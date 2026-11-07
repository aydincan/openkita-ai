"""Coarse public region for environment readings.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "facilities",
        sa.Column("exposure_region_code", sa.String(length=16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("facilities", "exposure_region_code")
