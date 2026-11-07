"""FastAPI dependencies. Shared resources live on ``app.state`` (created in the lifespan)."""

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, HTTPException, Request
import httpx
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.ai.base import AIProvider
from app.core.config import Settings
from app.exposure.cache import ExposureCache
from app.models import User
from app.security.sessions import COOKIE_NAME
from app.services.auth import user_for_token
from app.skills.models import LoadedSkill


def get_app_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def get_engine(request: Request) -> AsyncEngine:
    engine: AsyncEngine = request.app.state.engine
    return engine


def get_ai_provider(request: Request) -> AIProvider:
    provider: AIProvider = request.app.state.ai_provider
    return provider


async def get_db_session(request: Request) -> AsyncIterator[AsyncSession]:
    factory: async_sessionmaker[AsyncSession] = request.app.state.session_factory
    async with factory() as session:
        yield session


SettingsDep = Annotated[Settings, Depends(get_app_settings)]
EngineDep = Annotated[AsyncEngine, Depends(get_engine)]
AIProviderDep = Annotated[AIProvider, Depends(get_ai_provider)]
DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]


async def get_current_user(request: Request, session: DbSessionDep) -> User:
    user = await user_for_token(session, request.cookies.get(COOKIE_NAME))
    if user is None:
        raise HTTPException(status_code=401, detail="unauthenticated")
    return user


def get_parent_skill(request: Request) -> LoadedSkill:
    skills: object = getattr(request.app.state, "skills", None)
    skill = skills.get("parent-communication") if isinstance(skills, dict) else None
    if not isinstance(skill, LoadedSkill):
        raise HTTPException(status_code=503, detail="skill_unavailable")
    return skill


CurrentUserDep = Annotated[User, Depends(get_current_user)]
ParentSkillDep = Annotated[LoadedSkill, Depends(get_parent_skill)]


def get_exposure_client(request: Request) -> httpx.AsyncClient:
    client: httpx.AsyncClient = request.app.state.exposure_client
    return client


def get_exposure_cache(request: Request) -> ExposureCache:
    cache: ExposureCache = request.app.state.exposure_cache
    return cache


ExposureClientDep = Annotated[httpx.AsyncClient, Depends(get_exposure_client)]
ExposureCacheDep = Annotated[ExposureCache, Depends(get_exposure_cache)]
