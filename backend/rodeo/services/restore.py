"""Putting a snapshot back in place, and the recordings that belong with it.

Restore runs with the application stopped.  It is the one operation that
overwrites live data, so every step is ordered to leave the workspace
recoverable if the next one fails.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path
from typing import TypedDict
from uuid import uuid4

from sqlalchemy import create_engine

from rodeo.config import Settings
from rodeo.services.backups import (
    BackupValidationError,
    is_snapshot_name,
    vacuum_into,
    validate_backup,
)

logger = logging.getLogger(__name__)

RESTORE_REQUEST_FILENAME = "restore-request.json"
PRE_RESTORE_FILENAME_FORMAT = "pre-restore-%Y%m%dT%H%M%SZ.db"
PRE_RESTORE_GLOB = "pre-restore-*.db"


class RestoreError(RuntimeError):
    """Raised when a restore cannot be completed safely."""


class RestoreResult(TypedDict):
    restored: str
    preserved: str | None
    recordings_restored: list[str]


def pre_restore_filename(now: datetime) -> str:
    return now.astimezone(UTC).strftime(PRE_RESTORE_FILENAME_FORMAT)


def existing_pre_restore_copies(settings: Settings) -> list[Path]:
    if not settings.pre_restore_dir.is_dir():
        return []
    return sorted(
        path
        for path in settings.pre_restore_dir.glob(PRE_RESTORE_GLOB)
        if path.is_file()
    )


def resolve_snapshot(settings: Settings, backup_name: str) -> Path:
    if backup_name != Path(backup_name).name or not is_snapshot_name(backup_name):
        raise RestoreError(
            f"{backup_name!r} is not a Rodeo snapshot name "
            "(expected rodeo-YYYYMMDDTHHMMSSZ.db)"
        )
    source = settings.backups_dir / backup_name
    if not source.is_file():
        raise RestoreError(f"Backup not found: {source}")
    return source


def preserve_current_database(settings: Settings, *, now: datetime) -> Path | None:
    """Copy the live database aside so the restore can be undone.

    A plain file copy would omit commits still held in `rodeo.db-wal`, which
    the restore deletes moments later; VACUUM INTO folds them in.
    """
    live = Path(settings.resolved_database_url.split("///", 1)[-1])
    if not live.is_file():
        return None

    settings.pre_restore_dir.mkdir(parents=True, exist_ok=True)
    target = settings.pre_restore_dir / pre_restore_filename(now)
    if target.exists():
        return target

    engine = create_engine(settings.resolved_database_url)
    try:
        vacuum_into(engine, target)
    except Exception:
        target.unlink(missing_ok=True)
        raise
    finally:
        engine.dispose()
    validate_backup(target)
    return target


def prune_pre_restore_copies(settings: Settings) -> list[Path]:
    copies = existing_pre_restore_copies(settings)
    stale = copies[: max(len(copies) - settings.backup_retention, 0)]
    for path in stale:
        path.unlink(missing_ok=True)
    return stale


def referenced_storage_keys(database_path: Path) -> list[str]:
    uri = f"file:{database_path.resolve().as_posix()}?mode=ro"
    with closing(sqlite3.connect(uri, uri=True)) as connection:
        return [
            str(row[0])
            for row in connection.execute("SELECT storage_key FROM recording")
            if row[0]
        ]


def restore_recordings(settings: Settings, *, database_path: Path) -> list[str]:
    """Copy back any recording the restored database expects but no longer has.

    Restoring an older snapshot reintroduces rows for recordings that have
    since been deleted from the live directory; without this the app comes
    back up with attempts whose audio 404s.
    """
    if not settings.backup_recordings_dir.is_dir():
        return []

    settings.recordings_dir.mkdir(parents=True, exist_ok=True)
    restored: list[str] = []
    for storage_key in sorted(set(referenced_storage_keys(database_path))):
        if storage_key != Path(storage_key).name:
            logger.warning("Skipping suspicious storage key %r", storage_key)
            continue
        live = settings.recordings_dir / storage_key
        mirrored = settings.backup_recordings_dir / storage_key
        if live.exists() or not mirrored.is_file():
            continue
        temporary = live.with_name(f".{storage_key}.{uuid4().hex}.part")
        try:
            shutil.copyfile(mirrored, temporary)
            os.replace(temporary, live)
        finally:
            temporary.unlink(missing_ok=True)
        restored.append(storage_key)
    return restored


def restore_request_path(settings: Settings) -> Path:
    return settings.data_dir / RESTORE_REQUEST_FILENAME


def stage_restore_request(
    settings: Settings, *, backup_name: str, now: datetime | None = None
) -> Path:
    """Record a restore for the next startup to perform.

    The running application holds the database open, so the swap cannot happen
    here; it happens on the next boot before anything opens the file.
    """
    source = resolve_snapshot(settings, backup_name)
    try:
        validate_backup(source, thorough=True)
    except BackupValidationError as error:
        raise RestoreError(str(error)) from error

    target = restore_request_path(settings)
    temporary = target.with_name(f".{target.name}.{uuid4().hex}")
    temporary.write_text(
        json.dumps(
            {
                "backup_name": source.name,
                "requested_at": (now or datetime.now(UTC)).isoformat(),
            }
        )
    )
    os.replace(temporary, target)
    return target


def take_restore_request(settings: Settings) -> str | None:
    """Read the pending request and remove it before acting on it.

    Deleting first means a restore that fails cannot put the application into
    a restart loop; it boots on the database it already had.
    """
    path = restore_request_path(settings)
    if not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text())
        backup_name = payload["backup_name"]
    except (json.JSONDecodeError, KeyError, TypeError):
        logger.warning("Ignoring an unreadable restore request")
        path.unlink(missing_ok=True)
        return None
    finally:
        path.unlink(missing_ok=True)
    return str(backup_name)


def apply_pending_restore(settings: Settings) -> RestoreResult | None:
    """Run at startup, before migrations and before the database is opened."""
    backup_name = take_restore_request(settings)
    if backup_name is None:
        return None
    try:
        return restore_database(settings, backup_name=backup_name)
    except (RestoreError, OSError):
        # Booting on the existing database beats refusing to start.
        logger.exception("Requested restore of %s failed", backup_name)
        return None


def restore_database(
    settings: Settings, *, backup_name: str, now: datetime | None = None
) -> RestoreResult:
    moment = now or datetime.now(UTC)
    source = resolve_snapshot(settings, backup_name)

    try:
        validate_backup(source, thorough=True)
    except BackupValidationError as error:
        raise RestoreError(str(error)) from error

    preserved = preserve_current_database(settings, now=moment)

    live = Path(settings.resolved_database_url.split("///", 1)[-1])
    temporary = live.with_name(f".rodeo-restore-{uuid4().hex}.tmp")
    try:
        shutil.copyfile(source, temporary)
        os.replace(temporary, live)
    finally:
        temporary.unlink(missing_ok=True)

    # The restored file is self-contained; a stale WAL would describe the
    # database it replaced.
    for suffix in ("-wal", "-shm"):
        live.with_name(f"{live.name}{suffix}").unlink(missing_ok=True)

    recordings_restored = restore_recordings(settings, database_path=live)
    prune_pre_restore_copies(settings)

    logger.info(
        "Restored %s (preserved %s, recovered %d recording(s))",
        source.name,
        preserved.name if preserved else "nothing",
        len(recordings_restored),
    )
    return RestoreResult(
        restored=source.name,
        preserved=preserved.name if preserved else None,
        recordings_restored=recordings_restored,
    )


__all__ = [
    "RestoreError",
    "RestoreResult",
    "apply_pending_restore",
    "existing_pre_restore_copies",
    "preserve_current_database",
    "restore_database",
    "restore_recordings",
    "stage_restore_request",
    "take_restore_request",
]
