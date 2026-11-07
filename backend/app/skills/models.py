"""Loaded skill data. Skills are text files; this is the in-memory form."""

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class LoadedSkill:
    name: str
    description: str
    version: str
    module: str
    languages: tuple[str, ...]
    experimental_languages: tuple[str, ...]
    instructions: str
    schema: dict[str, Any]
    templates: tuple[tuple[str, str], ...]
    references: tuple[tuple[str, str], ...]


class SkillLoadError(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class SkillRunError(Exception):
    """Local skill run failed closed. ``code`` is a stable API error, not model text."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code
