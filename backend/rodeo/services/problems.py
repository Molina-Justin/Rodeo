from __future__ import annotations

import math

from sqlalchemy import String, case, cast, func, or_, select
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.sql.elements import ColumnElement

from rodeo.models import Attempt, Problem, ReviewState, Topic
from rodeo.models.enums import Difficulty, ProblemStatus
from rodeo.schemas.problems import (
    LatestAttemptSummary,
    ProblemAccess,
    ProblemDetail,
    ProblemListItem,
    ProblemPage,
    ProblemSort,
)


def _problem_item(
    problem: Problem,
    review_state: ReviewState | None,
    last_attempt: Attempt | None,
) -> ProblemListItem:
    attempt_summary = None
    if last_attempt is not None:
        attempt_summary = LatestAttemptSummary(
            id=last_attempt.id,
            completed_at=last_attempt.completed_at,
            duration_seconds=last_attempt.duration_seconds,
            outcome=last_attempt.outcome,
            effort=last_attempt.effort,
            blocker=last_attempt.blocker,
        )

    return ProblemListItem(
        id=problem.id,
        title=problem.title,
        slug=problem.slug,
        difficulty=problem.difficulty,
        premium=problem.premium,
        acceptance=problem.acceptance,
        active=problem.active,
        topics=tuple(sorted(topic.name for topic in problem.topics)),
        status=(
            review_state.status
            if review_state is not None
            else ProblemStatus.NOT_STARTED
        ),
        attempt_count=review_state.attempt_count if review_state is not None else 0,
        last_attempt=attempt_summary,
        best_duration_seconds=(
            review_state.best_duration_seconds if review_state is not None else None
        ),
        due_at=review_state.due_at if review_state is not None else None,
        has_notes=review_state.has_notes if review_state is not None else False,
        has_audio=review_state.has_audio if review_state is not None else False,
        has_transcript=(
            review_state.has_transcript if review_state is not None else False
        ),
    )


def list_problems(
    session: Session,
    *,
    page: int = 1,
    page_size: int = 50,
    search: str | None = None,
    difficulty: Difficulty | None = None,
    status: ProblemStatus | None = None,
    access: ProblemAccess = ProblemAccess.ALL,
    topic: str | None = None,
    sort: ProblemSort = ProblemSort.ID_ASC,
    include_inactive: bool = False,
) -> ProblemPage:
    normalized_search = search.strip().lower() if search else None
    normalized_topic = topic.strip().lower() if topic else None

    statement = (
        select(Problem, ReviewState, Attempt)
        .outerjoin(ReviewState, ReviewState.problem_id == Problem.id)
        .outerjoin(Attempt, Attempt.id == ReviewState.last_attempt_id)
        .options(selectinload(Problem.topics))
    )
    count_statement = (
        select(func.count(Problem.id))
        .select_from(Problem)
        .outerjoin(ReviewState, ReviewState.problem_id == Problem.id)
    )

    conditions: list[ColumnElement[bool]] = []
    if not include_inactive:
        conditions.append(Problem.active.is_(True))
    if normalized_search:
        search_conditions = [
            func.lower(Problem.title).contains(normalized_search, autoescape=True),
            func.lower(Problem.slug).contains(normalized_search, autoescape=True),
        ]
        if normalized_search.isdecimal():
            search_conditions.append(Problem.id == int(normalized_search))
        else:
            search_conditions.append(
                cast(Problem.id, String).contains(
                    normalized_search,
                    autoescape=True,
                )
            )
        conditions.append(or_(*search_conditions))
    if difficulty is not None:
        conditions.append(Problem.difficulty == difficulty)
    if status is ProblemStatus.NOT_STARTED:
        conditions.append(
            or_(
                ReviewState.problem_id.is_(None),
                ReviewState.status == ProblemStatus.NOT_STARTED,
            )
        )
    elif status is not None:
        conditions.append(ReviewState.status == status)
    if access is ProblemAccess.FREE:
        conditions.append(Problem.premium.is_(False))
    elif access is ProblemAccess.PREMIUM:
        conditions.append(Problem.premium.is_(True))
    if normalized_topic:
        conditions.append(
            Problem.topics.any(
                or_(
                    func.lower(Topic.name) == normalized_topic,
                    func.lower(Topic.slug) == normalized_topic,
                )
            )
        )

    if conditions:
        statement = statement.where(*conditions)
        count_statement = count_statement.where(*conditions)

    difficulty_order = case(
        (Problem.difficulty == Difficulty.EASY, 0),
        (Problem.difficulty == Difficulty.MEDIUM, 1),
        else_=2,
    )
    if sort is ProblemSort.ID_DESC:
        statement = statement.order_by(Problem.id.desc())
    elif sort is ProblemSort.TITLE_ASC:
        statement = statement.order_by(func.lower(Problem.title), Problem.id)
    elif sort is ProblemSort.TITLE_DESC:
        statement = statement.order_by(func.lower(Problem.title).desc(), Problem.id)
    elif sort is ProblemSort.DIFFICULTY_ASC:
        statement = statement.order_by(difficulty_order, Problem.id)
    elif sort is ProblemSort.DIFFICULTY_DESC:
        statement = statement.order_by(difficulty_order.desc(), Problem.id)
    elif sort is ProblemSort.ACCEPTANCE_ASC:
        statement = statement.order_by(Problem.acceptance, Problem.id)
    elif sort is ProblemSort.ACCEPTANCE_DESC:
        statement = statement.order_by(Problem.acceptance.desc(), Problem.id)
    else:
        statement = statement.order_by(Problem.id)

    total = session.scalar(count_statement) or 0
    rows = session.execute(
        statement.offset((page - 1) * page_size).limit(page_size)
    ).all()
    items = tuple(
        _problem_item(problem, review_state, last_attempt)
        for problem, review_state, last_attempt in rows
    )

    return ProblemPage(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        page_count=math.ceil(total / page_size) if total else 0,
    )


def get_problem(session: Session, problem_id: int) -> ProblemDetail | None:
    row = session.execute(
        select(Problem, ReviewState, Attempt)
        .outerjoin(ReviewState, ReviewState.problem_id == Problem.id)
        .outerjoin(Attempt, Attempt.id == ReviewState.last_attempt_id)
        .options(selectinload(Problem.topics))
        .where(Problem.id == problem_id)
    ).one_or_none()
    if row is None:
        return None

    problem, review_state, last_attempt = row
    item = _problem_item(problem, review_state, last_attempt)
    return ProblemDetail(
        **item.model_dump(),
        catalog_updated_at=problem.catalog_updated_at,
        created_at=problem.created_at,
        updated_at=problem.updated_at,
    )
