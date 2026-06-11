"""An additive mirror of the recordings directory.

Recordings are immutable: `store_upload` writes each file under a fresh UUID
and never rewrites it.  Copying the whole directory on every run would rewrite
gigabytes to no purpose, so the mirror only copies files it does not already
hold, and keeps a deleted recording recoverable for the retention window
before dropping it.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import TypedDict
from uuid import uuid4

from rodeo.config import Settings

logger = logging.getLogger(__name__)

MANIFEST_FILENAME = "recordings-manifest.json"
RECORDING_SUFFIXES = frozenset({".webm", ".ogg", ".m4a"})


class MirroredRecording(TypedDict):
    copied_at: str
    missing_since: str | None


class MirrorResult(TypedDict):
    copied: list[str]
    removed: list[str]


def manifest_path(settings: Settings) -> Path:
    return settings.backups_dir / MANIFEST_FILENAME


def read_manifest(settings: Settings) -> dict[str, MirroredRecording]:
    path = manifest_path(settings)
    if not path.is_file():
        return {}
    try:
        payload = json.loads(path.read_text())
    except json.JSONDecodeError:
        logger.warning("Recording manifest was unreadable; rebuilding it")
        return {}
    entries = payload.get("recordings")
    if not isinstance(entries, dict):
        return {}
    return {
        key: MirroredRecording(
            copied_at=str(value.get("copied_at", "")),
            missing_since=value.get("missing_since"),
        )
        for key, value in entries.items()
        if isinstance(value, dict)
    }


def write_manifest(settings: Settings, entries: dict[str, MirroredRecording]) -> None:
    """Replaced atomically so an interrupted run cannot truncate the manifest."""
    settings.backups_dir.mkdir(parents=True, exist_ok=True)
    target = manifest_path(settings)
    temporary = target.with_name(f".{target.name}.{uuid4().hex}")
    temporary.write_text(json.dumps({"recordings": entries}, indent=2, sort_keys=True))
    os.replace(temporary, target)


def live_recordings(settings: Settings) -> set[str]:
    if not settings.recordings_dir.is_dir():
        return set()
    return {
        path.name
        for path in settings.recordings_dir.iterdir()
        if path.is_file() and path.suffix in RECORDING_SUFFIXES
    }


def _copy_recording(settings: Settings, storage_key: str) -> None:
    """Copy through a temporary name so a crash never leaves a partial file."""
    source = settings.recordings_dir / storage_key
    target = settings.backup_recordings_dir / storage_key
    temporary = target.with_name(f".{storage_key}.{uuid4().hex}.part")
    try:
        shutil.copyfile(source, temporary)
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


def mirror_recordings(settings: Settings, *, now: datetime) -> MirrorResult:
    if not settings.backup_include_recordings:
        return MirrorResult(copied=[], removed=[])

    settings.backups_dir.mkdir(parents=True, exist_ok=True)
    settings.backup_recordings_dir.mkdir(parents=True, exist_ok=True)
    entries = read_manifest(settings)
    present = live_recordings(settings)
    copied: list[str] = []
    removed: list[str] = []

    for storage_key in sorted(present):
        mirrored = settings.backup_recordings_dir / storage_key
        if storage_key in entries and mirrored.is_file():
            # A deleted recording that came back is live again, not pending.
            entries[storage_key]["missing_since"] = None
            continue
        _copy_recording(settings, storage_key)
        entries[storage_key] = MirroredRecording(
            copied_at=now.isoformat(), missing_since=None
        )
        copied.append(storage_key)

    cutoff = now - settings.backup_retention_window
    for storage_key in sorted(set(entries) - present):
        missing_since = entries[storage_key]["missing_since"]
        if missing_since is None:
            entries[storage_key]["missing_since"] = now.isoformat()
            continue
        if datetime.fromisoformat(missing_since) > cutoff:
            continue
        (settings.backup_recordings_dir / storage_key).unlink(missing_ok=True)
        del entries[storage_key]
        removed.append(storage_key)

    write_manifest(settings, entries)
    return MirrorResult(copied=copied, removed=removed)
