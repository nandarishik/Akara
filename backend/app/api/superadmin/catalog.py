"""Superadmin plan catalog endpoints (GAP 1)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.core.errors import AkaraHTTPException
from app.core.rate_limit import ADMIN_READ_LIMIT, ADMIN_WRITE_LIMIT, limiter
from app.core.superadmin import SuperAdmin, SudoCtx, request_actor_meta, require_csrf
from app.core.tenant import get_supabase_service_client
from app.infra.catalog.plan_catalog_service import (
    count_affected_tenants,
    create_plan,
    get_plan,
    list_catalog,
    plan_diff,
    publish_plan,
    sync_plan_to_razorpay,
)
from app.domain.superadmin.audit import record_operation
from app.domain.superadmin.mutations import SuperadminMutation, check_expected_version, dry_run_response

router = APIRouter(tags=["superadmin-catalog"])


class PlanCreateBody(BaseModel):
    code: str = Field(..., min_length=2, max_length=32, pattern="^[a-z][a-z0-9_]*$")
    display_name: str = Field(..., min_length=1)
    description: str = ""
    monthly_price_minor: int = Field(default=0, ge=0)
    annual_price_minor: int | None = Field(default=None, ge=0)
    limits: dict[str, Any] = Field(default_factory=dict)
    entitlements: dict[str, Any] = Field(default_factory=dict)
    is_public: bool = False
    sort_order: int = 99


class PlanUpsertBody(SuperadminMutation):
    display_name: str | None = None
    description: str | None = None
    monthly_price_minor: int | None = Field(default=None, ge=0)
    annual_price_minor: int | None = Field(default=None, ge=0)
    limits: dict[str, Any] | None = None
    entitlements: dict[str, Any] | None = None
    cta_label: str | None = None
    is_public: bool | None = None
    sort_order: int | None = None
    draft: bool = True


class PlanAssignmentBody(SuperadminMutation):
    plan_code: str
    custom_limits: dict[str, Any] = Field(default_factory=dict)
    custom_price_minor: int | None = None
    source: str = Field(default="manual", pattern="^(razorpay|manual|contract|promotion)$")
    notes: str = ""
    contract_metadata: dict[str, Any] = Field(default_factory=dict)


class PublishBody(SuperadminMutation):
    schedule_price_migration: bool = False


@router.get("/catalog/plans")
@limiter.limit(ADMIN_READ_LIMIT)
def list_plans(request: Request, _admin: SuperAdmin, include_inactive: bool = False) -> dict[str, Any]:
    return {"items": list_catalog(include_inactive=include_inactive)}


@router.get("/catalog/plans/{code}")
@limiter.limit(ADMIN_READ_LIMIT)
def get_plan_detail(request: Request, code: str, _admin: SuperAdmin) -> dict[str, Any]:
    plan = get_plan(code)
    if not plan:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Plan not found")
    plan["affected_tenants"] = count_affected_tenants(code)
    return plan


@router.post("/catalog/plans")
@limiter.limit(ADMIN_WRITE_LIMIT)
def create_plan_endpoint(
    request: Request,
    body: PlanCreateBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    plan = create_plan(
        code=body.code,
        display_name=body.display_name,
        description=body.description,
        monthly_price_minor=body.monthly_price_minor,
        annual_price_minor=body.annual_price_minor,
        limits=body.limits,
        entitlements=body.entitlements,
        is_public=body.is_public,
        sort_order=body.sort_order,
    )
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.catalog.create_plan",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason="Plan catalog create",
        after_state={"code": body.code},
        resource_type="plan_catalog",
        resource_id=body.code,
        **meta,
    )
    return {"ok": True, "plan": plan, "audit": audit}


@router.patch("/catalog/plans/{code}")
@limiter.limit(ADMIN_WRITE_LIMIT)
def update_plan(
    request: Request,
    code: str,
    body: PlanUpsertBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    before = get_plan(code)
    if not before:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Plan not found")
    check_expected_version(int(before.get("version") or 1), body.expected_version)

    update: dict[str, Any] = {}
    if body.display_name is not None:
        update["display_name"] = body.display_name
    if body.description is not None:
        update["description"] = body.description
    if body.cta_label is not None:
        update["cta_label"] = body.cta_label
    if body.is_public is not None:
        update["is_public"] = body.is_public
    if body.sort_order is not None:
        update["sort_order"] = body.sort_order

    if body.draft:
        if body.limits is not None:
            update["draft_limits"] = body.limits
        if body.entitlements is not None:
            update["draft_entitlements"] = body.entitlements
        if body.monthly_price_minor is not None:
            update["draft_monthly_price_minor"] = body.monthly_price_minor
        if body.annual_price_minor is not None:
            update["draft_annual_price_minor"] = body.annual_price_minor
    else:
        if body.limits is not None:
            update["limits"] = body.limits
        if body.entitlements is not None:
            update["entitlements"] = body.entitlements
        if body.monthly_price_minor is not None:
            update["monthly_price_minor"] = body.monthly_price_minor
        if body.annual_price_minor is not None:
            update["annual_price_minor"] = body.annual_price_minor

    get_supabase_service_client().table("plan_catalog").update(update).eq("code", code).execute()
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.catalog.update_plan",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        before_state={"code": code},
        after_state=update,
        resource_type="plan_catalog",
        resource_id=code,
        **meta,
    )
    return {"ok": True, "code": code, "audit": audit}


@router.post("/catalog/plans/{code}/clone")
@limiter.limit(ADMIN_WRITE_LIMIT)
def clone_plan(
    request: Request,
    code: str,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
    new_code: str = "",
) -> dict[str, Any]:
    source = get_plan(code)
    if not source:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Source plan not found")
    target_code = new_code or f"{code}_copy"
    payload = {
        "code": target_code,
        "display_name": f"{source.get('display_name', code)} (copy)",
        "description": source.get("description", ""),
        "monthly_price_minor": source.get("monthly_price_minor", 0),
        "annual_price_minor": source.get("annual_price_minor"),
        "entitlements": source.get("entitlements") or {},
        "limits": source.get("limits") or {},
        "is_public": False,
        "is_active": True,
        "sort_order": int(source.get("sort_order") or 0) + 10,
    }
    get_supabase_service_client().table("plan_catalog").insert(payload).execute()
    return {"ok": True, "code": target_code}


@router.post("/catalog/plans/{code}/publish")
@limiter.limit(ADMIN_WRITE_LIMIT)
def publish_plan_endpoint(
    request: Request,
    code: str,
    body: PublishBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    before = get_plan(code)
    if not before:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Plan not found")

    diff = plan_diff(before)
    affected = count_affected_tenants(code)

    if body.dry_run:
        return dry_run_response(
            action="superadmin.catalog.publish_plan",
            before={"code": code, "version": before.get("version"), "current": {
                "limits": before.get("limits"),
                "entitlements": before.get("entitlements"),
                "monthly_price_minor": before.get("monthly_price_minor"),
                "annual_price_minor": before.get("annual_price_minor"),
            }},
            impact={"diff": diff, "affected_tenants": affected, "price_migration_scheduled": body.schedule_price_migration},
            warnings=[] if body.schedule_price_migration or not diff else [
                "Price changes apply to catalog only; existing Razorpay subscriptions unchanged unless migration scheduled"
            ],
        )

    check_expected_version(int(before.get("version") or 1), body.expected_version)
    result = publish_plan(
        code,
        actor_id=admin.user_id,
        schedule_price_migration=body.schedule_price_migration,
        expected_version=body.expected_version,
    )
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.catalog.publish_plan",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        before_state={"code": code},
        after_state=result,
        operation_id=body.operation_id,
        resource_type="plan_catalog",
        resource_id=code,
        **meta,
    )
    return {"ok": True, **result, "audit": audit}


@router.post("/catalog/plans/{code}/archive")
@limiter.limit(ADMIN_WRITE_LIMIT)
def archive_plan(
    request: Request,
    code: str,
    body: SuperadminMutation,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    if body.dry_run:
        return dry_run_response(action="superadmin.catalog.archive_plan", impact={"is_active": False})
    get_supabase_service_client().table("plan_catalog").update({"is_active": False}).eq("code", code).execute()
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.catalog.archive_plan",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        resource_type="plan_catalog",
        resource_id=code,
        **meta,
    )
    return {"ok": True, "code": code, "audit": audit}


@router.post("/catalog/plans/{code}/sync-razorpay")
@limiter.limit(ADMIN_WRITE_LIMIT)
def sync_razorpay(
    request: Request,
    code: str,
    body: SuperadminMutation,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    plan = get_plan(code)
    if not plan:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Plan not found")
    if body.dry_run:
        return dry_run_response(
            action="superadmin.catalog.sync_razorpay",
            impact={"code": code, "note": "Would create/update Razorpay Plans from catalog prices"},
        )
    result = sync_plan_to_razorpay(code)
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.catalog.sync_razorpay",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        after_state=result,
        operation_id=body.operation_id,
        resource_type="plan_catalog",
        resource_id=code,
        **meta,
    )
    return {"ok": True, **result, "audit": audit}


@router.post("/tenants/{tenant_id}/plan-assignment")
@limiter.limit(ADMIN_WRITE_LIMIT)
def assign_plan(
    request: Request,
    tenant_id: UUID,
    body: PlanAssignmentBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    if body.dry_run:
        return dry_run_response(
            action="superadmin.catalog.plan_assignment",
            impact={"tenant_id": str(tenant_id), "plan_code": body.plan_code, "custom_limits": body.custom_limits},
        )
    payload = {
        "tenant_id": str(tenant_id),
        "plan_code": body.plan_code,
        "custom_limits": body.custom_limits,
        "custom_price_minor": body.custom_price_minor,
        "source": body.source,
        "notes": body.notes,
        "contract_metadata": body.contract_metadata,
    }
    get_supabase_service_client().table("plan_assignments").upsert(payload, on_conflict="tenant_id").execute()
    get_supabase_service_client().table("tenants").update({"plan": body.plan_code}).eq("id", str(tenant_id)).execute()
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.catalog.plan_assignment",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        after_state=payload,
        operation_id=body.operation_id,
        resource_type="plan_assignment",
        resource_id=str(tenant_id),
        **meta,
    )
    return {"ok": True, "tenant_id": str(tenant_id), "audit": audit}
