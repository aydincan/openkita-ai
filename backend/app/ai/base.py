"""Abstract AI provider.

Application code depends on this interface only, never on a concrete vendor. Generation,
embedding and chat methods are added in later versions (and must be called through the
Privacy Gateway, see docs/decisions/0003).
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ConnectionResult:
    """Outcome of a provider connection test. ``detail`` must never contain secrets."""

    ok: bool
    detail: str
    latency_ms: float | None = None


@dataclass(frozen=True, slots=True)
class GenerationResult:
    """Outcome of one local generation. ``text`` is model output and must not be logged."""

    ok: bool
    text: str
    detail: str


class AIProvider(ABC):
    #: Short stable identifier, e.g. ``"ollama"``.
    name: str

    @abstractmethod
    async def check_connection(self) -> ConnectionResult:
        """Test reachability of the provider. Must not raise and must honour its timeout."""

    @abstractmethod
    async def generate(self, prompt: str, *, json_mode: bool = True) -> GenerationResult:
        """Generate text locally. Must not raise. Must not log ``prompt`` or the reply."""
