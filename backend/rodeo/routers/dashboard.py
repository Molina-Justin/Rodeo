from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from rodeo.db import get_db_session
from rodeo.models.base import utc_now
from rodeo.schemas.dashboard import (
    DashboardRange,
    DashboardResponse,
    ReviewQueueItem,
)
from rodeo.services.dashboard import dashboard

router = APIRouter(tags=["dashboard"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]
RangeDays = Annotated[DashboardRange, Query()]


@router.get("/dashboard", response_model=DashboardResponse)
def read_dashboard(
    request: Request,
    database: DatabaseSession,
    range_days: RangeDays = DashboardRange.QUARTER,
) -> DashboardResponse:
    return dashboard(
        database,
        now=utc_now(),
        timezone_name=request.app.state.settings.timezone,
        range_days=int(range_days),
    )


@router.get("/review-queue", response_model=list[ReviewQueueItem])
def review_queue(
    request: Request, database: DatabaseSession
) -> tuple[ReviewQueueItem, ...]:
    result = dashboard(
        database,
        now=utc_now(),
        timezone_name=request.app.state.settings.timezone,
        range_days=30,
    )
    return result.review_queue
