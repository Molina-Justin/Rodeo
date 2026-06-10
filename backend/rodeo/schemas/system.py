from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from rodeo.models.enums import (
    AttemptBlocker,
    AttemptEffort,
    AttemptOutcome,
    ProblemStatus,
)


class APIModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class HealthResponse(APIModel):
    status: Literal["ok"] = "ok"


class ReadinessResponse(APIModel):
    status: Literal["ready"] = "ready"
    database: Literal["ready"] = "ready"


class TranscriptionCapability(APIModel):
    enabled: bool
    available: bool
    model: str


class AICapability(APIModel):
    provider: Literal["anthropic"] = "anthropic"
    available: bool


class CapabilitiesResponse(APIModel):
    transcription: TranscriptionCapability
    ai: AICapability


class PromptTemplatesResponse(APIModel):
    session_template: str
    review_template: str


class PromptTemplateUpdate(APIModel):
    template: str = Field(min_length=1, max_length=20_000)


class ExportAttempt(APIModel):
    id: str
    problem_id: int
    problem_title: str
    problem_slug: str
    completed_at: datetime
    duration_seconds: int
    outcome: AttemptOutcome
    effort: AttemptEffort
    blocker: AttemptBlocker
    notes: str
    transcript: str | None
    created_at: datetime


class ExportReviewState(APIModel):
    problem_id: int
    problem_title: str
    status: ProblemStatus
    attempt_count: int
    best_duration_seconds: int | None
    interval_days: int
    lapses: int
    confidence: int
    due_at: datetime | None


class ExportResponse(APIModel):
    generated_at: datetime
    attempts: list[ExportAttempt]
    review_state: list[ExportReviewState]
    prompt_templates: PromptTemplatesResponse


class ClearResponse(APIModel):
    attempts_deleted: int = Field(ge=0)
    practice_sessions_deleted: int = Field(ge=0)
    recordings_deleted: int = Field(ge=0)
    settings_deleted: int = Field(ge=0)
    cleared_at: datetime
