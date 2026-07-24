"""Weekly debrief typed models."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any


@dataclass
class WeekMetrics:
    revenue: int = 0
    orders: int = 0
    parties: int = 0
    prior_revenue: int = 0
    prior_orders: int = 0
    prior_parties: int = 0


@dataclass
class ZoneChange:
    zone: str
    this_week: int
    prior_week: int
    change_inr: int
    change_pct: float


@dataclass
class ProductChange:
    product: str
    this_week: int
    prior_week: int
    change_inr: int
    change_pct: float


@dataclass
class PartyChange:
    party: str
    zone: str = ""


@dataclass
class WeekdayPattern:
    weekday: str
    this_week: int
    trailing_avg: int


@dataclass
class RollingAverages:
    avg_30d_daily: int = 0
    avg_60d_daily: int = 0
    avg_90d_daily: int = 0
    trend_30d: str = "flat"
    trend_60d: str = "flat"
    trend_90d: str = "flat"
    projected_month: int = 0


@dataclass
class OutstandingParty:
    party: str
    amount: int


@dataclass
class DebriefData:
    week_start: date
    week_end: date
    week_metrics: WeekMetrics = field(default_factory=WeekMetrics)
    zone_changes: list[ZoneChange] = field(default_factory=list)
    gaining_products: list[ProductChange] = field(default_factory=list)
    declining_products: list[ProductChange] = field(default_factory=list)
    churned_parties: list[PartyChange] = field(default_factory=list)
    reengaged_parties: list[PartyChange] = field(default_factory=list)
    weekday_patterns: list[WeekdayPattern] = field(default_factory=list)
    rolling: RollingAverages = field(default_factory=RollingAverages)
    outstanding_top5: list[OutstandingParty] = field(default_factory=list)
    days_of_data: int = 0
    data_freshness: date | None = None
    limited_mode: bool = False

    def to_context_dict(self) -> dict[str, Any]:
        return {
            "week_start": self.week_start.isoformat(),
            "week_end": self.week_end.isoformat(),
            "week_metrics": {
                "revenue": self.week_metrics.revenue,
                "orders": self.week_metrics.orders,
                "parties": self.week_metrics.parties,
                "prior_revenue": self.week_metrics.prior_revenue,
                "prior_orders": self.week_metrics.prior_orders,
                "prior_parties": self.week_metrics.prior_parties,
            },
            "zones": [
                {
                    "zone": z.zone,
                    "this_week": z.this_week,
                    "prior_week": z.prior_week,
                    "change_inr": z.change_inr,
                    "change_pct": z.change_pct,
                }
                for z in self.zone_changes
            ],
            "gaining_products": [
                {"product": p.product, "change_inr": p.change_inr, "change_pct": p.change_pct}
                for p in self.gaining_products
            ],
            "declining_products": [
                {"product": p.product, "change_inr": p.change_inr, "change_pct": p.change_pct}
                for p in self.declining_products
            ],
            "churned_parties": [{"party": p.party, "zone": p.zone} for p in self.churned_parties],
            "reengaged_parties": [{"party": p.party, "zone": p.zone} for p in self.reengaged_parties],
            "weekday_patterns": [
                {"weekday": w.weekday, "this_week": w.this_week, "trailing_avg": w.trailing_avg}
                for w in self.weekday_patterns
            ],
            "rolling": {
                "avg_30d_daily": self.rolling.avg_30d_daily,
                "avg_60d_daily": self.rolling.avg_60d_daily,
                "avg_90d_daily": self.rolling.avg_90d_daily,
                "trend_30d": self.rolling.trend_30d,
                "trend_60d": self.rolling.trend_60d,
                "trend_90d": self.rolling.trend_90d,
                "projected_month": self.rolling.projected_month,
            },
            "outstanding_top5": [
                {"party": o.party, "amount": o.amount} for o in self.outstanding_top5
            ],
            "days_of_data": self.days_of_data,
            "limited_mode": self.limited_mode,
        }
