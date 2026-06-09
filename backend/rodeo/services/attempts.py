from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from rodeo.models import (
    Attempt,
    Job,
    JobStatus,
    Problem,
    ProblemStatus,
    Recording,
    ReviewState,
    Transcription,
    TranscriptionStatus,
)
from rodeo.schemas.attempts import (
    AttemptCreate,
    AttemptListResponse,
    AttemptResponse,
    AttemptUpdate,
)
from rodeo.services.scheduling import (
    ENGINE_VERSION,
    SchedulingAttempt,
    build_review_states,
)
from rodeo.services.scheduling import (
    AttemptOutcome as SchedulingOutcome,
)
from rodeo.services.scheduling import (
    ProblemStatus as SchedulingStatus,
)

DELETE_RECORDING_JOB_KIND = "delete-recording-file"


class AttemptServiceError(Exception):
    """Base class for expected attempt-domain errors."""


class AttemptNotFoundError(AttemptServiceError):
    def __init__(self, attempt_id: str) -> None:
        super().__init__(f"attempt {attempt_id!r} was not found")


class ProblemNotFoundError(AttemptServiceError):
    def __init__(self, problem_id: int) -> None:
        super().__init__(f"problem {problem_id} was not found")


class IdempotencyConflictError(AttemptServiceError):
    def __init__(self, idempotency_key: str) -> None:
        super().__init__(
            f"idempotency key {idempotency_key!r} was already used "
            "with a different payload"
        )


@dataclass(frozen=True, slots=True)
class CreateAttemptResult:
    attempt: AttemptResponse
    created: bool


