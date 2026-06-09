"""Durable local recording storage.

The database only ever holds metadata.  Files are streamed into the temporary
directory, inspected before they are published, and finally moved into the
recordings directory with one atomic rename.
"""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from rodeo.config import Settings

CHUNK_SIZE = 1024 * 1024
SUPPORTED_MEDIA_TYPES = frozenset({"audio/webm", "audio/ogg"})


class RecordingUploadError(ValueError):
    """A browser upload could not safely be made durable."""


def normal_media_type(value: str | None) -> str:
    media_type = (value or "").split(";", 1)[0].strip().lower()
    if media_type not in SUPPORTED_MEDIA_TYPES:
        supported = ", ".join(sorted(SUPPORTED_MEDIA_TYPES))
        raise RecordingUploadError(f"audio MIME type must be one of: {supported}")
    return media_type


def extension_for_media_type(media_type: str) -> str:
    return ".webm" if media_type == "audio/webm" else ".ogg"


def recording_path(settings: Settings, storage_key: str) -> Path:
    candidate = (settings.recordings_dir / storage_key).resolve()
    recordings_root = settings.recordings_dir.resolve()
    if candidate.parent != recordings_root or candidate.suffix not in {".webm", ".ogg"}:
        raise RecordingUploadError("invalid recording storage key")
    return candidate


def probe_duration_ms(path: Path) -> int:
    """Read duration with PyAV, which uses the image's FFmpeg runtime."""
    try:
        import av
    except ImportError as error:  # pragma: no cover - image dependency
        raise RecordingUploadError("media probing is unavailable") from error

    try:
        with av.open(path) as container:
            if container.duration is not None:
                return max(0, round(float(container.duration / av.time_base) * 1_000))
            durations = [
                float(stream.duration * stream.time_base) * 1_000
                for stream in container.streams.audio
                if stream.duration is not None and stream.time_base is not None
            ]
    except Exception as error:  # PyAV exposes several FFmpeg-specific errors.
        raise RecordingUploadError("recording could not be decoded") from error

    if not durations:
        raise RecordingUploadError("recording duration could not be determined")
    return max(0, round(max(durations)))


async def store_upload(
    upload: UploadFile,
    *,
    settings: Settings,
) -> tuple[str, str, int, int, str, str | None]:
    """Stream an upload and return durable recording metadata.

    The resulting tuple is ``storage_key, media_type, byte_size, duration_ms,
    checksum, original_filename``.  A failed upload leaves no temporary file.
    A database rollback after a successful move may leave an orphan, which is
    intentionally safe and handled by reconciliation rather than by rolling
    back a user transaction.
    """
    media_type = normal_media_type(upload.content_type)
    temporary_path = settings.temporary_dir / f"upload-{uuid4().hex}.part"
    byte_size = 0
    digest = hashlib.sha256()
    try:
        with temporary_path.open("xb") as destination:
            while chunk := await upload.read(CHUNK_SIZE):
                byte_size += len(chunk)
                if byte_size > settings.max_recording_bytes:
                    raise RecordingUploadError("recording exceeds the upload limit")
                digest.update(chunk)
                destination.write(chunk)

        if byte_size == 0:
            raise RecordingUploadError("recording is empty")
        duration_ms = probe_duration_ms(temporary_path)
        storage_key = f"{uuid4()}{extension_for_media_type(media_type)}"
        destination_path = recording_path(settings, storage_key)
        os.replace(temporary_path, destination_path)
        return (
            storage_key,
            media_type,
            byte_size,
            duration_ms,
            digest.hexdigest(),
            upload.filename,
        )
    except OSError as error:
        raise RecordingUploadError("recording could not be stored") from error
    finally:
        await upload.close()
        temporary_path.unlink(missing_ok=True)
