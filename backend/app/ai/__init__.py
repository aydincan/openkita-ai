"""Provider-independent AI interface. v0.1: connection test and local generation."""

from app.ai.base import AIProvider, ConnectionResult, GenerationResult
from app.ai.disabled import DisabledProvider
from app.ai.factory import build_provider
from app.ai.ollama import OllamaProvider

__all__ = [
    "AIProvider",
    "ConnectionResult",
    "GenerationResult",
    "DisabledProvider",
    "OllamaProvider",
    "build_provider",
]
