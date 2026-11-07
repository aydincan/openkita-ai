"""Aggregates the health of the API and its dependencies."""

import asyncio
import logging
import time

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app import __version__
from app.ai.base import AIProvider
from app.ai.disabled import DisabledProvider
from app.core.config import Settings
from app.schemas.health import (
    ComponentHealth,
    ComponentState,
    HealthComponents,
    HealthResponse,
)

logger = logging.getLogger(__name__)


async def check_database(engine: AsyncEngine, timeout_seconds: float) -> ComponentHealth:
    """Run ``SELECT 1``. Never raises; error details are logged, not returned."""
    started = time.perf_counter()
    try:
        async with asyncio.timeout(timeout_seconds):
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - any failure means "database is down"
        logger.warning("Database health check failed: %s", type(exc).__name__)
        return ComponentHealth(status=ComponentState.DOWN, detail="Database is not reachable")
    latency = round((time.perf_counter() - started) * 1000, 1)
    return ComponentHealth(status=ComponentState.UP, latency_ms=latency)


async def check_ai(provider: AIProvider, timeout_seconds: float) -> ComponentHealth:
    """Optional dependency: a failure is reported but never fatal."""
    if isinstance(provider, DisabledProvider):
        return ComponentHealth(
            status=ComponentState.DISABLED, detail="AI provider disabled by configuration"
        )
    try:
        async with asyncio.timeout(timeout_seconds + 1):
            result = await provider.check_connection()
    except Exception as exc:  # noqa: BLE001 - providers must not raise, but never trust that
        logger.warning("AI health check failed: %s", type(exc).__name__)
        return ComponentHealth(status=ComponentState.DOWN, detail="AI provider check failed")
    state = ComponentState.UP if result.ok else ComponentState.DOWN
    return ComponentHealth(status=state, detail=result.detail, latency_ms=result.latency_ms)


async def get_health(
    engine: AsyncEngine, provider: AIProvider, settings: Settings
) -> HealthResponse:
    timeout = settings.health_check_timeout_seconds
    database, ai = await asyncio.gather(
        check_database(engine, timeout), check_ai(provider, timeout)
    )
    return HealthResponse(
        status="ok" if database.status is ComponentState.UP else "error",
        version=__version__,
        environment=settings.app_env,
        components=HealthComponents(
            api=ComponentHealth(status=ComponentState.UP),
            database=database,
            ai=ai,
        ),
    )
