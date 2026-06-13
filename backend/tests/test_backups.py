from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, text

from rodeo.config import Settings
from rodeo.db import dispose_database_engines
from rodeo.services.backups import (
    BackupValidationError,
    backup_filename,
    create_backup,
    existing_backups,
    latest_backup,
    prune_backups,
    run_backup,
    validate_backup,
)
from rodeo.services.migrations import upgrade_database
from rodeo.workers.backups import RETRY_DELAY, BackupScheduler

NOW = datetime(2026, 8, 30, 12, 30, 45, tzinfo=UTC)


@pytest.fixture
def migrated(settings: Settings) -> Iterator[Settings]:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    upgrade_database(settings.resolved_database_url)
    yield settings
    dispose_database_engines()


def test_backup_filename_is_utc_and_sorts_chronologically() -> None:
    earlier = backup_filename(NOW)
    later = backup_filename(NOW + timedelta(hours=1))
    assert earlier == "rodeo-20260830T123045Z.db"
    assert earlier < later


def test_create_backup_writes_a_readable_copy(migrated: Settings) -> None:
    target = create_backup(migrated, now=NOW)

    assert target == migrated.backups_dir / "rodeo-20260830T123045Z.db"
    assert target.is_file()

    engine = create_engine(f"sqlite+pysqlite:///{target}")
    with engine.connect() as connection:
        tables = set(
            connection.scalars(
                text("SELECT name FROM sqlite_master WHERE type = 'table'")
            )
        )
    engine.dispose()
    assert "alembic_version" in tables
    assert "attempt" in tables


def test_validate_backup_rejects_a_non_database_file(settings: Settings) -> None:
    settings.backups_dir.mkdir(parents=True)
    target = settings.backups_dir / backup_filename(NOW)
    target.write_text("not sqlite")

    with pytest.raises(BackupValidationError):
        validate_backup(target)


def test_backup_captures_rows_still_held_in_the_wal(migrated: Settings) -> None:
    """A plain file copy would miss these; VACUUM INTO must not."""
    engine = create_engine(migrated.resolved_database_url)
    with engine.begin() as connection:
        connection.exec_driver_sql("PRAGMA journal_mode=WAL")
        connection.exec_driver_sql("CREATE TABLE durability (marker TEXT NOT NULL)")
        connection.exec_driver_sql("INSERT INTO durability VALUES ('committed')")

    target = create_backup(migrated, now=NOW)
    engine.dispose()

    copied = create_engine(f"sqlite+pysqlite:///{target}")
    with copied.connect() as connection:
        markers = list(connection.scalars(text("SELECT marker FROM durability")))
    copied.dispose()
    assert markers == ["committed"]


def test_create_backup_is_idempotent_within_the_same_second(
    migrated: Settings,
) -> None:
    first = create_backup(migrated, now=NOW)
    second = create_backup(migrated, now=NOW)

    assert first == second
    assert len(existing_backups(migrated)) == 1


def test_prune_keeps_the_newest_within_retention(settings: Settings) -> None:
    settings.backup_retention = 3
    settings.backups_dir.mkdir(parents=True, exist_ok=True)
    written = [
        settings.backups_dir / backup_filename(NOW + timedelta(days=day))
        for day in range(5)
    ]
    for path in written:
        path.write_bytes(b"")

    (settings.backups_dir / "notes.txt").write_text("keep me")

    removed = prune_backups(settings)

    assert removed == written[:2]
    assert existing_backups(settings) == written[2:]
    assert (settings.backups_dir / "notes.txt").is_file()


def test_run_backup_is_a_no_op_when_disabled(migrated: Settings) -> None:
    migrated.backup_enabled = False

    assert run_backup(migrated, now=NOW) is None
    assert existing_backups(migrated) == []


def test_run_backup_writes_and_prunes(migrated: Settings) -> None:
    migrated.backup_retention = 2
    for day in range(4):
        run_backup(migrated, now=NOW + timedelta(days=day))

    names = [path.name for path in existing_backups(migrated)]
    assert names == [
        backup_filename(NOW + timedelta(days=2)),
        backup_filename(NOW + timedelta(days=3)),
    ]


def test_scheduler_runs_immediately_when_no_backup_exists(settings: Settings) -> None:
    scheduler = BackupScheduler(settings)

    assert scheduler.due_at(now=NOW) == NOW


