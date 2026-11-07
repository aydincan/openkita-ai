"""Public environment outlook. Session required. No facility id leaves the host."""

from datetime import UTC, datetime

from fastapi import APIRouter

from app.api.deps import (
    CurrentUserDep,
    DbSessionDep,
    ExposureCacheDep,
    ExposureClientDep,
    SettingsDep,
)
from app.api.errors import http_error
from app.exposure.regions import REGIONS
from app.schemas.exposure import ExposureRegionOption, ExposureReport
from app.services.auth import get_facility
from app.services.errors import AppError
from app.services.exposure import load_exposure

router = APIRouter(tags=["exposure"])


@router.get("/exposure/regions", response_model=list[ExposureRegionOption])
async def list_regions(_user: CurrentUserDep) -> list[ExposureRegionOption]:
    return [
        ExposureRegionOption(code=region.code, label=region.label) for region in REGIONS.values()
    ]


@router.get("/exposure", response_model=ExposureReport)
async def read_exposure(
    user: CurrentUserDep,
    session: DbSessionDep,
    client: ExposureClientDep,
    cache: ExposureCacheDep,
    settings: SettingsDep,
) -> ExposureReport:
    try:
        facility = await get_facility(session, user.facility_id)
    except AppError as exc:
        raise http_error(exc) from None
    return await load_exposure(
        region_code=facility.exposure_region_code,
        client=client,
        cache=cache,
        settings=settings,
        now=datetime.now(UTC),
    )
