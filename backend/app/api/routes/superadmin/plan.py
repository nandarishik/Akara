"""Superadmin plan and feature override management."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import Field

from app.core.errors import AkaraHTTPException
from app.core.rate_limit import ADMIN_WRITE_LIMIT, limiter
from app.core.superadmin import SudoCtx, request_actor_meta, require_csrf
from app.core.tenant import get_supabase_service_client
from app.services.superadmin.audit import record_operation
from app.services.superadmin.mutations import SuperadminMutation, dry_run_response

router = APIRouter(prefix="/tenants", tags=["superadmin-plan"])

VALID_PLANS = frozenset({"free", "pro", "business"})
VALID_STATUSES = frozenset({"active", "trialing", "past_due", "cancelled"})


class PlanPatchBody(SuperadminMutation):
    plan: str | None = None
    plan_status: str | None = None
    trial_ends_at: str | None = None
    bypass_stripe: bool = False
    note: str | None = Field(default=None, max_length=500)


class FeaturesPatchBody(SuperadminMutation):
    features: dict[str, bool] = Field(default_factory=dict)


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


@router.patch("/{tenant_id}/plan")
@limiter.limit(ADMIN_WRITE_LIMIT)
def patch_plan(
    request: Request,
    tenant_id: UUID,
    body: PlanPatchBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    before = _get_tenant_or_404(tenant_id)
    patch: dict[str, Any] = {}
    if body.plan is not None:
        if body.plan not in VALID_PLANS:
            raise AkaraHTTPException(
                status_code=400,
                code="VALIDATION_ERROR",
                message="Invalid plan",
            )
        patch["plan"] = body.plan
    if body.plan_status is not None:
        if body.plan_status not in VALID_STATUSES:
            raise AkaraHTTPException(
                status_code=400,
                code="VALIDATION_ERROR",
                message="Invalid plan_status",
            )
        patch["plan_status"] = body.plan_status
    if body.trial_ends_at is not None:
        patch["trial_ends_at"] = body.trial_ends_at
    if body.bypass_stripe and body.plan:
        patch["plan_overrides_at"] = "now()"

    if not patch:
        raise AkaraHTTPException(
            status_code=400,
            code="VALIDATION_ERROR",
            message="No plan fields to update",
        )

    if body.dry_run:
        return dry_run_response(
            action="superadmin.plan.patch",
            before={
                "plan": before.get("plan"),
                "plan_status": before.get("plan_status"),
                "trial_ends_at": before.get("trial_ends_at"),
            },
            impact=patch,
        )

    if body.bypass_stripe:
        patch["past_due_since"] = None

    supa = get_supabase_service_client()
    if "plan_overrides_at" in patch:
        from datetime import UTC, datetime

        patch["plan_overrides_at"] = datetime.now(UTC).isoformat()

    result = supa.table("tenants").update(patch).eq("id", str(tenant_id)).execute()
    after = result.data[0]

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.plan.patch",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        before_state={
            "plan": before.get("plan"),
            "plan_status": before.get("plan_status"),
            "trial_ends_at": before.get("trial_ends_at"),
        },
        after_state={
            "plan": after.get("plan"),
            "plan_status": after.get("plan_status"),
            "trial_ends_at": after.get("trial_ends_at"),
        },
        operation_id=body.operation_id,
        resource_type="tenant",
        resource_id=str(tenant_id),
        details={"note": body.note, "bypass_stripe": body.bypass_stripe},
        **meta,
    )
    return {"ok": True, "tenant": after, "audit": audit}


@router.patch("/{tenant_id}/features")
@limiter.limit(ADMIN_WRITE_LIMIT)
def patch_features(
    request: Request,
    tenant_id: UUID,
    body: FeaturesPatchBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    before = _get_tenant_or_404(tenant_id)
    before_overrides = dict(before.get("feature_overrides") or {})
    after_overrides = {**before_overrides, **body.features}

    if not body.features:
        raise AkaraHTTPException(
            status_code=400,
            code="VALIDATION_ERROR",
            message="At least one feature override required",
        )

    if body.dry_run:
        return dry_run_response(
            action="superadmin.features.patch",
            before={"feature_overrides": before_overrides},
            impact={"feature_overrides": after_overrides},
        )

    supa = get_supabase_service_client()
    result = (
        supa.table("tenants")
        .update({"feature_overrides": after_overrides})
        .eq("id", str(tenant_id))
        .execute()
    )
    after = result.data[0]

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.features.patch",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        before_state={"feature_overrides": before_overrides},
        after_state={"feature_overrides": after_overrides},
        operation_id=body.operation_id,
        resource_type="tenant",
        resource_id=str(tenant_id),
        **meta,
    )
    return {"ok": True, "feature_overrides": after.get("feature_overrides"), "audit": audit}
