import json
from pathlib import Path

from app.core.config import REPO_ROOT
from app.skills.loader import load_skill, load_skills
from app.skills.prompt import SYSTEM_POLICY, build_prompt
from app.skills.render import render_letter

SKILLS = REPO_ROOT / "skills"
EXAMPLE = json.loads(
    (SKILLS / "parent-communication/examples/sommerfest-einladung.output.json").read_text(
        encoding="utf-8"
    )
)


def test_shipped_skills_load() -> None:
    loaded = load_skills(SKILLS)
    assert set(loaded) == {"parent-communication", "meeting-minutes", "event-planner"}
    skill = loaded["parent-communication"]
    assert skill.version == "0.1.0"
    assert "tr" in skill.experimental_languages
    assert "Du schreibst **nur einen Entwurf**" in skill.instructions


def test_prompt_comes_from_the_skill_and_policy_is_last() -> None:
    skill = load_skill(SKILLS / "parent-communication")
    prompt = build_prompt(skill, {"facts": "TOKEN-FAKT", "language": "de"})
    assert "Du schreibst **nur einen Entwurf**" in prompt
    assert "TOKEN-FAKT" in prompt
    assert "elternbrief-ankuendigung.md" in prompt
    assert prompt.strip().endswith(SYSTEM_POLICY)


def test_letter_is_rendered_from_fields_only() -> None:
    letter = render_letter(EXAMPLE)
    assert letter.startswith("Einladung zu unserem Sommerfest")
    assert "Liebe Eltern," in letter
    assert "Ihr Team der Kita Sonnenblume" in letter
    assert "wurde versendet" not in letter


def test_invalid_skill_is_skipped(tmp_path: Path) -> None:
    folder = tmp_path / "custom"
    folder.mkdir()
    (folder / "SKILL.md").write_text("---\nname: custom\nbad: yes\n---\n\nHi\n", encoding="utf-8")
    (folder / "schema.json").write_text("{}", encoding="utf-8")
    assert load_skills(tmp_path) == {}
