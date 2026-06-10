"""Server-owned practice-session clock and state transitions."""

from __future__ import annotations

from datetime import UTC, datetime
from math import ceil

from sqlalchemy import select
from sqlalchemy.orm import Session

from rodeo.models import Attempt, Job, JobStatus, PracticeSession, Problem, Recording
from rodeo.models.enums import PracticeSessionStatus
from rodeo.schemas.attempts import AttemptCreate
from rodeo.schemas.recordings import RecordingResponse
from rodeo.schemas.sessions import (
    FinalizePracticeSessionResponse,
    PracticeSessionCreate,
    PracticeSessionFinalize,
    PracticeSessionResponse,
)
from rodeo.services.attempts import (
    DELETE_RECORDING_JOB_KIND,
    ProblemNotFoundError,
    create_attempt,
)


class PracticeSessionError(RuntimeError):
    pass


class PracticeSessionNotFoundError(PracticeSessionError):
    pass


class PracticeSessionStateError(PracticeSessionError):
    pass


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def active_duration_ms(session: PracticeSession, *, now: datetime) -> int:
    total = session.accumulated_active_ms
    if session.running_since is not None:
        delta = _aware(now) - _aware(session.running_since)
        total += max(0, int(delta.total_seconds() * 1_000))
    return total


def _recording_response(recording: Recording | None) -> RecordingResponse | None:
    if recording is None:
        return None
    return RecordingResponse(
        id=recording.id,
        attempt_id=recording.attempt_id,
        practice_session_id=recording.practice_session_id,
        media_type=recording.media_type,
        byte_size=recording.byte_size,
        duration_ms=recording.duration_ms,
        checksum_sha256=recording.checksum_sha256,
        content_url=f"/api/v1/recordings/{recording.id}/content",
        created_at=_aware(recording.created_at),
        updated_at=_aware(recording.updated_at),
    )


def _recording_for(session: Session, session_id: str) -> Recording | None:
    return session.scalar(
        select(Recording).where(Recording.practice_session_id == session_id)
    )


def to_response(
    database: Session,
    practice_session: PracticeSession,
    *,
    now: datetime,
) -> PracticeSessionResponse:
    recording = _recording_for(database, practice_session.id)
    return PracticeSessionResponse(
        id=practice_session.id,
        problem_id=practice_session.problem_id,
        status=practice_session.status,
        started_at=_aware(practice_session.started_at),
        running_since=(
            _aware(practice_session.running_since)
            if practice_session.running_since is not None
            else None
        ),
        paused_at=(
            _aware(practice_session.paused_at)
            if practice_session.paused_at is not None
            else None
        ),
        stopped_at=(
            _aware(practice_session.stopped_at)
            if practice_session.stopped_at is not None
            else None
        ),
        finalized_at=(
            _aware(practice_session.finalized_at)
            if practice_session.finalized_at is not None
            else None
        ),
        active_duration_ms=active_duration_ms(practice_session, now=now),
        attempt_id=database.scalar(
            select(Attempt.id).where(Attempt.practice_session_id == practice_session.id)
        ),
        recording=_recording_response(recording),
        created_at=_aware(practice_session.created_at),
        updated_at=_aware(practice_session.updated_at),
    )


def create_session(
    database: Session,
    *,
    payload: PracticeSessionCreate,
    now: datetime,
) -> PracticeSession:
    if database.get(Problem, payload.problem_id) is None:
        raise ProblemNotFoundError(payload.problem_id)
    existing = database.scalar(
        select(PracticeSession.id).where(
            PracticeSession.status.in_(
                (
                    PracticeSessionStatus.ACTIVE,
                    PracticeSessionStatus.PAUSED,
                    PracticeSessionStatus.AWAITING_DETAILS,
                )
            )
        )
    )
    if existing is not None:
        raise PracticeSessionStateError("a practice session is already in progress")
    timestamp = _aware(now)
    practice_session = PracticeSession(
        problem_id=payload.problem_id,
        status=PracticeSessionStatus.ACTIVE,
        started_at=timestamp,
        running_since=timestamp,
    )
    database.add(practice_session)
    database.flush()
    return practice_session


def get_session(database: Session, session_id: str) -> PracticeSession:
    practice_session = database.get(PracticeSession, session_id)
    if practice_session is None:
        raise PracticeSessionNotFoundError(
            f"practice session {session_id!r} was not found"
        )
    return practice_session


