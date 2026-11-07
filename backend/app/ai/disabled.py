from app.ai.base import AIProvider, ConnectionResult, GenerationResult


class DisabledProvider(AIProvider):
    """Used when ``AI_PROVIDER=none``: the application runs without any AI backend."""

    name = "none"

    async def check_connection(self) -> ConnectionResult:
        return ConnectionResult(ok=False, detail="AI provider disabled by configuration")

    async def generate(self, prompt: str, *, json_mode: bool = True) -> GenerationResult:
        del prompt, json_mode
        return GenerationResult(ok=False, text="", detail="AI provider disabled by configuration")
