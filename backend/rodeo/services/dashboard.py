"""Read-only, bounded dashboard projections from catalog and durable attempts."""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime, timedelta
from math import floor
from typing import TypedDict
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from rodeo.models import Attempt, Problem, ReviewState
from rodeo.models.enums import ProblemStatus
from rodeo.schemas.dashboard import (
    ActivityDay,
    ConsistencyResponse,
    DashboardResponse,
    ReviewQueueItem,
    TopicFocusResponse,
)
from rodeo.services.scheduling import (
    AttemptOutcome as SchedulingOutcome,
)
from rodeo.services.scheduling import (
    Difficulty as SchedulingDifficulty,
)
from rodeo.services.scheduling import SchedulingAttempt, mastery_score, readiness_score

TOPIC_MASTERY_SAMPLE_TARGET = 50

QUEUE_LIMIT = 6


class ActivityDayRow(TypedDict):
    key: str
    minutes: float
    problem_count: int
    activity_level: int


class TopicRow(TypedDict):
    topic: str
    score: int
    attempted: int
    problem_count: int
    weight: float
    due_count: int


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _due_in_days(review: ReviewState, now: datetime, timezone: ZoneInfo) -> int | None:
    if review.next_due_on is not None:
        return (review.next_due_on - now.astimezone(timezone).date()).days
    if review.due_at is None:
        return None
    return (
        _aware(review.due_at).astimezone(timezone).date()
        - now.astimezone(timezone).date()
    ).days


def _activity_level(minutes: float) -> int:
    if minutes <= 0:
        return 0
    if minutes < 30:
        return 1
    if minutes < 60:
        return 2
    return 3 if minutes < 100 else 4


