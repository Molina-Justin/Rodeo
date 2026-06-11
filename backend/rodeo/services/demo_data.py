"""Realistic, disposable practice history for backup and UI testing."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from rodeo.models import (
    AppSetting,
    Attempt,
    AttemptBlocker,
    AttemptEffort,
    AttemptOutcome,
    Job,
    PracticeSession,
    PracticeSessionStatus,
    Problem,
    Recording,
    ReviewState,
    Transcription,
)
from rodeo.schemas.attempts import AttemptCreate
from rodeo.schemas.system import InterviewGoalsUpdate
from rodeo.services.attempts import create_attempt
from rodeo.services.system import update_interview_goals, update_prompt_template


class DemoDataError(RuntimeError):
    """Demo data cannot be added without risking existing workspace data."""


@dataclass(frozen=True, slots=True)
class DemoDataSummary:
    attempts: int
    practice_sessions: int
    problems_practiced: int
    settings: int


@dataclass(frozen=True, slots=True)
class _DemoAttempt:
    problem_id: int
    days_ago: int
    duration_seconds: int
    outcome: AttemptOutcome
    effort: AttemptEffort
    blocker: AttemptBlocker
    notes: str
    timed: bool = False


DEMO_ATTEMPTS = (
    _DemoAttempt(
        1,
        78,
        1_680,
        AttemptOutcome.HINT,
        AttemptEffort.HEAVY,
        AttemptBlocker.PATTERN,
        "Started with a nested loop, then recognized the complement hash map.",
        True,
    ),
    _DemoAttempt(
        1,
        42,
        720,
        AttemptOutcome.OPTIMAL,
        AttemptEffort.MODERATE,
        AttemptBlocker.NONE,
        "One-pass hash map. Explained why each complement is checked first.",
    ),
    _DemoAttempt(
        1,
        12,
        510,
        AttemptOutcome.OPTIMAL,
        AttemptEffort.LIGHT,
        AttemptBlocker.NONE,
        "Clean solve; covered duplicate values and negative numbers.",
        True,
    ),
    _DemoAttempt(
        2,
        70,
        2_700,
        AttemptOutcome.SOLUTION,
        AttemptEffort.BRUTAL,
        AttemptBlocker.IMPLEMENTATION,
        "Lost track of the carry and advanced the lists inconsistently.",
    ),
    _DemoAttempt(
        2,
        29,
        1_950,
        AttemptOutcome.HINT,
        AttemptEffort.HEAVY,
        AttemptBlocker.EDGE_CASES,
        "Needed a reminder to append a final carry after both lists end.",
        True,
    ),
    _DemoAttempt(
        2,
        5,
        1_260,
        AttemptOutcome.OPTIMAL,
        AttemptEffort.MODERATE,
        AttemptBlocker.NONE,
        "Dummy head kept the loop simple; stated O(max(m, n)) time.",
    ),
    _DemoAttempt(
        3,
        61,
        2_160,
        AttemptOutcome.FAILED,
        AttemptEffort.HEAVY,
        AttemptBlocker.DEBUGGING,
        "Window start moved backward after a repeated character.",
    ),
    _DemoAttempt(
        3,
        18,
        1_140,
        AttemptOutcome.OPTIMAL,
        AttemptEffort.MODERATE,
        AttemptBlocker.NONE,
        "Tracked last-seen indexes and only moved the left edge forward.",
        True,
    ),
    _DemoAttempt(
        4,
        36,
        3_420,
        AttemptOutcome.FAILED,
        AttemptEffort.BRUTAL,
        AttemptBlocker.COMPLEXITY,
        "Could describe partitioning but not derive the boundary conditions.",
    ),
    _DemoAttempt(
        4,
        4,
        2_880,
        AttemptOutcome.SOLUTION,
        AttemptEffort.HEAVY,
        AttemptBlocker.PATTERN,
        "Replayed the binary-search partition and wrote down both sentinels.",
        True,
    ),
    _DemoAttempt(
        5,
        23,
        1_920,
        AttemptOutcome.HINT,
        AttemptEffort.HEAVY,
        AttemptBlocker.PATTERN,
        "Needed the expand-around-center idea; even centers were easy to miss.",
    ),
    _DemoAttempt(
        11,
        17,
        900,
        AttemptOutcome.OPTIMAL,
        AttemptEffort.MODERATE,
        AttemptBlocker.NONE,
        "Proved that moving the shorter wall is the only useful choice.",
        True,
    ),
    _DemoAttempt(
        15,
        31,
        2_520,
        AttemptOutcome.SOLUTION,
        AttemptEffort.HEAVY,
        AttemptBlocker.EDGE_CASES,
        "Found triplets but emitted duplicates from repeated anchor values.",
    ),
    _DemoAttempt(
        15,
        7,
        1_740,
        AttemptOutcome.HINT,
        AttemptEffort.MODERATE,
        AttemptBlocker.IMPLEMENTATION,
        "Sorted first and skipped duplicates at the anchor and both pointers.",
    ),
    _DemoAttempt(
        20,
        52,
        660,
        AttemptOutcome.OPTIMAL,
        AttemptEffort.LIGHT,
        AttemptBlocker.NONE,
        "Stack held opening brackets; checked empty stack before every pop.",
    ),
    _DemoAttempt(
        20,
        16,
        390,
        AttemptOutcome.OPTIMAL,
        AttemptEffort.LIGHT,
        AttemptBlocker.NONE,
        "Fast clean review with mismatched and unfinished input cases.",
    ),
    _DemoAttempt(
        21,
        27,
        780,
        AttemptOutcome.OPTIMAL,
        AttemptEffort.MODERATE,
        AttemptBlocker.NONE,
        "Used a sentinel node and compared one node from each list.",
    ),
    _DemoAttempt(
        22,
        3,
        1_320,
        AttemptOutcome.OPTIMAL,
        AttemptEffort.MODERATE,
        AttemptBlocker.NONE,
        "Backtracking state was just the string plus open and close counts.",
        True,
    ),
    _DemoAttempt(
        23,
        10,
        3_180,
        AttemptOutcome.FAILED,
        AttemptEffort.BRUTAL,
        AttemptBlocker.COMPLEXITY,
        "Pairwise scanning worked but missed the expected heap complexity.",
    ),
    _DemoAttempt(
        49,
        21,
        960,
        AttemptOutcome.OPTIMAL,
        AttemptEffort.MODERATE,
        AttemptBlocker.NONE,
        "Used a 26-count tuple as the grouping key and discussed Unicode.",
    ),
    _DemoAttempt(
        53,
        14,
        840,
        AttemptOutcome.HINT,
        AttemptEffort.MODERATE,
        AttemptBlocker.PATTERN,
        "Remembered Kadane after first trying to enumerate every subarray.",
    ),
    _DemoAttempt(
        70,
        47,
        540,
        AttemptOutcome.OPTIMAL,
        AttemptEffort.LIGHT,
        AttemptBlocker.NONE,
        "Reduced the DP to two rolling values and handled n=1 explicitly.",
    ),
    _DemoAttempt(
        121,
        9,
        480,
        AttemptOutcome.OPTIMAL,
        AttemptEffort.LIGHT,
        AttemptBlocker.NONE,
        "Maintained the cheapest buy so far and the best profit so far.",
    ),
    _DemoAttempt(
        200,
        6,
        1_860,
        AttemptOutcome.HINT,
        AttemptEffort.HEAVY,
        AttemptBlocker.IMPLEMENTATION,
        "Traversal was right; initially marked cells visited after enqueueing.",
        True,
    ),
    _DemoAttempt(
        206,
        2,
        600,
        AttemptOutcome.OPTIMAL,
        AttemptEffort.LIGHT,
        AttemptBlocker.NONE,
        "Named prev, current, and next before changing any pointers.",
    ),
    _DemoAttempt(
        322,
        1,
        2_040,
        AttemptOutcome.SOLUTION,
        AttemptEffort.HEAVY,
        AttemptBlocker.PATTERN,
        "Greedy counterexample led to bottom-up DP over every amount.",
    ),
)

_USER_TABLES = (
    Attempt,
    PracticeSession,
    Recording,
    Transcription,
    ReviewState,
    Job,
    AppSetting,
)


def _require_empty_workspace(session: Session) -> None:
    populated = {
        model.__tablename__: session.scalar(select(func.count()).select_from(model))
        or 0
        for model in _USER_TABLES
    }
    populated = {name: count for name, count in populated.items() if count > 0}
    if not populated:
        return
    detail = ", ".join(f"{name}={count}" for name, count in populated.items())
    raise DemoDataError(
        "Demo data is only added to an empty workspace; existing data was found "
        f"({detail})."
    )


def seed_demo_data(
    session: Session,
    *,
    now: datetime,
    timezone_name: str,
) -> DemoDataSummary:
    """Populate an empty catalog with deterministic, realistic practice history.

    The caller owns the transaction. Any failure rolls back the entire fixture.
    """
    _require_empty_workspace(session)
    timestamp = now.astimezone(UTC)
    problem_ids = {entry.problem_id for entry in DEMO_ATTEMPTS}
    available_ids = set(
        session.scalars(select(Problem.id).where(Problem.id.in_(problem_ids)))
    )
    missing_ids = sorted(problem_ids - available_ids)
    if missing_ids:
        raise DemoDataError(
            "The bundled problem catalog is missing demo problem IDs: "
            + ", ".join(str(problem_id) for problem_id in missing_ids)
        )

    session_count = 0
    ordered_attempts = sorted(DEMO_ATTEMPTS, key=lambda item: -item.days_ago)
    for index, entry in enumerate(ordered_attempts):
        completed_at = (timestamp - timedelta(days=entry.days_ago)).replace(
            hour=19,
            minute=(index * 7) % 60,
            second=0,
            microsecond=0,
        )
        practice_session_id: str | None = None
        if entry.timed:
            started_at = completed_at - timedelta(seconds=entry.duration_seconds)
            practice_session = PracticeSession(
                problem_id=entry.problem_id,
                status=PracticeSessionStatus.FINALIZED,
                started_at=started_at,
                accumulated_active_ms=entry.duration_seconds * 1_000,
                stopped_at=completed_at,
                finalized_at=completed_at,
            )
            session.add(practice_session)
            session.flush()
            practice_session_id = practice_session.id
            session_count += 1

        create_attempt(
            session,
            problem_id=entry.problem_id,
            payload=AttemptCreate(
                completed_at=completed_at,
                duration_seconds=entry.duration_seconds,
                outcome=entry.outcome,
                effort=entry.effort,
                blocker=entry.blocker,
                notes=entry.notes,
            ),
            idempotency_key=f"demo-attempt-{index + 1:02d}",
            now=timestamp,
            timezone_name=timezone_name,
            practice_session_id=practice_session_id,
        )

    update_interview_goals(
        session,
        goals=InterviewGoalsUpdate(
            target_role="Senior backend engineer",
            target_date=(timestamp.date() + timedelta(days=75)).isoformat(),
            years_experience=5,
        ),
        now=timestamp,
    )
    update_prompt_template(
        session,
        template_key="session",
        template=(
            "Build a {{minutes}}-minute {{topic}} practice set with "
            "{{problem_count}} problems. Prioritize overdue work and my recurring "
            "{{blocker}} blocker, then explain the order."
        ),
        now=timestamp,
    )

    return DemoDataSummary(
        attempts=len(DEMO_ATTEMPTS),
        practice_sessions=session_count,
        problems_practiced=len(problem_ids),
        settings=2,
    )


__all__ = ["DemoDataError", "DemoDataSummary", "seed_demo_data"]
