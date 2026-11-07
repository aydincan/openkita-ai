import json
from typing import Any

import pytest
from sqlalchemy import func, select

from app.ai.base import AIProvider, ConnectionResult, GenerationResult
from app.api.deps import get_ai_provider
from app.documents.export import EXPORT_FOOTER, render_docx, render_pdf
from app.models import Draft
from app.skills.render import render_letter
from tests.test_accounts import _setup
from tests.test_skills import EXAMPLE

FACTS = "SONNENBLUME-XYZ-FAKT: Sommerfest am 20. Juni im Garten der Kita Sonnenblume."


class ScriptedProvider(AIProvider):
    name = "scripted"

    def __init__(self, replies: list[GenerationResult]) -> None:
        self._replies = list(replies)
        self.prompts: list[str] = []

    async def check_connection(self) -> ConnectionResult:
        return ConnectionResult(ok=True, detail="scripted")

    async def generate(self, prompt: str, *, json_mode: bool = True) -> GenerationResult:
        del json_mode
        self.prompts.append(prompt)
        if not self._replies:
            return GenerationResult(ok=False, text="", detail="no reply")
        return self._replies.pop(0)


def _use(app: Any, replies: list[GenerationResult]) -> ScriptedProvider:
    provider = ScriptedProvider(replies)
    app.dependency_overrides[get_ai_provider] = lambda: provider
    return provider


def _request(language: str = "de") -> dict[str, str]:
    return {
        "message_type": "invitation",
        "tone": "friendly",
        "language": language,
        "facts": FACTS,
        "kita_name": "Kita Sonnenblume",
        "sender": "Ihr Team der Kita Sonnenblume",
    }


def _json_reply(payload: dict[str, Any]) -> GenerationResult:
    return GenerationResult(ok=True, text=json.dumps(payload), detail="ok")


async def _count(factory: Any) -> int:
    async with factory() as session:
        found = await session.scalar(select(func.count()).select_from(Draft))
        return int(found or 0)


async def test_invalid_model_json_is_not_saved(api: Any, caplog: pytest.LogCaptureFixture) -> None:
    client, factory, app = api
    await _setup(client)
    _use(
        app,
        [
            GenerationResult(ok=True, text="not json", detail="ok"),
            GenerationResult(ok=True, text='{"no": true}', detail="ok"),
        ],
    )
    caplog.set_level("INFO")
    response = await client.post("/drafts/parent-communication", json=_request())
    assert response.status_code == 422
    assert response.json()["detail"] == "invalid_model_output"
    assert await _count(factory) == 0
    assert FACTS not in caplog.text
    assert "not json" not in caplog.text


async def test_model_down_is_not_saved(api: Any) -> None:
    client, factory, app = api
    await _setup(client)
    _use(app, [GenerationResult(ok=False, text="", detail="Ollama is not reachable")])
    response = await client.post("/drafts/parent-communication", json=_request())
    assert response.status_code == 503
    assert response.json()["detail"] == "model_unavailable"
    assert await _count(factory) == 0


async def test_draft_is_rendered_approved_without_claiming_send_and_exported(
    api: Any, caplog: pytest.LogCaptureFixture
) -> None:
    client, factory, app = api
    await _setup(client)
    provider = _use(
        app,
        [GenerationResult(ok=True, text="nope", detail="ok"), _json_reply(EXAMPLE)],
    )
    caplog.set_level("INFO")
    created = await client.post("/drafts/parent-communication", json=_request())
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["ai_generated"] is True
    assert body["status"] == "draft"
    assert body["requires_human_review"] is True
    assert body["body"] == render_letter(EXAMPLE)
    assert "Sommerfest" in body["body"]
    assert "wurde versendet" not in created.text
    assert "sent" not in _keys(body)
    assert FACTS in provider.prompts[0]
    assert "Du schreibst **nur einen Entwurf**" in provider.prompts[0]
    assert FACTS not in caplog.text
    assert await _count(factory) == 1

    approved = await client.post(f"/drafts/{body['id']}/approve")
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    assert approved.json()["body"] == body["body"]
    assert approved.json()["requires_human_review"] is False
    assert "wurde versendet" not in approved.text
    assert "has been sent" not in approved.text.lower()
    assert "sent" not in _keys(approved.json())

    blocked = await client.get(f"/drafts/{body['id']}/export/pdf")
    assert blocked.status_code == 400
    assert blocked.json()["detail"] == "export_not_confirmed"
    pdf = await client.get(f"/drafts/{body['id']}/export/pdf?confirm=true")
    assert pdf.status_code == 200
    assert pdf.headers["content-type"].startswith("application/pdf")
    assert pdf.content.startswith(b"%PDF")
    docx = await client.get(f"/drafts/{body['id']}/export/docx?confirm=true")
    assert docx.status_code == 200
    assert docx.content.startswith(b"PK")
    text = _docx_text(docx.content)
    assert "Sommerfest" in text
    assert "Nicht versendet" in text
    assert "wurde versendet" not in text


def test_export_uses_saved_fictional_text() -> None:
    body = "Einladung fuer Familie Beispiel zum Sommerfest.\n"
    pdf = render_pdf(body)
    docx = render_docx(body)
    assert pdf.startswith(b"%PDF")
    assert "Familie Beispiel" in _docx_text(docx)
    assert EXPORT_FOOTER in _docx_text(docx)
    assert "wurde versendet" not in _docx_text(docx)


def _keys(value: object) -> set[str]:
    found: set[str] = set()
    if isinstance(value, dict):
        found.update(str(key) for key in value)
        for item in value.values():
            found.update(_keys(item))
    elif isinstance(value, list):
        for item in value:
            found.update(_keys(item))
    return found


def _docx_text(payload: bytes) -> str:
    import io
    import zipfile

    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        return archive.read("word/document.xml").decode("utf-8")
