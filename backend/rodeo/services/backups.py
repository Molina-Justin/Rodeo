"""Point-in-time database snapshots taken with SQLite's own VACUUM INTO."""

from __future__ import annotations

import logging
import re
import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path
from typing import TypedDict

from sqlalchemy import Engine

from rodeo.config import Settings
from rodeo.db import get_engine
from rodeo.services.recording_backups import mirror_recordings

logger = logging.getLogger(__name__)

BACKUP_FILENAME_FORMAT = "rodeo-%Y%m%dT%H%M%SZ.db"
BACKUP_GLOB = "rodeo-*.db"


BACKUP_FILENAME_PATTERN = re.compile(r"^rodeo-\d{8}T\d{6}Z\.db$")


class SnapshotStats(TypedDict):
    attempt_count: int
    solved_count: int


SOLVED_COUNT_SQL = """
SELECT count(*) FROM (
    SELECT outcome, row_number() OVER (
        PARTITION BY problem_id ORDER BY completed_at DESC
    ) AS rank_in_problem
    FROM attempt
) WHERE rank_in_problem = 1 AND outcome = 'optimal'
"""


class BackupValidationError(RuntimeError):
    """Raised when SQLite cannot verify a newly written snapshot."""


def backup_filename(now: datetime) -> str:
    return now.astimezone(UTC).strftime(BACKUP_FILENAME_FORMAT)


def is_snapshot_name(name: str) -> bool:
    return BACKUP_FILENAME_PATTERN.match(name) is not None


def existing_backups(settings: Settings) -> list[Path]:
    """Oldest first. The timestamp format sorts lexically and chronologically."""
    if not settings.backups_dir.is_dir():
        return []
    return sorted(
        path
        for path in settings.backups_dir.glob(BACKUP_GLOB)
        if path.is_file() and is_snapshot_name(path.name)
    )


def latest_backup(settings: Settings) -> Path | None:
    backups = existing_backups(settings)
    return backups[-1] if backups else None


def validate_backup(path: Path, *, thorough: bool = False) -> None:
    """Check a snapshot without modifying it.

    `quick_check` is enough for the routine path after every write.  A restore
    reads a file that may have sat on disk for weeks and happens once, so it
    pays for the full `integrity_check`, which also verifies indexes against
    the tables they point at.
    """
    if not path.is_file():
        raise BackupValidationError(f"Backup does not exist: {path.name}")

    pragma = "integrity_check" if thorough else "quick_check"
    try:
        uri = f"file:{path.resolve().as_posix()}?mode=ro"

        with closing(sqlite3.connect(uri, uri=True)) as connection:
            results = [str(row[0]) for row in connection.execute(f"PRAGMA {pragma}")]
    except sqlite3.Error as error:
        raise BackupValidationError(
            f"SQLite could not read backup {path.name}"
        ) from error

    if results != ["ok"]:
        raise BackupValidationError(f"SQLite {pragma} failed for {path.name}")


def snapshot_stats(path: Path) -> SnapshotStats | None:
    """Summarise a snapshot so one can be told apart from another.

    Returns None rather than raising: an unreadable or older-schema snapshot
    should still be listed, just without a summary.
    """
    try:
        uri = f"file:{path.resolve().as_posix()}?mode=ro"
        with closing(sqlite3.connect(uri, uri=True)) as connection:
            attempts = connection.execute("SELECT count(*) FROM attempt").fetchone()
            solved = connection.execute(SOLVED_COUNT_SQL).fetchone()
    except sqlite3.Error:
        logger.warning("Could not summarise snapshot %s", path.name)
        return None
    return SnapshotStats(attempt_count=int(attempts[0]), solved_count=int(solved[0]))


def delete_backup(settings: Settings, filename: str) -> Path:
    """Remove one snapshot. The recordings mirror is shared and left alone."""
    if filename != Path(filename).name or not is_snapshot_name(filename):
        raise BackupValidationError(f"{filename!r} is not a Rodeo snapshot name")
    target = settings.backups_dir / filename
    if not target.is_file():
        raise BackupValidationError(f"Backup not found: {filename}")
    target.unlink()
    logger.info("Deleted database backup %s", filename)
    return target


def vacuum_into(engine: Engine, target: Path) -> None:
    """Write a consistent copy of `engine`'s database to `target`.

    VACUUM INTO reads through a normal transaction, so it captures committed
    work still sitting in the WAL and needs no write lock on the database.
    """

    connection = engine.connect().execution_options(isolation_level="AUTOCOMMIT")
    with connection:
        connection.exec_driver_sql(f"VACUUM INTO '{sql_literal(target)}'")


def create_backup(settings: Settings, *, now: datetime) -> Path:
    settings.backups_dir.mkdir(parents=True, exist_ok=True)
    target = settings.backups_dir / backup_filename(now)
    if target.exists():
        validate_backup(target)
        return target

    try:
        vacuum_into(get_engine(settings), target)
        validate_backup(target)
    except Exception:
        target.unlink(missing_ok=True)
        raise
    return target


def prune_backups(settings: Settings) -> list[Path]:
    backups = existing_backups(settings)
    stale = backups[: max(len(backups) - settings.backup_retention, 0)]
    for path in stale:
        path.unlink(missing_ok=True)
    return stale


def run_backup(settings: Settings, *, now: datetime) -> Path | None:
    if not settings.backup_enabled:
        return None
    target = create_backup(settings, now=now)
    pruned = prune_backups(settings)
    logger.info("Wrote database backup %s (pruned %d)", target.name, len(pruned))

    recordings = mirror_recordings(settings, now=now)
    if recordings["copied"] or recordings["removed"]:
        logger.info(
            "Mirrored %d recording(s), dropped %d past retention",
            len(recordings["copied"]),
            len(recordings["removed"]),
        )
    return target


def sql_literal(path: Path) -> str:
    return str(path).replace("'", "''")