def get_current_session(database: Session) -> PracticeSession | None:
    return database.scalar(
        select(PracticeSession)
        .where(
            PracticeSession.status.in_(
                (
                    PracticeSessionStatus.ACTIVE,
                    PracticeSessionStatus.PAUSED,
                    PracticeSessionStatus.AWAITING_DETAILS,
                )
            )
        )
        .order_by(PracticeSession.started_at.desc())
    )


def pause_session(practice_session: PracticeSession, *, now: datetime) -> None:
    if practice_session.status is not PracticeSessionStatus.ACTIVE:
        raise PracticeSessionStateError("only an active practice session can be paused")
    timestamp = _aware(now)
    practice_session.accumulated_active_ms = active_duration_ms(
        practice_session, now=timestamp
    )
    practice_session.running_since = None
    practice_session.paused_at = timestamp
    practice_session.status = PracticeSessionStatus.PAUSED


def resume_session(practice_session: PracticeSession, *, now: datetime) -> None:
    if practice_session.status is not PracticeSessionStatus.PAUSED:
        raise PracticeSessionStateError("only a paused practice session can be resumed")
    practice_session.running_since = _aware(now)
    practice_session.paused_at = None
    practice_session.status = PracticeSessionStatus.ACTIVE


def stop_session(practice_session: PracticeSession, *, now: datetime) -> None:
    if practice_session.status not in {
        PracticeSessionStatus.ACTIVE,
        PracticeSessionStatus.PAUSED,
    }:
        raise PracticeSessionStateError("practice session has already been stopped")
    timestamp = _aware(now)
    practice_session.accumulated_active_ms = active_duration_ms(
        practice_session, now=timestamp
    )
    practice_session.running_since = None
    practice_session.paused_at = None
    practice_session.stopped_at = timestamp
    practice_session.status = PracticeSessionStatus.AWAITING_DETAILS


def attach_recording(
    database: Session,
    *,
    practice_session: PracticeSession,
    storage_key: str,
    media_type: str,
    byte_size: int,
    duration_ms: int,
    checksum_sha256: str,
    original_filename: str | None,
) -> Recording:
    if practice_session.status is not PracticeSessionStatus.AWAITING_DETAILS:
        raise PracticeSessionStateError("recordings can only be attached after stop")
    if _recording_for(database, practice_session.id) is not None:
        raise PracticeSessionStateError("practice session already has a recording")
    recording = Recording(
        practice_session_id=practice_session.id,
        storage_key=storage_key,
        media_type=media_type,
        byte_size=byte_size,
        duration_ms=duration_ms,
        checksum_sha256=checksum_sha256,
        original_filename=original_filename,
    )
    database.add(recording)
    database.flush()
    return recording


def finalize_session(
    database: Session,
    *,
    practice_session: PracticeSession,
    payload: PracticeSessionFinalize,
    idempotency_key: str,
    now: datetime,
    timezone_name: str,
) -> FinalizePracticeSessionResponse:
    if practice_session.status not in {
        PracticeSessionStatus.AWAITING_DETAILS,
        PracticeSessionStatus.FINALIZED,
    }:
        raise PracticeSessionStateError(
            "practice session must be stopped before finalizing"
        )
    completed_at = practice_session.stopped_at or _aware(now)
    attempt_payload = AttemptCreate(
        completed_at=_aware(completed_at),
        duration_seconds=max(1, ceil(practice_session.accumulated_active_ms / 1_000)),
        outcome=payload.outcome,
        effort=payload.effort,
        blocker=payload.blocker,
        notes=payload.notes,
    )
    result = create_attempt(
        database,
        problem_id=practice_session.problem_id,
        payload=attempt_payload,
        idempotency_key=idempotency_key,
        now=now,
        timezone_name=timezone_name,
        practice_session_id=practice_session.id,
    )
    if practice_session.status is PracticeSessionStatus.AWAITING_DETAILS:
        practice_session.status = PracticeSessionStatus.FINALIZED
        practice_session.finalized_at = _aware(now)
        database.flush()
    return FinalizePracticeSessionResponse(
        session=to_response(database, practice_session, now=now),
        attempt=result.attempt,
        created=result.created,
    )


def discard_session(
    database: Session,
    *,
    practice_session: PracticeSession,
    now: datetime,
) -> None:
    if practice_session.status is PracticeSessionStatus.FINALIZED:
        raise PracticeSessionStateError(
            "a finalized practice session cannot be discarded"
        )
    recording = _recording_for(database, practice_session.id)
    if recording is not None:
        database.add(
            Job(
                kind=DELETE_RECORDING_JOB_KIND,
                status=JobStatus.QUEUED,
                payload={"storage_key": recording.storage_key},
                available_at=_aware(now),
            )
        )
    database.delete(practice_session)
