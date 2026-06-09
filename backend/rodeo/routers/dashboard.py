from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from rodeo.db import get_db_session
from rodeo.models.base import utc_now
from rodeo.services.dashboard import dashboard

router = APIRouter(tags=["dashboard"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]
RangeDays = Annotated[Literal[30, 60, 90, 180], Query()]


@router.get("/dashboard")
def read_dashboard(request: Request, database: DatabaseSession, range_days: RangeDays = 90) -> dict[str, object]:
    return dashboard(database, now=utc_now(), timezone_name=request.app.state.settings.timezone, range_days=range_days)


@router.get("/review-queue")
def review_queue(request: Request, database: DatabaseSession) -> list[object]:
    result = dashboard(database, now=utc_now(), timezone_name=request.app.state.settings.timezone, range_days=30)
    return result["review_queue"] if isinstance(result["review_queue"], list) else []
