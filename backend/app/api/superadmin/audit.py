"""Superadmin audit log viewer."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from app.core.pagination import OffsetPage, OffsetParams
from app.core.rate_limit import ADMIN_READ_LIMIT, limiter
from app.core.superadmin import SuperAdmin
from app.core.tenant import get_supabase_service_client

router = APIRouter(prefix="/audit-logs", tags=["superadmin-audit"])


class AuditLogItem(BaseModel):
    id: UUID
    created_at: datetime
    tenant_id: UUID | None = None
    actor_id: UUID | None = None
    actor_email: str | None = None
    user_id: UUID | None = None
    action: str
    resource_type: str | None = None
    resource_id: str | None = None
    operation_id: UUID | None = None
    reason: str | None = None
    before_state: dict[str, Any] | None = None
    after_state: dict[str, Any] | None = None
    details: dict[str, Any] | None = None
    ip_address: str | None = None
    user_agent: str | None = None


@router.get("", response_model=OffsetPage[AuditLogItem])
@limiter.limit(ADMIN_READ_LIMIT)
def list_audit_logs(
    request: Request,
    _admin: SuperAdmin,
    params: OffsetParams = Depends(),
    tenant_id: UUID | None = Query(default=None),
    user_id: UUID | None = Query(default=None),
    action: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    ip: str | None = Query(default=None),
) -> OffsetPage[AuditLogItem]:
    supa = get_supabase_service_client()
    query = supa.table("audit_log").select("*", count="exact")
    if tenant_id:
        query = query.eq("tenant_id", str(tenant_id))
    if user_id:
        query = query.or_(f"user_id.eq.{user_id},actor_id.eq.{user_id}")
    if action:
        query = query.ilike("action", f"%{action}%")
    if date_from:
        query = query.gte("created_at", date_from)
    if date_to:
        query = query.lte("created_at", date_to)
    if ip:
        query = query.eq("ip_address", ip)

    result = (
        query.order("created_at", desc=True)
        .range(params.offset, params.offset + params.limit - 1)
        .execute()
    )

    items = [AuditLogItem(**row) for row in (result.data or [])]
    total = result.count or len(items)
    return OffsetPage.build(items, total, params)
