"""Parent-letter draft payloads. There is no field that claims the letter was sent."""

from datetime import datetime
from typing import Literal, cast
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models import Draft

MessageType = Literal[
    "announcement",
    "invitation",
    "reminder",
    "information",
    "closure_notice",
    "request",
    "other",
]
Tone = Literal["friendly", "neutral", "formal", "warm"]
LetterLanguage = Literal["de", "en", "tr", "ar"]
DraftStatus = Literal["draft", "approved"]

_MESSAGE_TYPES = {
    "announcement",
    "invitation",
    "reminder",
    "information",
    "closure_notice",
    "request",
    "other",
}
_TONES = {"friendly", "neutral", "formal", "warm"}
_LANGUAGES = {"de", "en", "tr", "ar"}


class ParentLetterRequest(BaseModel):
    message_type: MessageType
    tone: Tone = "friendly"
    language: LetterLanguage = "de"
    facts: str = Field(min_length=1, max_length=4000)
    kita_name: str | None = Field(default=None, max_length=200)
    sender: str | None = Field(default=None, max_length=200)
    group_name: str | None = Field(default=None, max_length=200)
    reply_by: str | None = Field(default=None, max_length=200)

    @field_validator("facts")
    @classmethod
    def _facts(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("invalid_facts")
        return text


class DraftUpdateRequest(BaseModel):
    subject: str = Field(min_length=1, max_length=150)
    body: str = Field(min_length=1, max_length=20000)

    @field_validator("subject", "body")
    @classmethod
    def _strip_subject(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("invalid_draft")
        return text


class MissingInformation(BaseModel):
    placeholder: str
    question: str


class KeyFact(BaseModel):
    label: str
    value: str


class DraftResponse(BaseModel):
    id: UUID
    facility_id: UUID
    author_display_name: str
    subject: str
    body: str
    language: LetterLanguage
    message_type: MessageType
    tone: Tone
    status: DraftStatus
    ai_generated: Literal[True]
    skill: str
    skill_version: str
    requires_human_review: bool
    warnings: list[str]
    missing_information: list[MissingInformation]
    key_facts: list[KeyFact]
    created_at: datetime
    updated_at: datetime


def draft_response(draft: Draft, author_display_name: str) -> DraftResponse:
    fields = draft.fields if isinstance(draft.fields, dict) else {}
    message_type = fields.get("message_type")
    tone = fields.get("tone")
    language = draft.language if draft.language in _LANGUAGES else "de"
    status = draft.status if draft.status in {"draft", "approved"} else "draft"
    resolved_type = message_type if message_type in _MESSAGE_TYPES else "other"
    resolved_tone = tone if tone in _TONES else "friendly"
    return DraftResponse(
        id=draft.id,
        facility_id=draft.facility_id,
        author_display_name=author_display_name,
        subject=draft.subject,
        body=draft.body,
        language=cast(LetterLanguage, language),
        message_type=cast(MessageType, resolved_type),
        tone=cast(Tone, resolved_tone),
        status=cast(DraftStatus, status),
        ai_generated=True,
        skill=draft.skill_name,
        skill_version=draft.skill_version,
        requires_human_review=status != "approved",
        warnings=_strings(fields.get("warnings")),
        missing_information=_missing(fields.get("missing_information")),
        key_facts=_facts(fields.get("key_facts")),
        created_at=draft.created_at,
        updated_at=draft.updated_at,
    )


def _strings(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _missing(value: object) -> list[MissingInformation]:
    if not isinstance(value, list):
        return []
    rows: list[MissingInformation] = []
    for item in value:
        if isinstance(item, dict) and isinstance(item.get("placeholder"), str):
            question = item.get("question")
            rows.append(
                MissingInformation(
                    placeholder=item["placeholder"],
                    question=question if isinstance(question, str) else "",
                )
            )
    return rows


def _facts(value: object) -> list[KeyFact]:
    if not isinstance(value, list):
        return []
    rows: list[KeyFact] = []
    for item in value:
        label = item.get("label") if isinstance(item, dict) else None
        fact_value = item.get("value") if isinstance(item, dict) else None
        if isinstance(label, str) and isinstance(fact_value, str):
            rows.append(KeyFact(label=label, value=fact_value))
    return rows
