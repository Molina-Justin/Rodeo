import sqlite3
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from rodeo.config import Settings
from rodeo.db import dispose_database_engines
from rodeo.services.backups import create_backup
from rodeo.services.migrations import upgrade_database
from rodeo.services.restore import (
    RestoreError,
    existing_pre_restore_copies,
    preserve_current_database,
    restore_database,
    restore_recordings,
)

NOW = datetime(2026, 8, 30, 12, 0, 0, tzinfo=UTC)


@pytest.fixture
def workspace(tmp_path: Path) -> Iterator[Settings]:
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True)
    settings = Settings(
        environment="test",
        data_dir=data_dir,
        database_url=f"sqlite+pysqlite:///{data_dir / 'rodeo.db'}",
        bundled_models_dir=tmp_path / "bundled-models",
    )
    upgrade_database(settings.resolved_database_url)
    yield settings
    dispose_database_engines()


def live_path(settings: Settings) -> Path:
    return settings.data_dir / "rodeo.db"


def add_attempt_marker(settings: Settings, note: str, *, leave_in_wal: bool) -> None:
    """Write a committed row, optionally leaving it in an unclosed WAL."""
    connection = sqlite3.connect(live_path(settings))
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("CREATE TABLE IF NOT EXISTS marker (note TEXT)")
    connection.execute("INSERT INTO marker VALUES (?)", (note,))
    connection.commit()
    if leave_in_wal:
        return
    connection.close()


def insert_recording(
    connection: sqlite3.Connection,
    recording_id: str,
    storage_key: str,
    *,
    byte_size: int,
) -> None:
    connection.execute(
        "INSERT INTO recording (id, storage_key, media_type, byte_size,"
        " duration_ms, checksum_sha256, created_at, updated_at)"
        " VALUES (?, ?, 'audio/webm', ?, 1000, 'abc', '2026-08-30', '2026-08-30')",
        (recording_id, storage_key, byte_size),
    )


def markers(database_path: Path) -> list[str]:
    uri = f"file:{database_path.resolve().as_posix()}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    try:
        return [str(row[0]) for row in connection.execute("SELECT note FROM marker")]
    finally:
        connection.close()


def test_preserved_copy_keeps_commits_left_in_the_wal(workspace: Settings) -> None:
    """A killed container leaves committed rows in rodeo.db-wal.

    The restore deletes that WAL, so the preserved copy is the only place
    those rows can survive. A plain file copy would drop them silently.
    """
    add_attempt_marker(workspace, "checkpointed", leave_in_wal=False)
    add_attempt_marker(workspace, "still in the wal", leave_in_wal=True)
    assert (workspace.data_dir / "rodeo.db-wal").stat().st_size > 0

    preserved = preserve_current_database(workspace, now=NOW)

    assert preserved is not None
    assert markers(preserved) == ["checkpointed", "still in the wal"]


def test_preserve_returns_none_without_a_live_database(tmp_path: Path) -> None:
    settings = Settings(
        environment="test",
        data_dir=tmp_path / "empty",
        database_url=f"sqlite+pysqlite:///{tmp_path / 'empty' / 'rodeo.db'}",
    )
    (tmp_path / "empty").mkdir()

    assert preserve_current_database(settings, now=NOW) is None


def test_restore_replaces_the_database_and_preserves_the_old_one(
    workspace: Settings,
) -> None:
    add_attempt_marker(workspace, "before the snapshot", leave_in_wal=False)
    snapshot = create_backup(workspace, now=NOW)
    add_attempt_marker(workspace, "after the snapshot", leave_in_wal=False)

    result = restore_database(
        workspace, backup_name=snapshot.name, now=NOW + timedelta(days=1)
    )

    assert result["restored"] == snapshot.name
    assert markers(live_path(workspace)) == ["before the snapshot"]
    preserved = workspace.pre_restore_dir / str(result["preserved"])
    assert markers(preserved) == ["before the snapshot", "after the snapshot"]


def test_restore_clears_the_stale_wal(workspace: Settings) -> None:
    snapshot = create_backup(workspace, now=NOW)
    add_attempt_marker(workspace, "later work", leave_in_wal=True)

    restore_database(workspace, backup_name=snapshot.name, now=NOW)

    assert not (workspace.data_dir / "rodeo.db-wal").exists()
    assert not (workspace.data_dir / "rodeo.db-shm").exists()


def test_restore_brings_back_recordings_the_snapshot_references(
    workspace: Settings,
) -> None:
    storage_key = "11111111-1111-4111-8111-111111111111.webm"
    workspace.recordings_dir.mkdir(parents=True, exist_ok=True)
    (workspace.recordings_dir / storage_key).write_bytes(b"take one")
    workspace.backup_recordings_dir.mkdir(parents=True, exist_ok=True)
    (workspace.backup_recordings_dir / storage_key).write_bytes(b"take one")

    connection = sqlite3.connect(live_path(workspace))
    insert_recording(connection, "r1", storage_key, byte_size=8)
    connection.commit()
    connection.close()

    snapshot = create_backup(workspace, now=NOW)

    (workspace.recordings_dir / storage_key).unlink()

    result = restore_database(workspace, backup_name=snapshot.name, now=NOW)

    assert result["recordings_restored"] == [storage_key]
    assert (workspace.recordings_dir / storage_key).read_bytes() == b"take one"


