"""Public control-plane read endpoints (no auth)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.core.rate_limit import limiter
from app.infra.catalog.plan_catalog_service import list_public_plans
from app.infra.content.cms_service import get_active_placements, record_placement_event
from app.infra.legal.document_service import get_published_document

router = APIRouter(prefix="/public", tags=["public"])


class PlacementEventBody(BaseModel):
    metadata: dict[str, Any] = Field(default_factory=dict)


@router.get("/plans")
@limiter.limit("60/minute")
def public_plans(request: Request) -> dict:
    return {"items": list_public_plans()}


@router.get("/content/{key}")
@limiter.limit("60/minute")
def public_content(request: Request, key: str, locale: str = "en-IN") -> dict:
    from app.infra.content.cms_service import get_content_entry

    entry = get_content_entry(key, locale)
    if entry and entry.get("published_value") is not None:
        return {"key": key, "locale": locale, "value": entry["published_value"]}
    return {"key": key, "locale": locale, "value": None}


@router.get("/placements")
@limiter.limit("60/minute")
def public_placements(
    request: Request,
    plan: str | None = None,
    page: str | None = None,
) -> dict:
    return {"items": get_active_placements(plan=plan, page=page)}


@router.post("/placements/{slot_key}/impression")
@limiter.limit("120/minute")
def placement_impression(
    request: Request,
    slot_key: str,
    body: PlacementEventBody | None = None,
    user_id: UUID | None = None,
    tenant_id: UUID | None = None,
) -> dict:
    event = record_placement_event(
        slot_key,
        "impression",
        user_id=user_id,
        tenant_id=tenant_id,
        metadata=(body.metadata if body else {}),
    )
    return {"ok": True, "event_id": event.get("id")}


@router.post("/placements/{slot_key}/click")
@limiter.limit("120/minute")
def placement_click(
    request: Request,
    slot_key: str,
    body: PlacementEventBody | None = None,
    user_id: UUID | None = None,
    tenant_id: UUID | None = None,
) -> dict:
    event = record_placement_event(
        slot_key,
        "click",
        user_id=user_id,
        tenant_id=tenant_id,
        metadata=(body.metadata if body else {}),
    )
    return {"ok": True, "event_id": event.get("id")}


@router.get("/legal/{document_key}")
@limiter.limit("60/minute")
def public_legal(request: Request, document_key: str) -> dict:
    doc = get_published_document(document_key)
    if not doc:
        return {"document_key": document_key, "document": None}
    return {
        "document_key": document_key,
        "document": {
            "version": doc.get("version"),
            "title": doc.get("title"),
            "body_markdown": doc.get("body_markdown"),
            "effective_at": doc.get("effective_at"),
            "requires_reacceptance": doc.get("requires_reacceptance"),
            "metadata": doc.get("metadata") or {},
        },
    }
