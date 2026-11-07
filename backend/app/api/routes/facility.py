"""The single facility for this deployment. Educators can read it, not rename it."""

from fastapi import APIRouter

from app.api.deps import CurrentUserDep, DbSessionDep
from app.api.errors import http_error
from app.exposure.regions import region_label
from app.models import Facility
from app.schemas.accounts import FacilityRegionUpdate, FacilityResponse, FacilityUpdateRequest
from app.services.auth import get_facility, rename_facility, set_exposure_region
from app.services.errors import AppError

router = APIRouter(tags=["facility"])


def _facility_response(facility: Facility) -> FacilityResponse:
    code = facility.exposure_region_code
    return FacilityResponse(
        id=facility.id,
        name=facility.name,
        exposure_region_code=code,
        exposure_region_label=region_label(code),
    )


@router.get("/facility", response_model=FacilityResponse)
async def read_facility(user: CurrentUserDep, session: DbSessionDep) -> FacilityResponse:
    try:
        facility = await get_facility(session, user.facility_id)
    except AppError as exc:
        raise http_error(exc) from None
    return _facility_response(facility)


@router.patch("/facility", response_model=FacilityResponse)
async def update_facility(
    body: FacilityUpdateRequest,
    user: CurrentUserDep,
    session: DbSessionDep,
) -> FacilityResponse:
    try:
        facility = await rename_facility(
            session, facility_id=user.facility_id, role=user.role, name=body.name
        )
    except AppError as exc:
        raise http_error(exc) from None
    return _facility_response(facility)


@router.patch("/facility/region", response_model=FacilityResponse)
async def update_region(
    body: FacilityRegionUpdate,
    user: CurrentUserDep,
    session: DbSessionDep,
) -> FacilityResponse:
    try:
        facility = await set_exposure_region(
            session,
            facility_id=user.facility_id,
            role=user.role,
            region_code=body.region_code,
        )
    except AppError as exc:
        raise http_error(exc) from None
    return _facility_response(facility)
