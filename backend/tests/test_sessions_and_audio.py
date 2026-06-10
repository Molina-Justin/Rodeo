from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from rodeo.config import Settings
from rodeo.db import session_factory_for_url
from rodeo.models import Job, Problem, Recording, ReviewState, Transcription
from rodeo.models.enums import (
    AttemptBlocker,
    AttemptEffort,
    AttemptOutcome,
    Difficulty,
    JobStatus,
    TranscriptionStatus,
)
from rodeo.schemas.sessions import PracticeSessionCreate, PracticeSessionFinalize
from rodeo.services.attempts import DELETE_RECORDING_JOB_KIND
from rodeo.services.sessions import (
    active_duration_ms,
    create_session,
    finalize_session,
    pause_session,
    resume_session,
    stop_session,
)
from rodeo.services.transcriptions import TRANSCRIBE_JOB_KIND

ORIGIN_HEADERS = {"Origin": "http://testserver"}


def add_problem(database: Session) -> None:
    database.add(
        Problem(
            id=1,
            title="Two Sum",
            slug="two-sum",
            difficulty=Difficulty.EASY,
            premium=False,
            acceptance=55.0,
            active=True,
        )
    )
    database.flush()


def test_server_clock_excludes_paused_time_and_finalizes_idempotently(
    db_session: Session,
) -> None:
    add_problem(db_session)
    started_at = datetime(2026, 8, 29, 12, tzinfo=UTC)
    practice_session = create_session(
        db_session,
        payload=PracticeSessionCreate(problem_id=1),
        now=started_at,
    )
    pause_session(practice_session, now=started_at + timedelta(seconds=15))

    assert (
        active_duration_ms(practice_session, now=started_at + timedelta(hours=2))
        == 15_000
    )

    resume_session(practice_session, now=started_at + timedelta(hours=2))
    stop_session(practice_session, now=started_at + timedelta(hours=2, seconds=10))

    payload = PracticeSessionFinalize(
        outcome=AttemptOutcome.OPTIMAL,
        effort=AttemptEffort.MODERATE,
        blocker=AttemptBlocker.NONE,
        notes="Used a monotonic stack.",
    )
    first = finalize_session(
        db_session,
        practice_session=practice_session,
        payload=payload,
        idempotency_key="session-finalize-1",
        now=started_at + timedelta(hours=2, seconds=11),
        timezone_name="America/New_York",
    )
    second = finalize_session(
        db_session,
        practice_session=practice_session,
        payload=payload,
        idempotency_key="session-finalize-1",
        now=started_at + timedelta(hours=2, seconds=12),
        timezone_name="America/New_York",
    )

    assert first.created is True
    assert second.created is False
    assert first.attempt.id == second.attempt.id
    assert first.attempt.duration_seconds == 25
    assert first.session.status == "finalized"


def test_audio_upload_playback_transcription_and_deferred_delete(
    client: TestClient,
    settings: Settings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "rodeo.services.recordings.probe_duration_ms",
        lambda _path: 8_250,
    )
    started = client.post(
        "/api/v1/practice-sessions",
        json={"problem_id": 1},
        headers=ORIGIN_HEADERS,
    )
    assert started.status_code == 201
    session_id = started.json()["id"]

    stopped = client.post(
        f"/api/v1/practice-sessions/{session_id}/stop",
        headers=ORIGIN_HEADERS,
        files={"audio": ("attempt.webm", b"durable-audio", "audio/webm")},
    )
    assert stopped.status_code == 200
    recording = stopped.json()["recording"]
    assert recording["duration_ms"] == 8_250
    assert recording["byte_size"] == len(b"durable-audio")
    factory = session_factory_for_url(
        settings.resolved_database_url,
        settings.sqlite_busy_timeout_ms,
    )
    with factory() as database:
        recording_row = database.get(Recording, recording["id"])
        assert recording_row is not None
        storage_key = recording_row.storage_key

    finalized = client.post(
        f"/api/v1/practice-sessions/{session_id}/finalize",
        headers={**ORIGIN_HEADERS, "Idempotency-Key": "audio-finalize-1"},
        json={
            "outcome": "hint",
            "effort": "heavy",
            "blocker": "pattern",
            "notes": "Needs another pass.",
        },
    )
    assert finalized.status_code == 200
    attempt = finalized.json()["attempt"]
    assert attempt["has_audio"] is True
    attempt_id = attempt["id"]

    content = client.get(recording["content_url"])
    assert content.status_code == 200
    assert content.content == b"durable-audio"
    assert content.headers["content-type"].startswith("audio/webm")

    queued = client.post(
        f"/api/v1/attempts/{attempt_id}/transcription",
        headers=ORIGIN_HEADERS,
    )
    assert queued.status_code == 200
    assert queued.json()["status"] == "queued"

    deleted = client.delete(
        f"/api/v1/attempts/{attempt_id}/recording",
        headers=ORIGIN_HEADERS,
    )
    assert deleted.status_code == 204
    assert client.get(recording["content_url"]).status_code == 404

    with factory() as database:
        deletion_job = database.scalar(
            select(Job).where(Job.kind == DELETE_RECORDING_JOB_KIND)
        )
        assert deletion_job is not None
        assert deletion_job.payload == {"storage_key": storage_key}


