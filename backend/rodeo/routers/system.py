import logging
import os
import signal
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, cast

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from rodeo.config import Settings
from rodeo.db import get_db_session
from rodeo.models.base import utc_now
from rodeo.schemas.system import (
    BackupFile,
    BackupFileListResponse,
    BackupStatusResponse,
    CapabilitiesResponse,
    ClearResponse,
    ExportResponse,
    HealthResponse,
    InterviewGoalsResponse,
    InterviewGoalsUpdate,
    PromptTemplatesResponse,
    PromptTemplateUpdate,
    ReadinessResponse,
    RestoreRequest,
    RestoreScheduledResponse,
)
from rodeo.services.backups import (
    BackupValidationError,
    delete_backup,
    existing_backups,
    snapshot_stats,
)
from rodeo.services.recordings import RecordingUploadError, recording_path
from rodeo.services.restore import RestoreError, stage_restore_request
from rodeo.services.system import (
    PromptTemplateKey,
    check_readiness,
    clear_workspace_data,
    export_workspace,
    get_capabilities,
    get_interview_goals,
    get_prompt_templates,
    reset_prompt_template,
    update_interview_goals,
    update_prompt_template,
)
from rodeo.workers.backups import BackupScheduler

router = APIRouter(tags=["system"])
logger = logging.getLogger(__name__)
DatabaseSession = Annotated[Session, Depends(get_db_session)]


def _settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def _prompt_template_key(template_key: str) -> PromptTemplateKey:
    if template_key not in {"session", "review"}:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Unknown template"
        )
    return cast(PromptTemplateKey, template_key)


@router.get("/health/live", response_model=HealthResponse)
def live() -> HealthResponse:
    return HealthResponse()


@router.get("/health/ready", response_model=ReadinessResponse)
def ready(request: Request) -> ReadinessResponse:
    try:
        return check_readiness(request.app.state.settings)
    except SQLAlchemyError as error:
        logger.exception("Database readiness check failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unavailable",
        ) from error


@router.get("/capabilities", response_model=CapabilitiesResponse)
def capabilities(request: Request) -> CapabilitiesResponse:
    return get_capabilities(request.app.state.settings)


def _backup_scheduler(request: Request) -> BackupScheduler:
    scheduler: BackupScheduler = request.app.state.backups
    return scheduler


def _backup_location(settings: Settings) -> str:
    # /data is the container path; users see the bind-mounted host directory.
    if settings.data_dir == Path("/data"):
        return "data/backups"
    return str(settings.backups_dir)


def _backup_status(request: Request) -> BackupStatusResponse:
    settings = _settings(request)
    backups = existing_backups(settings)
    newest = backups[-1] if backups else None
    return BackupStatusResponse(
        enabled=settings.backup_enabled,
        last_backup_at=(
            datetime.fromtimestamp(newest.stat().st_mtime, UTC) if newest else None
        ),
        next_backup_at=_backup_scheduler(request).next_attempt(),
        last_backup_filename=newest.name if newest else None,
        snapshot_count=len(backups),
        recordings_included=settings.backup_include_recordings,
        location=_backup_location(settings),
    )


@router.get("/system/backups", response_model=BackupStatusResponse)
def backup_status(request: Request) -> BackupStatusResponse:
    return _backup_status(request)


@router.post("/system/backups", response_model=BackupStatusResponse)
def backup_now(request: Request) -> BackupStatusResponse:
    settings = _settings(request)
    if not settings.backup_enabled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Backups are disabled"
        )
    try:
        _backup_scheduler(request).run_now()
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Backup failed; Rodeo will retry automatically",
        ) from error
    return _backup_status(request)


def _request_shutdown() -> None:
    """Ask uvicorn to stop after the response has been written.

    SIGTERM rather than a hard exit: the lifespan still runs, which closes the
    database cleanly and checkpoints the WAL before the restore reads it.
    """
    threading.Timer(0.5, lambda: os.kill(os.getpid(), signal.SIGTERM)).start()


@router.post(
    "/system/backups/restore",
    response_model=RestoreScheduledResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def restore_backup(
    payload: RestoreRequest, request: Request
) -> RestoreScheduledResponse:
    settings = _settings(request)
    try:
        stage_restore_request(settings, backup_name=payload.filename)
    except RestoreError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)
        ) from error

    # Outside the container nothing would bring the process back up, so the
    # request is staged and the person restarts Rodeo themselves.
    will_restart = settings.environment == "production"
    if will_restart:
        logger.info("Restarting to restore %s", payload.filename)
        _request_shutdown()
    return RestoreScheduledResponse(
        filename=payload.filename, will_restart=will_restart
    )


