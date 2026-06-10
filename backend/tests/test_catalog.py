from __future__ import annotations

import json
from datetime import UTC, datetime

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from rodeo.models import Attempt, CatalogSync, Problem
from rodeo.models.enums import (
    AttemptBlocker,
    AttemptEffort,
    AttemptOutcome,
    CatalogSyncStatus,
    Difficulty,
)
from rodeo.schemas.problems import CatalogProblem
from rodeo.services.catalog import (
    CatalogValidationError,
    apply_catalog_snapshot,
    fetch_leetcode_catalog,
    load_seed_catalog,
    refresh_catalog,
)


def catalog_problem(
    problem_id: int,
    title: str,
    *,
    difficulty: Difficulty = Difficulty.EASY,
    topics: tuple[str, ...] = (),
) -> CatalogProblem:
    return CatalogProblem(
        id=problem_id,
        title=title,
        slug=title.lower().replace(" ", "-"),
        difficulty=difficulty,
        premium=False,
        acceptance=50,
        topics=topics,
    )


def test_bundled_seed_is_complete_and_valid() -> None:
    entries = load_seed_catalog()

    assert len(entries) == 4_033
    assert entries[0].id == 1
    assert entries[0].title == "Two Sum"
    assert entries[-1].id == 4_033


def test_snapshot_upserts_and_preserves_removed_attempt_problem(
    db_session: Session,
) -> None:
    first_snapshot = (
        catalog_problem(1, "One", topics=("Array",)),
        catalog_problem(2, "Two", topics=("Hash Table",)),
    )
    with db_session.begin():
        initial = apply_catalog_snapshot(db_session, first_snapshot)

    attempt = Attempt(
        id="attempt-1",
        problem_id=1,
        completed_at=datetime(2026, 8, 1, tzinfo=UTC),
        duration_seconds=600,
        outcome=AttemptOutcome.OPTIMAL,
        effort=AttemptEffort.MODERATE,
        blocker=AttemptBlocker.NONE,
        notes="keep this history",
    )
    db_session.add(attempt)
    db_session.commit()

    second_snapshot = (
        catalog_problem(2, "Two Updated", topics=("Hash Table", "Array")),
        catalog_problem(3, "Three", difficulty=Difficulty.HARD),
    )
    with db_session.begin():
        updated = apply_catalog_snapshot(db_session, second_snapshot)

    preserved = db_session.get(Problem, 1)
    assert initial.added_count == 2
    assert updated.added_count == 1
    assert updated.updated_count == 1
    assert updated.deactivated_count == 1
    assert preserved is not None
    assert preserved.active is False
    assert db_session.get(Attempt, "attempt-1") is not None


def test_fetches_and_validates_every_graphql_page() -> None:
    offsets: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        skip = body["variables"]["skip"]
        offsets.append(skip)
        questions = [
            {
                "questionFrontendId": "1",
                "title": "One",
                "titleSlug": "one",
                "difficulty": "Easy",
                "paidOnly": False,
                "acRate": 0.5012,
                "topicTags": [{"name": "Array"}],
            },
            {
                "questionFrontendId": "2",
                "title": "Two",
                "titleSlug": "two",
                "difficulty": "Medium",
                "paidOnly": True,
                "acRate": 0.6255,
                "topicTags": [],
            },
        ]
        if skip == 2:
            questions = [
                {
                    "questionFrontendId": "3",
                    "title": "Three",
                    "titleSlug": "three",
                    "difficulty": "Hard",
                    "paidOnly": False,
                    "acRate": 0.3333,
                    "topicTags": [{"name": "Graph"}],
                }
            ]
        return httpx.Response(
            200,
            json={
                "data": {
                    "problemsetQuestionListV2": {
                        "totalLength": 3,
                        "questions": questions,
                    }
                }
            },
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        entries = fetch_leetcode_catalog(client=client, page_size=2)

    assert offsets == [0, 2]
    assert [entry.id for entry in entries] == [1, 2, 3]
    assert entries[0].acceptance == 50.1
    assert entries[0].topics == ("Array",)


def test_rejects_incomplete_graphql_snapshot() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": {
                    "problemsetQuestionListV2": {
                        "totalLength": 2,
                        "questions": [],
                    }
                }
            },
        )

    with (
        httpx.Client(transport=httpx.MockTransport(handler)) as client,
        pytest.raises(CatalogValidationError, match="incomplete"),
    ):
        fetch_leetcode_catalog(client=client, page_size=2)


def test_refresh_records_completion_and_applies_atomically(
    db_session: Session,
) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": {
                    "problemsetQuestionListV2": {
                        "totalLength": 1,
                        "questions": [
                            {
                                "questionFrontendId": "10",
                                "title": "Ten",
                                "titleSlug": "ten",
                                "difficulty": "Easy",
                                "paidOnly": False,
                                "acRate": 0.75,
                                "topicTags": [],
                            }
                        ],
                    }
                }
            },
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = refresh_catalog(db_session, client=client)

    assert result.status is CatalogSyncStatus.COMPLETED
    assert result.added_count == 1
    assert db_session.get(Problem, 10) is not None
    assert db_session.scalar(select(CatalogSync).where(CatalogSync.id == result.id))
