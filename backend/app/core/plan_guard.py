"""Plan guards — FastAPI dependencies injected into every resource-consuming endpoint.

Usage pattern:
    @router.post("/copilot/chat")
    async def chat(
        ...
        _quota: None = Depends(require_copilot_quota),
    ):
        ...

All guards raise UsageExceeded (HTTP 402) or FeatureBlocked (HTTP 403) so the
frontend can show the right upgrade CTA without parsing error text.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import Depends, HTTPException, status

from app.core.plan_limits import (
    get_limit as _static_get_limit,
    is_feature_enabled as _static_is_feature_enabled,
    required_plan_for_feature,
)
from app.core.tenant import TenantContext, get_supabase_service_client, get_tenant_context

logger = logging.getLogger(__name__)


def get_limit(plan: str, key: str, tenant_id: UUID | None = None) -> Any:
    """Resolve limit from plan_assignments → catalog → static fallback."""
    if tenant_id is not None:
        try:
            from app.services.catalog.plan_catalog_service import resolve_tenant_limits

            resolved = resolve_tenant_limits(tenant_id, plan)
            limits = resolved.get("limits") or {}
            if key in limits:
                return limits[key]
        except Exception:
            pass
    return _static_get_limit(plan, key)


def is_feature_enabled(
    plan: str,
    feature: str,
    overrides: dict,
    tenant_id: UUID | None = None,
) -> bool:
    if feature in overrides:
        return bool(overrides[feature])
    if tenant_id is not None:
        try:
            from app.services.catalog.plan_catalog_service import resolve_tenant_limits

            resolved = resolve_tenant_limits(tenant_id, plan)
            features = resolved.get("features") or {}
            if feature in features:
                return bool(features[feature])
        except Exception:
            pass
    return _static_is_feature_enabled(plan, feature, overrides)


# ---------------------------------------------------------------------------
# Typed error responses
# ---------------------------------------------------------------------------


class UsageExceeded(HTTPException):
    """HTTP 402 — quota or usage limit breached."""

    def __init__(self, message: str, feature: str | None = None) -> None:
        super().__init__(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "usage_limit_exceeded",
                "message": message,
                "feature": feature,
                "upgrade_url": "/upgrade",
            },
        )


class FeatureBlocked(HTTPException):
    """HTTP 403 — feature not available on current plan."""

    def __init__(self, message: str, feature: str) -> None:
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "feature_not_available",
                "message": message,
                "feature": feature,
                "upgrade_url": "/upgrade",
            },
        )


# ---------------------------------------------------------------------------
# Shared: fetch usage from Supabase (called by all guards)
# ---------------------------------------------------------------------------


def _get_current_usage(tenant_id: UUID) -> dict:
    """Fetch current-month usage counters via get_current_usage RPC.
    Returns zeroed dict when tenant has no usage row yet, or when billing
    migration 011 has not been fully applied yet.
    """
    from app.core.tenant import (
        get_supabase_service_client,  # local import avoids circular
    )

    zeroed = {
        "copilot_calls": 0,
        "rows_imported": 0,
        "uploads_count": 0,
        "debrief_count": 0,
        "uploads_today": 0,
        "undos_today": 0,
    }

    try:
        result = (
            get_supabase_service_client()
            .rpc("get_current_usage", {"p_tenant_id": str(tenant_id)})
            .execute()
        )
        return result.data or zeroed
    except Exception as exc:
        logger.warning(
            "get_current_usage RPC unavailable for tenant %s: %s",
            tenant_id,
            exc,
        )
        return zeroed


def _get_total_rows(tenant_id: UUID) -> int:
    """Count total rows in sales_data for the tenant."""
    result = (
        get_supabase_service_client()
        .table("sales_data")
        .select("id", count="exact")
        .eq("tenant_id", str(tenant_id))
        .execute()
    )
    return result.count or 0


def _fetch_billing_state(tenant_id: UUID) -> dict:
    try:
        result = (
            get_supabase_service_client()
            .table("tenants")
            .select("plan, plan_status, trial_ends_at")
            .eq("id", str(tenant_id))
            .single()
            .execute()
        )
        return result.data or {}
    except Exception:
        return {}


def _effective_plan(tenant: TenantContext) -> str:
    """Return plan for quota checks — cancelled after grace → free."""
    state = _fetch_billing_state(tenant.tenant_id)
    plan = state.get("plan") or tenant.plan
    plan_status = state.get("plan_status") or tenant.plan_status
    trial_ends_at = state.get("trial_ends_at")

    if plan_status == "cancelled" and trial_ends_at:
        try:
            end = datetime.fromisoformat(str(trial_ends_at).replace("Z", "+00:00"))
            if end.tzinfo is None:
                end = end.replace(tzinfo=UTC)
            if datetime.now(UTC) > end:
                return "free"
        except (ValueError, TypeError):
            return "free"
    return plan


def _check_plan_status(tenant: TenantContext, block_past_due: bool = False) -> None:
    """Enforce past_due blocks on write operations."""
    state = _fetch_billing_state(tenant.tenant_id)
    plan_status = state.get("plan_status") or tenant.plan_status
    if block_past_due and plan_status == "past_due":
        raise UsageExceeded(
            message=(
                "Payment overdue. Update your payment method in Billing "
                "to restore copilot and imports."
            ),
            feature="payment_overdue",
        )


# ---------------------------------------------------------------------------
# Guard: copilot quota
# ---------------------------------------------------------------------------


def require_copilot_quota():
    """Dependency: blocks /copilot/chat when monthly copilot_calls limit reached.

    Usage:
        _quota: None = Depends(require_copilot_quota())

    The increment (copilot_calls + 1) is done *after* a successful answer,
    not here. Free plan blocks at 10; Pro at 400; Business at 800.
    Dashboard and debrief endpoints are NOT gated by this guard.
    """
    async def _check(
        tenant: TenantContext = Depends(get_tenant_context),
    ) -> None:
        _check_plan_status(tenant, block_past_due=True)
        plan = _effective_plan(tenant)
        limit = get_limit(plan, "copilot_calls_per_month", tenant.tenant_id)
        if limit == -1:
            return  # unlimited

        usage = _get_current_usage(tenant.tenant_id)
        current = usage.get("copilot_calls", 0)

        if current >= limit:
            raise UsageExceeded(
                message=(
                    f"You've used all {limit} copilot questions for this month. "
                    f"Upgrade to Pro for 400 questions/month."
                    if plan == "free"
                    else f"You've used all {limit} copilot questions for this month. "
                    f"Contact support or upgrade your plan."
                ),
                feature="copilot_calls",
            )

    return _check


def get_copilot_quota_metadata(tenant: TenantContext) -> dict[str, int | float | bool]:
    """Soft quota metadata for response headers (80/90% warnings, hard stop at 100%)."""
    plan = _effective_plan(tenant)
    limit = get_limit(plan, "copilot_calls_per_month", tenant.tenant_id)
    if limit == -1:
        return {
            "quota_used": 0,
            "quota_limit": -1,
            "quota_pct": 0.0,
            "warn": False,
            "urgent": False,
        }
    usage = _get_current_usage(tenant.tenant_id)
    current = int(usage.get("copilot_calls", 0))
    pct = (current / limit) * 100 if limit else 0.0
    return {
        "quota_used": current,
        "quota_limit": limit,
        "quota_pct": round(pct, 1),
        "warn": pct >= 80,
        "urgent": pct >= 90,
    }


def apply_copilot_quota_headers(response, metadata: dict[str, int | float | bool]) -> None:
    """Attach quota warning headers to a copilot HTTP response."""
    response.headers["X-Quota-Used"] = str(metadata["quota_used"])
    response.headers["X-Quota-Limit"] = str(metadata["quota_limit"])
    response.headers["X-Quota-Warn"] = "true" if metadata.get("warn") else "false"
    response.headers["X-Quota-Urgent"] = "true" if metadata.get("urgent") else "false"


def maybe_notify_copilot_quota_threshold(tenant_id: UUID, prev_count: int, new_count: int) -> None:
    """Send E10 quota warning email when crossing 80% or 90% (once per threshold per month)."""
    state = _fetch_billing_state(tenant_id)
    plan = state.get("plan") or "free"
    limit = get_limit(plan, "copilot_calls_per_month", tenant_id)
    if limit <= 0:
        return

    prev_pct = (prev_count / limit) * 100
    new_pct = (new_count / limit) * 100
    thresholds = (80, 90)

    for threshold in thresholds:
        if prev_pct < threshold <= new_pct:
            _send_quota_threshold_email(tenant_id, plan, threshold)


def _send_quota_threshold_email(tenant_id: UUID, plan: str, threshold: int) -> None:
    from datetime import timedelta

    from app.services.billing.email import send_quota_warning_email
    from app.services.notifications.delivery_log import log_delivery

    supa = get_supabase_service_client()
    template_key = f"quota_warning_{threshold}"
    since = (datetime.now(UTC) - timedelta(days=31)).isoformat()
    existing = (
        supa.table("delivery_logs")
        .select("id")
        .eq("tenant_id", str(tenant_id))
        .eq("template", template_key)
        .gte("created_at", since)
        .limit(1)
        .execute()
    )
    if existing.data:
        return

    admins = (
        supa.table("profiles")
        .select("id")
        .eq("tenant_id", str(tenant_id))
        .eq("role", "admin")
        .limit(3)
        .execute()
    )
    for row in admins.data or []:
        try:
            user = supa.auth.admin.get_user_by_id(row["id"])
            email = user.user.email if user and user.user else None
        except Exception:
            email = None
        if not email:
            continue
        prefs_row = (
            supa.table("profiles")
            .select("preferences")
            .eq("id", row["id"])
            .maybe_single()
            .execute()
        )
        prefs = (prefs_row.data or {}).get("preferences") or {}
        if prefs.get("usage_warnings_enabled") is False:
            continue
        ok = send_quota_warning_email(email, plan, threshold)
        log_delivery(
            channel="email",
            template=template_key,
            status="sent" if ok else "failed",
            tenant_id=tenant_id,
            user_id=UUID(str(row["id"])),
            metadata={"threshold_pct": threshold},
        )
        if ok:
            logger.info(
                "Quota warning (%s%%) sent to %s for tenant %s",
                threshold,
                email,
                tenant_id,
            )
            break


# ---------------------------------------------------------------------------
# Guard: import quota
# ---------------------------------------------------------------------------


def require_import_quota(row_count: int):
    """Dependency factory: checks row + upload quotas before /data/import.

    Usage:
        await require_import_quota(len(df))(tenant)   # called manually in route

    Enforces two independent upload limits:
      1. Daily hard cap  — ALL plans (3/day). Prevents server abuse.
      2. Monthly limit   — free plan only (5/month). Pro/Business = unlimited monthly.
      3. Row storage cap — all plans.
    """

    async def _check(tenant: TenantContext) -> None:
        _check_plan_status(tenant, block_past_due=True)
        plan = _effective_plan(tenant)
        usage = _get_current_usage(tenant.tenant_id)

        # 1. Daily upload cap (ALL plans, hard limit)
        daily_limit = get_limit(plan, "uploads_per_day", tenant.tenant_id)  # always 3
        uploads_today = usage.get("uploads_today", 0)
        if uploads_today >= daily_limit:
            raise UsageExceeded(
                message=(
                    f"You've reached {daily_limit} uploads today. "
                    f"Daily limit resets at midnight IST. Come back tomorrow!"
                ),
                feature="uploads_daily",
            )

        # 2. Monthly upload limit (free plan only; -1 = unlimited for pro/business)
        upload_limit = get_limit(plan, "uploads_per_month", tenant.tenant_id)
        if upload_limit != -1 and usage.get("uploads_count", 0) >= upload_limit:
            raise UsageExceeded(
                message=(
                    f"You've reached your {upload_limit} uploads/month limit. "
                    f"Upgrade to Pro for unlimited uploads."
                ),
                feature="uploads_monthly",
            )

        # 3. Row storage cap
        rows_limit = get_limit(plan, "rows_total", tenant.tenant_id)
        if rows_limit != -1:
            current_rows = _get_total_rows(tenant.tenant_id)
            if current_rows + row_count > rows_limit:
                raise UsageExceeded(
                    message=(
                        f"This import would exceed your {rows_limit:,} row storage limit. "
                        f"Delete old data or upgrade your plan."
                    ),
                    feature="rows_total",
                )

    return _check


# ---------------------------------------------------------------------------
# Guard: undo quota
# ---------------------------------------------------------------------------


def require_undo_quota():
    """Dependency: blocks DELETE /data/imports/{id} when daily limit reached.

    Limit: 2 undos per day, ALL plans. Resets at midnight IST.

    "Undo" = deleting all rows from a previously imported batch.
    Without this limit, a user could loop: import → delete → import → delete
    endlessly, hammering Supabase and burning server CPU.
    """
    async def _check(
        tenant: TenantContext = Depends(get_tenant_context),
    ) -> None:
        usage = _get_current_usage(tenant.tenant_id)
        daily_limit = get_limit(tenant.plan, "undos_per_day", tenant.tenant_id)  # always 2
        undos_today = usage.get("undos_today", 0)
        if undos_today >= daily_limit:
            raise UsageExceeded(
                message=(
                    f"You've reached {daily_limit} data undos today. "
                    f"Daily limit resets at midnight IST. "
                    f"Contact support if you need help with your data."
                ),
                feature="undos_daily",
            )

    return _check


# ---------------------------------------------------------------------------
# Guard: feature availability
# ---------------------------------------------------------------------------


def require_feature(feature_name: str):
    """Dependency factory: checks if a feature is enabled for the tenant's plan.

    Usage:
        _: None = Depends(require_feature("scheme_leakage"))

    Superadmin can enable any feature per-tenant via tenants.feature_overrides.
    """
    async def _check(
        tenant: TenantContext = Depends(get_tenant_context),
    ) -> None:
        plan = _effective_plan(tenant)
        if not is_feature_enabled(plan, feature_name, tenant.feature_overrides, tenant.tenant_id):
            required = required_plan_for_feature(feature_name)
            raise FeatureBlocked(
                message=f"This feature requires {required}. Upgrade to unlock it.",
                feature=feature_name,
            )

    return _check
