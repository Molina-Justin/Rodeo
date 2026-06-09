from __future__ import annotations

from datetime import datetime

from pydantic import Field

from rodeo.schemas.system import APIModel


class AIArtifactCreate(APIModel):
    kind: str = Field(min_length=1, max_length=64)
    include_notes: bool = False
    include_transcript: bool = False


class AIArtifactResponse(APIModel):
    id: str
    attempt_id: str
    kind: str
    provider: str
    model: str
    prompt_version: str
    content: str
    created_at: datetime
    updated_at: datetime
