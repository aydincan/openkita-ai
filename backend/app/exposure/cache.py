"""In-memory cache of public environment documents. Keys are source names, never a facility id."""

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any


@dataclass(frozen=True)
class CachedDocument:
    retrieved_at: datetime
    body: dict[str, Any]


class ExposureCache:
    def __init__(self) -> None:
        self._items: dict[str, CachedDocument] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str, now: datetime, ttl: timedelta) -> CachedDocument | None:
        async with self._lock:
            item = self._items.get(key)
            if item is None or now - item.retrieved_at > ttl:
                return None
            return item

    async def put(self, key: str, body: dict[str, Any], retrieved_at: datetime) -> None:
        async with self._lock:
            self._items[key] = CachedDocument(retrieved_at=retrieved_at, body=body)
