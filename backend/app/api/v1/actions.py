"""Decision engine customer actions API."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.core.errors import AkaraHTTPException
from app.core.rate_limit import limiter
from app.core.tenant import TenantCtx, get_supabase_service_client

router = APIRouter(prefix="/actions", tags=["actions"])


class ActionDecision(BaseModel):
    notes: str | None = None


@router.get("")
@limiter.limit("30/minute")
def list_actions(request: Request, tenant: TenantCtx) -> dict[str, Any]:
    rows = (
        get_supabase_service_client()
        .table("recommendations")
        .select("*")
        .eq("tenant_id", str(tenant.tenant_id))
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return {"items": rows.data or []}


@router.get("/{recommendation_id}")
def get_action(recommendation_id: UUID, tenant: TenantCtx) -> dict[str, Any]:
    row = (
        get_supabase_service_client()
        .table("recommendations")
        .select("*")
        .eq("id", str(recommendation_id))
        .eq("tenant_id", str(tenant.tenant_id))
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Recommendation not found")
    return row.data


@router.post("/{recommendation_id}/accept")
def accept_action(recommendation_id: UUID, tenant: TenantCtx, body: ActionDecision) -> dict[str, Any]:
    get_supabase_service_client().table("recommendations").update({
        "status": "watching",
        "decision_notes": body.notes,
    }).eq("id", str(recommendation_id)).eq("tenant_id", str(tenant.tenant_id)).eq("status", "open").execute()
    return {"ok": True, "status": "watching"}


@router.post("/{recommendation_id}/dismiss")
def dismiss_action(recommendation_id: UUID, tenant: TenantCtx, body: ActionDecision) -> dict[str, Any]:
    get_supabase_service_client().table("recommendations").update({
        "status": "dismissed",
        "decision_notes": body.notes,
    }).eq("id", str(recommendation_id)).eq("tenant_id", str(tenant.tenant_id)).execute()
    return {"ok": True, "status": "dismissed"}
