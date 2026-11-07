"""Facility setup, sessions, and user administration. Queries carry ``facility_id``."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.exposure.regions import REGIONS
from app.models import DeploymentState, Facility, User, UserSession
from app.security.passwords import (
    hash_password,
    password_is_rejected,
    verify_dummy,
    verify_password,
)
from app.security.sessions import as_utc, hash_session_token, new_session_token
from app.services.errors import AppError


async def needs_setup(session: AsyncSession) -> bool:
    state = await session.get(DeploymentState, 1)
    if state is not None and state.setup_completed:
        return False
    admin_id = await session.scalar(select(User.id).where(User.role == "administrator").limit(1))
    return admin_id is None


async def setup_facility(
    session: AsyncSession,
    settings: Settings,
    *,
    facility_name: str,
    email: str,
    display_name: str,
    password: str,
) -> tuple[User, str]:
    if password_is_rejected(password):
        raise AppError("weak_password", 422)
    state = await _lock_state(session)
    if state.setup_completed or not await needs_setup(session):
        state.setup_completed = True
        await session.commit()
        raise AppError("setup_closed", 409)
    facility = Facility(name=facility_name.strip())
    session.add(facility)
    await session.flush()
    user = User(
        facility_id=facility.id,
        email=email.strip().lower(),
        password_hash=hash_password(settings.app_env, password),
        display_name=display_name.strip(),
        role="administrator",
        is_active=True,
    )
    session.add(user)
    await session.flush()
    token = _add_session(session, user, settings)
    state.setup_completed = True
    await session.commit()
    return user, token


async def authenticate(
    session: AsyncSession,
    settings: Settings,
    *,
    email: str,
    password: str,
) -> tuple[User, str]:
    user = await session.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None:
        verify_dummy(settings.app_env, password)
        raise AppError("invalid_credentials", 401)
    password_ok = verify_password(settings.app_env, user.password_hash, password)
    if not password_ok or not user.is_active:
        raise AppError("invalid_credentials", 401)
    token = _add_session(session, user, settings)
    await session.commit()
    return user, token


async def user_for_token(session: AsyncSession, token: str | None) -> User | None:
    if not token:
        return None
    stored = await session.scalar(
        select(UserSession).where(UserSession.token_hash == hash_session_token(token))
    )
    if stored is None:
        return None
    if as_utc(stored.expires_at) <= datetime.now(UTC):
        await session.delete(stored)
        await session.commit()
        return None
    user = await session.get(User, stored.user_id)
    if user is None or not user.is_active or user.facility_id != stored.facility_id:
        return None
    return user


async def logout(session: AsyncSession, token: str | None) -> None:
    if not token:
        return
    await session.execute(
        delete(UserSession).where(UserSession.token_hash == hash_session_token(token))
    )
    await session.commit()


async def get_facility(session: AsyncSession, facility_id: UUID) -> Facility:
    facility = await session.get(Facility, facility_id)
    if facility is None:
        raise AppError("not_found", 404)
    return facility


async def rename_facility(
    session: AsyncSession,
    *,
    facility_id: UUID,
    role: str,
    name: str,
) -> Facility:
    if role != "administrator":
        raise AppError("forbidden", 403)
    facility = await get_facility(session, facility_id)
    facility.name = name.strip()
    await session.commit()
    return facility


async def set_exposure_region(
    session: AsyncSession,
    *,
    facility_id: UUID,
    role: str,
    region_code: str | None,
) -> Facility:
    if role != "administrator":
        raise AppError("forbidden", 403)
    if region_code is not None and region_code not in REGIONS:
        raise AppError("invalid_region", 422)
    facility = await get_facility(session, facility_id)
    facility.exposure_region_code = region_code
    await session.commit()
    return facility


async def list_users(session: AsyncSession, *, facility_id: UUID, role: str) -> list[User]:
    if role != "administrator":
        raise AppError("forbidden", 403)
    rows = await session.scalars(
        select(User).where(User.facility_id == facility_id).order_by(User.created_at)
    )
    return list(rows)


async def create_educator(
    session: AsyncSession,
    settings: Settings,
    *,
    facility_id: UUID,
    role: str,
    email: str,
    display_name: str,
    password: str,
) -> User:
    if role != "administrator":
        raise AppError("forbidden", 403)
    if password_is_rejected(password):
        raise AppError("weak_password", 422)
    user = User(
        facility_id=facility_id,
        email=email.strip().lower(),
        password_hash=hash_password(settings.app_env, password),
        display_name=display_name.strip(),
        role="educator",
        is_active=True,
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise AppError("email_taken", 409) from None
    return user


async def deactivate_user(
    session: AsyncSession,
    *,
    facility_id: UUID,
    role: str,
    user_id: UUID,
) -> User:
    if role != "administrator":
        raise AppError("forbidden", 403)
    user = await session.scalar(
        select(User).where(User.id == user_id, User.facility_id == facility_id)
    )
    if user is None:
        raise AppError("not_found", 404)
    if user.role != "educator":
        raise AppError("cannot_deactivate", 403)
    user.is_active = False
    await session.execute(
        delete(UserSession).where(
            UserSession.user_id == user.id,
            UserSession.facility_id == facility_id,
        )
    )
    await session.commit()
    return user


async def _lock_state(session: AsyncSession) -> DeploymentState:
    state = await session.get(DeploymentState, 1)
    if state is None:
        state = DeploymentState(id=1, setup_completed=False)
        session.add(state)
        try:
            await session.flush()
        except IntegrityError:
            await session.rollback()
            existing = await session.get(DeploymentState, 1)
            if existing is None:
                raise AppError("setup_closed", 409) from None
            return existing
    return state


def _add_session(session: AsyncSession, user: User, settings: Settings) -> str:
    token = new_session_token()
    session.add(
        UserSession(
            user_id=user.id,
            facility_id=user.facility_id,
            token_hash=hash_session_token(token),
            expires_at=datetime.now(UTC) + timedelta(hours=settings.session_ttl_hours),
        )
    )
    return token
