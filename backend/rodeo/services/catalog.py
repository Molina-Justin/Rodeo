from __future__ import annotations

import math
import re
import unicodedata
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from importlib import resources

import httpx
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from rodeo.models import CatalogSync, Problem, Topic
from rodeo.models.base import utc_now
from rodeo.models.enums import CatalogSyncStatus, Difficulty
from rodeo.schemas.problems import CatalogProblem, CatalogSyncResponse

LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"
LEETCODE_CATEGORY = "all-code-essentials"
DEFAULT_PAGE_SIZE = 100
CATALOG_QUERY = """
query problems(
  $filters: QuestionFilterInput,
  $limit: Int,
  $skip: Int,
  $categorySlug: String
) {
  problemsetQuestionListV2(
    filters: $filters,
    limit: $limit,
    skip: $skip,
    categorySlug: $categorySlug
  ) {
    totalLength
    questions {
      questionFrontendId
      title
      titleSlug
      difficulty
      paidOnly
      acRate
      topicTags { name }
    }
  }
}
"""


@dataclass(frozen=True, slots=True)
class CatalogMutationResult:
    added_count: int
    updated_count: int
    deactivated_count: int
    total_count: int


class CatalogError(RuntimeError):
    """Base class for safe catalog errors returned by the API."""


class CatalogValidationError(CatalogError):
    """The catalog source did not contain a complete, valid snapshot."""


class CatalogRefreshError(CatalogError):
    def __init__(self, message: str, *, sync: CatalogSyncResponse) -> None:
        super().__init__(message)
        self.sync = sync


class _GraphQLModel(BaseModel):
    model_config = ConfigDict(extra="ignore")


class _GraphQLError(_GraphQLModel):
    message: str = "Unknown GraphQL error"


class _GraphQLTopic(_GraphQLModel):
    name: str


class _GraphQLQuestion(_GraphQLModel):
    question_frontend_id: str = Field(alias="questionFrontendId")
    title: str
    title_slug: str = Field(alias="titleSlug")
    difficulty: str
    paid_only: bool = Field(alias="paidOnly")
    acceptance_rate: float = Field(alias="acRate")
    topic_tags: tuple[_GraphQLTopic, ...] = Field(
        default=(),
        alias="topicTags",
    )


class _GraphQLProblemPage(_GraphQLModel):
    total_length: int = Field(alias="totalLength", ge=1)
    questions: tuple[_GraphQLQuestion, ...]


class _GraphQLData(_GraphQLModel):
    problem_list: _GraphQLProblemPage = Field(alias="problemsetQuestionListV2")


class _GraphQLResponse(_GraphQLModel):
    data: _GraphQLData | None = None
    errors: tuple[_GraphQLError, ...] = ()


def load_seed_catalog() -> tuple[CatalogProblem, ...]:
    seed = resources.files("rodeo.assets").joinpath("leetcode-problems.json")
    try:
        payload = seed.read_bytes()
        entries = TypeAdapter(tuple[CatalogProblem, ...]).validate_json(payload)
    except (OSError, ValidationError) as error:
        raise CatalogValidationError("The bundled catalog seed is invalid") from error

    _validate_snapshot(entries)
    return entries


def _slugify(value: str) -> str:
    ascii_value = (
        unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    )
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-")
    if not slug:
        raise CatalogValidationError("A topic name could not be converted to a slug")
    return slug[:100]


def _validate_snapshot(entries: Sequence[CatalogProblem]) -> None:
    if not entries:
        raise CatalogValidationError("The catalog snapshot is empty")

    ids = {entry.id for entry in entries}
    slugs = {entry.slug for entry in entries}
    if len(ids) != len(entries):
        raise CatalogValidationError("The catalog contains duplicate problem IDs")
    if len(slugs) != len(entries):
        raise CatalogValidationError("The catalog contains duplicate problem slugs")


def _topic_for_name(
    session: Session,
    name: str,
    *,
    topics_by_name: dict[str, Topic],
    topics_by_slug: dict[str, Topic],
) -> Topic:
    existing = topics_by_name.get(name)
    if existing is not None:
        return existing

    base_slug = _slugify(name)
    slug = base_slug
    suffix = 2
    while slug in topics_by_slug:
        suffix_text = f"-{suffix}"
        slug = f"{base_slug[: 100 - len(suffix_text)]}{suffix_text}"
        suffix += 1

    topic = Topic(name=name, slug=slug)
    session.add(topic)
    topics_by_name[name] = topic
    topics_by_slug[slug] = topic
    return topic


