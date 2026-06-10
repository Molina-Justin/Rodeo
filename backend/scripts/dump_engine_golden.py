"""Regenerate the policy-v2 golden snapshot from the Python engine.

Run after a deliberate change to ``rodeo.services.scheduling``:

    .venv/bin/python scripts/dump_engine_golden.py

Review the diff. An unexplained change to the snapshot is a scheduling
regression, which is the whole reason the file is checked in.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from rodeo.services.scheduling import (
    ENGINE_VERSION,
    build_review_states,
    due_review_count,
    mastery_score,
)
from tests.engine_parity import GOLDEN_FIXTURE, load_parity_fixture


def build_golden() -> dict[str, Any]:
    fixture = load_parity_fixture()
    cases: dict[str, Any] = {}

    for case in fixture.cases:
        states = build_review_states(
            case.attempts, now=fixture.now, timezone_name=fixture.timezone
        )
        cases[case.name] = {
            "masteryScore": mastery_score(case.attempts),
            "dueReviewCount": due_review_count(
                case.attempts, now=fixture.now, timezone_name=fixture.timezone
            ),
            "reviewStates": [
                {
                    "problemId": state.problem_id,
                    "lastAttemptId": state.last_attempt.attempt_id,
                    "attemptCount": state.attempt_count,
                    "intervalDays": state.interval_days,
                    "lapses": state.lapses,
                    "confidence": state.confidence,
                    "dueInDays": state.due_in_days,
                    "status": state.status.value,
                    "nextDueOn": (
                        None if state.next_due_on is None else state.next_due_on
                    ),
                    "graduatedAt": (
                        None
                        if state.graduated_at is None
                        else state.graduated_at.isoformat()
                    ),
                    "cleanQuickStreak": state.clean_quick_streak,
                }
                for state in states
            ],
        }

    return {
        "engineVersion": ENGINE_VERSION,
        "timezone": fixture.timezone,
        "now": fixture.now.isoformat(),
        "cases": cases,
    }


if __name__ == "__main__":
    GOLDEN_FIXTURE.write_text(f"{json.dumps(build_golden(), indent=2, default=str)}\n")
    print(f"wrote {GOLDEN_FIXTURE}")