def dashboard(
    database: Session, *, now: datetime, timezone_name: str, range_days: int
) -> DashboardResponse:
    timezone = ZoneInfo(timezone_name)
    now = _aware(now)
    problems = database.scalars(
        select(Problem)
        .where(Problem.active.is_(True))
        .options(selectinload(Problem.topics))
    ).all()
    ids = {problem.id for problem in problems}
    problems_by_id = {problem.id: problem for problem in problems}
    attempts = (
        database.scalars(
            select(Attempt)
            .where(Attempt.problem_id.in_(ids))
            .order_by(Attempt.completed_at, Attempt.created_at, Attempt.id)
        ).all()
        if ids
        else []
    )
    states = (
        {
            state.problem_id: state
            for state in database.scalars(
                select(ReviewState).where(ReviewState.problem_id.in_(ids))
            ).all()
        }
        if ids
        else {}
    )
    latest: dict[int, Attempt] = {}
    for attempt in attempts:
        latest[attempt.problem_id] = attempt
    scheduling_attempts = [
        SchedulingAttempt(
            problem_id=item.problem_id,
            completed_at=_aware(item.completed_at),
            outcome=SchedulingOutcome(item.outcome.value),
            attempt_id=item.id,
            duration_seconds=item.duration_seconds,
            difficulty=SchedulingDifficulty(
                item.problem_difficulty_at_attempt
                or problems_by_id[item.problem_id].difficulty.value
            ),
            target_minutes=item.target_minutes_at_attempt,
        )
        for item in attempts
    ]
    mastery = mastery_score(scheduling_attempts, known_problem_ids=ids)
    readiness = readiness_score(
        scheduling_attempts,
        now=now,
        timezone_name=timezone_name,
        known_problem_ids=ids,
        cadence_window_days=range_days,
    )
    solved = {
        problem_id
        for problem_id, attempt in latest.items()
        if attempt.outcome.value == "optimal"
    }

    minutes_by_day: dict[str, float] = {}
    count_by_day: Counter[str] = Counter()
    for attempt in attempts:
        key = _aware(attempt.completed_at).astimezone(timezone).date().isoformat()
        minutes_by_day[key] = (
            minutes_by_day.get(key, 0.0) + attempt.duration_seconds / 60
        )
        count_by_day[key] += 1
    today = now.astimezone(timezone).date()
    days: list[ActivityDayRow] = []
    for offset in range(range_days - 1, -1, -1):
        day = today - timedelta(days=offset)
        key = day.isoformat()
        minutes = round(minutes_by_day.get(key, 0.0), 2)
        days.append(
            {
                "key": key,
                "minutes": minutes,
                "problem_count": count_by_day[key],
                "activity_level": _activity_level(minutes),
            }
        )
    active_keys = sorted(key for key, count in count_by_day.items() if count)
    best_streak = streak = 0
    previous = None
    for key in active_keys:
        day = datetime.fromisoformat(key).date()
        streak = (
            streak + 1 if previous is not None and (day - previous).days == 1 else 1
        )
        best_streak = max(best_streak, streak)
        previous = day
    cursor = today if count_by_day[today.isoformat()] else today - timedelta(days=1)
    current_streak = 0
    while count_by_day[cursor.isoformat()]:
        current_streak += 1
        cursor -= timedelta(days=1)

    queue: list[ReviewQueueItem] = []
    for problem_id, state in sorted(
        states.items(), key=lambda pair: _due_in_days(pair[1], now, timezone) or 0
    ):
        due_in_days = _due_in_days(state, now, timezone)
        if due_in_days is not None and due_in_days <= 0:
            problem = problems_by_id[problem_id]
            queue.append(
                ReviewQueueItem(
                    problem_id=problem_id,
                    title=problem.title,
                    topic=problem.topics[0].name if problem.topics else "General",
                    status=state.status,
                    due_in_days=due_in_days,
                )
            )
    queue = queue[:QUEUE_LIMIT]

    topic_rows: dict[str, TopicRow] = {}
    for problem in problems:
        for topic in problem.topics:
            item = topic_rows.setdefault(
                topic.name,
                {
                    "topic": topic.name,
                    "score": 0,
                    "attempted": 0,
                    "problem_count": 0,
                    "weight": 0.0,
                    "due_count": 0,
                },
            )
            item["problem_count"] += 1
            problem_state = states.get(problem.id)
            if problem_state and problem_state.attempt_count:
                item["attempted"] += 1
                item["weight"] = (
                    item["weight"]
                    + {
                        ProblemStatus.SOLVED: 1,
                        ProblemStatus.REVIEW: 0.6,
                        ProblemStatus.STRUGGLING: 0.25,
                        ProblemStatus.NOT_STARTED: 0,
                    }[problem_state.status]
                )
                due_in_days = _due_in_days(problem_state, now, timezone)
                if due_in_days is not None and due_in_days <= 0:
                    item["due_count"] += 1
    focuses: list[TopicFocusResponse] = []
    for item in topic_rows.values():
        mastery_denominator = min(item["problem_count"], TOPIC_MASTERY_SAMPLE_TARGET)
        item["score"] = (
            floor(item["weight"] / mastery_denominator * 100 + 0.5)
            if item["problem_count"]
            else 0
        )
        focuses.append(
            TopicFocusResponse(
                topic=item["topic"],
                score=item["score"],
                attempted=item["attempted"],
                problem_count=item["problem_count"],
                due_count=item["due_count"],
            )
        )
    focuses.sort(
        key=lambda item: (
            0 if item.due_count else 1 if item.attempted else 2,
            -item.due_count,
            item.score,
            item.topic,
        )
    )
    return DashboardResponse(
        attempt_count=len(attempts),
        solved_count=len(solved),
        logged_today=count_by_day[today.isoformat()],
        mastery_score=mastery,
        readiness_score=readiness,
        due_count=sum(
            1
            for state in states.values()
            if (due_in_days := _due_in_days(state, now, timezone)) is not None
            and due_in_days <= 0
        ),
        consistency=ConsistencyResponse(
            days=tuple(ActivityDay(**day) for day in days),
            minutes=round(sum(day["minutes"] for day in days), 2),
            problem_count=sum(day["problem_count"] for day in days),
            streak=current_streak,
            best_streak=best_streak,
        ),
        focuses=tuple(focuses),
        review_queue=tuple(queue),
    )
