"""Users, one facility, sessions and parent-letter drafts.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "deployment_state",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("setup_completed", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.CheckConstraint("id = 1", name="ck_deployment_state_id"),
        sa.PrimaryKeyConstraint("id", name="pk_deployment_state"),
    )
    op.execute("INSERT INTO deployment_state (id, setup_completed) VALUES (1, false)")

    op.create_table(
        "facilities",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_facilities"),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("facility_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("role IN ('administrator', 'educator')", name="ck_users_role"),
        sa.ForeignKeyConstraint(
            ["facility_id"], ["facilities.id"], name="fk_users_facility_id_facilities"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_facility_id", "users", ["facility_id"])
    op.create_table(
        "sessions",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("facility_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["facility_id"], ["facilities.id"], name="fk_sessions_facility_id_facilities"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_sessions_user_id_users"),
        sa.PrimaryKeyConstraint("id", name="pk_sessions"),
        sa.UniqueConstraint("token_hash", name="uq_sessions_token_hash"),
    )
    op.create_index("ix_sessions_facility_id", "sessions", ["facility_id"])
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_table(
        "drafts",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("facility_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("author_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("skill_name", sa.String(length=80), nullable=False),
        sa.Column("skill_version", sa.String(length=20), nullable=False),
        sa.Column("subject", sa.String(length=150), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("fields", sa.JSON(), nullable=False),
        sa.Column("language", sa.String(length=8), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("ai_generated", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("language IN ('de', 'en', 'tr', 'ar')", name="ck_drafts_language"),
        sa.CheckConstraint("status IN ('draft', 'approved')", name="ck_drafts_status"),
        sa.ForeignKeyConstraint(
            ["author_id"], ["users.id"], name="fk_drafts_author_id_users"
        ),
        sa.ForeignKeyConstraint(
            ["facility_id"], ["facilities.id"], name="fk_drafts_facility_id_facilities"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_drafts"),
    )
    op.create_index("ix_drafts_author_id", "drafts", ["author_id"])
    op.create_index("ix_drafts_facility_id", "drafts", ["facility_id"])


def downgrade() -> None:
    op.drop_index("ix_drafts_facility_id", table_name="drafts")
    op.drop_index("ix_drafts_author_id", table_name="drafts")
    op.drop_table("drafts")
    op.drop_index("ix_sessions_user_id", table_name="sessions")
    op.drop_index("ix_sessions_facility_id", table_name="sessions")
    op.drop_table("sessions")
    op.drop_index("ix_users_facility_id", table_name="users")
    op.drop_table("users")
    op.drop_table("facilities")
    op.drop_table("deployment_state")
