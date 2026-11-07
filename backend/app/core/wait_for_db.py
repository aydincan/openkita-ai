"""Wait until PostgreSQL accepts connections (used by the container entrypoint before
running migrations). ``python -m app.core.wait_for_db``; exit code 1 on timeout."""

import asyncio
import logging
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import get_settings
from app.core.database import create_engine

logger = logging.getLogger("openkita.wait_for_db")


async def wait_for_database(
    engine: AsyncEngine, attempts: int = 30, delay_seconds: float = 2.0
) -> bool:
    for attempt in range(1, attempts + 1):
        try:
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
        except Exception as exc:  # noqa: BLE001 - any failure means "not ready yet"
            logger.info("Database not ready (%d/%d): %s", attempt, attempts, type(exc).__name__)
            if attempt < attempts:
                await asyncio.sleep(delay_seconds)
        else:
            return True
    return False


async def _main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    engine = create_engine(get_settings())
    try:
        ok = await wait_for_database(engine)
    finally:
        await engine.dispose()
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(_main()))
