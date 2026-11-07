from app.ai.base import AIProvider
from app.ai.disabled import DisabledProvider
from app.ai.ollama import OllamaProvider
from app.core.config import Settings


def build_provider(settings: Settings) -> AIProvider:
    """Select the provider from configuration. Unknown values are rejected by Settings."""
    if settings.ai_provider == "ollama":
        return OllamaProvider(
            base_url=settings.ollama_base_url,
            model=settings.ollama_model,
            timeout_seconds=settings.health_check_timeout_seconds,
            generate_timeout_seconds=settings.ollama_generate_timeout_seconds,
        )
    return DisabledProvider()
