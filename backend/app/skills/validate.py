"""Validate model JSON against the skill schema. Unvalidated output is never returned."""

import json
import re
from typing import Any

from jsonschema import Draft202012Validator

from app.skills.models import LoadedSkill

_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)
_PLACEHOLDER = re.compile(r"\[[^\[\]\n]{1,80}\]")


def parse_json_object(text: str) -> tuple[dict[str, Any] | None, list[str]]:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = _FENCE.sub("", stripped).strip()
    try:
        payload: object = json.loads(stripped)
    except json.JSONDecodeError:
        return None, ["Response is not JSON"]
    if not isinstance(payload, dict):
        return None, ["Response is not a JSON object"]
    return payload, []


def validate_fields(
    skill: LoadedSkill,
    payload: dict[str, Any],
    *,
    language: str,
    tone: str,
    message_type: str,
) -> list[str]:
    validator = Draft202012Validator(skill.schema)
    errors = [
        error.message
        for error in sorted(
            validator.iter_errors(payload), key=lambda item: list(item.absolute_path)
        )
    ]
    if errors:
        return errors[:8]
    if payload.get("language") != language:
        errors.append("language does not match the request")
    if payload.get("tone") != tone:
        errors.append("tone does not match the request")
    if payload.get("message_type") != message_type:
        errors.append("message_type does not match the request")
    listed = _listed_placeholders(payload.get("missing_information"))
    used = _placeholders(payload)
    missing = sorted(used - listed)
    if missing:
        errors.append("placeholder not listed in missing_information")
    return errors


def _listed_placeholders(value: object) -> set[str]:
    found: set[str] = set()
    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict) and isinstance(item.get("placeholder"), str):
                found.add(item["placeholder"])
    return found


def _placeholders(value: object) -> set[str]:
    found: set[str] = set()
    if isinstance(value, str):
        found.update(_PLACEHOLDER.findall(value))
    elif isinstance(value, dict):
        for item in value.values():
            found.update(_placeholders(item))
    elif isinstance(value, list):
        for item in value:
            found.update(_placeholders(item))
    return found
