"""Render a parent letter from validated fields. The model never supplies the body."""

from typing import Any


def render_letter(fields: dict[str, Any]) -> str:
    lines: list[str] = [str(fields["subject"]), "", str(fields["salutation"]), ""]
    paragraphs = fields["body_paragraphs"]
    if isinstance(paragraphs, list):
        for paragraph in paragraphs:
            lines.append(str(paragraph).strip())
            lines.append("")
    call_to_action = fields.get("call_to_action")
    if isinstance(call_to_action, str) and call_to_action.strip():
        lines.append(call_to_action.strip())
        lines.append("")
    closing = fields.get("closing")
    if isinstance(closing, str) and closing.strip():
        lines.append(closing.strip())
        lines.append("")
    lines.append(str(fields["greeting"]))
    lines.append(str(fields["signature"]))
    return "\n".join(lines).strip() + "\n"
