import asyncio
from collections.abc import AsyncIterator, Iterator
from pathlib import Path
from types import TracebackType
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.ai.base import AIProvider, ConnectionResult, GenerationResult
from app.api.deps import get_ai_provider, get_db_session, get_engine
from app.core.config import Settings
from app.main import create_app
from app.models import Base

# Deliberately full of URL-special characters: must work unencoded in POSTGRES_PASSWORD.
TEST_PASSWORD = "p@ss/w0rd:#?"


def make_settings(**overrides: Any) -> Settings:
    base: dict[str, Any] = {
        "app_env": "test",
        # Unreachable database (port 1) unless a test overrides it.
        "postgres_host": "127.0.0.1",
        "postgres_port": 1,
        "postgres_user": "user",
        "postgres_password": TEST_PASSWORD,
        "postgres_db": "nope",
        "database_url": None,
        "ai_provider": "none",
        "health_check_timeout_seconds": 0.5,
    }
    base.update(overrides)
    return Settings(_env_file=None, **base)


class FakeConnection:
    async def __aenter__(self) -> "FakeConnection":
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        return None

    async def execute(self, *_args: object, **_kwargs: object) -> None:
        return None


class FakeEngine:
    """Stands in for AsyncEngine: connects instantly (healthy database)."""

    def connect(self) -> FakeConnection:
        return FakeConnection()


class HangingConnection(FakeConnection):
    async def execute(self, *_args: object, **_kwargs: object) -> None:
        await asyncio.sleep(30)


class HangingEngine(FakeEngine):
    def connect(self) -> FakeConnection:
        return HangingConnection()


class StubProvider(AIProvider):
    name = "stub"

    def __init__(self, result: ConnectionResult | Exception) -> None:
        self._result = result

    async def check_connection(self) -> ConnectionResult:
        if isinstance(self._result, Exception):
            raise self._result
        return self._result

    async def generate(self, prompt: str, *, json_mode: bool = True) -> GenerationResult:
        del prompt, json_mode
        return GenerationResult(ok=False, text="", detail="stub")


@pytest.fixture
def client_factory() -> Iterator[Any]:
    """Build a client (with lifespan) and optionally override engine / AI provider."""
    clients: list[TestClient] = []

    def _make(
        settings: Settings | None = None,
        engine: object | None = None,
        provider: AIProvider | None = None,
    ) -> TestClient:
        app = create_app(settings or make_settings())
        if engine is not None:
            app.dependency_overrides[get_engine] = lambda: cast(AsyncEngine, engine)
        if provider is not None:
            app.dependency_overrides[get_ai_provider] = lambda: provider
        client = TestClient(app)
        client.__enter__()
        clients.append(client)
        return client

    yield _make
    for client in clients:
        client.__exit__(None, None, None)


@pytest.fixture
async def api(
    tmp_path: Path,
) -> AsyncIterator[tuple[AsyncClient, async_sessionmaker[AsyncSession], Any]]:
    """SQLite app with a real session, so auth and drafts can be tested without PostgreSQL."""
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'test.sqlite3'}")

    @event.listens_for(engine.sync_engine, "connect")
    def _foreign_keys(dbapi_connection: Any, _record: object) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    app = create_app(make_settings())
    app.dependency_overrides[get_db_session] = override_session
    transport = ASGITransport(app=app)
    # This httpx build does not run the ASGI lifespan, which is what publishes settings.
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=transport, base_url="http://test") as client,
    ):
        yield client, factory, app
    await engine.dispose()
