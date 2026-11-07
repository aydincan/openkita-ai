"""FastAPI application factory.

Run with ``uvicorn app.main:create_app --factory`` (no application instance is created at
import time, so importing this module has no side effects and never reads configuration).
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import httpx

from app import __version__
from app.ai import build_provider
from app.api.errors import register_error_handlers
from app.api.routes import auth, drafts, exposure, facility, health, users
from app.core.config import Settings, get_settings
from app.core.database import create_engine, create_session_factory
from app.core.logging import configure_logging
from app.core.security_headers import SecurityHeadersMiddleware
from app.exposure.cache import ExposureCache
from app.skills.loader import load_skills


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # Resources are only created here (not at import time) so tests can build
        # isolated apps. Engine creation is lazy and does not need a running database.
        engine = create_engine(settings)
        app.state.settings = settings
        app.state.engine = engine
        app.state.session_factory = create_session_factory(engine)
        app.state.ai_provider = build_provider(settings)
        app.state.skills = load_skills(settings.skills_dir)
        exposure_client = httpx.AsyncClient(
            timeout=httpx.Timeout(settings.exposure_http_timeout_seconds),
            follow_redirects=False,
        )
        app.state.exposure_client = exposure_client
        app.state.exposure_cache = ExposureCache()
        try:
            yield
        finally:
            await exposure_client.aclose()
            await engine.dispose()

    # Interactive docs pull Swagger UI / ReDoc assets from a CDN, so they only exist outside
    # production (see docs/privacy.md).
    docs = settings.docs_enabled
    app = FastAPI(
        title="OpenKita AI API",
        version=__version__,
        description="Self-hosted AI assistant for childcare facilities.",
        lifespan=lifespan,
        docs_url="/docs" if docs else None,
        redoc_url="/redoc" if docs else None,
        openapi_url="/openapi.json" if docs else None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["*"],
    )
    app.add_middleware(SecurityHeadersMiddleware, strict_csp=not docs)
    register_error_handlers(app)
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(facility.router)
    app.include_router(users.router)
    app.include_router(drafts.router)
    app.include_router(exposure.router)
    return app
