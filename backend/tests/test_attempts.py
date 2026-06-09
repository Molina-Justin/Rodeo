from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from rodeo.models import (
    Attempt,
    AttemptEffort,
    AttemptOutcome,
    Base,
    Difficulty,
    Job,
    Problem,
    ProblemStatus,
    Recording,
    ReviewState,
    Transcription,
    TranscriptionStatus,
)
from rodeo.schemas.attempts import AttemptCreate, AttemptUpdate
from rodeo.services.attempts import (
    DELETE_RECORDING_JOB_KIND,
    IdempotencyConflictError,
    create_attempt,
    delete_attempt,
    rebuild_review_states_if_engine_changed,
    recompute_problem_review_state,
    update_attempt,
)
from rodeo.services.scheduling import ENGINE_VERSION

NOW = datetime(2026, 8, 29, 12, tzinfo=UTC)
TIMEZONE = "America/New_York"


@pytest.fixture
def db_session() -> Session:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as session:
        yield session
    engine.dispose()


def add_problem(session: Session, problem_id: int = 1) -> Problem:
    problem = Problem(
        id=problem_id,
        title=f"Problem {problem_id}",
        slug=f"problem-{problem_id}",
        difficulty=Difficulty.MEDIUM,
        premium=False,
        acceptance=50.0,
        active=True,
    )
    session.add(problem)
    session.flush()
    return problem


def attempt_payload(
    *,
    completed_at: datetime = datetime(2026, 8, 20, 14, tzinfo=UTC),
    duration_seconds: int = 600,
    outcome: AttemptOutcome = AttemptOutcome.OPTIMAL,
    notes: str = "Used a monotonic stack.",
) -> AttemptCreate:
    return AttemptCreate(
        completed_at=completed_at,
        duration_seconds=duration_seconds,
        outcome=outcome,
        effort=AttemptEffort.MODERATE,
        notes=notes,
    )


def test_create_is_idempotent_and_populates_review_state(
    db_session: Session,
) -> None:
    add_problem(db_session)
    payload = attempt_payload()

    first = create_attempt(
        db_session,
        problem_id=1,
        payload=payload,
        idempotency_key="manual-create-1",
        now=NOW,
        timezone_name=TIMEZONE,
    )
    replay = create_attempt(
        db_session,
        problem_id=1,
        payload=payload,
        idempotency_key="manual-create-1",
        now=NOW,
        timezone_name=TIMEZONE,
    )

    assert first.created is True
    assert replay.created is False
    assert replay.attempt.id == first.attempt.id
    assert len(db_session.scalars(select(Attempt)).all()) == 1

    review = db_session.get(ReviewState, 1)
    assert review is not None
    assert review.status is ProblemStatus.SOLVED
    assert review.attempt_count == 1
    assert review.last_attempt_id == first.attempt.id
    assert review.best_duration_seconds == 600
    assert review.interval_days == 3
    assert review.lapses == 0
    assert review.confidence == 4
    assert review.due_at is not None
    assert review.due_at.replace(tzinfo=UTC) == datetime(
        2026, 8, 23, 4, tzinfo=UTC
    )
    assert review.has_notes is True
    assert review.has_audio is False
    assert review.has_transcript is False
    assert review.engine_version == ENGINE_VERSION


def test_idempotency_key_rejects_a_different_payload(db_session: Session) -> None:
    add_problem(db_session)
    create_attempt(
        db_session,
        problem_id=1,
        payload=attempt_payload(),
        idempotency_key="manual-create-1",
        now=NOW,
        timezone_name=TIMEZONE,
    )

    with pytest.raises(IdempotencyConflictError):
        create_attempt(
            db_session,
            problem_id=1,
            payload=attempt_payload(duration_seconds=601),
            idempotency_key="manual-create-1",
            now=NOW,
            timezone_name=TIMEZONE,
        )


