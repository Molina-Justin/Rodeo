"""Deterministic attempt-history scheduling primitives.

This module deliberately has no database, HTTP, or clock dependencies. Callers
must provide timezone-aware timestamps and inject ``now`` for due-date work.
"""

from __future__ import annotations

from collections import deque
from collections.abc import Iterable, Set
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from enum import StrEnum
from fractions import Fraction
from math import floor
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

ENGINE_VERSION = "2"
MAX_CONFIDENCE = 5
MAX_INTERVAL_DAYS = 365


class AttemptOutcome(StrEnum):
    """The result recorded for one problem attempt."""

    OPTIMAL = "optimal"
    HINT = "hint"
    SOLUTION = "solution"
    FAILED = "failed"


class Difficulty(StrEnum):
    """Problem difficulty snapshot used by the deterministic scheduler."""

    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class AttemptClassification(StrEnum):
    LAPSE = "lapse"
    ASSISTED_RECALL = "assisted-recall"
    INDEPENDENT_NOT_QUICK = "independent-not-quick"
    CLEAN_AND_QUICK = "clean-and-quick"


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
    duration_seconds: int = 30 * 60
    difficulty: Difficulty = Difficulty.MEDIUM
    target_minutes: int | None = None


@dataclass(frozen=True, slots=True)
class ReviewState:
    """A problem's derived state after replaying its complete attempt history."""

    problem_id: int
    last_attempt: SchedulingAttempt
    attempt_count: int
    interval_days: int
    lapses: int
    confidence: int
    due_in_days: int | None
    status: ProblemStatus
    next_due_on: date | None
    graduated_at: datetime | None
    clean_quick_streak: int


_TARGET_MINUTES: dict[Difficulty, int] = {
    Difficulty.EASY: 20,
    Difficulty.MEDIUM: 30,
    Difficulty.HARD: 45,
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


_DIFFICULTY_WEIGHT: dict[Difficulty, Fraction] = {
    Difficulty.EASY: Fraction(4, 5),
    Difficulty.MEDIUM: Fraction(1, 1),
    Difficulty.HARD: Fraction(6, 5),
}
_MIN_TIME_FACTOR = Fraction(1, 2)
_MIN_OVERDUE_FACTOR = Fraction(2, 5)
_OVERDUE_GRACE_DAYS = 14

_READINESS_MASTERY_WEIGHT = Fraction(7, 10)
_READINESS_COVERAGE_WEIGHT = Fraction(1, 5)
_READINESS_CADENCE_WEIGHT = Fraction(1, 10)


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


def target_minutes_for_difficulty(difficulty: Difficulty) -> int:
    return _TARGET_MINUTES[difficulty]


def classify_attempt(attempt: SchedulingAttempt) -> AttemptClassification:
    if attempt.outcome in {AttemptOutcome.SOLUTION, AttemptOutcome.FAILED}:
        return AttemptClassification.LAPSE
    if attempt.outcome is AttemptOutcome.HINT:
        return AttemptClassification.ASSISTED_RECALL
    target_minutes = attempt.target_minutes or target_minutes_for_difficulty(
        attempt.difficulty
    )
    if attempt.duration_seconds <= target_minutes * 60:
        return AttemptClassification.CLEAN_AND_QUICK
    return AttemptClassification.INDEPENDENT_NOT_QUICK


def _next_interval_days(
    classification: AttemptClassification,
    previous_interval_days: int,
) -> int:
    if classification is AttemptClassification.LAPSE:
        return 1
    if classification is AttemptClassification.ASSISTED_RECALL:
        candidate = max(
            2, _round_like_javascript(Fraction(previous_interval_days * 7, 10))
        )
    elif classification is AttemptClassification.INDEPENDENT_NOT_QUICK:
        candidate = max(
            3, _round_like_javascript(Fraction(previous_interval_days * 3, 2))
        )
    else:
        candidate = max(
            3, _round_like_javascript(Fraction(previous_interval_days * 5, 2))
        )
    return min(MAX_INTERVAL_DAYS, candidate)


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
        clean_quick_streak = 0
        recent_clean_reviews: deque[bool] = deque(maxlen=3)
        next_due_on: date | None = None
        graduated_at: datetime | None = None

        for attempt in ordered:
            completed_on = attempt.completed_at.astimezone(app_timezone).date()
            classification = classify_attempt(attempt)
            was_early_practice = (
                next_due_on is not None
                and completed_on < next_due_on - timedelta(days=1)
            )

            if graduated_at is not None:
                if classification is AttemptClassification.CLEAN_AND_QUICK:
                    clean_quick_streak += 1
                    continue
                interval_days = 1
                next_due_on = None
                graduated_at = None
                clean_quick_streak = 0
                recent_clean_reviews.clear()

            candidate_interval = _next_interval_days(classification, interval_days)
            candidate_due_on = completed_on + timedelta(days=candidate_interval)

            if was_early_practice and classification in {
                AttemptClassification.CLEAN_AND_QUICK,
                AttemptClassification.INDEPENDENT_NOT_QUICK,
            }:
                continue

            interval_days = candidate_interval
            next_due_on = candidate_due_on
            if classification is AttemptClassification.LAPSE:
                lapses += 1
                successful_streak = 0
                clean_quick_streak = 0
                recent_clean_reviews.clear()
                continue

            successful_streak += 1
            if classification is not AttemptClassification.CLEAN_AND_QUICK:
                clean_quick_streak = 0
                recent_clean_reviews.clear()
                continue

            clean_quick_streak += 1
            recent_clean_reviews.append(not was_early_practice)
            if (
                clean_quick_streak >= 4
                and len(recent_clean_reviews) == 3
                and all(recent_clean_reviews)
                and interval_days >= 20
            ):
                next_due_on = None
                graduated_at = attempt.completed_at

        last_attempt = ordered[-1]

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
                due_in_days=(next_due_on - today).days if next_due_on else None,
                status=derive_status(last_attempt),
                next_due_on=next_due_on,
                graduated_at=graduated_at,
                clean_quick_streak=clean_quick_streak,
            )
        )

    states.sort(
        key=lambda state: (
            state.due_in_days is None,
            state.due_in_days if state.due_in_days is not None else 0,
        )
    )
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
        state.due_in_days is not None and state.due_in_days <= 0
        for state in build_review_states(
            attempts,
            now=now,
            timezone_name=timezone_name,
            known_problem_ids=known_problem_ids,
        )
    )


