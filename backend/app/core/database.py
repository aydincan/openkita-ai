"""Async SQLAlchemy engine and session handling."""

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import Settings


def create_engine(settings: Settings) -> AsyncEngine:
    """Create the engine. Connections are opened lazily, so this never fails when the
    database is down; failures surface on first use (and are handled by /health)."""
    return create_async_engine(
        settings.sqlalchemy_url,
        pool_pre_ping=True,
        connect_args={"timeout": settings.health_check_timeout_seconds * 2},
    )


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)
