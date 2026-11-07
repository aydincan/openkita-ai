"""Application settings, loaded from environment variables (see ``.env.example``)."""

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Literal, Self

from pydantic import Field, SecretStr, ValidationError, field_validator, model_validator
from pydantic_core import InitErrorDetails
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
from sqlalchemy.engine import URL, make_url

# backend/app/core/config.py -> repository root. Lets local development pick up the same
# root ``.env`` that Docker Compose uses, regardless of the working directory.
REPO_ROOT = Path(__file__).resolve().parents[3]

# Passwords that are documented defaults or trivially guessable. Always refused.
_PLACEHOLDER_PASSWORDS = frozenset(
    {"", "change-me", "changeme", "change_me", "password", "postgres", "openkita", "secret"}
)

SETUP_HINT = (
    "Set a strong, unique database password in .env (POSTGRES_PASSWORD); "
    "placeholders such as 'change-me' are refused."
)


def _is_placeholder(password: str | None) -> bool:
    return password is None or password.strip().lower() in _PLACEHOLDER_PASSWORDS


def is_placeholder_password(password: str | None) -> bool:
    """True for empty or documented placeholder passwords (same list as the DB entrypoint)."""
    return _is_placeholder(password)


_REDACTED_INPUT = "<redacted>"


def _redact_validation_input(value: object) -> object:
    """Replace every validation input with a marker, including nested secrets.

    A model-level error's ``input`` is the raw data dict, so ``postgres_password``
    and ``database_url`` are nested inside it. ``hide_input_in_errors`` does not
    remove those values from ``errors()``.
    """
    if isinstance(value, dict):
        return {key: _redact_validation_input(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_redact_validation_input(item) for item in value]
    if isinstance(value, tuple):
        return tuple(_redact_validation_input(item) for item in value)
    return _REDACTED_INPUT


def _redacted_validation_error(exc: ValidationError) -> ValidationError:
    """Rebuild ``exc`` so ``str``, ``repr``, and ``errors()`` contain no raw inputs."""
    line_errors: list[InitErrorDetails] = []
    for err in exc.errors():
        line: InitErrorDetails = {
            "type": err["type"],
            "loc": err["loc"],
            "input": _redact_validation_input(err.get("input")),
        }
        ctx = err.get("ctx")
        if ctx is not None:
            line["ctx"] = ctx
        line_errors.append(line)
    return ValidationError.from_exception_data(exc.title, line_errors)


class Settings(BaseSettings):
    """All configuration of the backend. Every field maps to an env variable of the same name
    (case-insensitive), e.g. ``postgres_host`` <- ``POSTGRES_HOST``."""

    model_config = SettingsConfigDict(
        # Later files win: a ``.env`` in the working directory overrides the repo-root one.
        env_file=(REPO_ROOT / ".env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        # str()/repr() only. errors() is rebuilt without inputs in __init__.
        hide_input_in_errors=True,
    )

    def __init__(self, **values: Any) -> None:
        try:
            super().__init__(**values)
        except ValidationError as exc:
            # ``exc`` still holds raw inputs (including nested passwords). Do not log or chain it.
            raise _redacted_validation_error(exc) from None

    app_env: Literal["development", "production", "test"] = "production"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # Database. The connection URL is assembled with SQLAlchemy's URL.create(), so passwords
    # may contain any character ("@", "/", ":", "#", "?" ...). There is deliberately no
    # default password.
    postgres_host: str = "localhost"
    postgres_port: int = Field(default=5432, ge=1, le=65535)
    postgres_user: str = "openkita"
    postgres_password: SecretStr | None = None
    postgres_db: str = "openkita"
    # Optional full-URL override (must already be correctly URL-encoded). Wins over POSTGRES_*.
    database_url: SecretStr | None = None

    # Comma-separated list of allowed browser origins for CORS.
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    # AI. Local-first: "ollama" (local) or "none". External AI is a reserved flag and
    # stays disabled by default; no external provider exists in this version.
    ai_provider: Literal["ollama", "none"] = "ollama"
    external_ai_enabled: bool = False
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"

    # Upper bound (seconds) for each dependency check performed by /health. Capped at 5 so
    # /health always answers well within the frontend proxy timeout (default 8 s).
    health_check_timeout_seconds: float = Field(default=3.0, gt=0, le=5)

    # Local generation can take much longer than a health check. External AI stays disabled.
    ollama_generate_timeout_seconds: float = Field(default=120.0, gt=0, le=300)

    # Server-side sessions. The cookie is host-only and HttpOnly. Secure defaults off because
    # the Compose UI is plain HTTP on localhost; set true behind HTTPS.
    session_ttl_hours: int = Field(default=12, ge=1, le=168)
    session_cookie_secure: bool = False

    # Skill files (instructions, schemas, templates). Not personal data.
    skills_dir: Path = REPO_ROOT / "skills"

    # Public environment documents. Requests send a coarse region only.
    # DWD health alerts (pollen, UV, heat) are CC BY 4.0. UBA air data is dl-de/by-2-0.
    exposure_http_timeout_seconds: float = Field(default=5.0, gt=0, le=8)
    dwd_health_alerts_base_url: str = (
        "https://opendata.dwd.de/climate_environment/health/alerts"
    )
    uba_air_base_url: str = "https://luftdaten.umweltbundesamt.de/api/air-data/v4"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("dwd_health_alerts_base_url", "uba_air_base_url")
    @classmethod
    def _https_exposure_source(cls, value: str) -> str:
        cleaned = value.strip().rstrip("/")
        if not cleaned.startswith("https://") or " " in cleaned:
            raise ValueError("exposure source URL must use https")
        return cleaned

    @field_validator("external_ai_enabled")
    @classmethod
    def _external_ai_not_supported(cls, value: bool) -> bool:
        # Fail closed: until the Privacy Gateway is implemented, enabling external AI is refused.
        if value:
            raise ValueError(
                "EXTERNAL_AI_ENABLED=true is not supported "
                "before the Privacy Gateway is implemented"
            )
        return value

    @model_validator(mode="after")
    def _validate_database(self) -> Self:
        # Error messages are static on purpose: they must never contain secret material.
        if self.database_url is not None:
            try:
                url = make_url(self.database_url.get_secret_value())
            except Exception:
                raise ValueError("DATABASE_URL is not a valid database URL") from None
            if url.drivername != "postgresql+asyncpg":
                raise ValueError("DATABASE_URL must use the 'postgresql+asyncpg://' scheme")
            if _is_placeholder(url.password):
                raise ValueError(
                    f"DATABASE_URL contains no password or a placeholder. {SETUP_HINT}"
                )
        elif _is_placeholder(
            self.postgres_password.get_secret_value() if self.postgres_password else None
        ):
            raise ValueError(f"POSTGRES_PASSWORD is not set or is a placeholder. {SETUP_HINT}")
        return self

    @property
    def sqlalchemy_url(self) -> URL:
        """Async SQLAlchemy URL (``postgresql+asyncpg``). Use ``hide_password`` when logging."""
        if self.database_url is not None:
            return make_url(self.database_url.get_secret_value())
        if self.postgres_password is None:  # unreachable: _validate_database refuses this
            raise RuntimeError("POSTGRES_PASSWORD is not set")
        return URL.create(
            drivername="postgresql+asyncpg",
            username=self.postgres_user,
            password=self.postgres_password.get_secret_value(),
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        )

    @property
    def docs_enabled(self) -> bool:
        """Swagger UI loads assets from a CDN, so interactive docs are development-only."""
        return self.app_env != "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