def _latest_attempts(
    attempts: Iterable[SchedulingAttempt],
    known_problem_ids: Set[int] | None,
) -> dict[int, SchedulingAttempt]:
    """Most recent attempt per problem.

    A tie keeps the first, matching indexAttempts.
    """

    latest_by_problem: dict[int, SchedulingAttempt] = {}
    for attempt in attempts:
        if not _is_known(attempt.problem_id, known_problem_ids):
            continue
        _require_aware(attempt.completed_at, "attempt.completed_at")
        current = latest_by_problem.get(attempt.problem_id)
        if current is None or attempt.completed_at > current.completed_at:
            latest_by_problem[attempt.problem_id] = attempt
    return latest_by_problem


def mastery_score(
    attempts: Iterable[SchedulingAttempt],
    *,
    known_problem_ids: Set[int] | None = None,
) -> int:
    """Return catalog-weighted mastery on a 0-100 scale.

    When a catalog is supplied, its unattempted problems contribute zero.
    """

    latest_by_problem = _latest_attempts(attempts, known_problem_ids)
    denominator = (
        len(known_problem_ids)
        if known_problem_ids is not None
        else len(latest_by_problem)
    )

    if denominator == 0:
        return 0

    total = sum(
        (
            _STATUS_WEIGHT[derive_status(attempt)]
            for attempt in latest_by_problem.values()
        ),
        start=Fraction(0),
    )
    return _round_like_javascript(total * 100 / denominator)


def _time_factor(attempt: SchedulingAttempt) -> Fraction:
    """How efficiently an attempt used its difficulty's target time.

    Finishing at or under target earns full credit; running over tapers
    credit down to ``_MIN_TIME_FACTOR`` rather than to zero, since a correct,
    slow solve is still worth far more than not solving it at all.
    """

    target_minutes = attempt.target_minutes or target_minutes_for_difficulty(
        attempt.difficulty
    )
    ratio = Fraction(target_minutes * 60, attempt.duration_seconds)
    return max(_MIN_TIME_FACTOR, min(Fraction(1), ratio))


