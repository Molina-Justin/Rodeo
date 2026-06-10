from __future__ import annotations

from datetime import datetime

from pydantic import Field

from rodeo.models.enums import (
    AttemptBlocker,
    AttemptEffort,
    AttemptOutcome,
    PracticeSessionStatus,
)
from rodeo.schemas.attempts import MAX_NOTES_LENGTH, AttemptResponse
from rodeo.schemas.recordings import RecordingResponse
from rodeo.schemas.system import APIModel


class PracticeSessionCreate(APIModel):
    problem_id: int = Field(gt=0)


class PracticeSessionFinalize(APIModel):
    duration_seconds: int | None = Field(default=None, gt=0)
    outcome: AttemptOutcome
    effort: AttemptEffort
    blocker: AttemptBlocker = AttemptBlocker.NONE
    notes: str = Field(default="", max_length=MAX_NOTES_LENGTH)


class PracticeSessionResponse(APIModel):
    id: str
    problem_id: int
    status: PracticeSessionStatus
    started_at: datetime
    running_since: datetime | None
    paused_at: datetime | None
    stopped_at: datetime | None
    finalized_at: datetime | None
    active_duration_ms: int = Field(ge=0)
    attempt_id: str | None
    recording: RecordingResponse | None
    created_at: datetime
    updated_at: datetime


class FinalizePracticeSessionResponse(APIModel):
    session: PracticeSessionResponse
    attempt: AttemptResponse
    created: bool
