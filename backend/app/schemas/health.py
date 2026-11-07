from enum import StrEnum
from typing import Literal

from pydantic import BaseModel


class ComponentState(StrEnum):
    UP = "up"
    DOWN = "down"
    DISABLED = "disabled"


class ComponentHealth(BaseModel):
    status: ComponentState
    detail: str | None = None
    latency_ms: float | None = None


class HealthComponents(BaseModel):
    api: ComponentHealth
    database: ComponentHealth
    ai: ComponentHealth


class HealthResponse(BaseModel):
    """``status`` is ``ok`` iff the database is up. The AI component is optional and never
    changes the overall status."""

    status: Literal["ok", "error"]
    version: str
    environment: str
    components: HealthComponents
