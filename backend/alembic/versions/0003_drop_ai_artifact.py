"""Drop the ai_artifact table with the removal of AI service calls.

Revision ID: 0003_drop_ai_artifact
Revises: 0002_review_queue_policy_v2
Create Date: 2026-08-30
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003_drop_ai_artifact"
down_revision: str | None = "0002_review_queue_policy_v2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index("ix_ai_artifact_attempt_id", table_name="ai_artifact")
    op.drop_table("ai_artifact")


def downgrade() -> None:
    op.create_table(
        "ai_artifact",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("attempt_id", sa.String(length=36), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("prompt_version", sa.String(length=32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["attempt_id"],
            ["attempt.id"],
            name="fk_ai_artifact_attempt_id_attempt",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_ai_artifact"),
    )
    op.create_index("ix_ai_artifact_attempt_id", "ai_artifact", ["attempt_id"])
