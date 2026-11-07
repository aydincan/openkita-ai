from typing import Any

from tests.conftest import FakeEngine, make_settings


def test_security_headers_present(client_factory: Any) -> None:
    client = client_factory(settings=make_settings(app_env="production"), engine=FakeEngine())
    headers = client.get("/health").headers
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["x-frame-options"] == "DENY"
    assert headers["referrer-policy"] == "no-referrer"
    assert "camera=()" in headers["permissions-policy"]
    assert headers["cache-control"] == "no-store"
    assert "frame-ancestors 'none'" in headers["content-security-policy"]


def test_docs_disabled_in_production(client_factory: Any) -> None:
    client = client_factory(settings=make_settings(app_env="production"))
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(path).status_code == 404


def test_docs_enabled_in_development_without_strict_csp(client_factory: Any) -> None:
    client = client_factory(settings=make_settings(app_env="development"))
    response = client.get("/docs")
    assert response.status_code == 200
    assert "content-security-policy" not in response.headers  # Swagger UI needs its CDN
    assert response.headers["x-content-type-options"] == "nosniff"
    assert client.get("/openapi.json").status_code == 200
