"""Billing API — usage summary for the authenticated tenant.

Endpoint:
  GET /billing/usage  — returns current plan, plan_status, monthly counters,
                        daily counters, users, and feature flags.

The frontend UsageBanner reads this endpoint to decide which quota warning
to show. No limits are hardcoded in the frontend — all come from here.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.plan_limits import PLAN_LIMITS
from app.core.tenant import TenantCtx, get_supabase_service_client

router = APIRouter(prefix="/billing", tags=["billing"])


class UsageResponse(BaseModel):
    plan: str
    plan_status: str

    # Monthly copilot quota
    copilot_calls_used: int
    copilot_calls_limit: int            # -1 = unlimited

    # Row storage
    rows_used: int
    rows_limit: int                     # -1 = unlimited

    # Monthly uploads (free = 5, pro/business = unlimited)
    uploads_used: int
    uploads_limit: int                  # -1 = unlimited

    # Daily upload cap (all plans = 3)
    uploads_today: int
    uploads_per_day: int

    # Daily undo cap (all plans = 2)
    undos_today: int
    undos_per_day: int

    # User seats
    users_used: int
    users_limit: int

    # Feature flags (plan + overrides applied)
    features: dict

    # Retention info
    retention_days: int


@router.get("/usage", response_model=UsageResponse)
def get_usage(user: CurrentUser, tenant: TenantCtx) -> UsageResponse:
    """Return current month usage + plan limits for the authenticated tenant.

    Called by the frontend UsageBanner on every page load (cached 60 s).
    Uses service role to bypass RLS so all counters are accurate.
    """
    supa = get_supabase_service_client()
    limits = PLAN_LIMITS.get(tenant.plan, PLAN_LIMITS["free"])

    # Apply feature overrides from tenant
    effective_features: dict = {}
    for feature, default in limits["features"].items():
        if feature in tenant.feature_overrides:
            effective_features[feature] = bool(tenant.feature_overrides[feature])
        else:
            effective_features[feature] = default

    # Current month usage via RPC (handles daily reset semantics internally)
    usage_result = supa.rpc(
        "get_current_usage", {"p_tenant_id": str(tenant.tenant_id)}
    ).execute()
    usage: dict = usage_result.data or {}

    # Total row count (live count from sales_data)
    rows_result = (
        supa.table("sales_data")
        .select("id", count="exact")
        .eq("tenant_id", str(tenant.tenant_id))
        .execute()
    )

    # Active user count in tenant
    users_result = (
        supa.table("profiles")
        .select("id", count="exact")
        .eq("tenant_id", str(tenant.tenant_id))
        .execute()
    )

    return UsageResponse(
        plan=tenant.plan,
        plan_status=tenant.plan_status,
        copilot_calls_used=usage.get("copilot_calls", 0),
        copilot_calls_limit=limits["copilot_calls_per_month"],
        rows_used=rows_result.count or 0,
        rows_limit=limits["rows_total"],
        uploads_used=usage.get("uploads_count", 0),
        uploads_limit=limits["uploads_per_month"],
        uploads_today=usage.get("uploads_today", 0),
        uploads_per_day=limits["uploads_per_day"],
        undos_today=usage.get("undos_today", 0),
        undos_per_day=limits["undos_per_day"],
        users_used=users_result.count or 0,
        users_limit=limits["users"],
        features=effective_features,
        retention_days=limits["retention_days"],
    )
