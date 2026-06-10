"""Persist review-queue policy v2 snapshots and graduation state.

Revision ID: 0002_review_queue_policy_v2
Revises: 0001_initial_schema
Create Date: 2026-08-29
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002_review_queue_policy_v2"
down_revision: str | None = "0001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("attempt") as batch_op:
        batch_op.add_column(sa.Column("problem_difficulty_at_attempt", sa.String(16)))
        batch_op.add_column(sa.Column("target_minutes_at_attempt", sa.Integer()))

    with op.batch_alter_table("review_state") as batch_op:
        batch_op.add_column(sa.Column("next_due_on", sa.Date()))
        batch_op.add_column(sa.Column("graduated_at", sa.DateTime(timezone=True)))
        batch_op.add_column(
            sa.Column(
                "clean_quick_streak", sa.Integer(), server_default="0", nullable=False
            )
        )
        batch_op.create_index("ix_review_state_next_due_on", ["next_due_on"])


def downgrade() -> None:
    with op.batch_alter_table("review_state") as batch_op:
        batch_op.drop_index("ix_review_state_next_due_on")
        batch_op.drop_column("clean_quick_streak")
        batch_op.drop_column("graduated_at")
        batch_op.drop_column("next_due_on")

    with op.batch_alter_table("attempt") as batch_op:
        batch_op.drop_column("target_minutes_at_attempt")
        batch_op.drop_column("problem_difficulty_at_attempt")
