from __future__ import annotations

from datetime import UTC, datetime
from fractions import Fraction
from zoneinfo import ZoneInfo

import pytest

from rodeo.services.scheduling import (
    AttemptOutcome,
    Difficulty,
    ProblemStatus,
    ReviewState,
    SchedulingAttempt,
    attempt_quality,
    build_review_states,
    derive_status,
    due_review_count,
    mastery_score,
    readiness_score,
)


def attempt(
    problem_id: int,
    completed_at: datetime,
    outcome: AttemptOutcome,
    *,
    attempt_id: str | None = None,
    duration_seconds: int = 30 * 60,
    difficulty: Difficulty = Difficulty.MEDIUM,
    target_minutes: int | None = None,
) -> SchedulingAttempt:
    return SchedulingAttempt(
        problem_id=problem_id,
        completed_at=completed_at,
        outcome=outcome,
        attempt_id=attempt_id,
        duration_seconds=duration_seconds,
        difficulty=difficulty,
        target_minutes=target_minutes,
    )


def test_empty_history_has_no_state_or_mastery() -> None:
    now = datetime(2026, 1, 1, tzinfo=UTC)

    assert build_review_states([], now=now, timezone_name="UTC") == []
    assert due_review_count([], now=now, timezone_name="UTC") == 0
    assert mastery_score([]) == 0
    assert derive_status(None) is ProblemStatus.NOT_STARTED


@pytest.mark.parametrize(
    ("outcome", "status"),
    [
        (AttemptOutcome.OPTIMAL, ProblemStatus.SOLVED),
        (AttemptOutcome.HINT, ProblemStatus.REVIEW),
        (AttemptOutcome.SOLUTION, ProblemStatus.STRUGGLING),
        (AttemptOutcome.FAILED, ProblemStatus.STRUGGLING),
    ],
)
def test_status_comes_from_latest_outcome(
    outcome: AttemptOutcome,
    status: ProblemStatus,
) -> None:
    latest = attempt(1, datetime(2026, 1, 1, tzinfo=UTC), outcome)

    assert derive_status(latest) is status


def test_review_state_replays_history_chronologically() -> None:
    first = attempt(
        7,
        datetime(2026, 1, 1, 9, tzinfo=UTC),
        AttemptOutcome.OPTIMAL,
        attempt_id="first",
    )
    second = attempt(
        7,
        datetime(2026, 1, 2, 9, tzinfo=UTC),
        AttemptOutcome.HINT,
        attempt_id="second",
    )
    third = attempt(
        7,
        datetime(2026, 1, 3, 9, tzinfo=UTC),
        AttemptOutcome.OPTIMAL,
        attempt_id="third",
    )

    [state] = build_review_states(
        [third, first, second],
        now=datetime(2026, 1, 10, tzinfo=UTC),
        timezone_name="UTC",
    )

    assert state.interval_days == 5
    assert state.last_attempt is third
    assert state.attempt_count == 3
    assert state.lapses == 0
    assert state.confidence == 5
    assert state.due_in_days == -2
    assert state.status is ProblemStatus.SOLVED


def test_failure_resets_interval_streak_and_counts_a_lapse() -> None:
    history = [
        attempt(1, datetime(2026, 1, day, tzinfo=UTC), AttemptOutcome.FAILED)
        for day in range(1, 4)
    ]

    [state] = build_review_states(
        history,
        now=datetime(2026, 1, 5, tzinfo=UTC),
        timezone_name="UTC",
    )

    assert state.interval_days == 1
    assert state.lapses == 3
    assert state.confidence == 0
    assert state.due_in_days == -1
    assert state.status is ProblemStatus.STRUGGLING


def test_due_dates_use_local_calendar_days_across_dst() -> None:
    new_york = ZoneInfo("America/New_York")
    history = [
        attempt(
            1,
            datetime(2026, 3, 7, 23, 30, tzinfo=new_york),
            AttemptOutcome.OPTIMAL,
        )
    ]

    [state] = build_review_states(
        history,
        now=datetime(2026, 3, 9, 0, 1, tzinfo=new_york),
        timezone_name="America/New_York",
    )

    assert state.interval_days == 3
    assert state.due_in_days == 1


