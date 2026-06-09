import re
from enum import StrEnum

from sqlalchemy import Enum


def enum_type[EnumType: StrEnum](
    enum_class: type[EnumType],
    *,
    length: int,
) -> Enum:
    enum_name = re.sub(r"(?<!^)(?=[A-Z])", "_", enum_class.__name__).lower()
    return Enum(
        enum_class,
        name=enum_name,
        native_enum=False,
        create_constraint=True,
        validate_strings=True,
        values_callable=lambda members: [member.value for member in members],
        length=length,
    )


class Difficulty(StrEnum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class PracticeSessionStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    AWAITING_DETAILS = "awaiting_details"
    FINALIZED = "finalized"
    DISCARDED = "discarded"


class AttemptOutcome(StrEnum):
    OPTIMAL = "optimal"
    HINT = "hint"
    SOLUTION = "solution"
    FAILED = "failed"


class AttemptEffort(StrEnum):
    LIGHT = "light"
    MODERATE = "moderate"
    HEAVY = "heavy"
    BRUTAL = "brutal"


class AttemptBlocker(StrEnum):
    NONE = "none"
    PATTERN = "pattern"
    EDGE_CASES = "edge-cases"
    COMPLEXITY = "complexity"
    IMPLEMENTATION = "implementation"
    DEBUGGING = "debugging"
    TIME = "time"


class ProblemStatus(StrEnum):
    NOT_STARTED = "not-started"
    SOLVED = "solved"
    REVIEW = "review"
    STRUGGLING = "struggling"


class TranscriptionStatus(StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class JobStatus(StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class CatalogSyncStatus(StrEnum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
