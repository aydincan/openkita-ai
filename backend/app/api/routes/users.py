"""Administrator-only user management. New accounts are educators of the same facility."""

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CurrentUserDep, DbSessionDep, SettingsDep
from app.api.errors import http_error
from app.schemas.accounts import UserCreateRequest, UserResponse
from app.services.auth import create_educator, deactivate_user, list_users
from app.services.errors import AppError

router = APIRouter(tags=["users"])


@router.get("/users", response_model=list[UserResponse])
async def read_users(user: CurrentUserDep, session: DbSessionDep) -> list[UserResponse]:
    try:
        rows = await list_users(session, facility_id=user.facility_id, role=user.role)
    except AppError as exc:
        raise http_error(exc) from None
    return [UserResponse.model_validate(row, from_attributes=True) for row in rows]


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def add_educator(
    body: UserCreateRequest,
    user: CurrentUserDep,
    session: DbSessionDep,
    settings: SettingsDep,
) -> UserResponse:
    try:
        created = await create_educator(
            session,
            settings,
            facility_id=user.facility_id,
            role=user.role,
            email=body.email,
            display_name=body.display_name,
            password=body.password,
        )
    except AppError as exc:
        raise http_error(exc) from None
    return UserResponse.model_validate(created, from_attributes=True)


@router.post("/users/{user_id}/deactivate", response_model=UserResponse)
async def deactivate(
    user_id: UUID,
    user: CurrentUserDep,
    session: DbSessionDep,
) -> UserResponse:
    try:
        updated = await deactivate_user(
            session, facility_id=user.facility_id, role=user.role, user_id=user_id
        )
    except AppError as exc:
        raise http_error(exc) from None
    return UserResponse.model_validate(updated, from_attributes=True)
