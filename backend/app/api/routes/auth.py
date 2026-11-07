"""First-run setup, login and logout. Setup closes after the first administrator exists."""

from fastapi import APIRouter, Request, Response, status

from app.api.deps import CurrentUserDep, DbSessionDep, SettingsDep
from app.api.errors import http_error
from app.schemas.accounts import (
    LoginRequest,
    SetupRequest,
    SetupStatusResponse,
    UserResponse,
)
from app.security.sessions import COOKIE_NAME, attach_session_cookie, clear_session_cookie
from app.services.auth import authenticate, logout, needs_setup, setup_facility
from app.services.errors import AppError

router = APIRouter(tags=["auth"])


@router.get("/setup/status", response_model=SetupStatusResponse)
async def setup_status(session: DbSessionDep) -> SetupStatusResponse:
    return SetupStatusResponse(needs_setup=await needs_setup(session))


@router.post("/setup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def setup(
    body: SetupRequest,
    response: Response,
    session: DbSessionDep,
    settings: SettingsDep,
) -> UserResponse:
    try:
        user, token = await setup_facility(
            session,
            settings,
            facility_name=body.facility_name,
            email=body.email,
            display_name=body.display_name,
            password=body.password,
        )
    except AppError as exc:
        raise http_error(exc) from None
    attach_session_cookie(response, token, settings)
    return UserResponse.model_validate(user, from_attributes=True)


@router.post("/auth/login", response_model=UserResponse)
async def login(
    body: LoginRequest,
    response: Response,
    session: DbSessionDep,
    settings: SettingsDep,
) -> UserResponse:
    try:
        user, token = await authenticate(
            session, settings, email=body.email, password=body.password
        )
    except AppError as exc:
        raise http_error(exc) from None
    attach_session_cookie(response, token, settings)
    return UserResponse.model_validate(user, from_attributes=True)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_route(
    request: Request,
    response: Response,
    session: DbSessionDep,
    settings: SettingsDep,
) -> None:
    await logout(session, request.cookies.get(COOKIE_NAME))
    clear_session_cookie(response, settings)


@router.get("/auth/me", response_model=UserResponse)
async def me(user: CurrentUserDep) -> UserResponse:
    return UserResponse.model_validate(user, from_attributes=True)
