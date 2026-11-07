"""Call the local model, validate JSON, render. One repair retry, then fail closed."""

import logging
import re
from typing import Any

from app.ai.base import AIProvider
from app.skills.models import LoadedSkill, SkillRunError
from app.skills.prompt import build_prompt, build_repair_prompt
from app.skills.render import render_letter
from app.skills.validate import parse_json_object, validate_fields

logger = logging.getLogger(__name__)

_WARNING = re.compile(r"„(Experimentelle Sprache[^“]*)“")
_FALLBACK_WARNING = (
    "Experimentelle Sprache – bitte von einer Person mit sehr guten "
    "Sprachkenntnissen prüfen lassen."
)


async def run_parent_skill(
    provider: AIProvider,
    skill: LoadedSkill,
    user_input: dict[str, str],
) -> tuple[dict[str, Any], str]:
    prompt = build_prompt(skill, user_input)
    fields, errors = await _once(provider, skill, prompt, user_input)
    if fields is None:
        fields, errors = await _once(
            provider, skill, build_repair_prompt(prompt, errors), user_input
        )
    if fields is None:
        logger.info("skill_run skill=%s outcome=invalid_model_output", skill.name)
        raise SkillRunError("invalid_model_output")
    fields = _with_experimental_warning(skill, fields)
    logger.info("skill_run skill=%s outcome=validated", skill.name)
    return fields, render_letter(fields)


async def _once(
    provider: AIProvider,
    skill: LoadedSkill,
    prompt: str,
    user_input: dict[str, str],
) -> tuple[dict[str, Any] | None, list[str]]:
    try:
        result = await provider.generate(prompt, json_mode=True)
    except Exception:
        logger.info("skill_run skill=%s outcome=model_unavailable", skill.name)
        raise SkillRunError("model_unavailable") from None
    if not result.ok:
        logger.info("skill_run skill=%s outcome=model_unavailable", skill.name)
        raise SkillRunError("model_unavailable")
    payload, parse_errors = parse_json_object(result.text)
    if payload is None:
        return None, parse_errors
    schema_errors = validate_fields(
        skill,
        payload,
        language=user_input["language"],
        tone=user_input["tone"],
        message_type=user_input["message_type"],
    )
    if schema_errors:
        return None, schema_errors
    return payload, []


def _with_experimental_warning(skill: LoadedSkill, fields: dict[str, Any]) -> dict[str, Any]:
    language = fields.get("language")
    if language not in skill.experimental_languages:
        return fields
    warnings = fields.get("warnings")
    current = (
        [item for item in warnings if isinstance(item, str)] if isinstance(warnings, list) else []
    )
    sentence = _experimental_sentence(skill)
    if sentence not in current:
        current.append(sentence)
    return {**fields, "warnings": current}


def _experimental_sentence(skill: LoadedSkill) -> str:
    match = _WARNING.search(skill.instructions)
    if match is None:
        return _FALLBACK_WARNING
    return match.group(1)
