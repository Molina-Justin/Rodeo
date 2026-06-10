from __future__ import annotations

from typing import Annotated, cast

from fastapi import (
    APIRouter,
    Depends,
    File,
    Header,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from fastapi import status as http_status
from sqlalchemy.orm import Session

from rodeo.config import Settings
from rodeo.db import get_db_session
from rodeo.models.base import utc_now
from rodeo.schemas.sessions import (
    FinalizePracticeSessionResponse,
    PracticeSessionCreate,
    PracticeSessionFinalize,
    PracticeSessionResponse,
)
from rodeo.services.attempts import IdempotencyConflictError, ProblemNotFoundError
from rodeo.services.recordings import RecordingUploadError, store_upload
from rodeo.services.sessions import (
    PracticeSessionNotFoundError,
    PracticeSessionStateError,
    attach_recording,
    create_session,
    discard_session,
    finalize_session,
    get_current_session,
    get_session,
    pause_session,
    resume_session,
    stop_session,
    to_response,
)

router = APIRouter(prefix="/practice-sessions", tags=["practice sessions"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]
IdempotencyKey = Annotated[
    str, Header(alias="Idempotency-Key", min_length=1, max_length=128)
]


def _settings(request: Request) -> Settings:
    return cast(Settings, request.app.state.settings)


def _error(error: Exception) -> None:
    if isinstance(error, (PracticeSessionNotFoundError, ProblemNotFoundError)):
        raise HTTPException(status_code=404, detail=str(error)) from error
    if isinstance(error, (PracticeSessionStateError, IdempotencyConflictError)):
        raise HTTPException(status_code=409, detail=str(error)) from error
    if isinstance(error, RecordingUploadError):
        raise HTTPException(status_code=422, detail=str(error)) from error
    raise error


@router.post(
    "", response_model=PracticeSessionResponse, status_code=http_status.HTTP_201_CREATED
)
def start(
    payload: PracticeSessionCreate, database: DatabaseSession
) -> PracticeSessionResponse:
    now = utc_now()
    try:
        practice_session = create_session(database, payload=payload, now=now)
        database.commit()
        return to_response(database, practice_session, now=now)
    except Exception as error:
        database.rollback()
        _error(error)
        raise


@router.get("/current", response_model=PracticeSessionResponse | None)
def current(database: DatabaseSession) -> PracticeSessionResponse | None:
    practice_session = get_current_session(database)
    return (
        None
        if practice_session is None
        else to_response(database, practice_session, now=utc_now())
    )


@router.post("/{session_id}/pause", response_model=PracticeSessionResponse)
def pause(session_id: str, database: DatabaseSession) -> PracticeSessionResponse:
    now = utc_now()
    try:
        practice_session = get_session(database, session_id)
        pause_session(practice_session, now=now)
        database.commit()
        return to_response(database, practice_session, now=now)
    except Exception as error:
        database.rollback()
        _error(error)
        raise


@router.post("/{session_id}/resume", response_model=PracticeSessionResponse)
def resume(session_id: str, database: DatabaseSession) -> PracticeSessionResponse:
    now = utc_now()
    try:
        practice_session = get_session(database, session_id)
        resume_session(practice_session, now=now)
        database.commit()
        return to_response(database, practice_session, now=now)
    except Exception as error:
        database.rollback()
        _error(error)
        raise


@router.post("/{session_id}/stop", response_model=PracticeSessionResponse)
async def stop(
    session_id: str,
    request: Request,
    database: DatabaseSession,
    audio: Annotated[UploadFile | None, File()] = None,
) -> PracticeSessionResponse:
    now = utc_now()
    try:
        practice_session = get_session(database, session_id)
        stop_session(practice_session, now=now)
        if audio is not None:
            stored = await store_upload(audio, settings=_settings(request))
            attach_recording(
                database,
                practice_session=practice_session,
                storage_key=stored[0],
                media_type=stored[1],
                byte_size=stored[2],
                duration_ms=stored[3],
                checksum_sha256=stored[4],
                original_filename=stored[5],
            )
        database.commit()
        return to_response(database, practice_session, now=now)
    except Exception as error:
        database.rollback()
        _error(error)
        raise


@router.post("/{session_id}/finalize", response_model=FinalizePracticeSessionResponse)
def finalize(
    session_id: str,
    payload: PracticeSessionFinalize,
    idempotency_key: IdempotencyKey,
    request: Request,
    response: Response,
    database: DatabaseSession,
) -> FinalizePracticeSessionResponse:
    now = utc_now()
    try:
        result = finalize_session(
            database,
            practice_session=get_session(database, session_id),
            payload=payload,
            idempotency_key=idempotency_key,
            now=now,
            timezone_name=_settings(request).timezone,
        )
        database.commit()
    except Exception as error:
        database.rollback()
        _error(error)
        raise
    if not result.created:
        response.status_code = http_status.HTTP_200_OK
    return result


@router.delete("/{session_id}", status_code=http_status.HTTP_204_NO_CONTENT)
def discard(session_id: str, database: DatabaseSession) -> Response:
    try:
        discard_session(
            database, practice_session=get_session(database, session_id), now=utc_now()
        )
        database.commit()
    except Exception as error:
        database.rollback()
        _error(error)
        raise
    return Response(status_code=http_status.HTTP_204_NO_CONTENT)
