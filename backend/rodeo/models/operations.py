from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from rodeo.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from rodeo.models.enums import CatalogSyncStatus, JobStatus, enum_type
from rodeo.models.json_types import JSONValue

if TYPE_CHECKING:
    from rodeo.models.practice import Attempt


class Job(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "job"
    __table_args__ = (
        CheckConstraint("attempts >= 0", name="attempts_nonnegative"),
        CheckConstraint("max_attempts > 0", name="max_attempts_positive"),
    )

    kind: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[JobStatus] = mapped_column(
        enum_type(JobStatus, length=16),
        nullable=False,
        default=JobStatus.QUEUED,
        server_default=JobStatus.QUEUED.value,
        index=True,
    )
    payload: Mapped[dict[str, JSONValue]] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
        server_default="{}",
    )
    attempts: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    max_attempts: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=3,
        server_default="3",
    )
    available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    lease_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        index=True,
    )
    locked_by: Mapped[str | None] = mapped_column(String(100))
    error_code: Mapped[str | None] = mapped_column(String(100))
    error_message: Mapped[str | None] = mapped_column(Text)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AIArtifact(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_artifact"

    attempt_id: Mapped[str] = mapped_column(
        ForeignKey("attempt.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    attempt: Mapped[Attempt] = relationship(
        back_populates="ai_artifacts",
        lazy="raise",
    )


class CatalogSync(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "catalog_sync"

    status: Mapped[CatalogSyncStatus] = mapped_column(
        enum_type(CatalogSyncStatus, length=16),
        nullable=False,
        default=CatalogSyncStatus.RUNNING,
        server_default=CatalogSyncStatus.RUNNING.value,
        index=True,
    )
    source: Mapped[str] = mapped_column(String(255), nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    added_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    updated_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    deactivated_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    error_code: Mapped[str | None] = mapped_column(String(100))
    error_message: Mapped[str | None] = mapped_column(Text)


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[JSONValue] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
