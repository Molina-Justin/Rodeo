from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import Field, field_validator

from rodeo.models.enums import (
    AttemptBlocker,
    AttemptEffort,
    AttemptOutcome,
    CatalogSyncStatus,
    Difficulty,
    ProblemStatus,
)
from rodeo.schemas.system import APIModel


class ProblemAccess(StrEnum):
    ALL = "all"
    FREE = "free"
    PREMIUM = "premium"


class ProblemSort(StrEnum):
    ID_ASC = "id-asc"
    ID_DESC = "id-desc"
    TITLE_ASC = "title-asc"
    TITLE_DESC = "title-desc"
    DIFFICULTY_ASC = "difficulty-asc"
    DIFFICULTY_DESC = "difficulty-desc"
    ACCEPTANCE_ASC = "acceptance-asc"
    ACCEPTANCE_DESC = "acceptance-desc"


class CatalogProblem(APIModel):
    id: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=255)
    difficulty: Difficulty
    premium: bool
    acceptance: float = Field(ge=0, le=100)
    topics: tuple[str, ...] = ()

    @field_validator("title", "slug")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped

    @field_validator("topics")
    @classmethod
    def normalize_topics(cls, values: tuple[str, ...]) -> tuple[str, ...]:
        normalized = tuple(
            dict.fromkeys(value.strip() for value in values if value.strip())
        )
        for value in normalized:
            if len(value) > 100:
                raise ValueError("topic names must contain at most 100 characters")
        return normalized


class LatestAttemptSummary(APIModel):
    id: str
    completed_at: datetime
    duration_seconds: int
    outcome: AttemptOutcome
    effort: AttemptEffort
    blocker: AttemptBlocker


class ProblemListItem(APIModel):
    id: int
    title: str
    slug: str
    difficulty: Difficulty
    premium: bool
    acceptance: float
    active: bool
    topics: tuple[str, ...]
    status: ProblemStatus
    attempt_count: int
    last_attempt: LatestAttemptSummary | None
    best_duration_seconds: int | None
    due_at: datetime | None
    has_notes: bool
    has_audio: bool
    has_transcript: bool


class ProblemDetail(ProblemListItem):
    catalog_updated_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ProblemPage(APIModel):
    items: tuple[ProblemListItem, ...]
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total: int = Field(ge=0)
    page_count: int = Field(ge=0)


class CatalogSyncResponse(APIModel):
    id: str
    status: CatalogSyncStatus
    source: str
    started_at: datetime
    completed_at: datetime | None
    added_count: int
    updated_count: int
    deactivated_count: int
    error_code: str | None
    error_message: str | None