def _backup_catalogue(settings: Settings) -> BackupFileListResponse:
    files = []
    for path in reversed(existing_backups(settings)):
        stats = snapshot_stats(path)
        files.append(
            BackupFile(
                filename=path.name,
                size_bytes=path.stat().st_size,
                created_at=datetime.fromtimestamp(path.stat().st_mtime, UTC),
                attempt_count=stats["attempt_count"] if stats else None,
                solved_count=stats["solved_count"] if stats else None,
            )
        )
    recording_count = (
        sum(
            1
            for path in settings.backup_recordings_dir.iterdir()
            # Skip the dot-prefixed temporary files an in-flight copy leaves.
            if path.is_file() and not path.name.startswith(".")
        )
        if settings.backup_recordings_dir.is_dir()
        else 0
    )
    return BackupFileListResponse(
        location=_backup_location(settings),
        recording_count=recording_count,
        files=files,
    )


@router.get("/system/backups/files", response_model=BackupFileListResponse)
def backup_files(request: Request) -> BackupFileListResponse:
    return _backup_catalogue(_settings(request))


@router.delete(
    "/system/backups/files/{filename}", response_model=BackupFileListResponse
)
def remove_backup(filename: str, request: Request) -> BackupFileListResponse:
    settings = _settings(request)
    try:
        delete_backup(settings, filename)
    except BackupValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
        ) from error
    return _backup_catalogue(settings)


@router.get("/settings/prompt-templates", response_model=PromptTemplatesResponse)
def prompt_templates(session: DatabaseSession) -> PromptTemplatesResponse:
    return get_prompt_templates(session)


@router.put(
    "/settings/prompt-templates/{template_key}", response_model=PromptTemplatesResponse
)
def save_prompt_template(
    template_key: str,
    payload: PromptTemplateUpdate,
    session: DatabaseSession,
) -> PromptTemplatesResponse:
    try:
        result = update_prompt_template(
            session,
            template_key=_prompt_template_key(template_key),
            template=payload.template,
            now=utc_now(),
        )
        session.commit()
    except Exception:
        session.rollback()
        raise
    return result


@router.delete(
    "/settings/prompt-templates/{template_key}", response_model=PromptTemplatesResponse
)
def reset_saved_prompt_template(
    template_key: str, session: DatabaseSession
) -> PromptTemplatesResponse:
    try:
        result = reset_prompt_template(
            session, template_key=_prompt_template_key(template_key)
        )
        session.commit()
    except Exception:
        session.rollback()
        raise
    return result


@router.get("/settings/interview-goals", response_model=InterviewGoalsResponse)
def interview_goals(session: DatabaseSession) -> InterviewGoalsResponse:
    return get_interview_goals(session)


@router.put("/settings/interview-goals", response_model=InterviewGoalsResponse)
def save_interview_goals(
    payload: InterviewGoalsUpdate, session: DatabaseSession
) -> InterviewGoalsResponse:
    try:
        result = update_interview_goals(session, goals=payload, now=utc_now())
        session.commit()
    except Exception:
        session.rollback()
        raise
    return result


@router.get("/system/export", response_model=ExportResponse)
def export_data(session: DatabaseSession) -> ExportResponse:
    return export_workspace(session, now=utc_now())


@router.post("/system/clear", response_model=ClearResponse)
def clear_data(session: DatabaseSession, request: Request) -> ClearResponse:
    settings = _settings(request)
    try:
        result = clear_workspace_data(session)
        session.commit()
    except Exception:
        session.rollback()
        raise

    for storage_key in result.storage_keys:
        try:
            recording_path(settings, storage_key).unlink(missing_ok=True)
        except (RecordingUploadError, OSError):
            logger.warning(
                "Failed to remove recording file %s during clear", storage_key
            )

    return ClearResponse(
        attempts_deleted=result.attempts_deleted,
        practice_sessions_deleted=result.practice_sessions_deleted,
        recordings_deleted=len(result.storage_keys),
        settings_deleted=result.settings_deleted,
        cleared_at=utc_now(),
    )