def apply_catalog_snapshot(
    session: Session,
    entries: Sequence[CatalogProblem],
    *,
    observed_at: datetime | None = None,
) -> CatalogMutationResult:
    """Apply one fully validated snapshot inside the caller's transaction."""
    _validate_snapshot(entries)
    timestamp = observed_at or utc_now()

    existing_problems = session.scalars(
        select(Problem).options(selectinload(Problem.topics))
    ).all()
    problems_by_id = {problem.id: problem for problem in existing_problems}
    problems_by_slug = {problem.slug: problem for problem in existing_problems}
    entries_by_id = {entry.id: entry for entry in entries}

    reassigned_slugs = {
        entry.slug: entry.id
        for entry in entries
        if entry.slug in problems_by_slug
        and problems_by_slug[entry.slug].id != entry.id
    }
    for slug, new_owner_id in reassigned_slugs.items():
        old_owner = problems_by_slug[slug]
        old_owner.slug = f"retired-{old_owner.id}-{slug}"[:255]
        old_owner.active = False
        if old_owner.id in entries_by_id:
            continue
        problems_by_slug.pop(slug)
        problems_by_slug[old_owner.slug] = old_owner
        if new_owner_id == old_owner.id:
            raise CatalogValidationError("The catalog contains an invalid slug owner")
    if reassigned_slugs:
        session.flush()

    existing_topics = session.scalars(select(Topic)).all()
    topics_by_name = {topic.name: topic for topic in existing_topics}
    topics_by_slug = {topic.slug: topic for topic in existing_topics}

    added_count = 0
    updated_count = 0
    incoming_ids: set[int] = set()

    for entry in entries:
        incoming_ids.add(entry.id)
        entry_topics = [
            _topic_for_name(
                session,
                topic_name,
                topics_by_name=topics_by_name,
                topics_by_slug=topics_by_slug,
            )
            for topic_name in entry.topics
        ]
        problem = problems_by_id.get(entry.id)
        if problem is None:
            problem = Problem(
                id=entry.id,
                title=entry.title,
                slug=entry.slug,
                difficulty=entry.difficulty,
                premium=entry.premium,
                acceptance=entry.acceptance,
                active=True,
                catalog_updated_at=timestamp,
                topics=entry_topics,
            )
            session.add(problem)
            problems_by_id[entry.id] = problem
            added_count += 1
            continue

        changed = (
            problem.title != entry.title
            or problem.slug != entry.slug
            or problem.difficulty != entry.difficulty
            or problem.premium != entry.premium
            or problem.acceptance != entry.acceptance
            or not problem.active
            or {topic.name for topic in problem.topics} != set(entry.topics)
        )
        problem.title = entry.title
        problem.slug = entry.slug
        problem.difficulty = entry.difficulty
        problem.premium = entry.premium
        problem.acceptance = entry.acceptance
        problem.active = True
        problem.catalog_updated_at = timestamp
        problem.topics = entry_topics
        if changed:
            updated_count += 1

    deactivated_count = 0
    for problem in existing_problems:
        if problem.id in incoming_ids or not problem.active:
            continue
        problem.active = False
        deactivated_count += 1

    session.flush()
    return CatalogMutationResult(
        added_count=added_count,
        updated_count=updated_count,
        deactivated_count=deactivated_count,
        total_count=len(entries),
    )


def seed_catalog(session: Session) -> CatalogMutationResult:
    """Seed a brand-new database; existing catalogs are never overwritten."""
    entries = load_seed_catalog()

    def seed() -> CatalogMutationResult:
        existing_count = session.scalar(select(func.count(Problem.id))) or 0
        if existing_count:
            return CatalogMutationResult(0, 0, 0, existing_count)
        return apply_catalog_snapshot(session, entries)

    if session.in_transaction():
        return seed()
    with session.begin():
        return seed()


def _catalog_problem(question: _GraphQLQuestion) -> CatalogProblem:
    try:
        problem_id = int(question.question_frontend_id)
        difficulty = Difficulty(question.difficulty.lower())
    except (ValueError, TypeError) as error:
        raise CatalogValidationError(
            "LeetCode returned an unsupported problem identifier or difficulty"
        ) from error

    acceptance = math.floor(question.acceptance_rate * 1_000 + 0.5) / 10
    try:
        return CatalogProblem(
            id=problem_id,
            title=question.title,
            slug=question.title_slug,
            difficulty=difficulty,
            premium=question.paid_only,
            acceptance=acceptance,
            topics=tuple(topic.name for topic in question.topic_tags),
        )
    except ValidationError as error:
        raise CatalogValidationError(
            "LeetCode returned an invalid problem record"
        ) from error


