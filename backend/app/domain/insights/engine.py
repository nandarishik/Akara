"""InsightsEngine — Compute Top 3 actionable insights from real sales data.

Each insight includes:
- title:          Short headline
- description:    Specific data-driven detail (party names, products, ₹ amounts)
- revenue_impact: Estimated ₹ opportunity/risk (integer, paise-free)
- priority:       "high" | "medium" | "low"
- category:       "collections" | "routes" | "products"

Three insight types computed in order:
1. Inactive routes   — zones with routes having zero orders in the last 3 days
2. Outstanding recovery — parties outstanding > 30 days, ranked by amount
3. Product demand drops — products with >15% WoW revenue decline
"""

import logging
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from supabase import Client

logger = logging.getLogger(__name__)


@dataclass
class Insight:
    title: str
    description: str
    revenue_impact: int  # in rupees (integer)
    priority: str  # "high" | "medium" | "low"
    category: str  # "collections" | "routes" | "products"
    data_points: list[str] = field(default_factory=list)  # bullet-list items for email


def _fmt_inr(amount: int) -> str:
    """Format rupees in Indian lakh/crore notation."""
    if amount >= 10_000_000:
        return f"₹{amount / 10_000_000:.2f} Cr"
    if amount >= 100_000:
        return f"₹{amount / 100_000:.1f}L"
    if amount >= 1_000:
        return f"₹{amount / 1_000:.1f}K"
    return f"₹{amount:,}"


