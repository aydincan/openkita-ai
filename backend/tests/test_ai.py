import json

import httpx
import pytest

from app.ai import DisabledProvider, OllamaProvider, build_provider
from tests.conftest import make_settings


def _provider(handler: httpx.MockTransport) -> OllamaProvider:
    return OllamaProvider("http://ollama.test", "llama3.1:8b", transport=handler)


async def test_ollama_reachable_with_model() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/tags"
        return httpx.Response(200, json={"models": [{"name": "llama3.1:8b"}]})

    result = await _provider(httpx.MockTransport(handler)).check_connection()
    assert result.ok
    assert "available" in result.detail
    assert result.latency_ms is not None


async def test_ollama_reachable_without_model() -> None:
    transport = httpx.MockTransport(lambda _r: httpx.Response(200, json={"models": []}))
    result = await _provider(transport).check_connection()
    assert result.ok
    assert "not installed" in result.detail


async def test_ollama_connection_error() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused")

    result = await _provider(httpx.MockTransport(handler)).check_connection()
    assert not result.ok
    assert result.detail == "Ollama is not reachable"


async def test_ollama_http_error_and_bad_json() -> None:
    server_error = httpx.MockTransport(lambda _r: httpx.Response(500))
    assert not (await _provider(server_error).check_connection()).ok
    bad_json = httpx.MockTransport(lambda _r: httpx.Response(200, content=b"not json"))
    assert not (await _provider(bad_json).check_connection()).ok


async def test_disabled_provider() -> None:
    provider = DisabledProvider()
    result = await provider.check_connection()
    assert not result.ok
    generated = await provider.generate("do not log this prompt")
    assert not generated.ok
    assert generated.text == ""


async def test_ollama_generate_requests_json_and_does_not_log_the_prompt(
    caplog: pytest.LogCaptureFixture,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        assert request.url.path == "/api/generate"
        assert body["format"] == "json"
        assert body["stream"] is False
        assert body["model"] == "llama3.1:8b"
        return httpx.Response(200, json={"response": '{"language": "de"}'})

    caplog.set_level("DEBUG")
    result = await _provider(httpx.MockTransport(handler)).generate("prompt-secret-not-for-logs")
    assert result.ok
    assert result.text == '{"language": "de"}'
    assert "prompt-secret-not-for-logs" not in caplog.text


async def test_ollama_generate_unreachable(caplog: pytest.LogCaptureFixture) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused")

    caplog.set_level("INFO")
    result = await _provider(httpx.MockTransport(handler)).generate("prompt-secret-not-for-logs")
    assert not result.ok
    assert result.detail == "Ollama is not reachable"
    assert "prompt-secret-not-for-logs" not in caplog.text


def test_factory_selects_provider() -> None:
    assert build_provider(make_settings(ai_provider="none")).name == "none"
    assert build_provider(make_settings(ai_provider="ollama")).name == "ollama"
