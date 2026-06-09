"""Create the initial Rodeo schema.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-08-29
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def enum_type(name: str, length: int, *values: str) -> sa.Enum:
    return sa.Enum(
        *values,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=length,
    )


def timestamp_columns() -> tuple[sa.Column, sa.Column]:
    return (
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    )


def upgrade() -> None:
    op.create_table(
        "problem",
        sa.Column("id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column(
            "difficulty",
            enum_type("difficulty", 16, "easy", "medium", "hard"),
            nullable=False,
        ),
        sa.Column("premium", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("acceptance", sa.Float(), nullable=False),
        sa.Column("active", sa.Boolean(), server_default="1", nullable=False),
        sa.Column("catalog_updated_at", sa.DateTime(timezone=True), nullable=True),
        *timestamp_columns(),
        sa.PrimaryKeyConstraint("id", name="pk_problem"),
        sa.UniqueConstraint("slug", name="uq_problem_slug"),
    )
    op.create_index("ix_problem_active", "problem", ["active"])
    op.create_index("ix_problem_difficulty", "problem", ["difficulty"])
    op.create_index("ix_problem_title", "problem", ["title"])

    op.create_table(
        "topic",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        *timestamp_columns(),
        sa.PrimaryKeyConstraint("id", name="pk_topic"),
        sa.UniqueConstraint("name", name="uq_topic_name"),
        sa.UniqueConstraint("slug", name="uq_topic_slug"),
    )

    op.create_table(
        "problem_topic",
        sa.Column("problem_id", sa.Integer(), nullable=False),
        sa.Column("topic_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["problem_id"],
            ["problem.id"],
            name="fk_problem_topic_problem_id_problem",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["topic_id"],
            ["topic.id"],
            name="fk_problem_topic_topic_id_topic",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "problem_id",
            "topic_id",
            name="pk_problem_topic",
        ),
    )

    op.create_table(
        "practice_session",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("problem_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            enum_type(
                "practice_session_status",
                24,
                "active",
                "paused",
                "awaiting_details",
                "finalized",
                "discarded",
            ),
            server_default="active",
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("running_since", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "accumulated_active_ms",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column("paused_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("stopped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True),
        *timestamp_columns(),
        sa.CheckConstraint(
            "accumulated_active_ms >= 0",
            name="ck_practice_session_accumulated_active_ms_nonnegative",
        ),
        sa.ForeignKeyConstraint(
            ["problem_id"],
            ["problem.id"],
            name="fk_practice_session_problem_id_problem",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_practice_session"),
    )
    op.create_index(
        "ix_practice_session_problem_id",
        "practice_session",
        ["problem_id"],
    )
    op.create_index(
        "ix_practice_session_status",
        "practice_session",
        ["status"],
    )

    op.create_table(
        "attempt",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("problem_id", sa.Integer(), nullable=False),
        sa.Column("practice_session_id", sa.String(length=36), nullable=True),
        sa.Column("idempotency_key", sa.String(length=128), nullable=True),
        sa.Column("idempotency_payload_hash", sa.String(length=64), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column(
            "outcome",
            enum_type(
                "attempt_outcome",
                16,
                "optimal",
                "hint",
                "solution",
                "failed",
            ),
            nullable=False,
        ),
        sa.Column(
            "effort",
            enum_type(
                "attempt_effort",
                16,
                "light",
                "moderate",
                "heavy",
                "brutal",
            ),
            nullable=False,
        ),
        sa.Column(
            "blocker",
            enum_type(
                "attempt_blocker",
                24,
                "none",
                "pattern",
                "edge-cases",
                "complexity",
                "implementation",
                "debugging",
                "time",
            ),
            server_default="none",
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), server_default="", nullable=False),
        *timestamp_columns(),
        sa.CheckConstraint(
            "duration_seconds > 0",
            name="ck_attempt_duration_seconds_positive",
        ),
        sa.ForeignKeyConstraint(
            ["practice_session_id"],
            ["practice_session.id"],
            name="fk_attempt_practice_session_id_practice_session",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["problem_id"],
            ["problem.id"],
            name="fk_attempt_problem_id_problem",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_attempt"),
        sa.UniqueConstraint(
            "idempotency_key",
            name="uq_attempt_idempotency_key",
        ),
        sa.UniqueConstraint(
            "practice_session_id",
            name="uq_attempt_practice_session_id",
        ),
    )
    op.create_index("ix_attempt_completed_at", "attempt", ["completed_at"])
    op.create_index("ix_attempt_problem_id", "attempt", ["problem_id"])

    op.create_table(
        "recording",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("attempt_id", sa.String(length=36), nullable=True),
        sa.Column("practice_session_id", sa.String(length=36), nullable=True),
        sa.Column("storage_key", sa.String(length=255), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=True),
        sa.Column("media_type", sa.String(length=127), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=False),
        *timestamp_columns(),
        sa.CheckConstraint(
            "byte_size > 0",
            name="ck_recording_byte_size_positive",
        ),
        sa.CheckConstraint(
            "duration_ms >= 0",
            name="ck_recording_duration_ms_nonnegative",
        ),
        sa.ForeignKeyConstraint(
            ["attempt_id"],
            ["attempt.id"],
            name="fk_recording_attempt_id_attempt",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["practice_session_id"],
            ["practice_session.id"],
            name="fk_recording_practice_session_id_practice_session",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_recording"),
        sa.UniqueConstraint(
            "attempt_id",
            name="uq_recording_attempt_id",
        ),
        sa.UniqueConstraint(
            "checksum_sha256",
            name="uq_recording_checksum_sha256",
        ),
        sa.UniqueConstraint(
            "practice_session_id",
            name="uq_recording_practice_session_id",
        ),
        sa.UniqueConstraint("storage_key", name="uq_recording_storage_key"),
    )
    op.create_index("ix_recording_attempt_id", "recording", ["attempt_id"])

    op.create_table(
        "transcription",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("recording_id", sa.String(length=36), nullable=False),
        sa.Column(
            "status",
            enum_type(
                "transcription_status",
                16,
                "queued",
                "processing",
                "completed",
                "failed",
            ),
            server_default="queued",
            nullable=False,
        ),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column("corrected_text", sa.Text(), nullable=True),
        sa.Column("segments", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("language", sa.String(length=16), nullable=True),
        sa.Column("model", sa.String(length=100), nullable=True),
        sa.Column("retry_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_code", sa.String(length=100), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(
            ["recording_id"],
            ["recording.id"],
            name="fk_transcription_recording_id_recording",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_transcription"),
        sa.UniqueConstraint(
            "recording_id",
            name="uq_transcription_recording_id",
        ),
    )
    op.create_index("ix_transcription_status", "transcription", ["status"])

    op.create_table(
        "review_state",
        sa.Column("problem_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            enum_type(
                "problem_status",
                16,
                "not-started",
                "solved",
                "review",
                "struggling",
            ),
            server_default="not-started",
            nullable=False,
        ),
        sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_attempt_id", sa.String(length=36), nullable=True),
        sa.Column("best_duration_seconds", sa.Integer(), nullable=True),
        sa.Column("interval_days", sa.Integer(), server_default="0", nullable=False),
        sa.Column("lapses", sa.Integer(), server_default="0", nullable=False),
        sa.Column("confidence", sa.Integer(), server_default="0", nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("has_notes", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("has_audio", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("has_transcript", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("engine_version", sa.String(length=32), nullable=False),
        *timestamp_columns(),
        sa.CheckConstraint(
            "attempt_count >= 0",
            name="ck_review_state_attempt_count_nonnegative",
        ),
        sa.CheckConstraint(
            "confidence >= 0 AND confidence <= 5",
            name="ck_review_state_confidence_range",
        ),
        sa.CheckConstraint(
            "interval_days >= 0",
            name="ck_review_state_interval_days_nonnegative",
        ),
        sa.CheckConstraint(
            "lapses >= 0",
            name="ck_review_state_lapses_nonnegative",
        ),
        sa.ForeignKeyConstraint(
            ["last_attempt_id"],
            ["attempt.id"],
            name="fk_review_state_last_attempt_id_attempt",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["problem_id"],
            ["problem.id"],
            name="fk_review_state_problem_id_problem",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("problem_id", name="pk_review_state"),
    )
    op.create_index("ix_review_state_due_at", "review_state", ["due_at"])
    op.create_index("ix_review_state_status", "review_state", ["status"])

    op.create_table(
        "job",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column(
            "status",
            enum_type(
                "job_status",
                16,
                "queued",
                "processing",
                "completed",
                "failed",
                "cancelled",
            ),
            server_default="queued",
            nullable=False,
        ),
        sa.Column("payload", sa.JSON(), server_default="{}", nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("max_attempts", sa.Integer(), server_default="3", nullable=False),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("locked_by", sa.String(length=100), nullable=True),
        sa.Column("error_code", sa.String(length=100), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        *timestamp_columns(),
        sa.CheckConstraint("attempts >= 0", name="ck_job_attempts_nonnegative"),
        sa.CheckConstraint("max_attempts > 0", name="ck_job_max_attempts_positive"),
        sa.PrimaryKeyConstraint("id", name="pk_job"),
    )
    op.create_index("ix_job_available_at", "job", ["available_at"])
    op.create_index("ix_job_kind", "job", ["kind"])
    op.create_index("ix_job_lease_expires_at", "job", ["lease_expires_at"])
    op.create_index("ix_job_status", "job", ["status"])

    op.create_table(
        "ai_artifact",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("attempt_id", sa.String(length=36), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("prompt_version", sa.String(length=32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(
            ["attempt_id"],
            ["attempt.id"],
            name="fk_ai_artifact_attempt_id_attempt",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_ai_artifact"),
    )
    op.create_index("ix_ai_artifact_attempt_id", "ai_artifact", ["attempt_id"])

    op.create_table(
        "catalog_sync",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "status",
            enum_type(
                "catalog_sync_status",
                16,
                "running",
                "completed",
                "failed",
            ),
            server_default="running",
            nullable=False,
        ),
        sa.Column("source", sa.String(length=255), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("added_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("updated_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "deactivated_count",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column("error_code", sa.String(length=100), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_catalog_sync"),
    )
    op.create_index("ix_catalog_sync_status", "catalog_sync", ["status"])

    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("key", name="pk_app_settings"),
    )


def downgrade() -> None:
    raise NotImplementedError("Rodeo migrations are forward-only")
