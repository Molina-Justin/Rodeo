from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import inspect, text

from rodeo.config import Settings
from rodeo.db import get_engine
from rodeo.services.migrations import upgrade_database


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
