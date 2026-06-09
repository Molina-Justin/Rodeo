"""Read-only, bounded dashboard projections from catalog and durable attempts."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from rodeo.models import Attempt, Problem, ReviewState
from rodeo.models.enums import ProblemStatus
from rodeo.services.scheduling import SchedulingAttempt, mastery_score

QUEUE_LIMIT = 6


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _due_in_days(review: ReviewState, now: datetime, timezone: ZoneInfo) -> int | None:
    if review.due_at is None:
        return None
    return (_aware(review.due_at).astimezone(timezone).date() - now.astimezone(timezone).date()).days


def _activity_level(minutes: float) -> int:
    if minutes <= 0:
        return 0
    if minutes < 30:
        return 1
    if minutes < 60:
        return 2
    return 3 if minutes < 100 else 4


def dashboard(database: Session, *, now: datetime, timezone_name: str, range_days: int) -> dict[str, object]:
    timezone = ZoneInfo(timezone_name)
    now = _aware(now)
    problems = database.scalars(
        select(Problem).where(Problem.active.is_(True)).options(selectinload(Problem.topics))
    ).all()
    ids = {problem.id for problem in problems}
    attempts = database.scalars(select(Attempt).where(Attempt.problem_id.in_(ids)).order_by(Attempt.completed_at, Attempt.created_at, Attempt.id)).all() if ids else []
    states = {state.problem_id: state for state in database.scalars(select(ReviewState).where(ReviewState.problem_id.in_(ids))).all()} if ids else {}
    latest: dict[int, Attempt] = {}
    histories: dict[int, list[Attempt]] = defaultdict(list)
    for attempt in attempts:
        histories[attempt.problem_id].append(attempt)
        latest[attempt.problem_id] = attempt
    scheduling_attempts = [SchedulingAttempt(problem_id=item.problem_id, completed_at=_aware(item.completed_at), outcome=item.outcome, attempt_id=item.id) for item in attempts]
    mastery = mastery_score(scheduling_attempts, known_problem_ids=ids)
    solved = {problem_id for problem_id, attempt in latest.items() if attempt.outcome.value == "optimal"}

    minutes_by_day: Counter[str] = Counter()
    count_by_day: Counter[str] = Counter()
    for attempt in attempts:
        key = _aware(attempt.completed_at).astimezone(timezone).date().isoformat()
        minutes_by_day[key] += attempt.duration_seconds / 60
        count_by_day[key] += 1
    today = now.astimezone(timezone).date()
    days = []
    for offset in range(range_days - 1, -1, -1):
        day = today - timedelta(days=offset)
        key = day.isoformat()
        minutes = round(minutes_by_day[key], 2)
        days.append({"key": key, "minutes": minutes, "problem_count": count_by_day[key], "activity_level": _activity_level(minutes)})
    active_keys = sorted(key for key, count in count_by_day.items() if count)
    best_streak = streak = 0
    previous = None
    for key in active_keys:
        day = datetime.fromisoformat(key).date()
        streak = streak + 1 if previous is not None and (day - previous).days == 1 else 1
        best_streak = max(best_streak, streak)
        previous = day
    cursor = today if count_by_day[today.isoformat()] else today - timedelta(days=1)
    current_streak = 0
    while count_by_day[cursor.isoformat()]:
        current_streak += 1
        cursor -= timedelta(days=1)

    problems_by_id = {problem.id: problem for problem in problems}
    queue = []
    for problem_id, state in sorted(states.items(), key=lambda pair: _due_in_days(pair[1], now, timezone) or 0):
        due_in_days = _due_in_days(state, now, timezone)
        if due_in_days is not None and due_in_days <= 0:
            problem = problems_by_id[problem_id]
            queue.append({"problem_id": problem_id, "title": problem.title, "topic": problem.topics[0].name if problem.topics else "General", "status": state.status.value, "due_in_days": due_in_days})
    queue = queue[:QUEUE_LIMIT]

    topic_rows: dict[str, dict[str, object]] = {}
    for problem in problems:
        for topic in problem.topics:
            item = topic_rows.setdefault(topic.name, {"topic": topic.name, "score": 0, "attempted": 0, "problem_count": 0, "weight": 0.0, "due_count": 0})
            item["problem_count"] = int(item["problem_count"]) + 1
            state = states.get(problem.id)
            if state and state.attempt_count:
                item["attempted"] = int(item["attempted"]) + 1
                item["weight"] = float(item["weight"]) + {ProblemStatus.SOLVED: 1, ProblemStatus.REVIEW: .6, ProblemStatus.STRUGGLING: .25, ProblemStatus.NOT_STARTED: 0}[state.status]
                due_in_days = _due_in_days(state, now, timezone)
                if due_in_days is not None and due_in_days <= 0:
                    item["due_count"] = int(item["due_count"]) + 1
    focuses = []
    for item in topic_rows.values():
        attempted = int(item.pop("attempted"))
        weight = float(item.pop("weight"))
        item["attempted"] = attempted
        item["score"] = round(weight / attempted * 100) if attempted else 0
        focuses.append(item)
    focuses.sort(key=lambda item: (0 if item["due_count"] else 1 if item["attempted"] else 2, -int(item["due_count"]), int(item["score"]), str(item["topic"])))
    return {
        "attempt_count": len(attempts), "solved_count": len(solved),
        "logged_today": count_by_day[today.isoformat()], "mastery_score": mastery,
        "due_count": sum(
            1
            for state in states.values()
            if (due_in_days := _due_in_days(state, now, timezone)) is not None
            and due_in_days <= 0
        ),
        "consistency": {"days": days, "minutes": round(sum(day["minutes"] for day in days), 2), "problem_count": sum(day["problem_count"] for day in days), "streak": current_streak, "best_streak": best_streak},
        "focuses": focuses, "review_queue": queue,
    }