def test_due_review_count_includes_today_and_overdue() -> None:
    attempts = [
        attempt(1, datetime(2026, 1, 1, tzinfo=UTC), AttemptOutcome.FAILED),
        attempt(2, datetime(2026, 1, 2, tzinfo=UTC), AttemptOutcome.FAILED),
        attempt(3, datetime(2026, 1, 3, tzinfo=UTC), AttemptOutcome.FAILED),
    ]

    assert (
        due_review_count(
            attempts,
            now=datetime(2026, 1, 3, tzinfo=UTC),
            timezone_name="UTC",
        )
        == 2
    )


def test_mastery_uses_latest_attempt_and_javascript_rounding() -> None:
    attempts = [
        attempt(1, datetime(2026, 1, 1, tzinfo=UTC), AttemptOutcome.OPTIMAL),
        attempt(2, datetime(2026, 1, 1, tzinfo=UTC), AttemptOutcome.SOLUTION),
    ]

    assert mastery_score(attempts) == 63

    attempts.append(attempt(1, datetime(2026, 1, 2, tzinfo=UTC), AttemptOutcome.HINT))

    assert mastery_score(attempts) == 43


def test_mastery_keeps_first_attempt_when_timestamps_tie() -> None:
    completed_at = datetime(2026, 1, 1, tzinfo=UTC)

    assert (
        mastery_score(
            [
                attempt(1, completed_at, AttemptOutcome.OPTIMAL),
                attempt(1, completed_at, AttemptOutcome.FAILED),
            ]
        )
        == 100
    )


def test_catalog_filter_ignores_unknown_problem_ids() -> None:
    attempts = [
        attempt(1, datetime(2026, 1, 1, tzinfo=UTC), AttemptOutcome.OPTIMAL),
        attempt(999, datetime(2026, 1, 1, tzinfo=UTC), AttemptOutcome.FAILED),
    ]
    known_problem_ids = frozenset({1})
    now = datetime(2026, 1, 10, tzinfo=UTC)

    states = build_review_states(
        attempts,
        now=now,
        timezone_name="UTC",
        known_problem_ids=known_problem_ids,
    )

    assert [state.problem_id for state in states] == [1]
    assert mastery_score(attempts, known_problem_ids=known_problem_ids) == 100
    assert (
        due_review_count(
            attempts,
            now=now,
            timezone_name="UTC",
            known_problem_ids=known_problem_ids,
        )
        == 1
    )


def test_mastery_counts_unattempted_catalog_problems_as_zero() -> None:
    attempts = [
        attempt(1, datetime(2026, 1, 1, tzinfo=UTC), AttemptOutcome.OPTIMAL),
    ]

    assert mastery_score(attempts, known_problem_ids={1, 2}) == 50


@pytest.mark.parametrize("field", ["now", "attempt.completed_at"])
def test_naive_datetimes_are_rejected(field: str) -> None:
    aware_attempt = attempt(
        1,
        datetime(2026, 1, 1, tzinfo=UTC),
        AttemptOutcome.OPTIMAL,
    )
    now = datetime(2026, 1, 2, tzinfo=UTC)

    if field == "now":
        now = datetime(2026, 1, 2)
    else:
        aware_attempt = attempt(
            1,
            datetime(2026, 1, 1),
            AttemptOutcome.OPTIMAL,
        )

    with pytest.raises(ValueError, match=field.replace(".", r"\.")):
        build_review_states(
            [aware_attempt],
            now=now,
            timezone_name="UTC",
        )


def test_unknown_timezone_is_rejected() -> None:
    with pytest.raises(ValueError, match="unknown IANA timezone"):
        build_review_states(
            [],
            now=datetime(2026, 1, 1, tzinfo=UTC),
            timezone_name="Mars/Olympus_Mons",
        )


def test_first_clean_attempt_is_due_in_three_days_and_first_lapse_in_one() -> None:
    states = build_review_states(
        [
            attempt(1, datetime(2026, 1, 1, tzinfo=UTC), AttemptOutcome.OPTIMAL),
            attempt(2, datetime(2026, 1, 1, tzinfo=UTC), AttemptOutcome.FAILED),
        ],
        now=datetime(2026, 1, 1, tzinfo=UTC),
        timezone_name="UTC",
    )
    by_problem = {state.problem_id: state for state in states}
    clean = by_problem[1]
    lapse = by_problem[2]

    assert clean.interval_days == 3
    assert clean.due_in_days == 3
    assert lapse.interval_days == 1
    assert lapse.due_in_days == 1


