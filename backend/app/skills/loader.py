"""Read skill folders. Invalid skills are skipped; file contents are not logged."""

import json
import logging
import re
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError

from app.skills.models import LoadedSkill, SkillLoadError

logger = logging.getLogger(__name__)

_MAX_FILE_BYTES = 256 * 1024
_MAX_SKILL_BYTES = 2 * 1024 * 1024
_ALLOWED_SUFFIXES = {".md", ".json", ".txt"}
_SEMVER = re.compile(r"^\d+\.\d+\.\d+$")
_FRONTMATTER_KEYS = {
    "name",
    "description",
    "version",
    "module",
    "languages",
    "experimental_languages",
}
_MODULES = {"parent-communication", "administration", "knowledge"}
_PLACEHOLDER = re.compile(r"\[[^\[\]\n]{1,80}\]")


def load_skills(root: Path) -> dict[str, LoadedSkill]:
    """Load every valid skill under ``root``. A bad folder is skipped, not fatal."""
    if not root.is_dir():
        logger.warning("skills_dir_missing")
        return {}
    loaded: dict[str, LoadedSkill] = {}
    for folder in sorted(path for path in root.iterdir() if path.is_dir()):
        try:
            skill = load_skill(folder)
        except SkillLoadError as exc:
            logger.warning("skill_skipped name=%s reason=%s", folder.name, exc.reason)
            continue
        loaded[skill.name] = skill
    return loaded


def load_skill(folder: Path) -> LoadedSkill:
    _check_tree(folder)
    skill_md = _read_text(folder / "SKILL.md")
    meta, instructions = _parse_frontmatter(skill_md)
    _check_meta(folder, meta)
    schema = _read_json(folder / "schema.json")
    try:
        Draft202012Validator.check_schema(schema)
    except SchemaError as exc:
        raise SkillLoadError("schema_invalid") from exc
    _validate_examples(folder, schema)
    languages = _as_str_tuple(meta.get("languages"))
    experimental = _optional_str_tuple(meta.get("experimental_languages", ()))
    description = meta.get("description")
    version = meta.get("version")
    module = meta.get("module")
    name = meta.get("name")
    if not all(isinstance(item, str) for item in (description, version, module, name)):
        raise SkillLoadError("frontmatter_type")
    return LoadedSkill(
        name=str(name),
        description=str(description),
        version=str(version),
        module=str(module),
        languages=languages,
        experimental_languages=experimental,
        instructions=instructions.strip(),
        schema=schema,
        templates=_read_dir(folder / "templates"),
        references=_read_dir(folder / "references"),
    )


def _check_tree(folder: Path) -> None:
    total = 0
    for path in folder.rglob("*"):
        if path.is_symlink():
            raise SkillLoadError("symlink")
        if path.is_dir():
            continue
        relative = path.relative_to(folder)
        if not _allowed_path(relative):
            raise SkillLoadError("unexpected_file")
        if path.suffix.lower() not in _ALLOWED_SUFFIXES:
            raise SkillLoadError("file_type")
        size = path.stat().st_size
        if size > _MAX_FILE_BYTES:
            raise SkillLoadError("file_too_large")
        total += size
        if total > _MAX_SKILL_BYTES:
            raise SkillLoadError("skill_too_large")
    if not (folder / "SKILL.md").is_file() or not (folder / "schema.json").is_file():
        raise SkillLoadError("missing_required")


def _allowed_path(relative: Path) -> bool:
    parts = relative.parts
    if len(parts) == 1:
        return parts[0] in {"SKILL.md", "schema.json"}
    return len(parts) == 2 and parts[0] in {"templates", "references", "examples"}


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeError as exc:
        raise SkillLoadError("not_utf8") from exc


def _read_json(path: Path) -> dict[str, Any]:
    try:
        payload: object = json.loads(_read_text(path))
    except json.JSONDecodeError as exc:
        raise SkillLoadError("schema_json") from exc
    if not isinstance(payload, dict):
        raise SkillLoadError("schema_shape")
    return payload


