import logging
from typing import Annotated, cast

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from rodeo.config import Settings
from rodeo.db import get_db_session
from rodeo.models.base import utc_now
from rodeo.schemas.system import (
    CapabilitiesResponse,
    ClearResponse,
    ExportResponse,
    HealthResponse,
    PromptTemplatesResponse,
    PromptTemplateUpdate,
    ReadinessResponse,
)
from rodeo.services.recordings import RecordingUploadError, recording_path
from rodeo.services.system import (
    PromptTemplateKey,
    check_readiness,
    clear_workspace_data,
    export_workspace,
    get_capabilities,
    get_prompt_templates,
    reset_prompt_template,
    update_prompt_template,
)

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
def restore_prompt_template(
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
