from typing import Any, cast

from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.database import create_engine
from app.core.wait_for_db import wait_for_database
from tests.conftest import FakeEngine, make_settings


async def test_returns_true_when_database_is_ready() -> None:
    assert await wait_for_database(cast(AsyncEngine, FakeEngine()), attempts=3, delay_seconds=0)


async def test_gives_up_after_attempts_when_database_is_down() -> None:
    engine = create_engine(make_settings())
    try:
        assert not await wait_for_database(engine, attempts=2, delay_seconds=0.01)
    finally:
        await engine.dispose()


async def test_retries_until_ready() -> None:
    calls: dict[str, int] = {"n": 0}

    class Flaky(FakeEngine):
        def connect(self) -> Any:
            calls["n"] += 1
            if calls["n"] < 3:
                raise ConnectionRefusedError
            return super().connect()

    assert await wait_for_database(cast(AsyncEngine, Flaky()), attempts=5, delay_seconds=0)
    assert calls["n"] == 3