def test_update_replays_reordered_history_and_delete_resets_state(
    db_session: Session,
) -> None:
    add_problem(db_session)
    older = create_attempt(
        db_session,
        problem_id=1,
        payload=attempt_payload(
            completed_at=datetime(2026, 8, 20, tzinfo=UTC),
            duration_seconds=900,
            outcome=AttemptOutcome.FAILED,
        ),
        idempotency_key="older",
        now=NOW,
        timezone_name=TIMEZONE,
    ).attempt
    newer = create_attempt(
        db_session,
        problem_id=1,
        payload=attempt_payload(
            completed_at=datetime(2026, 8, 21, tzinfo=UTC),
            duration_seconds=500,
            outcome=AttemptOutcome.OPTIMAL,
        ),
        idempotency_key="newer",
        now=NOW,
        timezone_name=TIMEZONE,
    ).attempt

    update_attempt(
        db_session,
        attempt_id=older.id,
        payload=AttemptUpdate(
            completed_at=datetime(2026, 8, 22, tzinfo=UTC),
            outcome=AttemptOutcome.FAILED,
        ),
        now=NOW,
        timezone_name=TIMEZONE,
    )

    review = db_session.get(ReviewState, 1)
    assert review is not None
    assert review.last_attempt_id == older.id
    assert review.status is ProblemStatus.STRUGGLING
    assert review.interval_days == 1
    assert review.lapses == 1
    assert review.best_duration_seconds == 500

    delete_attempt(
        db_session,
        attempt_id=older.id,
        now=NOW,
        timezone_name=TIMEZONE,
    )
    assert review.last_attempt_id == newer.id
    assert review.attempt_count == 1
    assert review.status is ProblemStatus.SOLVED

    delete_attempt(
        db_session,
        attempt_id=newer.id,
        now=NOW,
        timezone_name=TIMEZONE,
    )
    assert review.status is ProblemStatus.NOT_STARTED
    assert review.attempt_count == 0
    assert review.last_attempt_id is None
    assert review.best_duration_seconds is None
    assert review.due_at is None


def test_recording_and_transcript_flags_and_deferred_file_delete(
    db_session: Session,
) -> None:
    add_problem(db_session)
    attempt = create_attempt(
        db_session,
        problem_id=1,
        payload=attempt_payload(notes=""),
        idempotency_key="with-audio",
        now=NOW,
        timezone_name=TIMEZONE,
    ).attempt
    recording = Recording(
        attempt_id=attempt.id,
        storage_key="ab/recording.webm",
        original_filename="recording.webm",
        media_type="audio/webm",
        byte_size=100,
        duration_ms=5_000,
        checksum_sha256="a" * 64,
    )
    db_session.add(recording)
    db_session.flush()
    db_session.add(
        Transcription(
            recording_id=recording.id,
            status=TranscriptionStatus.COMPLETED,
            raw_text="I used a stack.",
            segments=[],
        )
    )
    db_session.flush()

    recompute_problem_review_state(
        db_session,
        problem_id=1,
        now=NOW,
        timezone_name=TIMEZONE,
    )
    review = db_session.get(ReviewState, 1)
    assert review is not None
    assert review.has_audio is True
    assert review.has_transcript is True

    delete_attempt(
        db_session,
        attempt_id=attempt.id,
        now=NOW,
        timezone_name=TIMEZONE,
    )

    job = db_session.scalar(select(Job))
    assert job is not None
    assert job.kind == DELETE_RECORDING_JOB_KIND
    assert job.payload == {"storage_key": "ab/recording.webm"}
    assert db_session.get(Recording, recording.id) is None


def test_engine_version_change_rebuilds_every_problem(db_session: Session) -> None:
    add_problem(db_session, 1)
    add_problem(db_session, 2)
    create_attempt(
        db_session,
        problem_id=1,
        payload=attempt_payload(),
        idempotency_key="problem-1",
        now=NOW,
        timezone_name=TIMEZONE,
    )
    stale = db_session.get(ReviewState, 1)
    assert stale is not None
    stale.engine_version = "old"
    db_session.flush()

    rebuilt = rebuild_review_states_if_engine_changed(
        db_session,
        now=NOW,
        timezone_name=TIMEZONE,
    )

    assert rebuilt == 2
    first = db_session.get(ReviewState, 1)
    second = db_session.get(ReviewState, 2)
    assert first is not None and first.engine_version == ENGINE_VERSION
    assert second is not None and second.engine_version == ENGINE_VERSION
    assert second.status is ProblemStatus.NOT_STARTED
