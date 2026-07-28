"""Superadmin conversation and feedback explorer."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from app.core.errors import AkaraHTTPException
from app.core.pagination import OffsetPage, OffsetParams
from app.core.rate_limit import ADMIN_READ_LIMIT, limiter
from app.core.superadmin import SuperAdmin
from app.core.tenant import get_supabase_service_client

router = APIRouter(tags=["superadmin-conversations"])


class ConversationItem(BaseModel):
    id: UUID
    user_id: UUID
    user_email: str | None = None
    title: str
    question_count: int = 0
    created_at: datetime
    last_message_at: datetime | None = None


class MessageItem(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime
    cost_usd: float | None = None


class FeedbackItem(BaseModel):
    tenant_name: str | None = None
    tenant_id: UUID | None = None
    question: str | None = None
    rating: str | None = None
    comment: str | None = None
    created_at: datetime | None = None


def _user_email(user_id: str) -> str | None:
    supa = get_supabase_service_client()
    try:
        user = supa.auth.admin.get_user_by_id(user_id)
        return user.user.email if user and user.user else None
    except Exception:
        return None


@router.get("/tenants/{tenant_id}/conversations", response_model=list[ConversationItem])
@limiter.limit(ADMIN_READ_LIMIT)
def list_tenant_conversations(
    request: Request,
    tenant_id: UUID,
    _admin: SuperAdmin,
    limit: int = Query(default=100, le=500),
) -> list[ConversationItem]:
    supa = get_supabase_service_client()
    convos = (
        supa.table("conversations")
        .select("id, user_id, title, created_at, updated_at")
        .eq("tenant_id", str(tenant_id))
        .is_("deleted_at", "null")
        .order("updated_at", desc=True)
        .limit(limit)
        .execute()
    )

    items: list[ConversationItem] = []
    for row in convos.data or []:
        msg_count = (
            supa.table("chat_history")
            .select("id", count="exact")
            .eq("conversation_id", row["id"])
            .execute()
        )
        items.append(
            ConversationItem(
                id=UUID(row["id"]),
                user_id=UUID(row["user_id"]),
                user_email=_user_email(row["user_id"]),
                title=row.get("title", ""),
                question_count=msg_count.count or 0,
                created_at=row["created_at"],
                last_message_at=row.get("updated_at"),
            )
        )
    return items


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageItem])
@limiter.limit(ADMIN_READ_LIMIT)
def list_conversation_messages(
    request: Request,
    conversation_id: UUID,
    _admin: SuperAdmin,
) -> list[MessageItem]:
    supa = get_supabase_service_client()
    convo = (
        supa.table("conversations")
        .select("id")
        .eq("id", str(conversation_id))
        .maybe_single()
        .execute()
    )
    if not convo.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Conversation not found")

    rows = (
        supa.table("chat_history")
        .select("id, question, response, metadata, created_at")
        .eq("conversation_id", str(conversation_id))
        .order("created_at", desc=False)
        .execute()
    )

    messages: list[MessageItem] = []
    for row in rows.data or []:
        metadata = row.get("metadata") or {}
        cost = metadata.get("cost_usd")
        messages.append(
            MessageItem(
                id=str(row["id"]),
                role="user",
                content=row.get("question") or "",
                created_at=row["created_at"],
                cost_usd=float(cost) if cost is not None else None,
            )
        )
        if row.get("response"):
            messages.append(
                MessageItem(
                    id=f"{row['id']}-assistant",
                    role="assistant",
                    content=row["response"],
                    created_at=row["created_at"],
                    cost_usd=float(cost) if cost is not None else None,
                )
            )
    return messages


@router.get("/feedback", response_model=OffsetPage[FeedbackItem])
@limiter.limit(ADMIN_READ_LIMIT)
def list_feedback(
    request: Request,
    _admin: SuperAdmin,
    params: OffsetParams = Depends(),
    tenant_id: UUID | None = Query(default=None),
) -> OffsetPage[FeedbackItem]:
    supa = get_supabase_service_client()
    query = supa.table("copilot_feedback").select("*", count="exact")
    if tenant_id:
        query = query.eq("tenant_id", str(tenant_id))

    result = (
        query.order("rating", desc=False)
        .order("created_at", desc=True)
        .range(params.offset, params.offset + params.limit - 1)
        .execute()
    )

    tenant_names: dict[str, str] = {}
    items: list[FeedbackItem] = []
    for row in result.data or []:
        tid = row.get("tenant_id")
        tname = None
        if tid:
            if tid not in tenant_names:
                t = (
                    supa.table("tenants")
                    .select("name")
                    .eq("id", tid)
                    .maybe_single()
                    .execute()
                )
                tenant_names[tid] = (t.data or {}).get("name", "")
            tname = tenant_names[tid]

        items.append(
            FeedbackItem(
                tenant_name=tname,
                tenant_id=UUID(tid) if tid else None,
                question=row.get("question"),
                rating=row.get("rating"),
                comment=row.get("comment"),
                created_at=row.get("created_at"),
            )
        )

    total = result.count or len(items)
    return OffsetPage.build(items, total, params)
