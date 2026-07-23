"""Revenue Projection Simulator API.

Endpoints:
  GET  /simulator/baseline  — fetch tenant's last-30-day actuals from sales_data
  POST /simulator/run       — project revenue under a growth + discount scenario

The confidence interval is computed from real daily variance (not hardcoded).
Discount elasticity uses the industry-standard FMCG estimate of -0.3.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import CurrentUser
from app.core.plan_guard import require_feature
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.services.simulator.projector import RevenueProjector

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/simulator", tags=["simulator"])


class BaselineResponse(BaseModel):
    total_revenue_30d: float
    total_orders_30d: int
    daily_avg_revenue: float
    daily_stddev_revenue: float
    data_days: int


class SimulatorRequest(BaseModel):
    growth_rate_pct: float = Field(default=0.0, ge=-50, le=100)
    discount_change_pct: float = Field(default=0.0, ge=-50, le=50)


class SimulatorResponse(BaseModel):
    baseline_revenue: float
    projected_revenue: float
    projected_orders: int
    confidence_interval_lower: float
    confidence_interval_upper: float
    revenue_delta: float
    revenue_delta_pct: float
    growth_rate_pct: float
    discount_change_pct: float
    data_days: int


@router.get("/baseline", response_model=BaselineResponse)
def get_baseline(
    user: CurrentUser,
    tenant: TenantCtx,
) -> BaselineResponse:
    """Return the tenant's last-30-day revenue and order actuals.

    Used by the frontend to pre-populate the simulator with real numbers.
    """
    supabase = get_supabase_service_client()
    projector = RevenueProjector(supabase=supabase)
    baseline = projector.get_baseline(tenant_id=tenant.tenant_id)
    return BaselineResponse(
        total_revenue_30d=baseline.total_revenue_30d,
        total_orders_30d=baseline.total_orders_30d,
        daily_avg_revenue=baseline.daily_avg_revenue,
        daily_stddev_revenue=baseline.daily_stddev_revenue,
        data_days=baseline.data_days,
    )


@router.post("/run", response_model=SimulatorResponse)
def run_simulation(
    body: SimulatorRequest,
    user: CurrentUser,
    tenant: TenantCtx,
    _: None = Depends(require_feature("simulator")),  # Pro+ only
) -> SimulatorResponse:
    """Project revenue for the given growth and discount change scenario.

    Fetches the 30-day baseline internally — no need to pass revenue/orders.
    Returns a real 95% confidence interval based on actual daily variance.
    """
    supabase = get_supabase_service_client()
    projector = RevenueProjector(supabase=supabase)

    try:
        baseline = projector.get_baseline(tenant_id=tenant.tenant_id)
    except Exception as exc:
        logger.exception("Failed to fetch baseline for simulator")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not load baseline data: {exc}",
        ) from exc

    scenario = projector.project(
        baseline=baseline,
        growth_rate_pct=body.growth_rate_pct,
        discount_change_pct=body.discount_change_pct,
    )

    return SimulatorResponse(
        baseline_revenue=scenario.baseline_revenue,
        projected_revenue=scenario.projected_revenue,
        projected_orders=scenario.projected_orders,
        confidence_interval_lower=scenario.confidence_interval_lower,
        confidence_interval_upper=scenario.confidence_interval_upper,
        revenue_delta=scenario.revenue_delta,
        revenue_delta_pct=scenario.revenue_delta_pct,
        growth_rate_pct=scenario.growth_rate_pct,
        discount_change_pct=scenario.discount_change_pct,
        data_days=scenario.data_days,
    )
