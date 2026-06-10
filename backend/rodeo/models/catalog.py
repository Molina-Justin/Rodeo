from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from rodeo.models.base import Base, TimestampMixin
from rodeo.models.enums import Difficulty, enum_type

if TYPE_CHECKING:
    from rodeo.models.practice import Attempt, PracticeSession, ReviewState


class ProblemTopic(Base):
    __tablename__ = "problem_topic"

    problem_id: Mapped[int] = mapped_column(
        ForeignKey("problem.id", ondelete="CASCADE"),
        primary_key=True,
    )
    topic_id: Mapped[int] = mapped_column(
        ForeignKey("topic.id", ondelete="CASCADE"),
        primary_key=True,
    )


class Problem(TimestampMixin, Base):
    __tablename__ = "problem"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    difficulty: Mapped[Difficulty] = mapped_column(
        enum_type(Difficulty, length=16),
        nullable=False,
        index=True,
    )
    premium: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
    )
    acceptance: Mapped[float] = mapped_column(Float, nullable=False)
    active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1",
        index=True,
    )
    catalog_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    topics: Mapped[list[Topic]] = relationship(
        secondary="problem_topic",
        back_populates="problems",
        lazy="raise",
    )
    attempts: Mapped[list[Attempt]] = relationship(
        back_populates="problem",
        lazy="raise",
    )
    practice_sessions: Mapped[list[PracticeSession]] = relationship(
        back_populates="problem",
        lazy="raise",
    )
    review_state: Mapped[ReviewState | None] = relationship(
        back_populates="problem",
        uselist=False,
        lazy="raise",
    )


class Topic(TimestampMixin, Base):
    __tablename__ = "topic"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)

    problems: Mapped[list[Problem]] = relationship(
        secondary="problem_topic",
        back_populates="topics",
        lazy="raise",
    )
