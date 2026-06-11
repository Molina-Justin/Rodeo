from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import func, select

from rodeo.config import Settings
from rodeo.db import dispose_database_engines, session_factory_for_url
from rodeo.main import prepare_storage
from rodeo.models import AppSetting, Attempt, PracticeSession, ReviewState
from rodeo.schemas.attempts import AttemptCreate
from rodeo.services.attempts import create_attempt
from rodeo.services.backups import run_backup
from rodeo.services.catalog import seed_catalog
from rodeo.services.demo_data import DemoDataError, seed_demo_data
from rodeo.services.fingerprints import fingerprint_workspace
from rodeo.services.migrations import upgrade_database
from rodeo.services.restore import restore_database
from rodeo.services.system import clear_workspace_data

NOW = datetime(2026, 8, 30, 16, 0, tzinfo=UTC)


@pytest.fixture
def demo_workspace(tmp_path: Path) -> Iterator[Settings]:
    settings = Settings(
        environment="test",
        data_dir=tmp_path / "data",
        bundled_models_dir=tmp_path / "bundled-models",
        transcription_enabled=False,
    )
    prepare_storage(settings)
    upgrade_database(settings.resolved_database_url)
    factory = session_factory_for_url(
        settings.resolved_database_url,
        settings.sqlite_busy_timeout_ms,
    )
    with factory.begin() as session:
        seed_catalog(session)
    yield settings
    dispose_database_engines()


def _seed(settings: Settings) -> None:
    factory = session_factory_for_url(
        settings.resolved_database_url,
        settings.sqlite_busy_timeout_ms,
    )
    with factory.begin() as session:
        summary = seed_demo_data(
            session,
            now=NOW,
            timezone_name=settings.timezone,
        )

    assert summary.attempts >= 25
    assert summary.problems_practiced >= 15
    assert summary.practice_sessions >= 5
    assert summary.settings == 2


def test_demo_data_populates_a_meaningful_workspace(
    demo_workspace: Settings,
) -> None:
    _seed(demo_workspace)
    factory = session_factory_for_url(
        demo_workspace.resolved_database_url,
        demo_workspace.sqlite_busy_timeout_ms,
    )
    with factory() as session:
        assert (session.scalar(select(func.count()).select_from(Attempt)) or 0) >= 25
        assert (
            session.scalar(select(func.count()).select_from(PracticeSession)) or 0
        ) >= 5
        assert (
            session.scalar(select(func.count()).select_from(ReviewState)) or 0
        ) >= 15
        assert session.scalar(select(func.count()).select_from(AppSetting)) == 2
        assert set(session.scalars(select(Attempt.outcome))) >= {
            "optimal",
            "hint",
            "solution",
            "failed",
        }


def test_demo_data_refuses_to_mix_with_existing_workspace_data(
    demo_workspace: Settings,
) -> None:
    _seed(demo_workspace)
    factory = session_factory_for_url(
        demo_workspace.resolved_database_url,
        demo_workspace.sqlite_busy_timeout_ms,
    )

    with (
        pytest.raises(DemoDataError, match="only added to an empty workspace"),
        factory.begin() as session,
    ):
        seed_demo_data(
            session,
            now=NOW,
            timezone_name=demo_workspace.timezone,
        )


def test_populate_backup_mutate_restore_returns_to_exact_logical_state(
    demo_workspace: Settings,
) -> None:
    _seed(demo_workspace)
    before = fingerprint_workspace(demo_workspace)
    snapshot = run_backup(demo_workspace, now=NOW + timedelta(seconds=1))
    assert snapshot is not None

    factory = session_factory_for_url(
        demo_workspace.resolved_database_url,
        demo_workspace.sqlite_busy_timeout_ms,
    )
    with factory.begin() as session:
        clear_workspace_data(session)
        create_attempt(
            session,
            problem_id=7,
            payload=AttemptCreate(
                completed_at=NOW + timedelta(days=1),
                duration_seconds=2_400,
                outcome="failed",
                effort="brutal",
                blocker="debugging",
                notes="This attempt exists only after the backup.",
            ),
            idempotency_key="post-backup-mutation",
            now=NOW + timedelta(days=1),
            timezone_name=demo_workspace.timezone,
        )
    assert fingerprint_workspace(demo_workspace).sha256 != before.sha256

    # The Settings flow stops the process before startup applies the staged restore.
    dispose_database_engines()
    restore_database(
        demo_workspace,
        backup_name=snapshot.name,
        now=NOW + timedelta(days=2),
    )

    after = fingerprint_workspace(demo_workspace)
    assert after == before
