from __future__ import annotations

from datetime import datetime

from rodeo.models.enums import JobStatus
from rodeo.schemas.system import APIModel


class JobResponse(APIModel):
    id: str
    kind: str
    status: JobStatus
    attempts: int
    max_attempts: int
    available_at: datetime
    lease_expires_at: datetime | None
    error_code: str | None
    error_message: str | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