def test_scheduler_defers_to_the_newest_backup_on_disk(migrated: Settings) -> None:
    migrated.backup_interval_hours = 24
    target = create_backup(migrated, now=NOW)
    written_at = datetime.fromtimestamp(Path(target).stat().st_mtime, UTC)

    due = BackupScheduler(migrated).due_at(now=NOW)

    assert due == written_at + timedelta(hours=24)
    assert due > datetime.now(UTC)


def test_latest_backup_returns_none_before_any_run(settings: Settings) -> None:
    assert latest_backup(settings) is None


def test_scheduler_retries_temporary_failure_after_ten_minutes(
    settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail_backup(_settings: Settings, *, now: datetime) -> Path | None:
        raise OSError("disk temporarily unavailable")

    monkeypatch.setattr("rodeo.workers.backups.run_backup", fail_backup)
    scheduler = BackupScheduler(settings)

    with pytest.raises(OSError, match="temporarily unavailable"):
        scheduler.run_now(now=NOW)

    assert scheduler.next_attempt() == NOW + RETRY_DELAY


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("backup_interval_hours", 0),
        ("backup_interval_hours", 8_761),
        ("backup_retention", 0),
        ("backup_retention", 366),
    ],
)
def test_unsafe_backup_configuration_is_rejected(field: str, value: int) -> None:
    with pytest.raises(ValidationError):
        Settings.model_validate({field: value})


def _seed_attempt(
    settings: Settings, attempt_id: str, problem_id: int, outcome: str, day: int
) -> None:
    import sqlite3

    connection = sqlite3.connect(settings.resolved_database_url.split("///", 1)[-1])
    connection.execute(
        "INSERT OR IGNORE INTO problem (id,title,slug,difficulty,premium,acceptance,"
        "active,created_at,updated_at) VALUES (?,?,?,'easy',0,0.5,1,'2026-08-01',"
        "'2026-08-01')",
        (problem_id, f"Problem {problem_id}", f"problem-{problem_id}"),
    )
    connection.execute(
        "INSERT INTO attempt (id,problem_id,completed_at,duration_seconds,outcome,"
        "effort,created_at,updated_at) VALUES (?,?,?,900,?,'moderate','2026-08-01',"
        "'2026-08-01')",
        (attempt_id, problem_id, f"2026-08-{day:02d} 12:00:00", outcome),
    )
    connection.commit()
    connection.close()


def test_snapshot_stats_counts_attempts_and_solved_problems(
    migrated: Settings,
) -> None:
    from rodeo.services.backups import snapshot_stats

    _seed_attempt(migrated, "a1", 1, "optimal", day=1)
    _seed_attempt(migrated, "a2", 2, "failed", day=1)

    _seed_attempt(migrated, "a3", 3, "optimal", day=1)
    _seed_attempt(migrated, "a4", 3, "failed", day=2)

    stats = snapshot_stats(create_backup(migrated, now=NOW))

    assert stats is not None
    assert stats["attempt_count"] == 4
    assert stats["solved_count"] == 1


def test_snapshot_stats_returns_none_for_an_unreadable_file(
    settings: Settings,
) -> None:
    from rodeo.services.backups import snapshot_stats

    settings.backups_dir.mkdir(parents=True, exist_ok=True)
    broken = settings.backups_dir / backup_filename(NOW)
    broken.write_bytes(b"not a database")

    assert snapshot_stats(broken) is None


def test_delete_backup_removes_only_the_named_snapshot(migrated: Settings) -> None:
    from rodeo.services.backups import delete_backup

    first = create_backup(migrated, now=NOW)
    second = create_backup(migrated, now=NOW + timedelta(days=1))

    delete_backup(migrated, first.name)

    assert existing_backups(migrated) == [second]


@pytest.mark.parametrize(
    "name", ["../rodeo.db", "/etc/passwd", "notes.txt", "rodeo-20200101T000000Z.db"]
)
def test_delete_backup_rejects_anything_it_did_not_write(
    migrated: Settings, name: str
) -> None:
    from rodeo.services.backups import BackupValidationError, delete_backup

    create_backup(migrated, now=NOW)

    with pytest.raises(BackupValidationError):
        delete_backup(migrated, name)
    assert len(existing_backups(migrated)) == 1
