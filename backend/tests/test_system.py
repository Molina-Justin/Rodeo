from datetime import UTC, datetime
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from rodeo.config import Settings
from rodeo.db import get_engine
from rodeo.models import (
    AppSetting,
    Attempt,
    Job,
    PracticeSession,
    Problem,
    Recording,
    ReviewState,
)
from rodeo.schemas.attempts import AttemptCreate
from rodeo.services.attempts import create_attempt
from rodeo.services.migrations import upgrade_database
from rodeo.services.recordings import recording_path

ORIGIN_HEADERS = {"Origin": "http://testserver"}


def test_liveness(client: TestClient) -> None:
    response = client.get("/api/v1/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_checks_database(client: TestClient) -> None:
    response = client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "database": "ready"}


def test_capabilities_do_not_claim_uninstalled_features(
    client: TestClient,
) -> None:
    response = client.get("/api/v1/capabilities")

    assert response.status_code == 200
    assert response.json() == {
        "transcription": {
            "enabled": True,
            "available": False,
            "model": "base.en",
        },
        "ai": {"provider": "anthropic", "available": False},
    }


def test_rejects_unknown_origin(client: TestClient) -> None:
    response = client.post(
        "/api/v1/practice-sessions",
        headers={"Origin": "https://example.com"},
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Origin is not allowed"}


def test_unsafe_request_requires_origin(client: TestClient) -> None:
    response = client.post("/api/v1/practice-sessions")

    assert response.status_code == 403
    assert response.json() == {"detail": "Origin header is required"}


def test_allowed_origin_reaches_router(client: TestClient) -> None:
    response = client.post(
        "/api/v1/practice-sessions",
        headers={"Origin": "http://testserver"},
    )

    assert response.status_code == 422


def test_static_files_and_spa_fallback(
    settings: Settings,
    tmp_path: Path,
) -> None:
    static_dir = tmp_path / "static"
    static_dir.mkdir()
    (static_dir / "index.html").write_text("<main>Rodeo</main>", encoding="utf-8")
    (static_dir / "asset.txt").write_text("asset", encoding="utf-8")
    static_settings = settings.model_copy(update={"static_dir": static_dir})

    from rodeo.main import create_app

    with TestClient(create_app(static_settings)) as static_client:
        assert static_client.get("/asset.txt").text == "asset"
        assert static_client.get("/problems/1").text == "<main>Rodeo</main>"
        assert static_client.get("/api/v1/missing").status_code == 404


def test_migration_creates_schema_and_sqlite_pragmas(
    settings: Settings,
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "migrated.db"
    database_url = f"sqlite+pysqlite:///{database_path}"
    upgrade_database(database_url)

    migration_settings = settings.model_copy(update={"database_url": database_url})
    engine = get_engine(migration_settings)
    expected_tables = {
        "ai_artifact",
        "alembic_version",
        "app_settings",
        "attempt",
        "catalog_sync",
        "job",
        "practice_session",
        "problem",
        "problem_topic",
        "recording",
        "review_state",
        "topic",
        "transcription",
    }

    assert set(inspect(engine).get_table_names()) == expected_tables
    with engine.connect() as connection:
        assert connection.execute(text("PRAGMA foreign_keys")).scalar_one() == 1
        assert connection.execute(text("PRAGMA journal_mode")).scalar_one() == "wal"
        assert (
            connection.execute(text("PRAGMA busy_timeout")).scalar_one()
            == settings.sqlite_busy_timeout_ms
        )


def _seed_attempt_with_recording(
    db_session: Session,
    settings: Settings,
) -> tuple[Attempt, Recording]:
    problem = db_session.scalars(select(Problem)).first()
    assert problem is not None

    result = create_attempt(
        db_session,
        problem_id=problem.id,
        payload=AttemptCreate(
            completed_at=datetime(2026, 8, 20, 14, tzinfo=UTC),
            duration_seconds=600,
            outcome="optimal",
            effort="moderate",
            notes="Used a monotonic stack.",
        ),
        idempotency_key="system-test-1",
        now=datetime(2026, 8, 20, 14, tzinfo=UTC),
        timezone_name="America/New_York",
    )
    attempt = result.attempt

    storage_key = "system-test-recording.webm"
    recording_path(settings, storage_key).write_bytes(b"durable-audio")
    db_session.add(
        Recording(
            attempt_id=attempt.id,
            storage_key=storage_key,
            media_type="audio/webm",
            byte_size=13,
            duration_ms=1_000,
            checksum_sha256="0" * 64,
        )
    )
    db_session.commit()
    recording = db_session.scalar(
        select(Recording).where(Recording.storage_key == storage_key)
    )
    assert recording is not None
    stored_attempt = db_session.get(Attempt, attempt.id)
    assert stored_attempt is not None
    return stored_attempt, recording


def test_export_includes_attempts_with_transcript_and_review_state(
    client: TestClient,
    db_session: Session,
    settings: Settings,
) -> None:
    _seed_attempt_with_recording(db_session, settings)

    response = client.get("/api/v1/system/export")

    assert response.status_code == 200
    body = response.json()
    assert len(body["attempts"]) == 1
    exported = body["attempts"][0]
    assert exported["notes"] == "Used a monotonic stack."
    assert exported["duration_seconds"] == 600
    assert len(body["review_state"]) == 1
    assert body["review_state"][0]["attempt_count"] == 1
    assert (
        "Pick {{problem_count}} problems"
        in body["prompt_templates"]["session_template"]
    )


def test_prompt_templates_can_be_saved_and_reset(client: TestClient) -> None:
    initial = client.get("/api/v1/settings/prompt-templates")

    assert initial.status_code == 200
    assert "{{topic}}" in initial.json()["session_template"]

    saved = client.put(
        "/api/v1/settings/prompt-templates/session",
        headers=ORIGIN_HEADERS,
        json={"template": "Plan {{minutes}} minutes for {{topic}}."},
    )

    assert saved.status_code == 200
    assert saved.json()["session_template"] == "Plan {{minutes}} minutes for {{topic}}."

    reset = client.delete(
        "/api/v1/settings/prompt-templates/session", headers=ORIGIN_HEADERS
    )

    assert reset.status_code == 200
    assert "Pick {{problem_count}} problems" in reset.json()["session_template"]


def test_clear_deletes_user_data_and_recording_files_but_keeps_catalog(
    client: TestClient,
    db_session: Session,
    settings: Settings,
) -> None:
    _seed_attempt_with_recording(db_session, settings)
    db_session.add(
        AppSetting(
            key="prompt_template.session",
            value="Custom template",
            updated_at=datetime(2026, 8, 20, 14, tzinfo=UTC),
        )
    )
    db_session.commit()
    storage_path = recording_path(settings, "system-test-recording.webm")
    assert storage_path.exists()
    catalog_size_before = len(db_session.scalars(select(Problem)).all())

    response = client.post("/api/v1/system/clear", headers=ORIGIN_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["attempts_deleted"] == 1
    assert body["practice_sessions_deleted"] == 0
    assert body["recordings_deleted"] == 1
    assert body["settings_deleted"] == 1
    assert not storage_path.exists()

    db_session.expire_all()
    assert db_session.scalars(select(Attempt)).all() == []
    assert db_session.scalars(select(Recording)).all() == []
    assert db_session.scalars(select(ReviewState)).all() == []
    assert db_session.scalars(select(PracticeSession)).all() == []
    assert db_session.scalars(select(Job)).all() == []
    assert db_session.scalars(select(AppSetting)).all() == []
    assert len(db_session.scalars(select(Problem)).all()) == catalog_size_before
