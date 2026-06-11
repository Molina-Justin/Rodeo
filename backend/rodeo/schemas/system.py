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


class RestoreRequest(APIModel):
    filename: str = Field(min_length=1, max_length=200)


class RestoreScheduledResponse(APIModel):
    filename: str
    will_restart: bool


class BackupStatusResponse(APIModel):
    enabled: bool
    last_backup_at: datetime | None
    next_backup_at: datetime | None
    last_backup_filename: str | None
    snapshot_count: int = Field(ge=0)
    recordings_included: bool
    location: str


class BackupFile(APIModel):
    filename: str
    size_bytes: int = Field(ge=0)
    created_at: datetime
    attempt_count: int | None = None
    solved_count: int | None = None


class BackupFileListResponse(APIModel):
    location: str
    recording_count: int = Field(ge=0)
    files: list[BackupFile]


class TranscriptionCapability(APIModel):
    enabled: bool
    available: bool
    model: str


class CapabilitiesResponse(APIModel):
    transcription: TranscriptionCapability


class PromptTemplatesResponse(APIModel):
    session_template: str
    review_template: str


class PromptTemplateUpdate(APIModel):
    template: str = Field(min_length=1, max_length=20_000)


class InterviewGoalsResponse(APIModel):
    target_role: str
    target_date: str
    years_experience: int | None


class InterviewGoalsUpdate(APIModel):
    target_role: str = Field(default="", max_length=200)
    target_date: str = Field(default="", max_length=200)
    years_experience: int | None = Field(default=None, ge=0, le=60)


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
    interview_goals: InterviewGoalsResponse


class ClearResponse(APIModel):
    attempts_deleted: int = Field(ge=0)
    practice_sessions_deleted: int = Field(ge=0)
    recordings_deleted: int = Field(ge=0)
    settings_deleted: int = Field(ge=0)
    cleared_at: datetime