def test_transcript_correction_refreshes_problem_artifact_flag(
    db_session: Session,
) -> None:
    add_problem(db_session)
    now = datetime(2026, 8, 29, 16, tzinfo=UTC)
    practice_session = create_session(
        db_session,
        payload=PracticeSessionCreate(problem_id=1),
        now=now,
    )
    stop_session(practice_session, now=now + timedelta(seconds=1))
    recording = Recording(
        practice_session_id=practice_session.id,
        storage_key="test.webm",
        media_type="audio/webm",
        byte_size=4,
        duration_ms=1_000,
        checksum_sha256="a" * 64,
    )
    db_session.add(recording)
    db_session.flush()
    finalized = finalize_session(
        db_session,
        practice_session=practice_session,
        payload=PracticeSessionFinalize(
            outcome=AttemptOutcome.OPTIMAL,
            effort=AttemptEffort.LIGHT,
        ),
        idempotency_key="transcript-finalize-1",
        now=now + timedelta(seconds=2),
        timezone_name="America/New_York",
    )
    transcription = Transcription(
        recording_id=recording.id,
        status=TranscriptionStatus.COMPLETED,
        raw_text="explanation",
    )
    db_session.add(transcription)
    db_session.flush()

    from rodeo.schemas.transcriptions import TranscriptionCorrection
    from rodeo.services.transcriptions import correct_transcription

    correct_transcription(
        db_session,
        attempt_id=finalized.attempt.id,
        payload=TranscriptionCorrection(corrected_text="clean explanation"),
        now=now + timedelta(seconds=3),
        timezone_name="America/New_York",
    )

    state = db_session.get(ReviewState, 1)
    assert state is not None
    assert state.has_transcript is True


def test_transcription_request_is_singleton_and_queues_one_job(
    db_session: Session,
) -> None:
    add_problem(db_session)
    now = datetime(2026, 8, 29, 16, tzinfo=UTC)
    practice_session = create_session(
        db_session,
        payload=PracticeSessionCreate(problem_id=1),
        now=now,
    )
    stop_session(practice_session, now=now + timedelta(seconds=1))
    recording = Recording(
        practice_session_id=practice_session.id,
        storage_key="singleton.webm",
        media_type="audio/webm",
        byte_size=4,
        duration_ms=1_000,
        checksum_sha256="b" * 64,
    )
    db_session.add(recording)
    db_session.flush()
    attempt = finalize_session(
        db_session,
        practice_session=practice_session,
        payload=PracticeSessionFinalize(
            outcome=AttemptOutcome.HINT,
            effort=AttemptEffort.MODERATE,
        ),
        idempotency_key="singleton-finalize-1",
        now=now + timedelta(seconds=2),
        timezone_name="America/New_York",
    ).attempt

    from rodeo.services.transcriptions import request_transcription

    first = request_transcription(db_session, attempt_id=attempt.id, now=now)
    second = request_transcription(db_session, attempt_id=attempt.id, now=now)

    assert first.id == second.id
    jobs = db_session.scalars(
        select(Job).where(
            Job.kind == TRANSCRIBE_JOB_KIND,
            Job.status == JobStatus.QUEUED,
        )
    ).all()
    assert len(jobs) == 1

    recording_row = db_session.scalar(
        select(Recording).where(Recording.attempt_id == attempt.id)
    )
    assert recording_row is not None
    db_session.delete(recording_row)
    db_session.flush()
    delete_jobs = db_session.scalars(
        select(Job).where(Job.kind == DELETE_RECORDING_JOB_KIND)
    ).all()
    assert delete_jobs == []
