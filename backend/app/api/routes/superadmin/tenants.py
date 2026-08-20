"""Superadmin tenant management."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from app.core.errors import AkaraHTTPException
from app.core.pagination import OffsetPage, OffsetParams
from app.core.rate_limit import ADMIN_READ_LIMIT, ADMIN_WRITE_LIMIT, limiter
from app.core.superadmin import (
    SuperAdmin,
    SudoCtx,
    request_actor_meta,
    require_csrf,
)
from app.core.tenant import get_supabase_service_client
from app.core.plan_limits import get_limit
from app.domain.superadmin.audit import record_operation
from app.domain.superadmin.revenue import PLAN_MRR_INR
from app.domain.superadmin.mutations import (
    SuperadminMutation,
    check_expected_version,
    dry_run_response,
    require_confirmation,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tenants", tags=["superadmin-tenants"])

DATA_TABLES = ("sales_data", "secondary_sales_data", "scheme_master")


class TenantListItem(BaseModel):
    id: UUID
    name: str
    slug: str
    plan: str = "free"
    plan_status: str = "active"
    is_active: bool = True
    feature_overrides: dict[str, Any] = Field(default_factory=dict)
    user_count: int = 0
    copilot_calls_this_month: int = 0
    rows_stored: int = 0
    last_import_at: str | None = None
    last_active_at: str | None = None
    copilot_limit: int = 0
    questions_today: int = 0
    created_at: str | None = None
    trial_ends_at: str | None = None
    internal_notes: str = ""
    version: int = 1


class TenantCreateBody(SuperadminMutation):
    name: str
    slug: str
    config: dict[str, Any] = Field(default_factory=dict)
    plan: str = "free"
    plan_status: str = "active"
    feature_overrides: dict[str, Any] = Field(default_factory=dict)


class TenantPatchBody(SuperadminMutation):
    name: str | None = None
    slug: str | None = None
    config: dict[str, Any] | None = None
    plan: str | None = None
    plan_status: str | None = None
    is_active: bool | None = None
    feature_overrides: dict[str, Any] | None = None
    trial_ends_at: str | None = None
    internal_notes: str | None = None


class TenantNotesBody(SuperadminMutation):
    internal_notes: str


class TenantDeleteBody(SuperadminMutation):
    confirm: str


class TenantDebriefStatus(BaseModel):
    tenant_id: str
    last_debrief_at: str | None
    debrief_count: int
    last_email_status: str | None
    last_whatsapp_status: str | None


class DeliveryEvent(BaseModel):
    action: str
    created_at: str
    details: dict[str, Any] = Field(default_factory=dict)


class TenantOpsDetail(BaseModel):
    tenant_id: str
    imports_this_month: int
    imports_limit: int
    margin_pct: float | None
    llm_cost_usd_this_month: float
    delivery_events: list[DeliveryEvent] = Field(default_factory=list)


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


def _today_start_iso() -> str:
    return datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


def _questions_today(supa, tenant_id: str) -> int:
    result = (
        supa.table("llm_cost_log")
        .select("id", count="exact")
        .eq("tenant_id", tenant_id)
        .eq("feature", "copilot")
        .gte("created_at", _today_start_iso())
        .execute()
    )
    return int(result.count or 0)


def _last_active_at(supa, tenant_id: str) -> str | None:
    profiles = (
        supa.table("profiles")
        .select("id")
        .eq("tenant_id", tenant_id)
        .execute()
    )
    latest: str | None = None
    for profile in profiles.data or []:
        try:
            user = supa.auth.admin.get_user_by_id(profile["id"])
            ts = user.user.last_sign_in_at if user and user.user else None
            if not ts:
                continue
            ts_str = ts if isinstance(ts, str) else ts.isoformat()
            if latest is None or ts_str > latest:
                latest = ts_str
        except Exception:
            continue
    return latest


def _resolve_tenant_admin(supa, tenant_id: UUID) -> tuple[str, str]:
    profiles = (
        supa.table("profiles")
        .select("id")
        .eq("tenant_id", str(tenant_id))
        .eq("role", "admin")
        .limit(1)
        .execute()
    )
    if not profiles.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="No admin user")
    user_id = profiles.data[0]["id"]
    try:
        user = supa.auth.admin.get_user_by_id(user_id)
        email = user.user.email if user and user.user else None
    except Exception as exc:
        raise AkaraHTTPException(
            status_code=502, code="SERVICE_UNAVAILABLE", message="Could not resolve email"
        ) from exc
    if not email:
        raise AkaraHTTPException(status_code=400, code="VALIDATION_ERROR", message="No admin email")
    return user_id, email


def _enrich_tenant(row: dict[str, Any]) -> TenantListItem:
    supa = get_supabase_service_client()
    tid = row["id"]
    profiles = (
        supa.table("profiles")
        .select("id", count="exact")
        .eq("tenant_id", tid)
        .execute()
    )
    user_count = profiles.count or len(profiles.data or [])

    usage = supa.rpc("get_current_usage", {"p_tenant_id": tid}).execute()
    usage_data = usage.data or {}
    copilot_calls = int(usage_data.get("copilot_calls") or 0)

    sales = (
        supa.table("sales_data")
        .select("id", count="exact")
        .eq("tenant_id", tid)
        .execute()
    )
    rows_stored = sales.count or 0

    last_import = (
        supa.table("import_jobs")
        .select("created_at")
        .eq("tenant_id", tid)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    last_import_at = last_import.data[0]["created_at"] if last_import.data else None
    plan = row.get("plan", "free")

    return TenantListItem(
        id=UUID(tid),
        name=row.get("name", ""),
        slug=row.get("slug", ""),
        plan=plan,
        plan_status=row.get("plan_status", "active"),
        is_active=row.get("is_active", True),
        feature_overrides=row.get("feature_overrides") or {},
        user_count=user_count,
        copilot_calls_this_month=copilot_calls,
        rows_stored=rows_stored,
        last_import_at=last_import_at,
        last_active_at=_last_active_at(supa, tid),
        copilot_limit=get_limit(plan, "copilot_calls_per_month"),
        questions_today=_questions_today(supa, tid),
        created_at=row.get("created_at"),
        trial_ends_at=row.get("trial_ends_at"),
        internal_notes=row.get("internal_notes") or "",
        version=row.get("version") or 1,
    )


@router.get("", response_model=OffsetPage[TenantListItem])
@limiter.limit(ADMIN_READ_LIMIT)
def list_tenants(
    request: Request,
    _admin: SuperAdmin,
    params: OffsetParams = Depends(),
    plan: str | None = Query(default=None),
    plan_status: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    search: str | None = Query(default=None),
) -> OffsetPage[TenantListItem]:
    supa = get_supabase_service_client()
    query = supa.table("tenants").select("*", count="exact")
    if plan:
        query = query.eq("plan", plan)
    if plan_status:
        query = query.eq("plan_status", plan_status)
    if is_active is not None:
        query = query.eq("is_active", is_active)
    if search:
        query = query.or_(f"name.ilike.%{search}%,slug.ilike.%{search}%")

    result = (
        query.order("created_at", desc=True)
        .range(params.offset, params.offset + params.limit - 1)
        .execute()
    )
    items = [_enrich_tenant(row) for row in (result.data or [])]
    total = result.count or len(items)
    return OffsetPage.build(items, total, params)


@router.get("/{tenant_id}", response_model=TenantListItem)
@limiter.limit(ADMIN_READ_LIMIT)
def get_tenant(
    request: Request,
    tenant_id: UUID,
    _admin: SuperAdmin,
) -> TenantListItem:
    return _enrich_tenant(_get_tenant_or_404(tenant_id))


@router.get("/{tenant_id}/ops-detail", response_model=TenantOpsDetail)
@limiter.limit(ADMIN_READ_LIMIT)
def get_tenant_ops_detail(
    request: Request,
    tenant_id: UUID,
    _admin: SuperAdmin,
) -> TenantOpsDetail:
    tenant = _get_tenant_or_404(tenant_id)
    tid = str(tenant_id)
    supa = get_supabase_service_client()
    month_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    imports = (
        supa.table("import_jobs")
        .select("id", count="exact")
        .eq("tenant_id", tid)
        .gte("created_at", month_start.isoformat())
        .execute()
    )
    imports_count = int(imports.count or 0)
    plan = tenant.get("plan") or "free"
    imports_limit = get_limit(plan, "imports_per_month")

    llm_rows = (
        supa.table("llm_cost_log")
        .select("cost_usd")
        .eq("tenant_id", tid)
        .gte("created_at", month_start.isoformat())
        .execute()
    ).data or []
    llm_cost = sum(float(r.get("cost_usd") or 0) for r in llm_rows)
    plan_mrr = PLAN_MRR_INR.get(plan, 0)
    margin_pct = (
        round((1 - (llm_cost * 85 / plan_mrr)) * 100, 1) if plan_mrr > 0 else None
    )

    audit = (
        supa.table("audit_log")
        .select("action, created_at, details")
        .eq("tenant_id", tid)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    ).data or []
    delivery_keywords = (
        "activation",
        "debrief",
        "morning_brief",
        "nudge",
        "dunning",
        "broadcast",
        "whatsapp",
        "email",
    )
    delivery_events = [
        DeliveryEvent(
            action=row.get("action") or "",
            created_at=str(row.get("created_at") or ""),
            details=row.get("details") or {},
        )
        for row in audit
        if any(k in (row.get("action") or "").lower() for k in delivery_keywords)
    ][:15]

    return TenantOpsDetail(
        tenant_id=tid,
        imports_this_month=imports_count,
        imports_limit=imports_limit,
        margin_pct=margin_pct,
        llm_cost_usd_this_month=round(llm_cost, 4),
        delivery_events=delivery_events,
    )


@router.post("", status_code=201)
@limiter.limit(ADMIN_WRITE_LIMIT)
def create_tenant(
    request: Request,
    body: TenantCreateBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    if body.dry_run:
        return dry_run_response(
            action="superadmin.tenant.create",
            impact={"name": body.name, "slug": body.slug, "plan": body.plan},
        )

    supa = get_supabase_service_client()
    insert = {
        "name": body.name,
        "slug": body.slug,
        "config": body.config,
        "plan": body.plan,
        "plan_status": body.plan_status,
        "feature_overrides": body.feature_overrides,
    }
    result = supa.table("tenants").insert(insert).execute()
    tenant = result.data[0]
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.tenant.create",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=UUID(tenant["id"]),
        after_state=tenant,
        operation_id=body.operation_id,
        resource_type="tenant",
        resource_id=tenant["id"],
        **meta,
    )
    return {"ok": True, "tenant": tenant, "audit": audit}


@router.patch("/{tenant_id}")
@limiter.limit(ADMIN_WRITE_LIMIT)
def patch_tenant(
    request: Request,
    tenant_id: UUID,
    body: TenantPatchBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    before = _get_tenant_or_404(tenant_id)
    check_expected_version(before.get("version"), body.expected_version)

    patch = body.model_dump(
        exclude={"reason", "dry_run", "operation_id", "expected_version", "confirm"},
        exclude_none=True,
    )
    if not patch:
        raise AkaraHTTPException(
            status_code=400,
            code="VALIDATION_ERROR",
            message="No fields to update",
        )

    if body.dry_run:
        return dry_run_response(
            action="superadmin.tenant.patch",
            before=before,
            impact=patch,
        )

    new_version = int(before.get("version") or 1) + 1
    patch["version"] = new_version
    supa = get_supabase_service_client()
    result = (
        supa.table("tenants")
        .update(patch)
        .eq("id", str(tenant_id))
        .eq("version", before.get("version") or 1)
        .execute()
    )
    if not result.data:
        raise AkaraHTTPException(
            status_code=409,
            code="CONFLICT",
            message="Tenant version conflict — refresh and retry",
        )
    after = result.data[0]
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.tenant.patch",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        before_state=before,
        after_state=after,
        operation_id=body.operation_id,
        resource_type="tenant",
        resource_id=str(tenant_id),
        **meta,
    )
    return {"ok": True, "tenant": after, "audit": audit}


@router.patch("/{tenant_id}/notes")
@limiter.limit(ADMIN_WRITE_LIMIT)
def update_tenant_notes(
    request: Request,
    tenant_id: UUID,
    body: TenantNotesBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    before = _get_tenant_or_404(tenant_id)
    if body.dry_run:
        return dry_run_response(
            action="superadmin.tenant.notes",
            before={"internal_notes": before.get("internal_notes", "")},
            impact={"internal_notes": body.internal_notes},
        )

    supa = get_supabase_service_client()
    result = (
        supa.table("tenants")
        .update({"internal_notes": body.internal_notes})
        .eq("id", str(tenant_id))
        .execute()
    )
    after = result.data[0] if result.data else before
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.tenant.notes",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        before_state={"internal_notes": before.get("internal_notes", "")},
        after_state={"internal_notes": body.internal_notes},
        operation_id=body.operation_id,
        resource_type="tenant",
        resource_id=str(tenant_id),
        **meta,
    )
    return {"ok": True, "internal_notes": body.internal_notes, "audit": audit}


@router.get("/{tenant_id}/debrief-status", response_model=TenantDebriefStatus)
@limiter.limit(ADMIN_READ_LIMIT)
def tenant_debrief_status(
    request: Request,
    tenant_id: UUID,
    _admin: SuperAdmin,
) -> TenantDebriefStatus:
    supa = get_supabase_service_client()
    tid = str(tenant_id)
    _get_tenant_or_404(tenant_id)

    report = (
        supa.table("generated_reports")
        .select("created_at")
        .eq("tenant_id", tid)
        .eq("report_type", "weekly_debrief")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    last_at = report.data[0]["created_at"] if report.data else None

    usage = supa.rpc("get_current_usage", {"p_tenant_id": tid}).execute()
    debrief_count = int((usage.data or {}).get("debrief_count") or 0)

    deliveries = (
        supa.table("delivery_logs")
        .select("channel, status")
        .eq("tenant_id", tid)
        .eq("template", "weekly_debrief")
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    last_email = last_wa = None
    for row in deliveries.data or []:
        if row.get("channel") == "email" and last_email is None:
            last_email = row.get("status")
        if row.get("channel") == "whatsapp" and last_wa is None:
            last_wa = row.get("status")

    return TenantDebriefStatus(
        tenant_id=tid,
        last_debrief_at=last_at,
        debrief_count=debrief_count,
        last_email_status=last_email,
        last_whatsapp_status=last_wa,
    )


@router.patch("/{tenant_id}/activate")
@limiter.limit(ADMIN_WRITE_LIMIT)
def activate_tenant(
    request: Request,
    tenant_id: UUID,
    body: SuperadminMutation,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    before = _get_tenant_or_404(tenant_id)
    if body.dry_run:
        return dry_run_response(
            action="superadmin.tenant.activate",
            before={"is_active": before.get("is_active")},
            impact={"is_active": True},
        )
    supa = get_supabase_service_client()
    result = (
        supa.table("tenants")
        .update({"is_active": True})
        .eq("id", str(tenant_id))
        .execute()
    )
    after = result.data[0]
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.tenant.activate",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        before_state={"is_active": before.get("is_active")},
        after_state={"is_active": True},
        operation_id=body.operation_id,
        resource_type="tenant",
        resource_id=str(tenant_id),
        **meta,
    )
    return {"ok": True, "tenant": after, "audit": audit}


@router.patch("/{tenant_id}/deactivate")
@limiter.limit(ADMIN_WRITE_LIMIT)
def deactivate_tenant(
    request: Request,
    tenant_id: UUID,
    body: SuperadminMutation,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    before = _get_tenant_or_404(tenant_id)
    if body.dry_run:
        return dry_run_response(
            action="superadmin.tenant.deactivate",
            before={"is_active": before.get("is_active")},
            impact={"is_active": False},
        )
    supa = get_supabase_service_client()
    result = (
        supa.table("tenants")
        .update({"is_active": False})
        .eq("id", str(tenant_id))
        .execute()
    )
    after = result.data[0]
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.tenant.deactivate",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        before_state={"is_active": before.get("is_active")},
        after_state={"is_active": False},
        operation_id=body.operation_id,
        resource_type="tenant",
        resource_id=str(tenant_id),
        **meta,
    )
    return {"ok": True, "tenant": after, "audit": audit}


class NudgeUpgradeBody(SuperadminMutation):
    channel: str = Field(default="email", pattern="^(email)$")


@router.post("/{tenant_id}/nudge-upgrade")
@limiter.limit(ADMIN_WRITE_LIMIT)
def nudge_upgrade(
    request: Request,
    tenant_id: UUID,
    body: NudgeUpgradeBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    tenant = _get_tenant_or_404(tenant_id)
    supa = get_supabase_service_client()
    _, email = _resolve_tenant_admin(supa, tenant_id)

    if body.dry_run:
        return dry_run_response(
            action="superadmin.tenant.nudge_upgrade",
            impact={"tenant_id": str(tenant_id), "email": email, "plan": tenant.get("plan")},
        )

    from app.core.config import settings
    from app.domain.billing.email import _send

    plan = tenant.get("plan") or "free"
    subject = "You're getting great value from AKARA — upgrade for more"
    html = (
        f"<p>Hi,</p><p>Your team at <strong>{tenant.get('name')}</strong> is approaching "
        f"or has reached limits on the {plan} plan.</p>"
        f"<p><a href=\"{settings.customer_frontend_url.rstrip('/')}/upgrade\">"
        "See Pro and Business plans →</a></p>"
    )
    sent = _send(email, subject, html)
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.tenant.nudge_upgrade",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        operation_id=body.operation_id,
        details={"email": email, "sent": sent},
        **meta,
    )
    return {"ok": True, "sent": sent, "email": email, "audit": audit}


class ActivationNudgeBody(SuperadminMutation):
    template: str = Field(
        default="day1_no_import",
        pattern="^(day1_no_import|day3_no_copilot|day7_no_phone)$",
    )


_ACTIVATION_TEMPLATES = {
    "day1_no_import": ("activation_day1.html", "Upload your first file to AKARA"),
    "day3_no_copilot": ("activation_day3.html", "Ask AKARA Copilot your first question"),
    "day7_no_phone": ("activation_day7.html", "Add your phone for WhatsApp debrief"),
}


@router.post("/{tenant_id}/activation-nudge")
@limiter.limit(ADMIN_WRITE_LIMIT)
def activation_nudge(
    request: Request,
    tenant_id: UUID,
    body: ActivationNudgeBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    tenant = _get_tenant_or_404(tenant_id)
    supa = get_supabase_service_client()
    admin_user_id, email = _resolve_tenant_admin(supa, tenant_id)
    template_name, subject = _ACTIVATION_TEMPLATES[body.template]

    if body.dry_run:
        return dry_run_response(
            action="superadmin.tenant.activation_nudge",
            impact={
                "tenant_id": str(tenant_id),
                "email": email,
                "template": body.template,
            },
        )

    from pathlib import Path

    from jinja2 import Environment, FileSystemLoader, select_autoescape

    from app.core.config import settings
    from app.domain.billing.email import _send

    template_dir = Path(__file__).resolve().parents[3] / "services" / "email" / "templates"
    jinja = Environment(
        loader=FileSystemLoader(str(template_dir)),
        autoescape=select_autoescape(["html"]),
    )
    profile = (
        supa.table("profiles")
        .select("display_name")
        .eq("id", admin_user_id)
        .maybe_single()
        .execute()
    )
    html = jinja.get_template(template_name).render(
        name=(profile.data or {}).get("display_name") or "there",
        dashboard_url=settings.customer_frontend_url.rstrip("/"),
    )
    sent = _send(email, f"AKARA — {subject}", html)
    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.tenant.activation_nudge",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        operation_id=body.operation_id,
        details={"email": email, "template": body.template, "sent": sent},
        **meta,
    )
    return {"ok": True, "sent": sent, "email": email, "template": body.template, "audit": audit}


@router.delete("/{tenant_id}/data")
@limiter.limit(ADMIN_WRITE_LIMIT)
def wipe_tenant_data(
    request: Request,
    tenant_id: UUID,
    body: SuperadminMutation,
    admin: SudoCtx,
    confirm: bool = Query(default=False),
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    tenant = _get_tenant_or_404(tenant_id)
    if not confirm and not body.dry_run:
        raise AkaraHTTPException(
            status_code=400,
            code="VALIDATION_ERROR",
            message="Query param confirm=true is required",
        )

    supa = get_supabase_service_client()
    counts: dict[str, int] = {}
    for table in DATA_TABLES:
        try:
            cnt = (
                supa.table(table)
                .select("id", count="exact")
                .eq("tenant_id", str(tenant_id))
                .execute()
            )
            counts[table] = cnt.count or 0
        except Exception:
            counts[table] = 0

    if body.dry_run:
        return dry_run_response(
            action="superadmin.tenant.data_wipe",
            before=counts,
            impact={"deleted_rows": counts},
            warnings=["Tenant and profiles are preserved"],
        )

    deleted: dict[str, int] = {}
    for table in DATA_TABLES:
        try:
            supa.table(table).delete().eq("tenant_id", str(tenant_id)).execute()
            deleted[table] = counts.get(table, 0)
        except Exception as exc:
            logger.warning("Could not wipe %s for tenant %s: %s", table, tenant_id, exc)
            deleted[table] = 0

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.tenant.data_wipe",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        before_state=counts,
        after_state={"deleted_rows": deleted},
        operation_id=body.operation_id,
        resource_type="tenant",
        resource_id=str(tenant_id),
        details={"tenant_name": tenant.get("name")},
        **meta,
    )
    return {"ok": True, "deleted_rows": deleted, "audit": audit}


@router.delete("/{tenant_id}")
@limiter.limit(ADMIN_WRITE_LIMIT)
def delete_tenant(
    request: Request,
    tenant_id: UUID,
    body: TenantDeleteBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    tenant = _get_tenant_or_404(tenant_id)
    expected = f"DELETE {tenant['name']}"
    require_confirmation(body.confirm, expected)

    supa = get_supabase_service_client()
    profiles = (
        supa.table("profiles")
        .select("id")
        .eq("tenant_id", str(tenant_id))
        .execute()
    )
    user_ids = [p["id"] for p in (profiles.data or [])]

    if body.dry_run:
        return dry_run_response(
            action="superadmin.tenant.delete",
            before={"tenant": tenant, "user_count": len(user_ids)},
            impact={"hard_delete": True, "users_removed": len(user_ids)},
            warnings=["Irreversible — all tenant data and users will be removed"],
        )

    for uid in user_ids:
        try:
            supa.auth.admin.delete_user(uid)
        except Exception as exc:
            logger.warning("Could not delete auth user %s: %s", uid, exc)

    supa.table("tenants").delete().eq("id", str(tenant_id)).execute()

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.tenant.delete",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        before_state=tenant,
        after_state={},
        operation_id=body.operation_id,
        resource_type="tenant",
        resource_id=str(tenant_id),
        **meta,
    )
    return {"ok": True, "deleted_tenant_id": str(tenant_id), "audit": audit}
