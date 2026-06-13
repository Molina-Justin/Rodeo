from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from rodeo.models import (
    Attempt,
    AttemptEffort,
    AttemptOutcome,
    Base,
    Difficulty,
    Problem,
    ProblemTopic,
    Topic,
)
from rodeo.services.attempts import recompute_problem_review_state
from rodeo.services.dashboard import dashboard

NOW = datetime(2026, 8, 29, 12, tzinfo=UTC)
TIMEZONE = "UTC"


@pytest.fixture
def db_session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as session:
        yield session
    engine.dispose()


def add_problem(
    session: Session,
    problem_id: int,
    *,
    topic: Topic,
    difficulty: Difficulty = Difficulty.MEDIUM,
) -> Problem:
    problem = Problem(
        id=problem_id,
        title=f"Problem {problem_id}",
        slug=f"problem-{problem_id}",
        difficulty=difficulty,
        premium=False,
        acceptance=50.0,
        active=True,
    )
    session.add(problem)
    session.flush()
    session.add(ProblemTopic(problem_id=problem.id, topic_id=topic.id))
    session.flush()
    return problem


def add_attempt(
    session: Session,
    *,
    problem_id: int,
    outcome: AttemptOutcome,
    completed_at: datetime = NOW,
    duration_seconds: int = 600,
) -> None:
    session.add(
        Attempt(
            problem_id=problem_id,
            completed_at=completed_at,
            duration_seconds=duration_seconds,
            outcome=outcome,
            effort=AttemptEffort.MODERATE,
        )
    )
    session.flush()
    recompute_problem_review_state(
        session, problem_id=problem_id, now=NOW, timezone_name=TIMEZONE
    )


def test_topic_score_is_weighted_by_full_catalog_not_just_attempted(
    db_session: Session,
) -> None:
    """A topic's score must track coverage of the whole topic, not the average
    quality of whichever problems happen to have been attempted. Dividing by
    the attempted count instead of the topic's problem count lets one optimal
    solve saturate the topic at 100%, so every later solve in that topic
    reports the same 100% and looks like it changed nothing.
    """

    topic = Topic(name="Arrays", slug="arrays")
    db_session.add(topic)
    db_session.flush()
    for problem_id in (1, 2, 3, 4):
        add_problem(db_session, problem_id, topic=topic)

    add_attempt(db_session, problem_id=1, outcome=AttemptOutcome.OPTIMAL)
    db_session.commit()

    first = dashboard(db_session, now=NOW, timezone_name=TIMEZONE, range_days=90)
    [arrays_after_one] = [f for f in first.focuses if f.topic == "Arrays"]
    assert arrays_after_one.score == 25

    add_attempt(db_session, problem_id=2, outcome=AttemptOutcome.OPTIMAL)
    db_session.commit()

    second = dashboard(db_session, now=NOW, timezone_name=TIMEZONE, range_days=90)
    [arrays_after_two] = [f for f in second.focuses if f.topic == "Arrays"]
    assert arrays_after_two.score == 50


def test_large_topic_mastery_requires_realistic_distinct_problem_breadth(
    db_session: Session,
) -> None:
    """A couple of wins cannot imply mastery, while the target remains attainable."""

    topic = Topic(name="Arrays", slug="arrays")
    db_session.add(topic)
    db_session.flush()
    for problem_id in range(1, 101):
        add_problem(db_session, problem_id, topic=topic)

    for problem_id in (1, 2):
        add_attempt(db_session, problem_id=problem_id, outcome=AttemptOutcome.OPTIMAL)
    db_session.commit()

    after_two = dashboard(db_session, now=NOW, timezone_name=TIMEZONE, range_days=90)
    [arrays_after_two] = [f for f in after_two.focuses if f.topic == "Arrays"]
    assert arrays_after_two.score == 4

    for problem_id in range(3, 26):
        add_attempt(db_session, problem_id=problem_id, outcome=AttemptOutcome.OPTIMAL)
    db_session.commit()

    after_twenty_five = dashboard(
        db_session, now=NOW, timezone_name=TIMEZONE, range_days=90
    )
    [arrays_after_twenty_five] = [
        f for f in after_twenty_five.focuses if f.topic == "Arrays"
    ]
    assert arrays_after_twenty_five.score == 50


def test_topic_mastery_rounding_matches_the_browser(db_session: Session) -> None:
    topic = Topic(name="Arrays", slug="arrays")
    db_session.add(topic)
    db_session.flush()
    for problem_id in range(1, 101):
        add_problem(db_session, problem_id, topic=topic)

    add_attempt(db_session, problem_id=1, outcome=AttemptOutcome.FAILED)
    db_session.commit()

    result = dashboard(db_session, now=NOW, timezone_name=TIMEZONE, range_days=90)
    [arrays] = [f for f in result.focuses if f.topic == "Arrays"]
    assert arrays.score == 1


def test_topic_score_ignores_problems_from_other_topics(db_session: Session) -> None:
    arrays = Topic(name="Arrays", slug="arrays")
    graphs = Topic(name="Graphs", slug="graphs")
    db_session.add_all([arrays, graphs])
    db_session.flush()

    add_problem(db_session, 1, topic=arrays)
    add_problem(db_session, 2, topic=graphs)

    add_attempt(db_session, problem_id=1, outcome=AttemptOutcome.OPTIMAL)
    db_session.commit()

    result = dashboard(db_session, now=NOW, timezone_name=TIMEZONE, range_days=90)
    scores = {focus.topic: focus.score for focus in result.focuses}
    assert scores["Arrays"] == 100
    assert scores["Graphs"] == 0


def test_readiness_score_is_wired_into_the_dashboard_response(
    db_session: Session,
) -> None:
    topic = Topic(name="Arrays", slug="arrays")
    db_session.add(topic)
    db_session.flush()
    add_problem(db_session, 1, topic=topic)
    db_session.commit()

    empty = dashboard(db_session, now=NOW, timezone_name=TIMEZONE, range_days=90)
    assert empty.readiness_score == 0

    add_attempt(db_session, problem_id=1, outcome=AttemptOutcome.OPTIMAL)
    db_session.commit()

    result = dashboard(db_session, now=NOW, timezone_name=TIMEZONE, range_days=90)
    assert 0 < result.readiness_score <= 100


@pytest.mark.parametrize(
    ("difficulty", "duration_seconds", "expected_score"),
    [
        (Difficulty.HARD, 1200, 26),
        (Difficulty.EASY, 2400, 12),
    ],
)
def test_readiness_score_uses_the_real_attempt_duration_and_difficulty(
    db_session: Session,
    difficulty: Difficulty,
    duration_seconds: int,
    expected_score: int,
) -> None:
    """Regression guard: the dashboard service used to build every
    SchedulingAttempt with its dataclass defaults (medium difficulty, a flat
    30-minute duration) instead of the attempt's real recorded values. Left
    unfixed, both parametrizations here would produce the same score.
    """

    topic = Topic(name="Arrays", slug="arrays")
    db_session.add(topic)
    db_session.flush()
    add_problem(db_session, 1, topic=topic, difficulty=difficulty)
    for problem_id in (2, 3, 4):
        add_problem(db_session, problem_id, topic=topic)
    add_attempt(
        db_session,
        problem_id=1,
        outcome=AttemptOutcome.OPTIMAL,
        duration_seconds=duration_seconds,
    )
    db_session.commit()

    result = dashboard(db_session, now=NOW, timezone_name=TIMEZONE, range_days=90)

    assert result.readiness_score == expected_score