class InsightsEngine:
    """Computes Top 3 actionable insights from live sales data.

    Usage:
        engine = InsightsEngine(supabase_client)
        insights = engine.compute_insights(tenant_id)
    """

    def __init__(self, supabase: Client) -> None:
        self._sb = supabase

    def compute_insights(self, tenant_id: UUID) -> list[Insight]:
        """Return up to 3 insights, ordered by revenue_impact desc."""
        today = date.today()
        insights: list[Insight] = []

        try:
            insight = self._inactive_routes_insight(tenant_id, today)
            if insight:
                insights.append(insight)
        except Exception:
            logger.exception("Failed to compute inactive routes insight")

        try:
            insight = self._outstanding_recovery_insight(tenant_id)
            if insight:
                insights.append(insight)
        except Exception:
            logger.exception("Failed to compute outstanding recovery insight")

        try:
            insight = self._product_demand_drop_insight(tenant_id, today)
            if insight:
                insights.append(insight)
        except Exception:
            logger.exception("Failed to compute product demand drop insight")

        # Sort by revenue impact descending, cap at 3
        insights.sort(key=lambda x: x.revenue_impact, reverse=True)

        # If we have fewer than 3 insights (no data or errors), pad with generic ones
        if len(insights) < 3:
            insights.extend(_generic_insights()[len(insights):3])

        return insights[:3]

    # ------------------------------------------------------------------ #
    #  Insight 1 — Inactive routes                                          #
    # ------------------------------------------------------------------ #

    def _inactive_routes_insight(
        self, tenant_id: UUID, today: date
    ) -> Insight | None:
        """Routes that had zero orders in the past 3 days but were active
        in the prior 7 days. Revenue impact = 3 days × route avg/day."""
        three_days_ago = today - timedelta(days=3)
        ten_days_ago = today - timedelta(days=10)

        # Routes with orders in the past 10 days (baseline active set)
        active_res = (
            self._sb.table("sales_data")
            .select("route, total_amount")
            .eq("tenant_id", str(tenant_id))
            .gte("invoice_date", ten_days_ago.isoformat())
            .lte("invoice_date", (three_days_ago - timedelta(days=1)).isoformat())
            .not_.is_("route", "null")
            .execute()
        )
        active_rows = active_res.data or []
        if not active_rows:
            return None

        # Aggregate revenue per route in baseline period
        route_revenue: dict[str, Decimal] = {}
        for row in active_rows:
            route = row.get("route") or ""
            rev = Decimal(str(row.get("total_amount") or 0))
            route_revenue[route] = route_revenue.get(route, Decimal("0")) + rev

        # Routes with orders in the past 3 days
        recent_res = (
            self._sb.table("sales_data")
            .select("route")
            .eq("tenant_id", str(tenant_id))
            .gte("invoice_date", three_days_ago.isoformat())
            .not_.is_("route", "null")
            .execute()
        )
        recent_routes = {row.get("route") for row in (recent_res.data or [])}

        inactive = {
            r: rev
            for r, rev in route_revenue.items()
            if r not in recent_routes and r
        }

        if not inactive:
            return None

        # Top 5 by revenue for display
        top_inactive = sorted(inactive.items(), key=lambda x: x[1], reverse=True)[:5]
        total_risk = sum(v for _, v in top_inactive)

        # Estimate: 3 missed days × avg daily revenue for these routes
        # baseline_days = 7 (ten_days_ago to three_days_ago)
        baseline_days = 7
        daily_avg = total_risk / baseline_days if baseline_days else total_risk
        revenue_impact = int(daily_avg * 3)

        data_points = [
            f"{route} — {_fmt_inr(int(rev))} in past 7 days, 0 orders last 3 days"
            for route, rev in top_inactive[:3]
        ]

        return Insight(
            title=f"{len(inactive)} route{'s' if len(inactive) != 1 else ''} went silent in the last 3 days",
            description=(
                f"{len(inactive)} route(s) that were active last week have zero orders "
                f"in the past 3 days. Estimated revenue at risk: "
                f"{_fmt_inr(revenue_impact)}."
            ),
            revenue_impact=revenue_impact,
            priority="high" if revenue_impact >= 100_000 else "medium",
            category="routes",
            data_points=data_points,
        )

    # ------------------------------------------------------------------ #
    #  Insight 2 — Outstanding recovery                                     #
    # ------------------------------------------------------------------ #

    def _outstanding_recovery_insight(self, tenant_id: UUID) -> Insight | None:
        """Parties with outstanding > 30 days, sorted by outstanding amount."""
        try:
            result = self._sb.rpc(
                "get_outstanding_parties",
                {"p_tenant_id": str(tenant_id)},
            ).execute()
            rows = result.data or []
            if not isinstance(rows, list):
                rows = []
        except Exception:
            # Fallback: query directly
            result = (
                self._sb.table("sales_data")
                .select("party_name, outstanding_amount, party_zone")
                .eq("tenant_id", str(tenant_id))
                .gt("outstanding_amount", 0)
                .order("outstanding_amount", desc=True)
                .limit(20)
                .execute()
            )
            rows = result.data or []

        if not rows:
            return None

        # Aggregate by party
        party_outstanding: dict[str, Decimal] = {}
        for row in rows:
            party = row.get("party_name") or "Unknown"
            amt = Decimal(str(row.get("outstanding_amount") or 0))
            if amt > 0:
                party_outstanding[party] = (
                    party_outstanding.get(party, Decimal("0")) + amt
                )

        if not party_outstanding:
            return None

        top_parties = sorted(
            party_outstanding.items(), key=lambda x: x[1], reverse=True
        )[:5]
        total_outstanding = sum(v for _, v in top_parties)

        data_points = [
            f"{party} — {_fmt_inr(int(amt))} outstanding"
            for party, amt in top_parties[:3]
        ]

        return Insight(
            title=f"{_fmt_inr(int(total_outstanding))} recoverable today",
            description=(
                f"{len(top_parties)} parties have outstanding amounts totalling "
                f"{_fmt_inr(int(total_outstanding))}. "
                f"Highest: {top_parties[0][0]} at {_fmt_inr(int(top_parties[0][1]))}."
            ),
            revenue_impact=int(total_outstanding),
            priority="high" if total_outstanding >= 200_000 else "medium",
            category="collections",
            data_points=data_points,
        )

    # ------------------------------------------------------------------ #
    #  Insight 3 — Product demand drop                                      #
    # ------------------------------------------------------------------ #

    def _product_demand_drop_insight(
        self, tenant_id: UUID, today: date
    ) -> Insight | None:
        """Products with >15% week-over-week revenue decline."""
        this_week_start = today - timedelta(days=7)
        last_week_start = today - timedelta(days=14)
        last_week_end = today - timedelta(days=8)

        def _week_revenue(start: date, end: date) -> dict[str, Decimal]:
            res = (
                self._sb.table("sales_data")
                .select("product_name, total_amount")
                .eq("tenant_id", str(tenant_id))
                .gte("invoice_date", start.isoformat())
                .lte("invoice_date", end.isoformat())
                .not_.is_("product_name", "null")
                .execute()
            )
            agg: dict[str, Decimal] = {}
            for row in (res.data or []):
                prod = row.get("product_name") or ""
                rev = Decimal(str(row.get("total_amount") or 0))
                agg[prod] = agg.get(prod, Decimal("0")) + rev
            return agg

        this_week = _week_revenue(this_week_start, today)
        last_week = _week_revenue(last_week_start, last_week_end)

        if not last_week:
            return None

        drops: list[tuple[str, Decimal, float]] = []
        for prod, last_rev in last_week.items():
            if last_rev <= 0:
                continue
            this_rev = this_week.get(prod, Decimal("0"))
            pct_change = float((this_rev - last_rev) / last_rev * 100)
            if pct_change < -15:
                drops.append((prod, last_rev, pct_change))

        if not drops:
            return None

        drops.sort(key=lambda x: x[1], reverse=True)
        top_drops = drops[:5]

        # Revenue impact = sum of revenue lost (last week - this week)
        total_impact = sum(
            int(last_rev) - int(this_week.get(prod, Decimal("0")))
            for prod, last_rev, _ in top_drops
        )

        data_points = [
            f"{prod} — {abs(pct):.0f}% drop ({_fmt_inr(int(last_rev))} → {_fmt_inr(int(this_week.get(prod, Decimal('0'))))})"
            for prod, last_rev, pct in top_drops[:3]
        ]

        return Insight(
            title=f"{len(drops)} product{'s' if len(drops) != 1 else ''} dropped >15% this week",
            description=(
                f"{len(drops)} product(s) declined more than 15% week-over-week. "
                f"Largest drop: {top_drops[0][0]} ({abs(top_drops[0][2]):.0f}% decline). "
                f"Total impact: {_fmt_inr(total_impact)}."
            ),
            revenue_impact=max(0, total_impact),
            priority="medium" if total_impact >= 50_000 else "low",
            category="products",
            data_points=data_points,
        )


def _generic_insights() -> list[Insight]:
    """Fallback insights when real data is unavailable."""
    return [
        Insight(
            title="Review your top zone for inactive routes",
            description=(
                "Check if any routes in your highest-revenue zone had zero "
                "orders in the last 3 days. Each missed route day costs "
                "an estimated ₹5K–₹20K in delayed revenue."
            ),
            revenue_impact=15_000,
            priority="medium",
            category="routes",
            data_points=["No live data — connect your sales data to see real insights"],
        ),
        Insight(
            title="Review outstanding collections",
            description=(
                "Check parties with outstanding invoices older than 30 days. "
                "Outstanding balances tied up represent recoverable cash flow."
            ),
            revenue_impact=10_000,
            priority="medium",
            category="collections",
            data_points=["No outstanding data available yet"],
        ),
        Insight(
            title="Ask AKARA about week-over-week product drops",
            description=(
                "Use AKARA Copilot: 'Which products had a drop last week vs "
                "the week before?' to catch demand shifts early."
            ),
            revenue_impact=5_000,
            priority="low",
            category="products",
            data_points=["Use Copilot to generate data-driven insights"],
        ),
    ]
