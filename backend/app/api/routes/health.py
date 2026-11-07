from fastapi import APIRouter, Response, status

from app.api.deps import AIProviderDep, EngineDep, SettingsDep
from app.schemas.health import HealthResponse
from app.services.health import get_health

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    responses={503: {"model": HealthResponse, "description": "Database unavailable"}},
    summary="API, database and (optional) AI provider status",
)
async def health(
    response: Response,
    engine: EngineDep,
    provider: AIProviderDep,
    settings: SettingsDep,
) -> HealthResponse:
    result = await get_health(engine, provider, settings)
    if result.status != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return result


@router.get(
    "/health/live",
    summary="Liveness probe (process is up; touches no dependency)",
)
async def live() -> dict[str, str]:
    """Minimal public liveness check used by container healthchecks. Detailed component
    status (``/health``) is planned to move behind authentication."""
    return {"status": "ok"}
