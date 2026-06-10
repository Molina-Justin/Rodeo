from __future__ import annotations

from enum import IntEnum

from pydantic import Field

from rodeo.models.enums import ProblemStatus
from rodeo.schemas.system import APIModel


class DashboardRange(IntEnum):
    """Windows the range selector offers, in days.

    An IntEnum rather than a Literal: FastAPI hands query parameters to
    Pydantic as strings, and a Literal of ints refuses to coerce them, which
    made every explicit ?range_days= value fail validation.
    """

    MONTH = 30
    TWO_MONTHS = 60
    QUARTER = 90
    HALF_YEAR = 180


class ActivityDay(APIModel):
    key: str
    minutes: float = Field(ge=0)
    problem_count: int = Field(ge=0)
    activity_level: int = Field(ge=0, le=4)


class ConsistencyResponse(APIModel):
    days: tuple[ActivityDay, ...]
    minutes: float = Field(ge=0)
    problem_count: int = Field(ge=0)
    streak: int = Field(ge=0)
    best_streak: int = Field(ge=0)


class TopicFocusResponse(APIModel):
    topic: str
    score: int = Field(ge=0, le=100)
    attempted: int = Field(ge=0)
    problem_count: int = Field(ge=0)
    due_count: int = Field(ge=0)


class ReviewQueueItem(APIModel):
    problem_id: int
    title: str
    topic: str
    status: ProblemStatus
    due_in_days: int


class DashboardResponse(APIModel):
    attempt_count: int = Field(ge=0)
    solved_count: int = Field(ge=0)
    logged_today: int = Field(ge=0)
    mastery_score: int = Field(ge=0, le=100)
    readiness_score: int = Field(ge=0, le=100)
    due_count: int = Field(ge=0)
    consistency: ConsistencyResponse
    focuses: tuple[TopicFocusResponse, ...]
    review_queue: tuple[ReviewQueueItem, ...]
