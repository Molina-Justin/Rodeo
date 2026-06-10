from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from rodeo.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from rodeo.models.enums import (
    AttemptBlocker,
    AttemptEffort,
    AttemptOutcome,
    PracticeSessionStatus,
    ProblemStatus,
    TranscriptionStatus,
    enum_type,
)
from rodeo.models.json_types import JSONValue

if TYPE_CHECKING:
    from rodeo.models.catalog import Problem
    from rodeo.models.operations import AIArtifact


class PracticeSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "practice_session"
    __table_args__ = (
        CheckConstraint(
            "accumulated_active_ms >= 0",
            name="accumulated_active_ms_nonnegative",
        ),
    )

    problem_id: Mapped[int] = mapped_column(
        ForeignKey("problem.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[PracticeSessionStatus] = mapped_column(
        enum_type(PracticeSessionStatus, length=24),
        nullable=False,
        default=PracticeSessionStatus.ACTIVE,
        server_default=PracticeSessionStatus.ACTIVE.value,
        index=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    running_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    accumulated_active_ms: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    stopped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finalized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    problem: Mapped[Problem] = relationship(
        back_populates="practice_sessions",
        lazy="raise",
    )
    attempt: Mapped[Attempt | None] = relationship(
        back_populates="practice_session",
        uselist=False,
        lazy="raise",
    )
    recording: Mapped[Recording | None] = relationship(
        back_populates="practice_session",
        uselist=False,
        lazy="raise",
    )


class Attempt(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "attempt"
    __table_args__ = (
        CheckConstraint("duration_seconds > 0", name="duration_seconds_positive"),
    )

    problem_id: Mapped[int] = mapped_column(
        ForeignKey("problem.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    practice_session_id: Mapped[str | None] = mapped_column(
        ForeignKey("practice_session.id", ondelete="SET NULL"),
        unique=True,
    )
    idempotency_key: Mapped[str | None] = mapped_column(
        String(128),
        unique=True,
    )
    idempotency_payload_hash: Mapped[str | None] = mapped_column(String(64))
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    problem_difficulty_at_attempt: Mapped[str | None] = mapped_column(String(16))
    target_minutes_at_attempt: Mapped[int | None] = mapped_column(Integer)
    outcome: Mapped[AttemptOutcome] = mapped_column(
        enum_type(AttemptOutcome, length=16),
        nullable=False,
    )
    effort: Mapped[AttemptEffort] = mapped_column(
        enum_type(AttemptEffort, length=16),
        nullable=False,
    )
    blocker: Mapped[AttemptBlocker] = mapped_column(
        enum_type(AttemptBlocker, length=24),
        nullable=False,
        default=AttemptBlocker.NONE,
        server_default=AttemptBlocker.NONE.value,
    )
    notes: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
        server_default="",
    )

    problem: Mapped[Problem] = relationship(back_populates="attempts", lazy="raise")
    practice_session: Mapped[PracticeSession | None] = relationship(
        back_populates="attempt",
        lazy="raise",
    )
    recording: Mapped[Recording | None] = relationship(
        back_populates="attempt",
        uselist=False,
        lazy="raise",
    )
    ai_artifacts: Mapped[list[AIArtifact]] = relationship(
        back_populates="attempt",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="raise",
    )


class Recording(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "recording"
    __table_args__ = (
        CheckConstraint("byte_size > 0", name="byte_size_positive"),
        CheckConstraint("duration_ms >= 0", name="duration_ms_nonnegative"),
    )

    attempt_id: Mapped[str | None] = mapped_column(
        ForeignKey("attempt.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    practice_session_id: Mapped[str | None] = mapped_column(
        ForeignKey("practice_session.id", ondelete="CASCADE"),
        unique=True,
    )
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    original_filename: Mapped[str | None] = mapped_column(String(255))
    media_type: Mapped[str] = mapped_column(String(127), nullable=False)
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    checksum_sha256: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        unique=True,
    )

    attempt: Mapped[Attempt | None] = relationship(
        back_populates="recording",
        lazy="raise",
    )
    practice_session: Mapped[PracticeSession | None] = relationship(
        back_populates="recording",
        lazy="raise",
    )
    transcription: Mapped[Transcription | None] = relationship(
        back_populates="recording",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
        lazy="raise",
    )


class Transcription(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "transcription"

    recording_id: Mapped[str] = mapped_column(
        ForeignKey("recording.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    status: Mapped[TranscriptionStatus] = mapped_column(
        enum_type(TranscriptionStatus, length=16),
        nullable=False,
        default=TranscriptionStatus.QUEUED,
        server_default=TranscriptionStatus.QUEUED.value,
        index=True,
    )
    raw_text: Mapped[str | None] = mapped_column(Text)
    corrected_text: Mapped[str | None] = mapped_column(Text)
    segments: Mapped[list[dict[str, JSONValue]]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        server_default="[]",
    )
    language: Mapped[str | None] = mapped_column(String(16))
    model: Mapped[str | None] = mapped_column(String(100))
    retry_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    error_code: Mapped[str | None] = mapped_column(String(100))
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    recording: Mapped[Recording] = relationship(
        back_populates="transcription",
        lazy="raise",
    )


class ReviewState(TimestampMixin, Base):
    __tablename__ = "review_state"
    __table_args__ = (
        CheckConstraint("attempt_count >= 0", name="attempt_count_nonnegative"),
        CheckConstraint("interval_days >= 0", name="interval_days_nonnegative"),
        CheckConstraint("lapses >= 0", name="lapses_nonnegative"),
        CheckConstraint(
            "confidence >= 0 AND confidence <= 5",
            name="confidence_range",
        ),
    )

    problem_id: Mapped[int] = mapped_column(
        ForeignKey("problem.id", ondelete="CASCADE"),
        primary_key=True,
    )
    status: Mapped[ProblemStatus] = mapped_column(
        enum_type(ProblemStatus, length=16),
        nullable=False,
        default=ProblemStatus.NOT_STARTED,
        server_default=ProblemStatus.NOT_STARTED.value,
        index=True,
    )
    attempt_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    last_attempt_id: Mapped[str | None] = mapped_column(
        ForeignKey("attempt.id", ondelete="SET NULL")
    )
    best_duration_seconds: Mapped[int | None] = mapped_column(Integer)
    interval_days: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    lapses: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    confidence: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        index=True,
    )
    next_due_on: Mapped[date | None] = mapped_column(Date, index=True)
    graduated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    clean_quick_streak: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    has_notes: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
    )
    has_audio: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
    )
    has_transcript: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
    )
    engine_version: Mapped[str] = mapped_column(String(32), nullable=False)

    problem: Mapped[Problem] = relationship(
        back_populates="review_state",
        lazy="raise",
    )
    last_attempt: Mapped[Attempt | None] = relationship(
        foreign_keys=[last_attempt_id],
        lazy="raise",
    )