def test_restore_never_overwrites_a_recording_that_is_present(
    workspace: Settings,
) -> None:
    storage_key = "22222222-2222-4222-8222-222222222222.webm"
    workspace.recordings_dir.mkdir(parents=True, exist_ok=True)
    workspace.backup_recordings_dir.mkdir(parents=True, exist_ok=True)
    (workspace.recordings_dir / storage_key).write_bytes(b"live version")
    (workspace.backup_recordings_dir / storage_key).write_bytes(b"mirror version")

    connection = sqlite3.connect(live_path(workspace))
    insert_recording(connection, "r2", storage_key, byte_size=12)
    connection.commit()
    connection.close()

    restored = restore_recordings(workspace, database_path=live_path(workspace))

    assert restored == []
    assert (workspace.recordings_dir / storage_key).read_bytes() == b"live version"


def test_pre_restore_copies_are_pruned_to_retention(workspace: Settings) -> None:
    workspace.backup_retention = 2
    snapshot = create_backup(workspace, now=NOW)

    for day in range(4):
        restore_database(
            workspace, backup_name=snapshot.name, now=NOW + timedelta(days=day)
        )

    assert len(existing_pre_restore_copies(workspace)) == 2


def test_pre_restore_copies_are_not_mistaken_for_snapshots(
    workspace: Settings,
) -> None:
    from rodeo.services.backups import existing_backups

    snapshot = create_backup(workspace, now=NOW)
    restore_database(workspace, backup_name=snapshot.name, now=NOW)

    assert [path.name for path in existing_backups(workspace)] == [snapshot.name]


@pytest.mark.parametrize(
    "name",
    [
        "../rodeo.db",
        "/etc/passwd",
        "rodeo-before-restore-20260830T120000Z.db",
        "notes.txt",
        "rodeo-nonsense.db",
    ],
)
def test_restore_rejects_names_it_did_not_write(workspace: Settings, name: str) -> None:
    with pytest.raises(RestoreError):
        restore_database(workspace, backup_name=name, now=NOW)


def test_restore_refuses_a_corrupt_snapshot(workspace: Settings) -> None:
    snapshot = create_backup(workspace, now=NOW)
    add_attempt_marker(workspace, "current work", leave_in_wal=False)
    snapshot.write_bytes(b"SQLite format 3\x00" + b"garbage" * 200)

    with pytest.raises(RestoreError):
        restore_database(workspace, backup_name=snapshot.name, now=NOW)

    assert markers(live_path(workspace)) == ["current work"]


def test_staged_request_is_read_once_and_removed(workspace: Settings) -> None:
    from rodeo.services.restore import (
        restore_request_path,
        stage_restore_request,
        take_restore_request,
    )

    snapshot = create_backup(workspace, now=NOW)
    stage_restore_request(workspace, backup_name=snapshot.name, now=NOW)

    assert restore_request_path(workspace).is_file()
    assert take_restore_request(workspace) == snapshot.name

    assert not restore_request_path(workspace).exists()
    assert take_restore_request(workspace) is None


def test_staging_rejects_a_snapshot_that_does_not_exist(
    workspace: Settings,
) -> None:
    from rodeo.services.restore import restore_request_path, stage_restore_request

    with pytest.raises(RestoreError):
        stage_restore_request(
            workspace, backup_name="rodeo-20200101T000000Z.db", now=NOW
        )
    assert not restore_request_path(workspace).exists()


def test_pending_restore_is_applied_on_the_next_start(workspace: Settings) -> None:
    from rodeo.services.restore import apply_pending_restore, stage_restore_request

    add_attempt_marker(workspace, "before the snapshot", leave_in_wal=False)
    snapshot = create_backup(workspace, now=NOW)
    add_attempt_marker(workspace, "after the snapshot", leave_in_wal=False)
    stage_restore_request(workspace, backup_name=snapshot.name, now=NOW)

    result = apply_pending_restore(workspace)

    assert result is not None
    assert result["restored"] == snapshot.name
    assert markers(live_path(workspace)) == ["before the snapshot"]

    assert apply_pending_restore(workspace) is None


def test_apply_pending_restore_is_a_no_op_without_a_request(
    workspace: Settings,
) -> None:
    from rodeo.services.restore import apply_pending_restore

    assert apply_pending_restore(workspace) is None


def test_a_failed_restore_leaves_the_database_and_clears_the_request(
    workspace: Settings,
) -> None:
    from rodeo.services.restore import (
        apply_pending_restore,
        restore_request_path,
        stage_restore_request,
    )

    add_attempt_marker(workspace, "current work", leave_in_wal=False)
    snapshot = create_backup(workspace, now=NOW)
    stage_restore_request(workspace, backup_name=snapshot.name, now=NOW)

    snapshot.write_bytes(b"SQLite format 3\x00" + b"garbage" * 200)

    assert apply_pending_restore(workspace) is None
    assert markers(live_path(workspace)) == ["current work"]
    assert not restore_request_path(workspace).exists()


def test_unreadable_request_file_is_discarded(workspace: Settings) -> None:
    from rodeo.services.restore import restore_request_path, take_restore_request

    restore_request_path(workspace).write_text("{ not json")

    assert take_restore_request(workspace) is None
    assert not restore_request_path(workspace).exists()