def test_hint_never_increases_a_twenty_day_interval() -> None:
    history = [
        attempt(1, datetime(2026, 1, 1, tzinfo=UTC), AttemptOutcome.OPTIMAL),
        attempt(1, datetime(2026, 1, 4, tzinfo=UTC), AttemptOutcome.OPTIMAL),
        attempt(1, datetime(2026, 1, 12, tzinfo=UTC), AttemptOutcome.OPTIMAL),
        attempt(1, datetime(2026, 2, 1, tzinfo=UTC), AttemptOutcome.HINT),
    ]
    [state] = build_review_states(
        history, now=datetime(2026, 2, 1, tzinfo=UTC), timezone_name="UTC"
    )

    assert state.interval_days == 14


def test_clean_and_quick_progression_and_graduation() -> None:
    history = [
        attempt(1, datetime(2026, 1, 1, tzinfo=UTC), AttemptOutcome.OPTIMAL),
        attempt(1, datetime(2026, 1, 4, tzinfo=UTC), AttemptOutcome.OPTIMAL),
        attempt(1, datetime(2026, 1, 12, tzinfo=UTC), AttemptOutcome.OPTIMAL),
        attempt(1, datetime(2026, 2, 1, tzinfo=UTC), AttemptOutcome.OPTIMAL),
    ]
    intervals = []
    for index in range(1, len(history) + 1):
        [state] = build_review_states(
            history[:index], now=history[index - 1].completed_at, timezone_name="UTC"
        )
        intervals.append(state.interval_days)

    assert intervals == [3, 8, 20, 50]
    assert state.graduated_at == history[-1].completed_at
    assert state.next_due_on is None
    assert (
        due_review_count(
            history, now=datetime(2026, 4, 1, tzinfo=UTC), timezone_name="UTC"
        )
        == 0
    )


def test_early_success_keeps_due_date_but_early_hint_and_lapse_remediate() -> None:
    first = attempt(1, datetime(2026, 1, 1, tzinfo=UTC), AttemptOutcome.OPTIMAL)
    early_clean = attempt(1, datetime(2026, 1, 2, tzinfo=UTC), AttemptOutcome.OPTIMAL)
    early_slow = attempt(
        1,
        datetime(2026, 1, 2, tzinfo=UTC),
        AttemptOutcome.OPTIMAL,
        duration_seconds=31 * 60,
    )
    early_hint = attempt(1, datetime(2026, 1, 2, tzinfo=UTC), AttemptOutcome.HINT)
    early_lapse = attempt(1, datetime(2026, 1, 2, tzinfo=UTC), AttemptOutcome.FAILED)

    def replay(*items: SchedulingAttempt) -> ReviewState:
        return build_review_states(
            items, now=datetime(2026, 1, 2, tzinfo=UTC), timezone_name="UTC"
        )[0]

    assert replay(first, early_clean).next_due_on == datetime(2026, 1, 4).date()
    assert replay(first, early_slow).next_due_on == datetime(2026, 1, 4).date()
    assert replay(first, early_hint).next_due_on == datetime(2026, 1, 4).date()
    assert replay(first, early_lapse).next_due_on == datetime(2026, 1, 3).date()


def test_non_clean_manual_attempt_reactivates_a_graduated_problem() -> None:
    history = [
        attempt(1, datetime(2026, 1, 1, tzinfo=UTC), AttemptOutcome.OPTIMAL),
        attempt(1, datetime(2026, 1, 4, tzinfo=UTC), AttemptOutcome.OPTIMAL),
        attempt(1, datetime(2026, 1, 12, tzinfo=UTC), AttemptOutcome.OPTIMAL),
        attempt(1, datetime(2026, 2, 1, tzinfo=UTC), AttemptOutcome.OPTIMAL),
        attempt(1, datetime(2026, 2, 2, tzinfo=UTC), AttemptOutcome.HINT),
    ]
    [state] = build_review_states(
        history, now=datetime(2026, 2, 2, tzinfo=UTC), timezone_name="UTC"
    )

    assert state.graduated_at is None
    assert state.interval_days == 2
    assert state.due_in_days == 2


