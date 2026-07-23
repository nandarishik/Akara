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

from uuid import UUID

from fastapi import HTTPException, status

from app.core.plan_limits import (
    get_limit,
    is_feature_enabled,
    required_plan_for_feature,
)

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
    Returns zeroed dict when tenant has no usage row yet.
    """
    from app.core.tenant import (
        get_supabase_service_client,  # local import avoids circular
    )

    result = (
        get_supabase_service_client()
        .rpc("get_current_usage", {"p_tenant_id": str(tenant_id)})
        .execute()
    )
    return result.data or {
        "copilot_calls": 0,
        "rows_imported": 0,
        "uploads_count": 0,
        "debrief_count": 0,
        "uploads_today": 0,
        "undos_today": 0,
    }


def _get_total_rows(tenant_id: UUID) -> int:
    """Count total rows in sales_data for the tenant."""
    from app.core.tenant import get_supabase_service_client

    result = (
        get_supabase_service_client()
        .table("sales_data")
        .select("id", count="exact")
        .eq("tenant_id", str(tenant_id))
        .execute()
    )
    return result.count or 0


# ---------------------------------------------------------------------------
# Guard: copilot quota
# ---------------------------------------------------------------------------


def require_copilot_quota(tenant=None):  # type: ignore[assignment]
    """Dependency: blocks /copilot/chat when monthly copilot_calls limit reached.

    Usage:
        _quota: None = Depends(require_copilot_quota)

    The increment (copilot_calls + 1) is done *after* a successful answer,
    not here. Free plan blocks at 10; Pro at 400; Business at 800.
    Dashboard and debrief endpoints are NOT gated by this guard.
    """
    # Imported here so this module is importable before TenantCtx is defined
    from app.core.tenant import TenantCtx

    async def _check(tenant: TenantCtx) -> None:  # noqa: F811
        plan = tenant.plan
        limit = get_limit(plan, "copilot_calls_per_month")
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

    async def _check(tenant=None) -> None:  # type: ignore[assignment]

        # Handle both direct tenant arg and FastAPI Depends injection
        t = tenant
        if t is None:
            raise HTTPException(status_code=500, detail="TenantCtx required")

        plan = t.plan
        usage = _get_current_usage(t.tenant_id)

        # 1. Daily upload cap (ALL plans, hard limit)
        daily_limit = get_limit(plan, "uploads_per_day")  # always 3
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
        upload_limit = get_limit(plan, "uploads_per_month")
        if upload_limit != -1 and usage.get("uploads_count", 0) >= upload_limit:
            raise UsageExceeded(
                message=(
                    f"You've reached your {upload_limit} uploads/month limit. "
                    f"Upgrade to Pro for unlimited uploads."
                ),
                feature="uploads_monthly",
            )

        # 3. Row storage cap
        rows_limit = get_limit(plan, "rows_total")
        if rows_limit != -1:
            current_rows = _get_total_rows(t.tenant_id)
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
    from app.core.tenant import TenantCtx

    async def _check(tenant: TenantCtx) -> None:
        usage = _get_current_usage(tenant.tenant_id)
        daily_limit = get_limit(tenant.plan, "undos_per_day")  # always 2
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
    from app.core.tenant import TenantCtx

    async def _check(tenant: TenantCtx) -> None:
        if not is_feature_enabled(tenant.plan, feature_name, tenant.feature_overrides):
            required = required_plan_for_feature(feature_name)
            raise FeatureBlocked(
                message=f"This feature requires {required}. Upgrade to unlock it.",
                feature=feature_name,
            )

    return _check
