from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from rodeo.config import Settings
from rodeo.services.recording_backups import (
    live_recordings,
    manifest_path,
    mirror_recordings,
    read_manifest,
)

NOW = datetime(2026, 8, 30, 12, 0, 0, tzinfo=UTC)


@pytest.fixture
def prepared(settings: Settings) -> Settings:
    settings.recordings_dir.mkdir(parents=True, exist_ok=True)
    settings.backups_dir.mkdir(parents=True, exist_ok=True)
    return settings


def write_recording(settings: Settings, name: str, payload: bytes) -> Path:
    path = settings.recordings_dir / name
    path.write_bytes(payload)
    return path


def test_mirror_copies_recordings_byte_for_byte(prepared: Settings) -> None:
    write_recording(prepared, "a.webm", b"first-take")
    write_recording(prepared, "b.m4a", b"second-take")

    result = mirror_recordings(prepared, now=NOW)

    assert result["copied"] == ["a.webm", "b.m4a"]
    assert (prepared.backup_recordings_dir / "a.webm").read_bytes() == b"first-take"
    assert (prepared.backup_recordings_dir / "b.m4a").read_bytes() == b"second-take"


def test_mirror_skips_files_it_already_holds(prepared: Settings) -> None:
    write_recording(prepared, "a.webm", b"first-take")
    mirror_recordings(prepared, now=NOW)

    result = mirror_recordings(prepared, now=NOW + timedelta(days=1))

    assert result["copied"] == []


def test_mirror_ignores_non_recording_files(prepared: Settings) -> None:
    write_recording(prepared, "notes.txt", b"not audio")
    (prepared.recordings_dir / "nested").mkdir()

    result = mirror_recordings(prepared, now=NOW)

    assert result["copied"] == []
    assert live_recordings(prepared) == set()


def test_deleted_recording_is_retained_then_dropped(prepared: Settings) -> None:
    write_recording(prepared, "a.webm", b"first-take")
    mirror_recordings(prepared, now=NOW)
    (prepared.recordings_dir / "a.webm").unlink()

    # First run after the deletion only marks it; the copy must survive.
    noticed = mirror_recordings(prepared, now=NOW + timedelta(days=1))
    assert noticed["removed"] == []
    assert (prepared.backup_recordings_dir / "a.webm").is_file()
    assert read_manifest(prepared)["a.webm"]["missing_since"] is not None

    # Still inside the window.
    inside = mirror_recordings(prepared, now=NOW + timedelta(days=10))
    assert inside["removed"] == []
    assert (prepared.backup_recordings_dir / "a.webm").is_file()

    # Past the 14-day window.
    expired = mirror_recordings(prepared, now=NOW + timedelta(days=16))
    assert expired["removed"] == ["a.webm"]
    assert not (prepared.backup_recordings_dir / "a.webm").exists()
    assert "a.webm" not in read_manifest(prepared)


def test_restored_recording_clears_its_pending_deletion(prepared: Settings) -> None:
    write_recording(prepared, "a.webm", b"first-take")
    mirror_recordings(prepared, now=NOW)
    (prepared.recordings_dir / "a.webm").unlink()
    mirror_recordings(prepared, now=NOW + timedelta(days=1))

    write_recording(prepared, "a.webm", b"first-take")
    mirror_recordings(prepared, now=NOW + timedelta(days=2))

    assert read_manifest(prepared)["a.webm"]["missing_since"] is None
    # A file back inside the window must not be swept later.
    result = mirror_recordings(prepared, now=NOW + timedelta(days=40))
    assert result["removed"] == []


def test_missing_mirror_file_is_recopied(prepared: Settings) -> None:
    write_recording(prepared, "a.webm", b"first-take")
    mirror_recordings(prepared, now=NOW)
    (prepared.backup_recordings_dir / "a.webm").unlink()

    result = mirror_recordings(prepared, now=NOW + timedelta(days=1))

    assert result["copied"] == ["a.webm"]
    assert (prepared.backup_recordings_dir / "a.webm").read_bytes() == b"first-take"


def test_corrupt_manifest_is_rebuilt_without_losing_files(prepared: Settings) -> None:
    write_recording(prepared, "a.webm", b"first-take")
    mirror_recordings(prepared, now=NOW)
    manifest_path(prepared).write_text("{ not json")

    result = mirror_recordings(prepared, now=NOW + timedelta(days=1))

    assert result["copied"] == ["a.webm"]
    assert read_manifest(prepared)["a.webm"]["missing_since"] is None


def test_mirror_is_a_no_op_when_recordings_are_excluded(prepared: Settings) -> None:
    prepared.backup_include_recordings = False
    write_recording(prepared, "a.webm", b"first-take")

    result = mirror_recordings(prepared, now=NOW)

    assert result == {"copied": [], "removed": []}
    assert not prepared.backup_recordings_dir.exists()


def test_partial_copies_are_never_left_behind(prepared: Settings) -> None:
    write_recording(prepared, "a.webm", b"first-take")
    mirror_recordings(prepared, now=NOW)

    stray = list(prepared.backup_recordings_dir.glob(".*"))
    assert stray == []
