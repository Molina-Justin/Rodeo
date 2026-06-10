"""Keep the TypeScript policy-v2 projection identical to the Python engine."""

from __future__ import annotations

import json

import pytest

from rodeo.services.scheduling import (
    ENGINE_VERSION,
    ReviewState,
    build_review_states,
    due_review_count,
    mastery_score,
)
from tests.engine_parity import (
    GOLDEN_FIXTURE,
    ParityCase,
    load_parity_fixture,
)

FIXTURE = load_parity_fixture()
CASES = [pytest.param(case, id=case.name) for case in FIXTURE.cases]

def python_states(case: ParityCase) -> dict[int, ReviewState]:
    return {
        state.problem_id: state
        for state in build_review_states(
            case.attempts, now=FIXTURE.now, timezone_name=FIXTURE.timezone
        )
    }


@pytest.mark.parametrize("case", CASES)
def test_mastery_score_is_identical_in_both_engines(case: ParityCase) -> None:
    assert mastery_score(case.attempts) == case.expected["masteryScore"]


@pytest.mark.parametrize("case", CASES)
def test_problem_status_and_history_are_identical_in_both_engines(
    case: ParityCase,
) -> None:
    states = python_states(case)
    recorded = {state["problemId"]: state for state in case.expected["reviewStates"]}

    assert set(states) == set(recorded)

    for problem_id, expected in recorded.items():
        state = states[problem_id]
        assert state.status.value == expected["status"]
        assert state.attempt_count == expected["attemptCount"]
        assert state.lapses == expected["lapses"]
        assert state.confidence == expected["confidence"]
        assert state.last_attempt.attempt_id == expected["lastAttempt"]["id"]


@pytest.mark.parametrize("case", CASES)
def test_review_intervals_are_identical_in_both_engines(
    case: ParityCase,
) -> None:
    states = python_states(case)
    recorded = {state["problemId"]: state for state in case.expected["reviewStates"]}

    for problem_id, expected in recorded.items():
        state = states[problem_id]
        assert state.interval_days == expected["intervalDays"]
        assert state.due_in_days == expected["dueInDays"]
        assert state.clean_quick_streak == expected["cleanQuickStreak"]
        assert (
            None if state.next_due_on is None else state.next_due_on.isoformat()
        ) == expected["nextDueOn"]


def test_the_sidebar_badge_matches_the_server_due_count() -> None:
    disagreeing = {
        case.name
        for case in FIXTURE.cases
        if due_review_count(
            case.attempts, now=FIXTURE.now, timezone_name=FIXTURE.timezone
        )
        != case.expected["dueReviewCount"]
    }

    assert disagreeing == set()


def test_policy_v2_scheduling_matches_the_golden_snapshot() -> None:
    """Pins the v2 engine's own output.

    Regenerate with ``.venv/bin/python scripts/dump_engine_golden.py`` and read
    the diff; an unexplained change here is a scheduling regression.
    """
    golden = json.loads(GOLDEN_FIXTURE.read_text())

    assert golden["engineVersion"] == ENGINE_VERSION, (
        "The engine version moved without the golden snapshot being regenerated."
    )

    for case in FIXTURE.cases:
        expected = golden["cases"][case.name]
        states = build_review_states(
            case.attempts, now=FIXTURE.now, timezone_name=FIXTURE.timezone
        )

        assert mastery_score(case.attempts) == expected["masteryScore"], case.name
        assert (
            due_review_count(
                case.attempts, now=FIXTURE.now, timezone_name=FIXTURE.timezone
            )
            == expected["dueReviewCount"]
        ), case.name
        assert len(states) == len(expected["reviewStates"]), case.name

        for state, row in zip(states, expected["reviewStates"], strict=True):
            assert state.problem_id == row["problemId"], case.name
            assert state.interval_days == row["intervalDays"], case.name
            assert state.due_in_days == row["dueInDays"], case.name
            assert state.confidence == row["confidence"], case.name
            assert state.lapses == row["lapses"], case.name
            assert state.status.value == row["status"], case.name
            assert state.clean_quick_streak == row["cleanQuickStreak"], case.name
            assert (
                None if state.next_due_on is None else state.next_due_on.isoformat()
            ) == row["nextDueOn"], case.name