@pytest.mark.parametrize(
    ("outcome", "duration_seconds", "difficulty", "expected"),
    [
        (AttemptOutcome.OPTIMAL, 30 * 60, Difficulty.MEDIUM, Fraction(1)),
        (AttemptOutcome.OPTIMAL, 45 * 60, Difficulty.HARD, Fraction(6, 5)),
        (AttemptOutcome.OPTIMAL, 20 * 60, Difficulty.EASY, Fraction(4, 5)),
        (AttemptOutcome.OPTIMAL, 60 * 60, Difficulty.MEDIUM, Fraction(1, 2)),
        (AttemptOutcome.OPTIMAL, 120 * 60, Difficulty.MEDIUM, Fraction(1, 2)),
        (AttemptOutcome.HINT, 30 * 60, Difficulty.MEDIUM, Fraction(3, 5)),
        (AttemptOutcome.SOLUTION, 30 * 60, Difficulty.MEDIUM, Fraction(1, 4)),
        (AttemptOutcome.FAILED, 30 * 60, Difficulty.MEDIUM, Fraction(1, 4)),
    ],
)
def test_attempt_quality_weighs_outcome_difficulty_and_pace(
    outcome: AttemptOutcome,
    duration_seconds: int,
    difficulty: Difficulty,
    expected: Fraction,
) -> None:
    quality = attempt_quality(
        attempt(
            1,
            datetime(2026, 1, 1, tzinfo=UTC),
            outcome,
            duration_seconds=duration_seconds,
            difficulty=difficulty,
        )
    )

    assert quality == expected


def test_attempt_quality_prefers_the_snapshotted_target_over_difficulty_default() -> (
    None
):

    fast_against_snapshot = attempt(
        1,
        datetime(2026, 1, 1, tzinfo=UTC),
        AttemptOutcome.OPTIMAL,
        duration_seconds=20 * 60,
        difficulty=Difficulty.MEDIUM,
        target_minutes=20,
    )

    assert attempt_quality(fast_against_snapshot) == Fraction(1)


def test_readiness_is_zero_for_empty_history() -> None:
    now = datetime(2026, 1, 1, tzinfo=UTC)

    assert readiness_score([], now=now, timezone_name="UTC") == 0


def test_readiness_blends_discounted_mastery_coverage_and_cadence() -> None:

    now = datetime(2026, 1, 1, tzinfo=UTC)
    history = [attempt(1, now, AttemptOutcome.OPTIMAL)]

    score = readiness_score(
        history,
        now=now,
        timezone_name="UTC",
        known_problem_ids={1, 2, 3, 4},
        cadence_window_days=90,
    )

    assert score == 23

    assert score < mastery_score(history, known_problem_ids={1, 2, 3, 4})


def test_readiness_decays_as_a_solved_problem_goes_overdue() -> None:
    completed_at = datetime(2026, 1, 1, tzinfo=UTC)
    history = [attempt(1, completed_at, AttemptOutcome.OPTIMAL)]
    known_problem_ids = {1, 2, 3, 4}

    fresh = readiness_score(
        history,
        now=completed_at,
        timezone_name="UTC",
        known_problem_ids=known_problem_ids,
        cadence_window_days=90,
    )

    stale = readiness_score(
        history,
        now=datetime(2026, 1, 20, tzinfo=UTC),
        timezone_name="UTC",
        known_problem_ids=known_problem_ids,
        cadence_window_days=90,
    )

    assert fresh == 23
    assert stale == 13
    assert stale < fresh


@pytest.mark.parametrize(
    ("outcome", "expected"),
    [
        (AttemptOutcome.OPTIMAL, 90),
        (AttemptOutcome.HINT, 42),
        (AttemptOutcome.SOLUTION, 18),
        (AttemptOutcome.FAILED, 18),
    ],
)
def test_readiness_orders_outcomes_the_same_as_mastery(
    outcome: AttemptOutcome, expected: int
) -> None:
    now = datetime(2026, 1, 1, tzinfo=UTC)
    history = [attempt(1, now, outcome)]

    score = readiness_score(
        history,
        now=now,
        timezone_name="UTC",
        known_problem_ids={1},
        cadence_window_days=90,
    )

    assert score == expected


def test_readiness_rejects_naive_now() -> None:
    with pytest.raises(ValueError, match="now"):
        readiness_score(
            [attempt(1, datetime(2026, 1, 1, tzinfo=UTC), AttemptOutcome.OPTIMAL)],
            now=datetime(2026, 1, 1),
            timezone_name="UTC",
        )
