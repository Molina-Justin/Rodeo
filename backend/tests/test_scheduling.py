from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from rodeo.services.scheduling import (
    AttemptOutcome,
    ProblemStatus,
    SchedulingAttempt,
    build_review_states,
    derive_status,
    due_review_count,
    mastery_score,
)


def attempt(
    problem_id: int,
    completed_at: datetime,
    outcome: AttemptOutcome,
    *,
    attempt_id: str | None = None,
) -> SchedulingAttempt:
    return SchedulingAttempt(
        problem_id=problem_id,
        completed_at=completed_at,
        outcome=outcome,
        attempt_id=attempt_id,
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

    # JS Math.round parity: 1 * 2.5 = 3, 3 * 1.5 = 5, 5 * 2.5 = 13.
    assert state.interval_days == 13
    assert state.last_attempt is third
    assert state.attempt_count == 3
    assert state.lapses == 0
    assert state.confidence == 5
    assert state.due_in_days == 6
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

    # The clocks changed on March 8, but March 10 is still one calendar day away.
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

    # (1.0 + 0.25) / 2 * 100 = 62.5; Math.round returns 63.
    assert mastery_score(attempts) == 63

    attempts.append(
        attempt(1, datetime(2026, 1, 2, tzinfo=UTC), AttemptOutcome.HINT)
    )

    # (0.6 + 0.25) / 2 * 100 = 42.5; Math.round returns 43.
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


def test_frozen_typescript_fixtures_match() -> None:
    fixture_path = Path(__file__).parent / "fixtures" / "dashboard-parity.json"
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    now = datetime.fromisoformat(fixture["now"].replace("Z", "+00:00"))

    for case_name, case in fixture["cases"].items():
        attempts = [
            SchedulingAttempt(
                problem_id=item["problemId"],
                completed_at=datetime.fromisoformat(
                    item["completedAt"].replace("Z", "+00:00")
                ),
                outcome=AttemptOutcome(item["outcome"]),
                attempt_id=item["id"],
            )
            for item in case["attempts"]
        ]
        states = build_review_states(
            attempts,
            now=now,
            timezone_name=fixture["timezone"],
        )
        actual = [
            {
                "problemId": state.problem_id,
                "lastAttemptId": state.last_attempt.attempt_id,
                "attemptCount": state.attempt_count,
                "intervalDays": state.interval_days,
                "lapses": state.lapses,
                "confidence": state.confidence,
                "dueInDays": state.due_in_days,
                "status": state.status.value,
            }
            for state in states
        ]
        expected = [
            {
                "problemId": state["problemId"],
                "lastAttemptId": state["lastAttempt"]["id"],
                "attemptCount": state["attemptCount"],
                "intervalDays": state["intervalDays"],
                "lapses": state["lapses"],
                "confidence": state["confidence"],
                "dueInDays": state["dueInDays"],
                "status": state["status"],
            }
            for state in case["expected"]["reviewStates"]
        ]

        assert actual == expected, case_name
        assert (
            due_review_count(
                attempts,
                now=now,
                timezone_name=fixture["timezone"],
            )
            == case["expected"]["dueReviewCount"]
        ), case_name
        assert mastery_score(attempts) == case["expected"]["masteryScore"], case_name