def _fetch_page(
    client: httpx.Client,
    *,
    skip: int,
    page_size: int,
) -> _GraphQLProblemPage:
    try:
        response = client.post(
            LEETCODE_GRAPHQL_URL,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Rodeo catalog refresh",
            },
            json={
                "query": CATALOG_QUERY,
                "variables": {
                    "categorySlug": LEETCODE_CATEGORY,
                    "limit": page_size,
                    "skip": skip,
                    "filters": {"filterCombineType": "ALL"},
                },
            },
            timeout=30,
        )
        response.raise_for_status()
        payload = _GraphQLResponse.model_validate_json(response.content)
    except (httpx.HTTPError, ValidationError) as error:
        raise CatalogValidationError(
            f"LeetCode catalog request failed at offset {skip}"
        ) from error

    if payload.errors:
        raise CatalogValidationError(
            f"LeetCode returned a GraphQL error at offset {skip}"
        )
    if payload.data is None:
        raise CatalogValidationError(
            f"LeetCode returned no catalog data at offset {skip}"
        )
    return payload.data.problem_list


def fetch_leetcode_catalog(
    *,
    client: httpx.Client | None = None,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> tuple[CatalogProblem, ...]:
    if page_size < 1 or page_size > 100:
        raise ValueError("page_size must be between 1 and 100")

    def fetch(active_client: httpx.Client) -> tuple[CatalogProblem, ...]:
        questions: list[_GraphQLQuestion] = []
        expected_total: int | None = None
        skip = 0
        while expected_total is None or skip < expected_total:
            page = _fetch_page(active_client, skip=skip, page_size=page_size)
            if expected_total is None:
                expected_total = page.total_length
            elif page.total_length != expected_total:
                raise CatalogValidationError(
                    "LeetCode changed the catalog during refresh; retry the request"
                )
            if not page.questions:
                raise CatalogValidationError(
                    "LeetCode returned an incomplete catalog snapshot"
                )
            questions.extend(page.questions)
            skip += page_size

        if expected_total is None or len(questions) != expected_total:
            raise CatalogValidationError(
                "LeetCode returned an incomplete catalog snapshot"
            )
        entries = tuple(
            sorted(map(_catalog_problem, questions), key=lambda item: item.id)
        )
        _validate_snapshot(entries)
        return entries

    if client is not None:
        return fetch(client)
    with httpx.Client() as owned_client:
        return fetch(owned_client)


def _sync_response(sync: CatalogSync) -> CatalogSyncResponse:
    return CatalogSyncResponse(
        id=sync.id,
        status=sync.status,
        source=sync.source,
        started_at=sync.started_at,
        completed_at=sync.completed_at,
        added_count=sync.added_count,
        updated_count=sync.updated_count,
        deactivated_count=sync.deactivated_count,
        error_code=sync.error_code,
        error_message=sync.error_message,
    )


def refresh_catalog(
    session: Session,
    *,
    client: httpx.Client | None = None,
    clock: Callable[[], datetime] = utc_now,
) -> CatalogSyncResponse:
    started_at = clock()
    sync = CatalogSync(
        status=CatalogSyncStatus.RUNNING,
        source=LEETCODE_GRAPHQL_URL,
        started_at=started_at,
    )
    session.add(sync)
    session.flush()
    sync_id = sync.id
    session.commit()

    try:
        entries = fetch_leetcode_catalog(client=client)
        with session.begin():
            current_sync = session.get(CatalogSync, sync_id)
            if current_sync is None:
                raise RuntimeError("Catalog sync row disappeared during refresh")
            result = apply_catalog_snapshot(
                session,
                entries,
                observed_at=started_at,
            )
            current_sync.status = CatalogSyncStatus.COMPLETED
            current_sync.completed_at = clock()
            current_sync.added_count = result.added_count
            current_sync.updated_count = result.updated_count
            current_sync.deactivated_count = result.deactivated_count
        completed_sync = session.get(CatalogSync, sync_id)
        if completed_sync is None:
            raise RuntimeError("Catalog sync row disappeared after refresh")
        return _sync_response(completed_sync)
    except (CatalogError, httpx.HTTPError, SQLAlchemyError) as error:
        session.rollback()
        with session.begin():
            failed_sync = session.get(CatalogSync, sync_id)
            if failed_sync is None:
                raise RuntimeError(
                    "Catalog sync row disappeared after failure"
                ) from error
            failed_sync.status = CatalogSyncStatus.FAILED
            failed_sync.completed_at = clock()
            failed_sync.error_code = "catalog_refresh_failed"
            failed_sync.error_message = str(error)
        persisted_sync = session.get(CatalogSync, sync_id)
        if persisted_sync is None:
            raise RuntimeError("Catalog sync failure could not be persisted") from error
        raise CatalogRefreshError(
            "Catalog refresh failed",
            sync=_sync_response(persisted_sync),
        ) from error
