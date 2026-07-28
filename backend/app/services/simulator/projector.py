"""RevenueProjector — honest, data-driven revenue projection.

No ML. No fake confidence intervals.

Logic:
  1. Pull last 30 days of sales_data and aggregate to daily totals.
  2. Compute daily mean and population stddev from actual data.
  3. Apply growth_rate and discount_change multipliers to the 30-day total.
  4. Compute real 95% CI using: projected ± 1.96 × stddev × sqrt(days).
     This reflects actual daily variance — noisy businesses get wide CIs,
     stable businesses get tight CIs.

Discount elasticity is hardcoded at -0.3 and clearly labelled as an estimate.
This is the industry standard for FMCG price elasticity (Tellis 1988 meta-analysis
suggests -0.3 to -0.5 for consumer packaged goods).
"""

import logging
import math
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from supabase import Client

logger = logging.getLogger(__name__)

# Industry-standard FMCG price elasticity (conservative estimate)
# Source: Tellis (1988) — average price elasticity for CPG is approximately -0.3
_DISCOUNT_ELASTICITY = -0.3

# Minimum days of data to produce a reliable projection
_MIN_DATA_DAYS = 7

# Projection window in days (1 month ≈ 30 days)
_PROJECTION_DAYS = 30


@dataclass
class BaselineMetrics:
    """Last-30-day actuals from the tenant's sales_data."""

    total_revenue_30d: float
    total_orders_30d: int
    daily_avg_revenue: float
    daily_stddev_revenue: float  # population stddev of daily revenue totals
    data_days: int  # how many distinct days had any sales in the window


@dataclass
class ProjectionScenario:
    """Projected outcome for a given growth + discount scenario."""

    baseline_revenue: float
    projected_revenue: float
    projected_orders: int
    confidence_interval_lower: float
    confidence_interval_upper: float
    revenue_delta: float
    revenue_delta_pct: float
    growth_rate_pct: float
    discount_change_pct: float
    data_days: int  # expose to frontend for the "insufficient data" warning


class RevenueProjector:
    """Compute a baseline from live data and project revenue under a scenario.

    Usage:
        projector = RevenueProjector(supabase_client)
        baseline = projector.get_baseline(tenant_id)
        scenario = projector.project(baseline, growth_rate_pct=10, discount_change_pct=0)
    """

    def __init__(self, supabase: Client) -> None:
        self._sb = supabase

    def get_baseline(self, tenant_id: UUID) -> BaselineMetrics:
        """Query last 30 days of sales_data and compute daily stats."""
        today = date.today()
        thirty_days_ago = today - timedelta(days=_PROJECTION_DAYS)

        result = (
            self._sb.table("sales_data")
            .select("invoice_date, total_amount")
            .eq("tenant_id", str(tenant_id))
            .gte("invoice_date", thirty_days_ago.isoformat())
            .lte("invoice_date", today.isoformat())
            .execute()
        )
        rows = result.data or []

        # Aggregate total_amount by day
        daily_totals: dict[str, Decimal] = {}
        total_orders = 0
        for row in rows:
            day = str(row.get("invoice_date", ""))[:10]
            if not day:
                continue
            amt = Decimal(str(row.get("total_amount") or 0))
            daily_totals[day] = daily_totals.get(day, Decimal("0")) + amt
            total_orders += 1

        data_days = len(daily_totals)
        total_revenue = float(sum(daily_totals.values()))

        if data_days == 0:
            return BaselineMetrics(
                total_revenue_30d=0.0,
                total_orders_30d=0,
                daily_avg_revenue=0.0,
                daily_stddev_revenue=0.0,
                data_days=0,
            )

        revenues = [float(v) for v in daily_totals.values()]
        daily_avg = total_revenue / data_days

        # Population stddev
        variance = sum((r - daily_avg) ** 2 for r in revenues) / data_days
        daily_stddev = math.sqrt(variance)

        return BaselineMetrics(
            total_revenue_30d=round(total_revenue, 2),
            total_orders_30d=total_orders,
            daily_avg_revenue=round(daily_avg, 2),
            daily_stddev_revenue=round(daily_stddev, 2),
            data_days=data_days,
        )

    def project(
        self,
        baseline: BaselineMetrics,
        growth_rate_pct: float,
        discount_change_pct: float,
        market_expansion_pct: float = 0.0,
        customer_retention_pct: float = 0.0,
    ) -> ProjectionScenario:
        """Apply growth and discount scenario to baseline, return projection with real CI."""
        if baseline.data_days == 0:
            # No data — return zeroes
            return ProjectionScenario(
                baseline_revenue=0.0,
                projected_revenue=0.0,
                projected_orders=0,
                confidence_interval_lower=0.0,
                confidence_interval_upper=0.0,
                revenue_delta=0.0,
                revenue_delta_pct=0.0,
                growth_rate_pct=growth_rate_pct,
                discount_change_pct=discount_change_pct,
                data_days=0,
            )

        baseline_rev = baseline.total_revenue_30d

        # Business-plan sliders compound on top of volume growth.
        effective_growth = growth_rate_pct + market_expansion_pct + (customer_retention_pct * 0.5)

        # Apply growth factor
        growth_factor = 1 + (effective_growth / 100)
        projected = baseline_rev * growth_factor

        # Apply discount elasticity: increasing discount by X% → revenue change of X% × elasticity
        # e.g. +5% discount → 5 × (-0.3) = -1.5% revenue change
        if discount_change_pct != 0:
            discount_impact = projected * (discount_change_pct / 100) * _DISCOUNT_ELASTICITY
            projected += discount_impact

        # Real 95% CI: projected_daily_avg ± 1.96 × stddev / sqrt(data_days)
        # Then scale to 30-day window: multiply by _PROJECTION_DAYS
        # This uses the Central Limit Theorem for the mean of 30 daily observations.
        # Scale stddev by the same growth factor
        projected_stddev = baseline.daily_stddev_revenue * growth_factor

        # 30-day total CI: sum of 30 independent days
        # stddev of sum = stddev_of_daily × sqrt(30)
        ci_halfwidth = 1.96 * projected_stddev * math.sqrt(_PROJECTION_DAYS)
        ci_lower = max(0.0, projected - ci_halfwidth)
        ci_upper = projected + ci_halfwidth

        # Projected orders (linear scale with growth)
        projected_orders = int(baseline.total_orders_30d * growth_factor)

        delta = projected - baseline_rev
        delta_pct = (delta / baseline_rev * 100) if baseline_rev else 0.0

        return ProjectionScenario(
            baseline_revenue=round(baseline_rev, 2),
            projected_revenue=round(projected, 2),
            projected_orders=projected_orders,
            confidence_interval_lower=round(ci_lower, 2),
            confidence_interval_upper=round(ci_upper, 2),
            revenue_delta=round(delta, 2),
            revenue_delta_pct=round(delta_pct, 2),
            growth_rate_pct=growth_rate_pct,
            discount_change_pct=discount_change_pct,
            data_days=baseline.data_days,
        )