def attempt_quality(attempt: SchedulingAttempt) -> Fraction:
    """Weighted quality of a single attempt, on the same 0-1 scale as mastery.

    Starts from the outcome weight mastery already uses. This captures hint
    and solution usage before scaling by the problem's
    difficulty and by how efficiently the attempt used its target time.
    """

    outcome_weight = _STATUS_WEIGHT[_OUTCOME_STATUS[attempt.outcome]]
    difficulty_weight = _DIFFICULTY_WEIGHT[attempt.difficulty]
    return outcome_weight * difficulty_weight * _time_factor(attempt)


def _overdue_factor(state: ReviewState) -> Fraction:
    """Decay applied to a problem's quality the longer it sits overdue.

    A problem not yet due, or graduated out of the review queue entirely,
    keeps full credit. One that is overdue decays smoothly toward
    ``_MIN_OVERDUE_FACTOR``. It never drops out because the attempt
    genuinely happened, but stale practice counts for less than fresh
    practice when judging interview readiness today.
    """

    if state.due_in_days is None or state.due_in_days > 0:
        return Fraction(1)
    overdue_days = -state.due_in_days
    return max(
        _MIN_OVERDUE_FACTOR,
        Fraction(_OVERDUE_GRACE_DAYS, _OVERDUE_GRACE_DAYS + overdue_days),
    )


def _cadence_ratio(
    attempts: Iterable[SchedulingAttempt],
    *,
    now: datetime,
    timezone_name: str,
    window_days: int,
) -> Fraction:
    """Fraction of the trailing ``window_days`` that carried at least one attempt."""

    app_timezone = _load_timezone(timezone_name)
    today = now.astimezone(app_timezone).date()
    window_start = today - timedelta(days=window_days - 1)
    active_days = {
        attempt.completed_at.astimezone(app_timezone).date() for attempt in attempts
    }
    active_in_window = sum(1 for day in active_days if window_start <= day <= today)
    return Fraction(active_in_window, window_days)


def readiness_score(
    attempts: Iterable[SchedulingAttempt],
    *,
    now: datetime,
    timezone_name: str,
    known_problem_ids: Set[int] | None = None,
    cadence_window_days: int = 90,
) -> int:
    """Catalog-weighted interview readiness on a 0-100 scale.

    Blends three signals, weighted so a single attempt cannot dominate the
    result:

    - Discounted mastery (70%): the catalog-weighted average of each
      problem's latest-attempt quality (``attempt_quality``: outcome x
      difficulty x pace), decayed by ``_overdue_factor`` for problems overdue
      for review.
    - Catalog coverage (20%): the plain fraction of the catalog ever solved.
    - Recent practice cadence (10%): the fraction of
      ``cadence_window_days`` that carried an attempt.

    Coverage and cadence are intentionally minor terms here. The prior
    implementation blended four near-equal weights. Coverage and mastery
    both move in lockstep with "problems solved /
    catalog size": solving one new problem nudges both at once, so together
    they carried three quarters of the total weight for what was
    functionally a single signal counted twice. On a catalog small enough
    for 1/N to be a large step, that produced double-digit swings from one
    attempt. Making discounted mastery the dominant term, rather than
    mastery and coverage each independently commanding their own near-40%
    share, removes that duplication.
    """

    _require_aware(now, "now")
    materialized = list(attempts)
    latest = _latest_attempts(materialized, known_problem_ids)
    denominator = (
        len(known_problem_ids) if known_problem_ids is not None else len(latest)
    )
    if denominator == 0:
        return 0

    states_by_problem = {
        state.problem_id: state
        for state in build_review_states(
            materialized,
            now=now,
            timezone_name=timezone_name,
            known_problem_ids=known_problem_ids,
        )
    }

    discounted_total = Fraction(0)
    solved_count = 0
    for problem_id, last_attempt in latest.items():
        quality = attempt_quality(last_attempt)
        discounted_total += quality * _overdue_factor(states_by_problem[problem_id])
        if derive_status(last_attempt) is ProblemStatus.SOLVED:
            solved_count += 1

    discounted_mastery = min(Fraction(1), discounted_total / denominator)
    coverage = Fraction(solved_count, denominator)
    cadence = _cadence_ratio(
        materialized,
        now=now,
        timezone_name=timezone_name,
        window_days=cadence_window_days,
    )

    blended = (
        discounted_mastery * _READINESS_MASTERY_WEIGHT
        + coverage * _READINESS_COVERAGE_WEIGHT
        + cadence * _READINESS_CADENCE_WEIGHT
    )
    return _round_like_javascript(blended * 100)
