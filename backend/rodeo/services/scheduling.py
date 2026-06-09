"""Deterministic attempt-history scheduling primitives.

This module deliberately has no database, HTTP, or clock dependencies. Callers
must provide timezone-aware timestamps and inject ``now`` for due-date work.
"""

from __future__ import annotations

from collections.abc import Iterable, Set
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from fractions import Fraction
from math import floor
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

ENGINE_VERSION = "1"
MAX_CONFIDENCE = 5


class AttemptOutcome(StrEnum):
    """The result recorded for one problem attempt."""

    OPTIMAL = "optimal"
    HINT = "hint"
    SOLUTION = "solution"
    FAILED = "failed"


class ProblemStatus(StrEnum):
    """The user-facing state derived from the latest attempt."""

    NOT_STARTED = "not-started"
    SOLVED = "solved"
    REVIEW = "review"
    STRUGGLING = "struggling"


@dataclass(frozen=True, slots=True)
class SchedulingAttempt:
    """The minimal immutable attempt projection needed by the engine."""

    problem_id: int
    completed_at: datetime
    outcome: AttemptOutcome
    attempt_id: int | str | None = None


@dataclass(frozen=True, slots=True)
class ReviewState:
    """A problem's derived state after replaying its complete attempt history."""

    problem_id: int
    last_attempt: SchedulingAttempt
    attempt_count: int
    interval_days: int
    lapses: int
    confidence: int
    due_in_days: int
    status: ProblemStatus


_INTERVAL_GROWTH: dict[AttemptOutcome, Fraction] = {
    AttemptOutcome.OPTIMAL: Fraction(5, 2),
    AttemptOutcome.HINT: Fraction(3, 2),
    AttemptOutcome.SOLUTION: Fraction(0),
    AttemptOutcome.FAILED: Fraction(0),
}

_CONFIDENCE_BASE: dict[AttemptOutcome, int] = {
    AttemptOutcome.OPTIMAL: 4,
    AttemptOutcome.HINT: 2,
    AttemptOutcome.SOLUTION: 1,
    AttemptOutcome.FAILED: 0,
}

_OUTCOME_STATUS: dict[AttemptOutcome, ProblemStatus] = {
    AttemptOutcome.OPTIMAL: ProblemStatus.SOLVED,
    AttemptOutcome.HINT: ProblemStatus.REVIEW,
    AttemptOutcome.SOLUTION: ProblemStatus.STRUGGLING,
    AttemptOutcome.FAILED: ProblemStatus.STRUGGLING,
}

_STATUS_WEIGHT: dict[ProblemStatus, Fraction] = {
    ProblemStatus.NOT_STARTED: Fraction(0),
    ProblemStatus.SOLVED: Fraction(1),
    ProblemStatus.REVIEW: Fraction(3, 5),
    ProblemStatus.STRUGGLING: Fraction(1, 4),
}


def _round_like_javascript(value: Fraction) -> int:
    """Round a non-negative value the same way as JavaScript ``Math.round``."""

    if value < 0:
        raise ValueError("scheduling values must be non-negative")
    return floor(value + Fraction(1, 2))


def _require_aware(value: datetime, field_name: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must be timezone-aware")


def _load_timezone(timezone_name: str) -> ZoneInfo:
    try:
        return ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError as error:
        raise ValueError(f"unknown IANA timezone: {timezone_name}") from error


def _is_known(problem_id: int, known_problem_ids: Set[int] | None) -> bool:
    return known_problem_ids is None or problem_id in known_problem_ids


def derive_status(attempt: SchedulingAttempt | None) -> ProblemStatus:
    """Derive a problem status from its latest attempt."""

    if attempt is None:
        return ProblemStatus.NOT_STARTED
    return _OUTCOME_STATUS[attempt.outcome]


def build_review_states(
    attempts: Iterable[SchedulingAttempt],
    *,
    now: datetime,
    timezone_name: str,
    known_problem_ids: Set[int] | None = None,
) -> list[ReviewState]:
    """Replay each problem's history into its current scheduling state.

    ``due_in_days`` compares local calendar dates in ``timezone_name`` rather
    than elapsed 24-hour periods. This preserves the frontend's intended
    behavior across daylight-saving transitions.

    When ``known_problem_ids`` is supplied, attempts whose problem has left or
    never belonged to the catalog are ignored. Omitting it preserves the
    catalog-independent behavior of the original TypeScript primitive.
    """

    _require_aware(now, "now")
    app_timezone = _load_timezone(timezone_name)
    histories: dict[int, list[SchedulingAttempt]] = {}

    for attempt in attempts:
        if not _is_known(attempt.problem_id, known_problem_ids):
            continue
        _require_aware(attempt.completed_at, "attempt.completed_at")
        histories.setdefault(attempt.problem_id, []).append(attempt)

    today = now.astimezone(app_timezone).date()
    states: list[ReviewState] = []

    for problem_id, history in histories.items():
        ordered = sorted(history, key=lambda attempt: attempt.completed_at)
        interval_days = 1
        lapses = 0
        successful_streak = 0

        for attempt in ordered:
            growth = _INTERVAL_GROWTH[attempt.outcome]

            if growth == 0:
                interval_days = 1
                lapses += 1
                successful_streak = 0
                continue

            interval_days = max(
                1,
                _round_like_javascript(interval_days * growth),
            )
            successful_streak += 1

        last_attempt = ordered[-1]
        due_on = (
            last_attempt.completed_at.astimezone(app_timezone).date()
            + timedelta(days=interval_days)
        )

        states.append(
            ReviewState(
                problem_id=problem_id,
                last_attempt=last_attempt,
                attempt_count=len(ordered),
                interval_days=interval_days,
                lapses=lapses,
                confidence=min(
                    MAX_CONFIDENCE,
                    _CONFIDENCE_BASE[last_attempt.outcome]
                    + (1 if successful_streak >= 3 else 0),
                ),
                due_in_days=(due_on - today).days,
                status=derive_status(last_attempt),
            )
        )

    # Python's sort is stable, matching Array.sort for equal due dates.
    states.sort(key=lambda state: state.due_in_days)
    return states


def due_review_count(
    attempts: Iterable[SchedulingAttempt],
    *,
    now: datetime,
    timezone_name: str,
    known_problem_ids: Set[int] | None = None,
) -> int:
    """Count problems whose review date is today or overdue."""

    return sum(
        state.due_in_days <= 0
        for state in build_review_states(
            attempts,
            now=now,
            timezone_name=timezone_name,
            known_problem_ids=known_problem_ids,
        )
    )


def mastery_score(
    attempts: Iterable[SchedulingAttempt],
    *,
    known_problem_ids: Set[int] | None = None,
) -> int:
    """Return the weighted mean status of attempted problems on a 0-100 scale."""

    latest_by_problem: dict[int, SchedulingAttempt] = {}

    for attempt in attempts:
        if not _is_known(attempt.problem_id, known_problem_ids):
            continue
        _require_aware(attempt.completed_at, "attempt.completed_at")
        current = latest_by_problem.get(attempt.problem_id)

        # A tie deliberately keeps the first item, matching indexAttempts.
        if current is None or attempt.completed_at > current.completed_at:
            latest_by_problem[attempt.problem_id] = attempt

    if not latest_by_problem:
        return 0

    total = sum(
        (
            _STATUS_WEIGHT[derive_status(attempt)]
            for attempt in latest_by_problem.values()
        ),
        start=Fraction(0),
    )
    return _round_like_javascript(total * 100 / len(latest_by_problem))
