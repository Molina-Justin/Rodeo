from __future__ import annotations

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from starlette.responses import FileResponse

from rodeo.config import Settings
from rodeo.db import get_db_session
from rodeo.models import Recording
from rodeo.services.recordings import RecordingUploadError, recording_path

router = APIRouter(prefix="/recordings", tags=["recordings"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]


@router.get("/{recording_id}/content")
def content(
    recording_id: str,
    request: Request,
    database: DatabaseSession,
) -> FileResponse:
    recording = database.get(Recording, recording_id)
    if recording is None:
        raise HTTPException(status_code=404, detail="Recording not found")
    settings: Settings = request.app.state.settings
    try:
        path: Path = recording_path(settings, recording.storage_key)
    except RecordingUploadError as error:
        raise HTTPException(
            status_code=500, detail="Recording storage is invalid"
        ) from error
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Recording content is unavailable")
    # Starlette FileResponse provides ETags and byte range responses for seekable
    # local files, which keeps browser playback and seeking standards-compliant.
    return FileResponse(path, media_type=recording.media_type, filename=path.name)
