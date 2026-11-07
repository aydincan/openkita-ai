import os
from typing import Any

import pytest

from app.ai.base import ConnectionResult
from app.core.config import Settings
from tests.conftest import (
    TEST_PASSWORD,
    FakeEngine,
    HangingEngine,
    StubProvider,
    make_settings,
)


def test_health_ok_when_database_up(client_factory: Any) -> None:
    client = client_factory(engine=FakeEngine())
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["components"]["api"]["status"] == "up"
    assert body["components"]["database"]["status"] == "up"
    assert body["components"]["ai"]["status"] == "disabled"
    assert body["version"]


def test_health_reports_503_when_database_down(client_factory: Any) -> None:
    client = client_factory()  # real engine pointing to an unreachable port
    response = client.get("/health")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "error"
    assert body["components"]["database"]["status"] == "down"
    assert body["components"]["api"]["status"] == "up"


def test_database_failure_does_not_leak_connection_details(client_factory: Any) -> None:
    client = client_factory()
    text = client.get("/health").text
    assert TEST_PASSWORD not in text
    assert "127.0.0.1" not in text
    assert "Traceback" not in text


def test_hanging_database_times_out(client_factory: Any) -> None:
    client = client_factory(engine=HangingEngine())
    response = client.get("/health")
    assert response.status_code == 503
    assert response.json()["components"]["database"]["status"] == "down"


def test_ai_down_is_not_fatal(client_factory: Any) -> None:
    provider = StubProvider(ConnectionResult(ok=False, detail="Stub unreachable"))
    client = client_factory(engine=FakeEngine(), provider=provider)
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["components"]["ai"] == {
        "status": "down",
        "detail": "Stub unreachable",
        "latency_ms": None,
    }


def test_ai_provider_exception_is_contained(client_factory: Any) -> None:
    client = client_factory(engine=FakeEngine(), provider=StubProvider(RuntimeError("boom")))
    response = client.get("/health")
    assert response.status_code == 200
    ai = response.json()["components"]["ai"]
    assert ai["status"] == "down"
    assert "boom" not in response.text


def test_ai_up(client_factory: Any) -> None:
    provider = StubProvider(ConnectionResult(ok=True, detail="fine", latency_ms=4.2))
    client = client_factory(engine=FakeEngine(), provider=provider)
    ai = client.get("/health").json()["components"]["ai"]
    assert ai["status"] == "up"
    assert ai["latency_ms"] == 4.2


def test_unreachable_ollama_does_not_break_health(client_factory: Any) -> None:
    settings = make_settings(ai_provider="ollama", ollama_base_url="http://127.0.0.1:1")
    client = client_factory(settings=settings, engine=FakeEngine())
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["components"]["ai"]["status"] == "down"


def test_live_is_minimal_and_independent_of_dependencies(client_factory: Any) -> None:
    client = client_factory()  # database unreachable
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.skipif(
    not os.environ.get("RUN_DB_TESTS"),
    reason="set RUN_DB_TESTS=1 and POSTGRES_* to run against a real PostgreSQL",
)
def test_health_with_real_database(client_factory: Any) -> None:
    # Settings come from the POSTGRES_* environment (may contain special characters).
    settings = Settings(_env_file=None, app_env="test", ai_provider="none")
    response = client_factory(settings=settings).get("/health")
    assert response.status_code == 200
    assert response.json()["components"]["database"]["status"] == "up"
