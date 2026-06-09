from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from rodeo.db import get_db_session
from rodeo.models import Job
from rodeo.schemas.jobs import JobResponse

router = APIRouter(prefix="/jobs", tags=["jobs"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]


def _aware(value: datetime | None) -> datetime | None:
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=UTC)


@router.get("/{job_id}", response_model=JobResponse)
def read(job_id: str, database: DatabaseSession) -> JobResponse:
    job = database.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse(
        id=job.id,
        kind=job.kind,
        status=job.status,
        attempts=job.attempts,
        max_attempts=job.max_attempts,
        available_at=_aware(job.available_at),
        lease_expires_at=_aware(job.lease_expires_at),
        error_code=job.error_code,
        error_message=job.error_message,
        completed_at=_aware(job.completed_at),
        created_at=_aware(job.created_at),
        updated_at=_aware(job.updated_at),
    )