def _as_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _payload_hash(
    *,
    problem_id: int,
    payload: AttemptCreate,
    practice_session_id: str | None,
) -> str:
    canonical_payload = {
        "blocker": payload.blocker.value,
        "completed_at": _as_aware_utc(payload.completed_at).isoformat(),
        "duration_seconds": payload.duration_seconds,
        "effort": payload.effort.value,
        "notes": payload.notes,
        "outcome": payload.outcome.value,
        "practice_session_id": practice_session_id,
        "problem_id": problem_id,
    }
    encoded = json.dumps(
        canonical_payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _attempt_view_statement() -> Select[tuple[Attempt, Recording, Transcription]]:
    return (
        select(Attempt, Recording, Transcription)
        .outerjoin(Recording, Recording.attempt_id == Attempt.id)
        .outerjoin(Transcription, Transcription.recording_id == Recording.id)
    )


def _has_transcript(transcription: Transcription | None) -> bool:
    if transcription is None:
        return False
    if transcription.status is not TranscriptionStatus.COMPLETED:
        return False
    return bool(
        (transcription.corrected_text or "").strip()
        or (transcription.raw_text or "").strip()
    )


def _to_response(
    attempt: Attempt,
    recording: Recording | None,
    transcription: Transcription | None,
) -> AttemptResponse:
    return AttemptResponse(
        id=attempt.id,
        problem_id=attempt.problem_id,
        practice_session_id=attempt.practice_session_id,
        completed_at=_as_aware_utc(attempt.completed_at),
        duration_seconds=attempt.duration_seconds,
        outcome=attempt.outcome,
        effort=attempt.effort,
        blocker=attempt.blocker,
        notes=attempt.notes,
        recording_id=recording.id if recording is not None else None,
        transcription_id=(transcription.id if transcription is not None else None),
        transcription_status=(
            transcription.status if transcription is not None else None
        ),
        has_audio=recording is not None,
        has_transcript=_has_transcript(transcription),
        created_at=_as_aware_utc(attempt.created_at),
        updated_at=_as_aware_utc(attempt.updated_at),
    )


def _find_attempt_row(
    session: Session,
    attempt_id: str,
) -> tuple[Attempt, Recording | None, Transcription | None] | None:
    row = session.execute(
        _attempt_view_statement().where(Attempt.id == attempt_id)
    ).one_or_none()
    if row is None:
        return None
    return row._tuple()


def get_attempt(session: Session, attempt_id: str) -> AttemptResponse:
    row = _find_attempt_row(session, attempt_id)
    if row is None:
        raise AttemptNotFoundError(attempt_id)
    return _to_response(*row)


def list_attempts(
    session: Session,
    *,
    problem_id: int | None = None,
    offset: int = 0,
    limit: int = 50,
) -> AttemptListResponse:
    filters = (Attempt.problem_id == problem_id,) if problem_id is not None else ()
    total = session.scalar(select(func.count()).select_from(Attempt).where(*filters))
    rows = session.execute(
        _attempt_view_statement()
        .where(*filters)
        .order_by(Attempt.completed_at.desc(), Attempt.created_at.desc(), Attempt.id)
        .offset(offset)
        .limit(limit)
    ).all()
    return AttemptListResponse(
        items=[_to_response(*row._tuple()) for row in rows],
        total=total or 0,
        offset=offset,
        limit=limit,
    )


def _idempotent_result(
    session: Session,
    *,
    idempotency_key: str,
    payload_hash: str,
) -> CreateAttemptResult | None:
    existing = session.scalar(
        select(Attempt).where(Attempt.idempotency_key == idempotency_key)
    )
    if existing is None:
        return None
    if existing.idempotency_payload_hash != payload_hash:
        raise IdempotencyConflictError(idempotency_key)
    return CreateAttemptResult(attempt=get_attempt(session, existing.id), created=False)


def create_attempt(
    session: Session,
    *,
    problem_id: int,
    payload: AttemptCreate,
    idempotency_key: str,
    now: datetime,
    timezone_name: str,
    practice_session_id: str | None = None,
) -> CreateAttemptResult:
    """Create one attempt and recompute its problem inside the caller transaction.

    Manual routes and practice-session finalization both use this entry point.
    The function flushes but deliberately does not commit so a session finalizer
    can atomically include its own state transition and recording attachment.
    """

    problem = session.get(Problem, problem_id)
    if problem is None:
        raise ProblemNotFoundError(problem_id)

    payload_hash = _payload_hash(
        problem_id=problem_id,
        payload=payload,
        practice_session_id=practice_session_id,
    )
    existing_result = _idempotent_result(
        session,
        idempotency_key=idempotency_key,
        payload_hash=payload_hash,
    )
    if existing_result is not None:
        return existing_result

    attempt = Attempt(
        problem_id=problem_id,
        practice_session_id=practice_session_id,
        idempotency_key=idempotency_key,
        idempotency_payload_hash=payload_hash,
        completed_at=_as_aware_utc(payload.completed_at),
        duration_seconds=payload.duration_seconds,
        outcome=payload.outcome,
        effort=payload.effort,
        blocker=payload.blocker,
        notes=payload.notes,
    )

    try:
        with session.begin_nested():
            session.add(attempt)
            session.flush()
    except IntegrityError:
        raced_result = _idempotent_result(
            session,
            idempotency_key=idempotency_key,
            payload_hash=payload_hash,
        )
        if raced_result is not None:
            return raced_result
        raise

    if practice_session_id is not None:
        recording = session.scalar(
            select(Recording).where(
                Recording.practice_session_id == practice_session_id
            )
        )
        if recording is not None:
            recording.attempt_id = attempt.id
            session.flush()

    recompute_problem_review_state(
        session,
        problem_id=problem_id,
        now=now,
        timezone_name=timezone_name,
    )
    return CreateAttemptResult(attempt=get_attempt(session, attempt.id), created=True)


def update_attempt(
    session: Session,
    *,
    attempt_id: str,
    payload: AttemptUpdate,
    now: datetime,
    timezone_name: str,
) -> AttemptResponse:
    attempt = session.get(Attempt, attempt_id)
    if attempt is None:
        raise AttemptNotFoundError(attempt_id)

    updates = payload.model_dump(exclude_unset=True)
    completed_at = updates.get("completed_at")
    if isinstance(completed_at, datetime):
        updates["completed_at"] = _as_aware_utc(completed_at)

    for field_name, value in updates.items():
        setattr(attempt, field_name, value)

    session.flush()
    recompute_problem_review_state(
        session,
        problem_id=attempt.problem_id,
        now=now,
        timezone_name=timezone_name,
    )
    return get_attempt(session, attempt.id)


def delete_attempt(
    session: Session,
    *,
    attempt_id: str,
    now: datetime,
    timezone_name: str,
) -> None:
    attempt = session.get(Attempt, attempt_id)
    if attempt is None:
        raise AttemptNotFoundError(attempt_id)

    problem_id = attempt.problem_id
    recording = session.scalar(
        select(Recording).where(Recording.attempt_id == attempt_id)
    )
    if recording is not None:
        session.add(
            Job(
                kind=DELETE_RECORDING_JOB_KIND,
                status=JobStatus.QUEUED,
                payload={"storage_key": recording.storage_key},
                available_at=_as_aware_utc(now),
            )
        )
        session.delete(recording)

    session.delete(attempt)
    session.flush()
    recompute_problem_review_state(
        session,
        problem_id=problem_id,
        now=now,
        timezone_name=timezone_name,
    )


def _history_rows(
    session: Session,
    problem_id: int,
) -> list[tuple[Attempt, Recording | None, Transcription | None]]:
    rows = session.execute(
        _attempt_view_statement()
        .where(Attempt.problem_id == problem_id)
        .order_by(Attempt.completed_at, Attempt.created_at, Attempt.id)
    ).all()
    return [row._tuple() for row in rows]


def _due_at(
    completed_at: datetime,
    interval_days: int,
    timezone_name: str,
) -> datetime:
    app_timezone = ZoneInfo(timezone_name)
    due_date = _as_aware_utc(completed_at).astimezone(app_timezone).date() + timedelta(
        days=interval_days
    )
    return datetime.combine(due_date, time.min, tzinfo=app_timezone).astimezone(UTC)


def recompute_problem_review_state(
    session: Session,
    *,
    problem_id: int,
    now: datetime,
    timezone_name: str,
) -> ReviewState:
    """Replay one problem's complete history into its denormalized review row."""

    history = _history_rows(session, problem_id)
    review_state = session.get(ReviewState, problem_id)
    if review_state is None:
        review_state = ReviewState(
            problem_id=problem_id,
            engine_version=ENGINE_VERSION,
        )
        session.add(review_state)

    if not history:
        review_state.status = ProblemStatus.NOT_STARTED
        review_state.attempt_count = 0
        review_state.last_attempt_id = None
        review_state.best_duration_seconds = None
        review_state.interval_days = 0
        review_state.lapses = 0
        review_state.confidence = 0
        review_state.due_at = None
        review_state.has_notes = False
        review_state.has_audio = False
        review_state.has_transcript = False
        review_state.engine_version = ENGINE_VERSION
        session.flush()
        return review_state

    scheduling_attempts = [
        SchedulingAttempt(
            problem_id=attempt.problem_id,
            completed_at=_as_aware_utc(attempt.completed_at),
            outcome=SchedulingOutcome(attempt.outcome.value),
            attempt_id=attempt.id,
        )
        for attempt, _, _ in history
    ]
    [derived] = build_review_states(
        scheduling_attempts,
        now=_as_aware_utc(now),
        timezone_name=timezone_name,
    )
    latest_attempt = derived.last_attempt

    review_state.status = ProblemStatus(SchedulingStatus(derived.status).value)
    review_state.attempt_count = derived.attempt_count
    review_state.last_attempt_id = str(latest_attempt.attempt_id)
    review_state.best_duration_seconds = min(
        attempt.duration_seconds for attempt, _, _ in history
    )
    review_state.interval_days = derived.interval_days
    review_state.lapses = derived.lapses
    review_state.confidence = derived.confidence
    review_state.due_at = _due_at(
        latest_attempt.completed_at,
        derived.interval_days,
        timezone_name,
    )
    review_state.has_notes = any(
        bool(attempt.notes.strip()) for attempt, _, _ in history
    )
    review_state.has_audio = any(recording is not None for _, recording, _ in history)
    review_state.has_transcript = any(
        _has_transcript(transcription) for _, _, transcription in history
    )
    review_state.engine_version = ENGINE_VERSION
    session.flush()
    return review_state


def rebuild_review_states_if_engine_changed(
    session: Session,
    *,
    now: datetime,
    timezone_name: str,
) -> int:
    """Rebuild every problem row when any cached engine version is stale."""

    has_stale_state = session.scalar(
        select(func.count())
        .select_from(ReviewState)
        .where(ReviewState.engine_version != ENGINE_VERSION)
    )
    if not has_stale_state:
        return 0

    problem_ids = session.scalars(select(Problem.id).order_by(Problem.id)).all()
    for problem_id in problem_ids:
        recompute_problem_review_state(
            session,
            problem_id=problem_id,
            now=now,
            timezone_name=timezone_name,
        )
    return len(problem_ids)
