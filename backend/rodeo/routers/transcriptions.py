from __future__ import annotations

from typing import Annotated, cast

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from rodeo.config import Settings
from rodeo.db import get_db_session
from rodeo.models.base import utc_now
from rodeo.schemas.transcriptions import TranscriptionCorrection, TranscriptionResponse
from rodeo.services.transcriptions import (
    TranscriptionError,
    TranscriptionNotFoundError,
    correct_transcription,
    get_transcription,
    request_transcription,
    retry_transcription,
)

router = APIRouter(tags=["transcriptions"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]


def _error(error: Exception) -> None:
    if isinstance(error, TranscriptionNotFoundError):
        raise HTTPException(status_code=404, detail=str(error)) from error
    if isinstance(error, TranscriptionError):
        raise HTTPException(status_code=409, detail=str(error)) from error
    raise error


@router.post(
    "/attempts/{attempt_id}/transcription", response_model=TranscriptionResponse
)
def create(attempt_id: str, database: DatabaseSession) -> TranscriptionResponse:
    try:
        result = request_transcription(database, attempt_id=attempt_id, now=utc_now())
        database.commit()
        return result
    except Exception as error:
        database.rollback()
        _error(error)
        raise


@router.get(
    "/attempts/{attempt_id}/transcription", response_model=TranscriptionResponse
)
def read(attempt_id: str, database: DatabaseSession) -> TranscriptionResponse:
    try:
        return get_transcription(database, attempt_id=attempt_id)
    except Exception as error:
        _error(error)
        raise


@router.patch(
    "/attempts/{attempt_id}/transcription", response_model=TranscriptionResponse
)
def correct(
    attempt_id: str,
    payload: TranscriptionCorrection,
    request: Request,
    database: DatabaseSession,
) -> TranscriptionResponse:
    try:
        result = correct_transcription(
            database,
            attempt_id=attempt_id,
            payload=payload,
            now=utc_now(),
            timezone_name=cast(Settings, request.app.state.settings).timezone,
        )
        database.commit()
        return result
    except Exception as error:
        database.rollback()
        _error(error)
        raise


@router.post(
    "/attempts/{attempt_id}/transcription/retry", response_model=TranscriptionResponse
)
def retry(attempt_id: str, database: DatabaseSession) -> TranscriptionResponse:
    try:
        result = retry_transcription(database, attempt_id=attempt_id, now=utc_now())
        database.commit()
        return result
    except Exception as error:
        database.rollback()
        _error(error)
        raise