def _read_dir(folder: Path) -> tuple[tuple[str, str], ...]:
    if not folder.is_dir():
        return ()
    files: list[tuple[str, str]] = []
    for path in sorted(folder.iterdir()):
        if path.is_file() and not path.is_symlink():
            files.append((path.name, _read_text(path)))
    return tuple(files)


def _parse_frontmatter(raw: str) -> tuple[dict[str, object], str]:
    if not raw.startswith("---\n"):
        raise SkillLoadError("frontmatter_missing")
    end = raw.find("\n---\n", 4)
    if end == -1:
        raise SkillLoadError("frontmatter_open")
    data: dict[str, object] = {}
    lines = raw[4:end].splitlines()
    index = 0
    while index < len(lines):
        line = lines[index]
        if not line.strip():
            index += 1
            continue
        if line[0] in {" ", "\t"} or ":" not in line:
            raise SkillLoadError("frontmatter_syntax")
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if value in {">-", ">", "|"}:
            index += 1
            folded: list[str] = []
            while index < len(lines) and (
                lines[index].startswith("  ") or lines[index].strip() == ""
            ):
                folded.append(lines[index].strip())
                index += 1
            data[key] = " ".join(part for part in folded if part)
            continue
        if value.startswith("[") and value.endswith("]"):
            inner = value[1:-1].strip()
            data[key] = tuple(part.strip() for part in inner.split(",") if part.strip())
        else:
            data[key] = value
        index += 1
    return data, raw[end + 5 :]


def _check_meta(folder: Path, meta: dict[str, object]) -> None:
    unknown = set(meta) - _FRONTMATTER_KEYS
    if unknown or not {"name", "description", "version", "module", "languages"} <= set(meta):
        raise SkillLoadError("frontmatter_fields")
    name = meta.get("name")
    version = meta.get("version")
    module = meta.get("module")
    description = meta.get("description")
    if name != folder.name or not isinstance(version, str) or _SEMVER.fullmatch(version) is None:
        raise SkillLoadError("frontmatter_identity")
    if not isinstance(module, str) or module not in _MODULES:
        raise SkillLoadError("frontmatter_module")
    if not isinstance(description, str) or not description or len(description) > 500:
        raise SkillLoadError("frontmatter_description")
    languages = _as_str_tuple(meta.get("languages"))
    if not languages:
        raise SkillLoadError("frontmatter_languages")
    experimental = meta.get("experimental_languages", ())
    if experimental:
        _as_str_tuple(experimental)


def _optional_str_tuple(value: object) -> tuple[str, ...]:
    if value in (None, ()):
        return ()
    return _as_str_tuple(value)


def _as_str_tuple(value: object) -> tuple[str, ...]:
    if (
        not isinstance(value, tuple)
        or not value
        or not all(isinstance(item, str) and item for item in value)
    ):
        raise SkillLoadError("frontmatter_list")
    return value


def _validate_examples(folder: Path, schema: dict[str, Any]) -> None:
    examples = folder / "examples"
    if not examples.is_dir():
        raise SkillLoadError("examples_missing")
    outputs = sorted(examples.glob("*.output.json"))
    if not outputs:
        raise SkillLoadError("examples_missing")
    validator = Draft202012Validator(schema)
    requires_missing = "missing_information" in schema.get("properties", {})
    for output in outputs:
        stem = output.name.removesuffix(".output.json")
        if not (examples / f"{stem}.input.md").is_file():
            raise SkillLoadError("example_pair")
        try:
            payload: object = json.loads(_read_text(output))
        except json.JSONDecodeError as exc:
            raise SkillLoadError("example_json") from exc
        errors = sorted(validator.iter_errors(payload), key=lambda item: list(item.absolute_path))
        if errors:
            raise SkillLoadError("example_schema")
        if requires_missing and isinstance(payload, dict):
            _check_placeholders(payload)


def _check_placeholders(payload: dict[str, Any]) -> None:
    listed: set[str] = set()
    missing = payload.get("missing_information")
    if isinstance(missing, list):
        for item in missing:
            if isinstance(item, dict) and isinstance(item.get("placeholder"), str):
                listed.add(item["placeholder"])
    used = _placeholders(payload)
    if not used <= listed:
        raise SkillLoadError("example_placeholder")


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
