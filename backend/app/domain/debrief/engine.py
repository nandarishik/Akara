"""WeeklyDebriefEngine — nine deterministic computations."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from supabase import Client

from app.core.time_utils import last_completed_week_ist
from app.domain.debrief.models import (
    DebriefData,
    OutstandingParty,
    PartyChange,
    ProductChange,
    RollingAverages,
    WeekMetrics,
    WeekdayPattern,
    ZoneChange,
)
from app.domain.insights.engine import _fmt_inr

logger = logging.getLogger(__name__)

WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")


def _sum_amount(rows: list[dict]) -> int:
    total = Decimal("0")
    for row in rows:
        total += Decimal(str(row.get("total_amount") or 0))
    return int(total)


def _distinct_count(rows: list[dict], field: str) -> int:
    return len({row.get(field) for row in rows if row.get(field)})


class WeeklyDebriefEngine:
    def __init__(self, supabase: Client) -> None:
        self._sb = supabase

    def compute(self, tenant_id: UUID, reference: date | None = None) -> DebriefData:
        week_start, week_end = last_completed_week_ist(reference)
        prior_start = week_start - timedelta(days=7)
        prior_end = week_start - timedelta(days=1)

        days_of_data = self._count_data_days(tenant_id)
        data_freshness = self._latest_invoice_date(tenant_id)
        limited_mode = days_of_data < 14

        data = DebriefData(
            week_start=week_start,
            week_end=week_end,
            days_of_data=days_of_data,
            data_freshness=data_freshness,
            limited_mode=limited_mode,
        )

        if days_of_data < 7:
            return data

        this_rows = self._fetch_range(tenant_id, week_start, week_end)
        prior_rows = self._fetch_range(tenant_id, prior_start, prior_end)

        data.week_metrics = WeekMetrics(
            revenue=_sum_amount(this_rows),
            orders=len(this_rows),
            parties=_distinct_count(this_rows, "party_name"),
            prior_revenue=_sum_amount(prior_rows),
            prior_orders=len(prior_rows),
            prior_parties=_distinct_count(prior_rows, "party_name"),
        )

        if not limited_mode:
            data.zone_changes = self._revenue_by_zone(this_rows, prior_rows)
            data.gaining_products = self._top_gaining(this_rows, prior_rows)
            data.declining_products = self._top_declining(this_rows, prior_rows)
            data.churned_parties = self._churned_parties(this_rows, prior_rows)
            data.reengaged_parties = self._reengaged_parties(tenant_id, week_start, week_end)
            data.weekday_patterns = self._day_of_week_pattern(tenant_id, week_start, week_end)
            data.rolling = self._rolling_averages(tenant_id, week_end)
            data.outstanding_top5 = self._outstanding_top5(tenant_id)

        return data

    def cafe_additives(
        self,
        tenant_id: UUID,
        week_start: date,
        week_end: date,
        metrics: WeekMetrics,
    ) -> tuple[dict[str, float | None], list[dict[str, str]]]:
        cafe_rev = self._sum_canonical_revenue(tenant_id, week_start, week_end)
        prior_start = week_start - timedelta(days=7)
        prior_end = week_start - timedelta(days=1)
        cafe_prior = self._sum_canonical_revenue(tenant_id, prior_start, prior_end)
        if cafe_rev is not None and cafe_prior is not None:
            food, prior_food = self._food_cost_pair(
                tenant_id, week_start, week_end, prior_start, prior_end
            )
            trend = compute_trend_vs_previous_period(
                cafe_rev, cafe_prior, food, prior_food
            )
        else:
            trend = compute_trend_vs_previous_period(
                metrics.revenue, metrics.prior_revenue
            )
        actions = self._collect_recommended_actions(tenant_id, week_start, week_end)
        return trend, actions

    def _sum_canonical_revenue(
        self, tenant_id: UUID, start: date, end: date
    ) -> int | None:
        try:
            res = (
                self._sb.table("canonical_orders")
                .select("total_amount")
                .eq("tenant_id", str(tenant_id))
                .gte("order_time", start.isoformat())
                .lte("order_time", f"{end.isoformat()}T23:59:59")
                .execute()
            )
            rows = res.data or []
            if len(rows) < 7:
                return None
            return _sum_amount(rows)
        except Exception:
            return None

    def _food_cost_pair(
        self,
        tenant_id: UUID,
        week_start: date,
        week_end: date,
        prior_start: date,
        prior_end: date,
    ) -> tuple[float | None, float | None]:
        try:
            this = self._sum_food_cost(tenant_id, week_start, week_end)
            prior = self._sum_food_cost(tenant_id, prior_start, prior_end)
            return this, prior
        except Exception:
            return None, None

    def _sum_food_cost(self, tenant_id: UUID, start: date, end: date) -> float | None:
        res = (
            self._sb.table("canonical_expenses")
            .select("amount")
            .eq("tenant_id", str(tenant_id))
            .eq("category", "food_cost")
            .gte("expense_date", start.isoformat())
            .lte("expense_date", end.isoformat())
            .execute()
        )
        rows = res.data or []
        if not rows:
            return None
        return float(_sum_amount(rows))

    def _collect_recommended_actions(
        self, tenant_id: UUID, week_start: date, week_end: date
    ) -> list[dict[str, str]]:
        events: list[dict] = []
        anomalies: list[dict] = []
        spikes: list[dict] = []
        try:
            events = (
                self._sb.table("alert_trigger_events")
                .select("metric, metric_name")
                .eq("tenant_id", str(tenant_id))
                .gte("created_at", week_start.isoformat())
                .lte("created_at", f"{week_end.isoformat()}T23:59:59")
                .limit(10)
                .execute()
            ).data or []
        except Exception:
            events = []
        try:
            anomalies = (
                self._sb.table("alert_anomalies")
                .select("metric_name, is_outlier")
                .eq("tenant_id", str(tenant_id))
                .gte("detected_at", week_start.isoformat())
                .lte("detected_at", week_end.isoformat())
                .limit(10)
                .execute()
            ).data or []
        except Exception:
            anomalies = []
        try:
            spikes = (
                self._sb.table("forecasts")
                .select("item_id, predicted_revenue")
                .eq("tenant_id", str(tenant_id))
                .gte("forecast_date", week_end.isoformat())
                .limit(5)
                .execute()
            ).data or []
        except Exception:
            spikes = []
        return build_recommended_actions(events, anomalies, spikes)

    def _fetch_range(
        self, tenant_id: UUID, start: date, end: date
    ) -> list[dict]:
        res = (
            self._sb.table("sales_data")
            .select(
                "invoice_date, party_name, party_zone, product_name, total_amount"
            )
            .eq("tenant_id", str(tenant_id))
            .gte("invoice_date", start.isoformat())
            .lte("invoice_date", end.isoformat())
            .execute()
        )
        return res.data or []

    def _count_data_days(self, tenant_id: UUID) -> int:
        res = (
            self._sb.table("sales_data")
            .select("invoice_date")
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        dates = {row.get("invoice_date") for row in (res.data or []) if row.get("invoice_date")}
        return len(dates)

    def _latest_invoice_date(self, tenant_id: UUID) -> date | None:
        res = (
            self._sb.table("sales_data")
            .select("invoice_date")
            .eq("tenant_id", str(tenant_id))
            .order("invoice_date", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            return date.fromisoformat(str(res.data[0]["invoice_date"]))
        return None

    def _revenue_by_zone(
        self, this_rows: list[dict], prior_rows: list[dict]
    ) -> list[ZoneChange]:
        this: dict[str, int] = defaultdict(int)
        prior: dict[str, int] = defaultdict(int)
        for row in this_rows:
            zone = row.get("party_zone") or "Unknown"
            this[zone] += int(Decimal(str(row.get("total_amount") or 0)))
        for row in prior_rows:
            zone = row.get("party_zone") or "Unknown"
            prior[zone] += int(Decimal(str(row.get("total_amount") or 0)))

        changes: list[ZoneChange] = []
        for zone in set(this) | set(prior):
            tw, pw = this.get(zone, 0), prior.get(zone, 0)
            change = tw - pw
            pct = (change / pw * 100) if pw else (100.0 if tw else 0.0)
            changes.append(
                ZoneChange(zone=zone, this_week=tw, prior_week=pw, change_inr=change, change_pct=round(pct, 1))
            )
        changes.sort(key=lambda z: abs(z.change_inr), reverse=True)
        return changes[:10]

    def _aggregate_products(self, rows: list[dict]) -> dict[str, int]:
        agg: dict[str, int] = defaultdict(int)
        for row in rows:
            product = row.get("product_name") or "Unknown"
            agg[product] += int(Decimal(str(row.get("total_amount") or 0)))
        return agg

    def _top_gaining(self, this_rows: list[dict], prior_rows: list[dict]) -> list[ProductChange]:
        this = self._aggregate_products(this_rows)
        prior = self._aggregate_products(prior_rows)
        changes: list[ProductChange] = []
        for product, tw in this.items():
            pw = prior.get(product, 0)
            if pw <= 0:
                continue
            change = tw - pw
            pct = change / pw * 100
            if change > 0 and pct >= 20:
                changes.append(
                    ProductChange(product=product, this_week=tw, prior_week=pw, change_inr=change, change_pct=round(pct, 1))
                )
        changes.sort(key=lambda p: p.change_inr, reverse=True)
        return changes[:5]

    def _top_declining(self, this_rows: list[dict], prior_rows: list[dict]) -> list[ProductChange]:
        this = self._aggregate_products(this_rows)
        prior = self._aggregate_products(prior_rows)
        changes: list[ProductChange] = []
        for product, pw in prior.items():
            tw = this.get(product, 0)
            if pw <= 0:
                continue
            change = tw - pw
            pct = change / pw * 100
            if change < 0 and pct <= -15:
                changes.append(
                    ProductChange(product=product, this_week=tw, prior_week=pw, change_inr=change, change_pct=round(pct, 1))
                )
        changes.sort(key=lambda p: p.change_inr)
        return changes[:5]

    def _churned_parties(
        self, this_rows: list[dict], prior_rows: list[dict]
    ) -> list[PartyChange]:
        this_parties = {row.get("party_name") for row in this_rows if row.get("party_name")}
        prior_by_party: dict[str, str] = {}
        for row in prior_rows:
            party = row.get("party_name")
            if party and party not in this_parties:
                prior_by_party[party] = row.get("party_zone") or ""
        return [
            PartyChange(party=p, zone=z) for p, z in list(prior_by_party.items())[:10]
        ]

    def _reengaged_parties(
        self, tenant_id: UUID, week_start: date, week_end: date
    ) -> list[PartyChange]:
        silent_start = week_start - timedelta(days=21)
        silent_end = week_start - timedelta(days=1)
        silent_res = (
            self._sb.table("sales_data")
            .select("party_name, party_zone")
            .eq("tenant_id", str(tenant_id))
            .gte("invoice_date", silent_start.isoformat())
            .lte("invoice_date", silent_end.isoformat())
            .execute()
        )
        silent_parties = {r.get("party_name") for r in (silent_res.data or []) if r.get("party_name")}

        this_res = (
            self._sb.table("sales_data")
            .select("party_name, party_zone")
            .eq("tenant_id", str(tenant_id))
            .gte("invoice_date", week_start.isoformat())
            .lte("invoice_date", week_end.isoformat())
            .execute()
        )
        reengaged: list[PartyChange] = []
        seen: set[str] = set()
        for row in this_res.data or []:
            party = row.get("party_name")
            if not party or party in seen:
                continue
            if party not in silent_parties:
                continue
            # Must have been silent for 3+ weeks — check no orders in gap window before week
            gap = (
                self._sb.table("sales_data")
                .select("party_name")
                .eq("tenant_id", str(tenant_id))
                .eq("party_name", party)
                .gte("invoice_date", (week_start - timedelta(days=28)).isoformat())
                .lt("invoice_date", week_start.isoformat())
                .limit(1)
                .execute()
            )
            if gap.data:
                continue
            seen.add(party)
            reengaged.append(PartyChange(party=party, zone=row.get("party_zone") or ""))
        return reengaged[:10]

    def _day_of_week_pattern(
        self, tenant_id: UUID, week_start: date, week_end: date
    ) -> list[WeekdayPattern]:
        this_rows = self._fetch_range(tenant_id, week_start, week_end)
        this_by_dow: dict[int, int] = defaultdict(int)
        for row in this_rows:
            d = date.fromisoformat(str(row["invoice_date"]))
            this_by_dow[d.weekday()] += int(Decimal(str(row.get("total_amount") or 0)))

        trailing_start = week_end - timedelta(days=30)
        trail_rows = self._fetch_range(tenant_id, trailing_start, week_end)
        trail_by_dow: dict[int, list[int]] = defaultdict(list)
        daily: dict[date, int] = defaultdict(int)
        for row in trail_rows:
            d = date.fromisoformat(str(row["invoice_date"]))
            daily[d] += int(Decimal(str(row.get("total_amount") or 0)))
        for d, amt in daily.items():
            trail_by_dow[d.weekday()].append(amt)

        patterns: list[WeekdayPattern] = []
        for i, name in enumerate(WEEKDAYS):
            avg_vals = trail_by_dow.get(i, [0])
            trailing_avg = int(sum(avg_vals) / max(len(avg_vals), 1))
            patterns.append(
                WeekdayPattern(weekday=name, this_week=this_by_dow.get(i, 0), trailing_avg=trailing_avg)
            )
        return patterns

    def _rolling_averages(self, tenant_id: UUID, week_end: date) -> RollingAverages:
        def avg_daily(days: int) -> tuple[int, str]:
            start = week_end - timedelta(days=days)
            rows = self._fetch_range(tenant_id, start, week_end)
            daily: dict[date, int] = defaultdict(int)
            for row in rows:
                d = date.fromisoformat(str(row["invoice_date"]))
                daily[d] += int(Decimal(str(row.get("total_amount") or 0)))
            if not daily:
                return 0, "flat"
            vals = list(daily.values())
            avg = int(sum(vals) / len(vals))
            mid = len(vals) // 2
            first_half = sum(vals[:mid]) if mid else 0
            second_half = sum(vals[mid:]) if mid else sum(vals)
            trend = "up" if second_half > first_half else "down" if second_half < first_half else "flat"
            return avg, trend

        avg30, t30 = avg_daily(30)
        avg60, t60 = avg_daily(60)
        avg90, t90 = avg_daily(90)
        projected = avg30 * 30
        return RollingAverages(
            avg_30d_daily=avg30,
            avg_60d_daily=avg60,
            avg_90d_daily=avg90,
            trend_30d=t30,
            trend_60d=t60,
            trend_90d=t90,
            projected_month=projected,
        )

    def _outstanding_top5(self, tenant_id: UUID) -> list[OutstandingParty]:
        try:
            result = self._sb.rpc(
                "get_outstanding_parties",
                {"p_tenant_id": str(tenant_id)},
            ).execute()
            rows = result.data or []
        except Exception:
            rows = (
                self._sb.table("sales_data")
                .select("party_name, outstanding_amount")
                .eq("tenant_id", str(tenant_id))
                .gt("outstanding_amount", 0)
                .order("outstanding_amount", desc=True)
                .limit(20)
                .execute()
            ).data or []

        party_amt: dict[str, int] = defaultdict(int)
        for row in rows:
            party = row.get("party_name") or "Unknown"
            party_amt[party] += int(Decimal(str(row.get("outstanding_amount") or row.get("amount") or 0)))

        top = sorted(party_amt.items(), key=lambda x: x[1], reverse=True)[:5]
        return [OutstandingParty(party=p, amount=a) for p, a in top]


def compute_trend_vs_previous_period(
    revenue: int,
    prior_revenue: int,
    food_cost: float | None = None,
    prior_food_cost: float | None = None,
) -> dict[str, float | None]:
    def _wow(cur: float, prior: float) -> float:
        if prior == 0:
            return 0.0
        return round(100.0 * (cur - prior) / prior, 1)

    food = None
    if food_cost is not None and prior_food_cost is not None:
        food = _wow(food_cost, prior_food_cost)
    return {
        "revenue_wow_pct": _wow(float(revenue), float(prior_revenue)),
        "food_cost_wow_pct": food,
    }


def build_recommended_actions(
    alert_events: list[dict],
    anomalies: list[dict],
    forecast_spikes: list[dict],
) -> list[dict[str, str]]:
    actions: list[dict[str, str]] = []
    for ev in alert_events:
        metric = str(ev.get("metric") or ev.get("metric_name") or "alert")
        actions.append(
            {
                "title": f"Review {metric.replace('_', ' ')}",
                "detail": "Triggered this week",
            }
        )
        if len(actions) >= 3:
            return actions[:3]
    for an in anomalies:
        if an.get("is_outlier"):
            actions.append(
                {
                    "title": "Investigate unusual pattern",
                    "detail": str(an.get("metric_name") or "anomaly"),
                }
            )
        if len(actions) >= 3:
            return actions[:3]
    for fc in forecast_spikes:
        actions.append(
            {
                "title": f"Prep for demand spike: {fc.get('item_id', 'item')}",
                "detail": "Forecast above recent average",
            }
        )
        if len(actions) >= 3:
            break
    return actions[:3]


def format_inr(amount: int) -> str:
    return _fmt_inr(amount)
