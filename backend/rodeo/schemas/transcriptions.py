from __future__ import annotations

from datetime import datetime

from pydantic import Field

from rodeo.models.enums import TranscriptionStatus
from rodeo.schemas.system import APIModel


class TranscriptionSegment(APIModel):
    start_seconds: float = Field(ge=0)
    end_seconds: float = Field(ge=0)
    text: str


class TranscriptionResponse(APIModel):
    id: str
    recording_id: str
    status: TranscriptionStatus
    raw_text: str | None
    corrected_text: str | None
    segments: tuple[TranscriptionSegment, ...]
    language: str | None
    model: str | None
    retry_count: int = Field(ge=0)
    error_code: str | None
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TranscriptionCorrection(APIModel):
    corrected_text: str = Field(max_length=100_000)
