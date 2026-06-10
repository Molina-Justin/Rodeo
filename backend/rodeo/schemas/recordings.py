from __future__ import annotations

from datetime import datetime

from pydantic import Field

from rodeo.schemas.system import APIModel


class RecordingResponse(APIModel):
    id: str
    attempt_id: str | None
    practice_session_id: str | None
    media_type: str
    byte_size: int = Field(gt=0)
    duration_ms: int = Field(ge=0)
    checksum_sha256: str = Field(min_length=64, max_length=64)
    content_url: str
    created_at: datetime
    updated_at: datetime
