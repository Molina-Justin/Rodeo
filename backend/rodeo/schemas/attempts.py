from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from rodeo.models.enums import (
    AttemptBlocker,
    AttemptEffort,
    AttemptOutcome,
    Difficulty,
    TranscriptionStatus,
)

MAX_NOTES_LENGTH = 100_000


def _require_aware(value: datetime, field_name: str) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must be timezone-aware")
    return value


class AttemptAPIModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class AttemptCreate(AttemptAPIModel):
    completed_at: datetime
    duration_seconds: int = Field(gt=0)
    outcome: AttemptOutcome
    effort: AttemptEffort
    blocker: AttemptBlocker = AttemptBlocker.NONE
    notes: str = Field(default="", max_length=MAX_NOTES_LENGTH)

    @field_validator("completed_at")
    @classmethod
    def completed_at_must_be_aware(cls, value: datetime) -> datetime:
        return _require_aware(value, "completed_at")


class AttemptUpdate(AttemptAPIModel):
    completed_at: datetime | None = None
    duration_seconds: int | None = Field(default=None, gt=0)
    outcome: AttemptOutcome | None = None
    effort: AttemptEffort | None = None
    blocker: AttemptBlocker | None = None
    notes: str | None = Field(default=None, max_length=MAX_NOTES_LENGTH)

    @field_validator("completed_at")
    @classmethod
    def completed_at_must_be_aware(
        cls,
        value: datetime | None,
    ) -> datetime | None:
        if value is None:
            return None
        return _require_aware(value, "completed_at")

    @model_validator(mode="after")
    def explicitly_set_fields_cannot_be_null(self) -> AttemptUpdate:
        null_fields = [
            field_name
            for field_name in self.model_fields_set
            if getattr(self, field_name) is None
        ]
        if null_fields:
            joined_fields = ", ".join(sorted(null_fields))
            raise ValueError(f"fields cannot be null: {joined_fields}")
        return self


class AttemptResponse(AttemptAPIModel):
    id: str
    problem_id: int
    practice_session_id: str | None
    completed_at: datetime
    duration_seconds: int
    problem_difficulty_at_attempt: Difficulty | None
    target_minutes_at_attempt: int | None = Field(default=None, gt=0)
    outcome: AttemptOutcome
    effort: AttemptEffort
    blocker: AttemptBlocker
    notes: str
    recording_id: str | None
    transcription_id: str | None
    transcription_status: TranscriptionStatus | None
    has_audio: bool
    has_transcript: bool
    created_at: datetime
    updated_at: datetime


class AttemptListResponse(AttemptAPIModel):
    items: list[AttemptResponse]
    total: int = Field(ge=0)
    offset: int = Field(ge=0)
    limit: int = Field(ge=1)
