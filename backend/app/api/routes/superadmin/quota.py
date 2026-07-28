"""Superadmin quota management."""

from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.core.errors import AkaraHTTPException
from app.core.rate_limit import ADMIN_READ_LIMIT, ADMIN_WRITE_LIMIT, limiter
from app.core.superadmin import SuperAdmin, SudoCtx, request_actor_meta, require_csrf
from app.core.tenant import get_supabase_service_client
from app.core.time_utils import month_key_ist
from app.services.superadmin.audit import record_operation
from app.services.superadmin.mutations import SuperadminMutation, dry_run_response


router = APIRouter(prefix="/tenants", tags=["superadmin-quota"])


class QuotaPatchBody(SuperadminMutation):
    copilot_calls_override: int | None = Field(default=None, ge=0)
    copilot_bonus: int | None = Field(default=None, ge=0)
    uploads_override: int | None = Field(default=None, ge=0)
    reset_month: bool = False
    extend_billing_to: date | None = None


class QuotaHistoryRow(BaseModel):
    month: str
    copilot_calls: int = 0
    rows_imported: int = 0
    uploads_count: int = 0
    debrief_count: int = 0


def _get_tenant_or_404(tenant_id: UUID) -> dict[str, Any]:
    supa = get_supabase_service_client()
    row = (
        supa.table("tenants")
        .select("*")
        .eq("id", str(tenant_id))
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Tenant not found")
    return row.data


def _current_usage_row(tenant_id: UUID) -> dict[str, Any]:
    supa = get_supabase_service_client()
    month = str(month_key_ist())
    row = (
        supa.table("usage_tracking")
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .eq("month", month)
        .maybe_single()
        .execute()
    )
    return row.data or {"tenant_id": str(tenant_id), "month": month}


@router.patch("/{tenant_id}/quota")
@limiter.limit(ADMIN_WRITE_LIMIT)
def patch_quota(
    request: Request,
    tenant_id: UUID,
    body: QuotaPatchBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    tenant = _get_tenant_or_404(tenant_id)
    before_usage = _current_usage_row(tenant_id)
    before_overrides = tenant.get("feature_overrides") or {}

    impact: dict[str, Any] = {}
    if body.copilot_calls_override is not None:
        impact["copilot_calls_override"] = body.copilot_calls_override
    if body.copilot_bonus is not None:
        impact["copilot_bonus"] = body.copilot_bonus
    if body.uploads_override is not None:
        impact["uploads_override"] = body.uploads_override
    if body.reset_month:
        impact["reset_month"] = True
    if body.extend_billing_to:
        impact["extend_billing_to"] = str(body.extend_billing_to)

    if not impact:
        raise AkaraHTTPException(
            status_code=400,
            code="VALIDATION_ERROR",
            message="At least one quota field must be provided",
        )

    if body.dry_run:
        return dry_run_response(
            action="superadmin.quota.patch",
            before={"usage": before_usage, "feature_overrides": before_overrides},
            impact=impact,
        )

    supa = get_supabase_service_client()
    month = str(month_key_ist())
    after_usage = dict(before_usage)
    after_overrides = dict(before_overrides)

    if body.reset_month:
        supa.table("usage_tracking").delete().eq("tenant_id", str(tenant_id)).eq(
            "month", month
        ).execute()
        after_usage = {"tenant_id": str(tenant_id), "month": month}

    if body.copilot_calls_override is not None or body.uploads_override is not None:
        upsert: dict[str, Any] = {
            "tenant_id": str(tenant_id),
            "month": month,
        }
        if body.copilot_calls_override is not None:
            upsert["copilot_calls"] = body.copilot_calls_override
        if body.uploads_override is not None:
            upsert["uploads_count"] = body.uploads_override
        supa.table("usage_tracking").upsert(upsert).execute()
        after_usage.update(upsert)

    if body.copilot_bonus is not None:
        after_overrides["copilot_bonus"] = body.copilot_bonus
        supa.table("tenants").update({"feature_overrides": after_overrides}).eq(
            "id", str(tenant_id)
        ).execute()

    if body.extend_billing_to:
        supa.table("tenants").update({
            "trial_ends_at": body.extend_billing_to.isoformat(),
        }).eq("id", str(tenant_id)).execute()
        impact["trial_ends_at"] = body.extend_billing_to.isoformat()

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.quota.patch",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        before_state={"usage": before_usage, "feature_overrides": before_overrides},
        after_state={"usage": after_usage, "feature_overrides": after_overrides},
        operation_id=body.operation_id,
        resource_type="tenant",
        resource_id=str(tenant_id),
        details=impact,
        **meta,
    )
    return {"ok": True, "usage": after_usage, "feature_overrides": after_overrides, "audit": audit}


@router.get("/{tenant_id}/quota-history", response_model=list[QuotaHistoryRow])
@limiter.limit(ADMIN_READ_LIMIT)
def quota_history(
    request: Request,
    tenant_id: UUID,
    _admin: SuperAdmin,
) -> list[QuotaHistoryRow]:
    _get_tenant_or_404(tenant_id)
    supa = get_supabase_service_client()
    rows = (
        supa.table("usage_tracking")
        .select("month, copilot_calls, rows_imported, uploads_count, debrief_count")
        .eq("tenant_id", str(tenant_id))
        .order("month", desc=True)
        .execute()
    )
    return [
        QuotaHistoryRow(
            month=str(r["month"]),
            copilot_calls=int(r.get("copilot_calls") or 0),
            rows_imported=int(r.get("rows_imported") or 0),
            uploads_count=int(r.get("uploads_count") or 0),
            debrief_count=int(r.get("debrief_count") or 0),
        )
        for r in (rows.data or [])
    ]
