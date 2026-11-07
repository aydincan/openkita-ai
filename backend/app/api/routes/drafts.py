"""Parent-letter drafts. Export and approval never send the letter."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AIProviderDep, CurrentUserDep, DbSessionDep, ParentSkillDep
from app.api.errors import http_error
from app.documents.export import render_docx, render_pdf
from app.models import Draft
from app.schemas.drafts import (
    DraftResponse,
    DraftUpdateRequest,
    ParentLetterRequest,
    draft_response,
)
from app.services.drafts import (
    approve_draft,
    create_parent_draft,
    get_draft,
    list_drafts,
    update_draft,
)
from app.services.errors import AppError

router = APIRouter(tags=["drafts"])

_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@router.get("/drafts", response_model=list[DraftResponse])
async def read_drafts(user: CurrentUserDep, session: DbSessionDep) -> list[DraftResponse]:
    rows = await list_drafts(session, facility_id=user.facility_id)
    return [draft_response(draft, name) for draft, name in rows]


@router.post(
    "/drafts/parent-communication",
    response_model=DraftResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_letter(
    body: ParentLetterRequest,
    user: CurrentUserDep,
    session: DbSessionDep,
    provider: AIProviderDep,
    skill: ParentSkillDep,
) -> DraftResponse:
    try:
        draft, name = await create_parent_draft(
            session,
            provider,
            skill,
            author=user,
            message_type=body.message_type,
            tone=body.tone,
            language=body.language,
            facts=body.facts,
            kita_name=body.kita_name,
            sender=body.sender,
            group_name=body.group_name,
            reply_by=body.reply_by,
        )
    except AppError as exc:
        raise http_error(exc) from None
    return draft_response(draft, name)


@router.get("/drafts/{draft_id}", response_model=DraftResponse)
async def read_draft(draft_id: UUID, user: CurrentUserDep, session: DbSessionDep) -> DraftResponse:
    try:
        draft, name = await get_draft(session, facility_id=user.facility_id, draft_id=draft_id)
    except AppError as exc:
        raise http_error(exc) from None
    return draft_response(draft, name)


@router.patch("/drafts/{draft_id}", response_model=DraftResponse)
async def edit_draft(
    draft_id: UUID,
    body: DraftUpdateRequest,
    user: CurrentUserDep,
    session: DbSessionDep,
) -> DraftResponse:
    try:
        draft, name = await update_draft(
            session,
            facility_id=user.facility_id,
            draft_id=draft_id,
            subject=body.subject,
            body=body.body,
        )
    except AppError as exc:
        raise http_error(exc) from None
    return draft_response(draft, name)


@router.post("/drafts/{draft_id}/approve", response_model=DraftResponse)
async def approve(draft_id: UUID, user: CurrentUserDep, session: DbSessionDep) -> DraftResponse:
    try:
        draft, name = await approve_draft(session, facility_id=user.facility_id, draft_id=draft_id)
    except AppError as exc:
        raise http_error(exc) from None
    return draft_response(draft, name)


@router.post("/drafts/{draft_id}/export/pdf")
async def export_pdf(
    draft_id: UUID,
    user: CurrentUserDep,
    session: DbSessionDep,
    confirm: Annotated[bool, Query()] = False,
) -> Response:
    draft = await _confirmed_draft(session, user.facility_id, draft_id, confirm=confirm)
    return Response(
        content=render_pdf(draft.body),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="elternbrief.pdf"'},
    )


@router.post("/drafts/{draft_id}/export/docx")
async def export_docx(
    draft_id: UUID,
    user: CurrentUserDep,
    session: DbSessionDep,
    confirm: Annotated[bool, Query()] = False,
) -> Response:
    draft = await _confirmed_draft(session, user.facility_id, draft_id, confirm=confirm)
    return Response(
        content=render_docx(draft.body),
        media_type=_DOCX,
        headers={"Content-Disposition": 'attachment; filename="elternbrief.docx"'},
    )


async def _confirmed_draft(
    session: AsyncSession,
    facility_id: UUID,
    draft_id: UUID,
    *,
    confirm: bool,
) -> Draft:
    if not confirm:
        raise http_error(AppError("export_not_confirmed", 400))
    try:
        draft, _name = await get_draft(session, facility_id=facility_id, draft_id=draft_id)
    except AppError as exc:
        raise http_error(exc) from None
    return draft
