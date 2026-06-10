from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from fastapi import status as http_status
from sqlalchemy.orm import Session

from rodeo.config import Settings
from rodeo.db import get_db_session
from rodeo.models.base import utc_now
from rodeo.schemas.attempts import (
    AttemptCreate,
    AttemptListResponse,
    AttemptResponse,
    AttemptUpdate,
)
from rodeo.services.attempts import (
    AttemptNotFoundError,
    IdempotencyConflictError,
    ProblemNotFoundError,
    RecordingNotFoundError,
    create_attempt,
    delete_attempt,
    delete_attempt_recording,
    get_attempt,
    list_attempts,
    update_attempt,
)

router = APIRouter(tags=["attempts"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]
IdempotencyKey = Annotated[
    str,
    Header(alias="Idempotency-Key", min_length=1, max_length=128),
]


def _settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def _raise_http_error(error: Exception) -> None:
    if isinstance(
        error,
        (AttemptNotFoundError, ProblemNotFoundError, RecordingNotFoundError),
    ):
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    if isinstance(error, IdempotencyConflictError):
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    raise error


@router.get("/attempts", response_model=AttemptListResponse)
def read_attempts(
    session: DatabaseSession,
    problem_id: Annotated[int | None, Query(gt=0)] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> AttemptListResponse:
    return list_attempts(
        session,
        problem_id=problem_id,
        offset=offset,
        limit=limit,
    )


@router.get("/problems/{problem_id}/attempts", response_model=AttemptListResponse)
def read_problem_attempts(
    problem_id: int,
    session: DatabaseSession,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> AttemptListResponse:
    return list_attempts(
        session,
        problem_id=problem_id,
        offset=offset,
        limit=limit,
    )


@router.post(
    "/problems/{problem_id}/attempts",
    response_model=AttemptResponse,
    status_code=http_status.HTTP_201_CREATED,
)
def create_problem_attempt(
    problem_id: int,
    payload: AttemptCreate,
    idempotency_key: IdempotencyKey,
    session: DatabaseSession,
    request: Request,
    response: Response,
) -> AttemptResponse:
    settings = _settings(request)
    try:
        result = create_attempt(
            session,
            problem_id=problem_id,
            payload=payload,
            idempotency_key=idempotency_key,
            now=utc_now(),
            timezone_name=settings.timezone,
        )
        session.commit()
    except Exception as error:
        session.rollback()
        _raise_http_error(error)
        raise

    if not result.created:
        response.status_code = http_status.HTTP_200_OK
    return result.attempt


@router.get("/attempts/{attempt_id}", response_model=AttemptResponse)
def read_attempt(attempt_id: str, session: DatabaseSession) -> AttemptResponse:
    try:
        return get_attempt(session, attempt_id)
    except AttemptNotFoundError as error:
        _raise_http_error(error)
        raise


@router.patch("/attempts/{attempt_id}", response_model=AttemptResponse)
def patch_attempt(
    attempt_id: str,
    payload: AttemptUpdate,
    session: DatabaseSession,
    request: Request,
) -> AttemptResponse:
    settings = _settings(request)
    try:
        attempt = update_attempt(
            session,
            attempt_id=attempt_id,
            payload=payload,
            now=utc_now(),
            timezone_name=settings.timezone,
        )
        session.commit()
        return attempt
    except Exception as error:
        session.rollback()
        _raise_http_error(error)
        raise


@router.delete(
    "/attempts/{attempt_id}",
    status_code=http_status.HTTP_204_NO_CONTENT,
)
def remove_attempt(
    attempt_id: str,
    session: DatabaseSession,
    request: Request,
) -> Response:
    settings = _settings(request)
    try:
        delete_attempt(
            session,
            attempt_id=attempt_id,
            now=utc_now(),
            timezone_name=settings.timezone,
        )
        session.commit()
    except Exception as error:
        session.rollback()
        _raise_http_error(error)
        raise
    return Response(status_code=http_status.HTTP_204_NO_CONTENT)


@router.delete(
    "/attempts/{attempt_id}/recording",
    status_code=http_status.HTTP_204_NO_CONTENT,
)
def remove_attempt_recording(
    attempt_id: str,
    session: DatabaseSession,
    request: Request,
) -> Response:
    settings = _settings(request)
    try:
        delete_attempt_recording(
            session,
            attempt_id=attempt_id,
            now=utc_now(),
            timezone_name=settings.timezone,
        )
        session.commit()
    except Exception as error:
        session.rollback()
        _raise_http_error(error)
        raise
    return Response(status_code=http_status.HTTP_204_NO_CONTENT)
