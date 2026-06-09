from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from rodeo.models import Attempt, Problem, Recording, ReviewState
from rodeo.models.enums import (
    AttemptBlocker,
    AttemptEffort,
    AttemptOutcome,
    Difficulty,
    ProblemStatus,
)
from rodeo.schemas.problems import CatalogProblem, ProblemAccess, ProblemSort
from rodeo.services.catalog import apply_catalog_snapshot
from rodeo.services.problems import get_problem, list_problems


def install_problem_rows(session: Session) -> None:
    entries = (
        CatalogProblem(
            id=1,
            title="Array Start",
            slug="array-start",
            difficulty=Difficulty.EASY,
            premium=False,
            acceptance=70,
            topics=("Array",),
        ),
        CatalogProblem(
            id=2,
            title="Dynamic Finish",
            slug="dynamic-finish",
            difficulty=Difficulty.MEDIUM,
            premium=True,
            acceptance=55,
            topics=("Dynamic Programming",),
        ),
        CatalogProblem(
            id=3,
            title="Graph Middle",
            slug="graph-middle",
            difficulty=Difficulty.HARD,
            premium=False,
            acceptance=35,
            topics=("Graph", "Array"),
        ),
    )
    apply_catalog_snapshot(session, entries)

    attempt = Attempt(
        id="attempt-2",
        problem_id=2,
        completed_at=datetime(2026, 8, 20, 12, tzinfo=UTC),
        duration_seconds=900,
        outcome=AttemptOutcome.OPTIMAL,
        effort=AttemptEffort.MODERATE,
        blocker=AttemptBlocker.NONE,
        notes="memo",
    )
    session.add(attempt)
    session.flush()
    recording = Recording(
        id="recording-2",
        attempt_id=attempt.id,
        storage_key="recordings/recording-2.webm",
        media_type="audio/webm",
        byte_size=100,
        duration_ms=30_000,
        checksum_sha256="a" * 64,
    )
    session.add(recording)
    session.add(
        ReviewState(
            problem_id=2,
            status=ProblemStatus.SOLVED,
            attempt_count=1,
            last_attempt_id=attempt.id,
            best_duration_seconds=attempt.duration_seconds,
            interval_days=3,
            lapses=0,
            confidence=2,
            due_at=attempt.completed_at + timedelta(days=3),
            has_notes=True,
            has_audio=True,
            has_transcript=False,
            engine_version="test",
        )
    )


def test_problem_list_joins_review_state_and_latest_attempt(
    db_session: Session,
) -> None:
    with db_session.begin():
        install_problem_rows(db_session)

    page = list_problems(
        db_session,
        status=ProblemStatus.SOLVED,
        access=ProblemAccess.PREMIUM,
    )

    assert page.total == 1
    [problem] = page.items
    assert problem.id == 2
    assert problem.status is ProblemStatus.SOLVED
    assert problem.attempt_count == 1
    assert problem.has_notes is True
    assert problem.has_audio is True
    assert problem.last_attempt is not None
    assert problem.last_attempt.id == "attempt-2"


def test_problem_list_filters_topics_and_sorts_difficulty(
    db_session: Session,
) -> None:
    with db_session.begin():
        install_problem_rows(db_session)

    page = list_problems(
        db_session,
        topic="array",
        sort=ProblemSort.DIFFICULTY_DESC,
        page_size=1,
    )

    assert page.total == 2
    assert page.page_count == 2
    assert [problem.id for problem in page.items] == [3]


def test_problem_detail_includes_inactive_problem(db_session: Session) -> None:
    with db_session.begin():
        install_problem_rows(db_session)
        problem = db_session.get(Problem, 1)
        assert problem is not None
        problem.active = False

    detail = get_problem(db_session, 1)
    active_page = list_problems(db_session, search="1")

    assert detail is not None
    assert detail.active is False
    assert active_page.total == 0


def test_problem_routes_return_typed_page(
    client: TestClient,
    db_session: Session,
) -> None:
    with db_session.begin():
        install_problem_rows(db_session)

    response = client.get(
        "/api/v1/problems",
        params={
            "difficulty": "medium",
            "access": "premium",
            "status": "solved",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == 2
    assert body["items"][0]["last_attempt"]["id"] == "attempt-2"


def test_unknown_problem_returns_404(client: TestClient) -> None:
    response = client.get("/api/v1/problems/999999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Problem not found"}
