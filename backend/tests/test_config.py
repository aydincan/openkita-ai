import json
import logging
from typing import Any

import pytest
from pydantic import ValidationError
from sqlalchemy.engine import make_url

from app.core.config import Settings
from tests.conftest import TEST_PASSWORD, make_settings


def build(**overrides: Any) -> Settings:
    kwargs: dict[str, Any] = {"postgres_password": TEST_PASSWORD, "database_url": None}
    kwargs.update(overrides)
    return Settings(_env_file=None, **kwargs)


def test_defaults_are_safe() -> None:
    settings = build()
    assert settings.external_ai_enabled is False
    assert settings.ai_provider == "ollama"
    assert settings.app_env == "production"
    assert settings.docs_enabled is False
    assert settings.cors_origins == ["http://localhost:3000"]
    assert settings.sqlalchemy_url.drivername == "postgresql+asyncpg"


def test_reads_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("AI_PROVIDER", "none")
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://ollama:11434")
    monkeypatch.setenv("CORS_ORIGINS", "https://a.example, https://b.example")
    monkeypatch.setenv("POSTGRES_HOST", "db")
    monkeypatch.setenv("POSTGRES_PASSWORD", TEST_PASSWORD)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    settings = Settings(_env_file=None)
    assert settings.app_env == "development"
    assert settings.docs_enabled is True
    assert settings.ai_provider == "none"
    assert settings.ollama_base_url == "http://ollama:11434"
    assert settings.cors_origins == ["https://a.example", "https://b.example"]
    assert settings.sqlalchemy_url.host == "db"


def test_password_with_special_characters_survives_url_roundtrip() -> None:
    url = build().sqlalchemy_url
    assert url.password == TEST_PASSWORD
    rendered = url.render_as_string(hide_password=False)
    assert TEST_PASSWORD not in rendered  # it is percent-encoded in the DSN ...
    assert make_url(rendered).password == TEST_PASSWORD  # ... and decodes back losslessly
    assert TEST_PASSWORD not in repr(url)  # repr hides the password


def test_env_file_is_read_from_given_path(tmp_path: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("POSTGRES_PASSWORD", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    env = tmp_path / ".env"
    env.write_text("POSTGRES_PASSWORD='from-file-Pw#1'\nPOSTGRES_DB=filedb\n")
    settings = Settings(_env_file=env)
    assert settings.postgres_db == "filedb"
    assert settings.sqlalchemy_url.password == "from-file-Pw#1"


def test_default_env_file_is_repo_root() -> None:
    files = Settings.model_config["env_file"]
    assert isinstance(files, tuple)
    assert str(files[0]).endswith("/.env")
    assert (files[0].parent / "docker-compose.yml").exists()


@pytest.mark.parametrize("password", [None, "", "change-me", "Change-Me", "changeme", "password"])
def test_placeholder_or_missing_password_is_refused(password: str | None) -> None:
    with pytest.raises(ValidationError) as excinfo:
        build(postgres_password=password)
    assert "POSTGRES_PASSWORD" in str(excinfo.value)


def test_placeholder_password_in_database_url_is_refused() -> None:
    with pytest.raises(ValidationError):
        build(
            postgres_password=None,
            database_url="postgresql+asyncpg://u:change-me@localhost/db",
        )


def test_database_url_override_wins() -> None:
    settings = build(
        postgres_password=None,
        database_url="postgresql+asyncpg://u:Str0ng%40pw@dbhost:5555/mydb",
    )
    url = settings.sqlalchemy_url
    assert (url.host, url.port, url.database, url.password) == ("dbhost", 5555, "mydb", "Str0ng@pw")


def test_rejects_sync_database_driver() -> None:
    with pytest.raises(ValidationError):
        build(database_url="postgresql://u:Str0ng-pw@localhost/db")


def test_external_ai_fails_closed() -> None:
    with pytest.raises(ValidationError):
        build(external_ai_enabled=True)


def test_rejects_unknown_ai_provider() -> None:
    with pytest.raises(ValidationError):
        build(ai_provider="openai")


def test_health_timeout_is_capped() -> None:
    with pytest.raises(ValidationError):
        build(health_check_timeout_seconds=30)


@pytest.mark.parametrize(
    "bad",
    [
        {"ai_provider": "openai"},
        {"external_ai_enabled": True},
        {"health_check_timeout_seconds": 99},
        {"database_url": "mysql://u:p@localhost/db"},
        {"app_env": "staging"},
    ],
)
def test_validation_errors_never_contain_the_password(bad: dict[str, Any]) -> None:
    with pytest.raises(ValidationError) as excinfo:
        build(**bad)
    exc = excinfo.value
    assert TEST_PASSWORD not in str(exc)
    assert TEST_PASSWORD not in repr(exc)
    assert TEST_PASSWORD not in repr(exc.errors())
    assert TEST_PASSWORD not in exc.json()
    assert "p@ss" not in str(exc)


def _input_leaves(value: object) -> list[object]:
    if isinstance(value, dict):
        return [leaf for item in value.values() for leaf in _input_leaves(item)]
    if isinstance(value, list | tuple):
        return [leaf for item in value for leaf in _input_leaves(item)]
    return [value]


def test_validation_error_redacts_password_inside_url_and_errors() -> None:
    sentinel = "db-sentinel-9f3a7c"
    with pytest.raises(ValidationError) as excinfo:
        build(
            postgres_password=sentinel,
            database_url=f"mysql://openkita:{sentinel}@db.example:5432/openkita",
        )
    exc = excinfo.value
    # ctx may hold a ValueError; stringify it so the JSON check still sees that message.
    errors_json = json.dumps(exc.errors(), default=str)
    rendered = "\n".join([str(exc), repr(exc), repr(exc.errors()), exc.json(), errors_json])
    assert sentinel not in rendered
    assert exc.error_count() >= 1
    for err in exc.errors():
        leaves = _input_leaves(err["input"])
        assert leaves
        assert all(leaf == "<redacted>" for leaf in leaves)


def test_secrets_are_masked_in_repr() -> None:
    settings = build()
    assert TEST_PASSWORD not in repr(settings)
    assert TEST_PASSWORD not in str(settings)


def test_password_not_logged_during_failed_health_check(
    client_factory: Any, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    client = client_factory(settings=make_settings(log_level="DEBUG"))
    client.get("/health")
    assert "p@ss" not in caplog.text
    assert TEST_PASSWORD not in caplog.text
