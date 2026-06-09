from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from rodeo.db import get_db_session
from rodeo.models.enums import Difficulty, ProblemStatus
from rodeo.schemas.problems import (
    ProblemAccess,
    ProblemDetail,
    ProblemPage,
    ProblemSort,
)
from rodeo.services.problems import get_problem, list_problems

router = APIRouter(prefix="/problems", tags=["problems"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]


@router.get("", response_model=ProblemPage)
def problems(
    session: DatabaseSession,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
    search: Annotated[str | None, Query(max_length=255)] = None,
    difficulty: Difficulty | None = None,
    problem_status: Annotated[
        ProblemStatus | None,
        Query(alias="status"),
    ] = None,
    access: ProblemAccess = ProblemAccess.ALL,
    topic: Annotated[str | None, Query(max_length=100)] = None,
    sort: ProblemSort = ProblemSort.ID_ASC,
    include_inactive: bool = False,
) -> ProblemPage:
    return list_problems(
        session,
        page=page,
        page_size=page_size,
        search=search,
        difficulty=difficulty,
        status=problem_status,
        access=access,
        topic=topic,
        sort=sort,
        include_inactive=include_inactive,
    )


@router.get("/{problem_id}", response_model=ProblemDetail)
def problem(problem_id: int, session: DatabaseSession) -> ProblemDetail:
    result = get_problem(session, problem_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Problem not found",
        )
    return result
