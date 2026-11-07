"""Domain tables for one facility: accounts, sessions and parent-letter drafts.

Every user-owned row carries ``facility_id`` (ADR 0004). There are no child profiles.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.models.base import Base


def _now() -> datetime:
    return datetime.now(UTC)


class DeploymentState(Base):
    """Single row (id = 1) that closes first-run setup."""

    __tablename__ = "deployment_state"
    __table_args__ = (CheckConstraint("id = 1", name="id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    setup_completed: Mapped[bool] = mapped_column(Boolean, default=False)


class Facility(Base):
    __tablename__ = "facilities"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(200))
    # DWD pollen area code. Coarse public region, not an address and not a child.
    exposure_region_code: Mapped[str | None] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('administrator', 'educator')", name="role"),)

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    facility_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("facilities.id"), index=True
    )
    email: Mapped[str] = mapped_column(String(320), unique=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    display_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(32))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class UserSession(Base):
    __tablename__ = "sessions"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id"), index=True)
    facility_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("facilities.id"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Draft(Base):
    """An AI parent-letter draft. Approval only changes ``status``; nothing is sent."""

    __tablename__ = "drafts"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'approved')", name="status"),
        CheckConstraint("language IN ('de', 'en', 'tr', 'ar')", name="language"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    facility_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("facilities.id"), index=True
    )
    author_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id"), index=True)
    skill_name: Mapped[str] = mapped_column(String(80))
    skill_version: Mapped[str] = mapped_column(String(20))
    subject: Mapped[str] = mapped_column(String(150))
    body: Mapped[str] = mapped_column(Text)
    fields: Mapped[dict[str, Any]] = mapped_column(JSON)
    language: Mapped[str] = mapped_column(String(8))
    status: Mapped[str] = mapped_column(String(16), default="draft")
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
