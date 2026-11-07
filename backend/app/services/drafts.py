"""Parent-letter drafts. Every query is limited to the caller's facility."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIProvider
from app.models import Draft, User
from app.services.errors import AppError
from app.skills.models import LoadedSkill, SkillRunError
from app.skills.runner import run_parent_skill


async def create_parent_draft(
    session: AsyncSession,
    provider: AIProvider,
    skill: LoadedSkill,
    *,
    author: User,
    message_type: str,
    tone: str,
    language: str,
    facts: str,
    kita_name: str | None,
    sender: str | None,
    group_name: str | None,
    reply_by: str | None,
) -> tuple[Draft, str]:
    if skill.name != "parent-communication":
        raise AppError("skill_unavailable", 503)
    allowed = set(skill.languages) | set(skill.experimental_languages)
    if language not in allowed:
        raise AppError("validation_error", 422)
    user_input = _user_input(
        message_type=message_type,
        tone=tone,
        language=language,
        facts=facts,
        kita_name=kita_name,
        sender=sender,
        group_name=group_name,
        reply_by=reply_by,
    )
    try:
        fields, body = await run_parent_skill(provider, skill, user_input)
    except SkillRunError as exc:
        raise AppError(exc.code, 503 if exc.code == "model_unavailable" else 422) from None
    subject = fields.get("subject")
    if not isinstance(subject, str):
        raise AppError("invalid_model_output", 422)
    draft = Draft(
        facility_id=author.facility_id,
        author_id=author.id,
        skill_name=skill.name,
        skill_version=skill.version,
        subject=subject[:150],
        body=body,
        fields=fields,
        language=language,
        status="draft",
        ai_generated=True,
    )
    session.add(draft)
    await session.commit()
    return draft, author.display_name


async def list_drafts(session: AsyncSession, *, facility_id: UUID) -> list[tuple[Draft, str]]:
    rows = await session.execute(
        select(Draft, User.display_name)
        .join(User, User.id == Draft.author_id)
        .where(Draft.facility_id == facility_id, User.facility_id == facility_id)
        .order_by(Draft.created_at.desc())
        .limit(20)
    )
    return [(draft, name) for draft, name in rows.all()]


async def get_draft(
    session: AsyncSession, *, facility_id: UUID, draft_id: UUID
) -> tuple[Draft, str]:
    row = await session.execute(
        select(Draft, User.display_name)
        .join(User, User.id == Draft.author_id)
        .where(
            Draft.id == draft_id,
            Draft.facility_id == facility_id,
            User.facility_id == facility_id,
        )
    )
    found = row.one_or_none()
    if found is None:
        raise AppError("not_found", 404)
    draft, name = found
    return draft, name


async def update_draft(
    session: AsyncSession,
    *,
    facility_id: UUID,
    draft_id: UUID,
    subject: str,
    body: str,
) -> tuple[Draft, str]:
    draft, name = await get_draft(session, facility_id=facility_id, draft_id=draft_id)
    draft.subject = subject.strip()
    draft.body = body
    draft.updated_at = datetime.now(UTC)
    if draft.status == "approved":
        draft.status = "draft"
        draft.approved_at = None
    await session.commit()
    return draft, name


async def approve_draft(
    session: AsyncSession, *, facility_id: UUID, draft_id: UUID
) -> tuple[Draft, str]:
    """Mark the draft approved. This does not send, publish, or deliver it."""
    draft, name = await get_draft(session, facility_id=facility_id, draft_id=draft_id)
    if draft.status != "approved":
        draft.status = "approved"
        draft.approved_at = datetime.now(UTC)
        draft.updated_at = draft.approved_at
        await session.commit()
    return draft, name


def _user_input(
    *,
    message_type: str,
    tone: str,
    language: str,
    facts: str,
    kita_name: str | None,
    sender: str | None,
    group_name: str | None,
    reply_by: str | None,
) -> dict[str, str]:
    payload = {
        "message_type": message_type,
        "tone": tone,
        "language": language,
        "facts": facts,
    }
    for key, value in (
        ("kita_name", kita_name),
        ("sender", sender),
        ("group_name", group_name),
        ("reply_by", reply_by),
    ):
        if value and value.strip():
            payload[key] = value.strip()
    return payload
