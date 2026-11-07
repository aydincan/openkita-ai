"""Ollama provider (local inference): connection test and JSON generation."""

import logging
import time

import httpx

from app.ai.base import AIProvider, ConnectionResult, GenerationResult

logger = logging.getLogger(__name__)


class OllamaProvider(AIProvider):
    name = "ollama"

    def __init__(
        self,
        base_url: str,
        model: str,
        timeout_seconds: float = 3.0,
        transport: httpx.AsyncBaseTransport | None = None,
        generate_timeout_seconds: float = 120.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._timeout = timeout_seconds
        self._generate_timeout = generate_timeout_seconds
        self._transport = transport  # injectable for tests

    async def check_connection(self) -> ConnectionResult:
        started = time.perf_counter()
        try:
            async with httpx.AsyncClient(
                base_url=self._base_url, timeout=self._timeout, transport=self._transport
            ) as client:
                response = await client.get("/api/tags")
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            logger.debug("Ollama connection test failed: %s", type(exc).__name__)
            return ConnectionResult(ok=False, detail="Ollama is not reachable")

        latency = round((time.perf_counter() - started) * 1000, 1)
        names = _model_names(payload)
        if self._model in names:
            detail = f"Ollama reachable, model '{self._model}' available"
        else:
            detail = f"Ollama reachable, model '{self._model}' not installed yet"
        return ConnectionResult(ok=True, detail=detail, latency_ms=latency)

    async def generate(self, prompt: str, *, json_mode: bool = True) -> GenerationResult:
        body: dict[str, object] = {
            "model": self._model,
            "prompt": prompt,
            "stream": False,
        }
        if json_mode:
            body["format"] = "json"
        try:
            async with httpx.AsyncClient(
                base_url=self._base_url,
                timeout=self._generate_timeout,
                transport=self._transport,
            ) as client:
                response = await client.post("/api/generate", json=body)
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            logger.info("ollama_generate outcome=unreachable error=%s", type(exc).__name__)
            return GenerationResult(ok=False, text="", detail="Ollama is not reachable")

        text = payload.get("response") if isinstance(payload, dict) else None
        if not isinstance(text, str) or not text.strip():
            logger.info("ollama_generate outcome=empty")
            return GenerationResult(ok=False, text="", detail="Ollama returned no text")
        return GenerationResult(ok=True, text=text, detail="ok")


def _model_names(payload: object) -> set[str]:
    if not isinstance(payload, dict):
        return set()
    models = payload.get("models", [])
    if not isinstance(models, list):
        return set()
    return {m["name"] for m in models if isinstance(m, dict) and isinstance(m.get("name"), str)}
