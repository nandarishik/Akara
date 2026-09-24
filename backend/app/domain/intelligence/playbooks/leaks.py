"""Leak detection — MarginChef leaks.py approach, written from scratch."""

from __future__ import annotations

from decimal import Decimal

import pandas as pd

from app.domain.intelligence.schemas import LeakResult

LEAK_TYPES = {
    "high_food_cost": {"threshold": 0.40},
    "price_lag": {"cost_rise_threshold": 0.15, "stale_days": 30},
    "bleeding_bestseller": {"volume_percentile": 0.80, "margin_threshold": 0.20},
    "dead_weight": {"volume_percentile": 0.10, "margin_threshold": 0.10},
    "waste_spike": {"spike_threshold": 0.20},
}


def _aggregate_by_item(orders_df: pd.DataFrame) -> pd.DataFrame:
    grouped = orders_df.groupby("item_id")
    agg = grouped.agg(
        total_qty=("quantity", "sum"),
        total_revenue=("revenue", "sum"),
        total_food_cost=("food_cost", "sum"),
        days_with_orders=("order_date", "nunique") if "order_date" in orders_df.columns else ("quantity", "count"),
        item_name=("item_name", "first") if "item_name" in orders_df.columns else ("item_id", "first"),
    ).reset_index()
    if "item_name" not in agg.columns:
        agg["item_name"] = agg["item_id"]
    rev = agg["total_revenue"].replace(0, 1)
    agg["food_cost_ratio"] = agg["total_food_cost"] / rev
    agg["cm_ratio"] = (agg["total_revenue"] - agg["total_food_cost"]) / rev
    return agg


def detect_leaks(
    orders_df: pd.DataFrame,
    menu_items_df: pd.DataFrame,
    history_30d_df: pd.DataFrame | None = None,
) -> list[LeakResult]:
    if orders_df is None or orders_df.empty:
        return []
    item_agg = _aggregate_by_item(orders_df)
    qty = item_agg["total_qty"]
    p80 = float(qty.quantile(0.80)) if len(qty) else 0
    p10 = float(qty.quantile(0.10)) if len(qty) else 0
    results: dict[str, LeakResult] = {}

    for _, row in item_agg.iterrows():
        item_id = str(row["item_id"])
        days = max(1, int(row.get("days_with_orders") or 1))
        monthly_revenue = float(row["total_revenue"]) * (30 / days)
        candidates: list[LeakResult] = []
        food_cost_ratio = float(row["food_cost_ratio"])

        if food_cost_ratio > LEAK_TYPES["high_food_cost"]["threshold"]:
            excess = food_cost_ratio - 0.40
            candidates.append(
                LeakResult(
                    item_id=item_id,
                    item_name=str(row["item_name"]),
                    leak_type="high_food_cost",
                    severity="high" if food_cost_ratio > 0.55 else "medium",
                    details={
                        "food_cost_ratio": round(food_cost_ratio, 3),
                        "target_ratio": 0.40,
                        "excess_pct": round(excess * 100, 1),
                    },
                    estimated_monthly_loss_inr=Decimal(str(round(monthly_revenue * excess, 2))),
                )
            )

        menu_row = pd.DataFrame()
        if menu_items_df is not None and not menu_items_df.empty:
            if "id" in menu_items_df.columns:
                menu_row = menu_items_df[menu_items_df["id"] == item_id]
            if menu_row.empty and "item_name" in menu_items_df.columns:
                menu_row = menu_items_df[menu_items_df["item_name"] == row["item_name"]]
        if not menu_row.empty:
            current_cost = float(menu_row.iloc[0].get("current_cost_price") or 0)
            hist_cost = current_cost
            if history_30d_df is not None and not history_30d_df.empty:
                hist = history_30d_df[history_30d_df["item_id"] == item_id]
                if not hist.empty and "food_cost" in hist.columns:
                    hist_cost = float(hist["food_cost"].mean())
            elif "historical_cost" in menu_row.columns:
                hist_cost = float(menu_row.iloc[0]["historical_cost"] or current_cost)
            stale = int(menu_row.iloc[0].get("price_last_changed_days") or 0)
            if hist_cost > 0:
                cost_rise = (current_cost - hist_cost) / hist_cost
                if cost_rise >= 0.15 and stale >= 30:
                    candidates.append(
                        LeakResult(
                            item_id=item_id,
                            item_name=str(row["item_name"]),
                            leak_type="price_lag",
                            severity="high" if cost_rise > 0.25 else "medium",
                            details={
                                "cost_rise_pct": round(cost_rise * 100, 1),
                                "price_unchanged_days": stale,
                            },
                            estimated_monthly_loss_inr=Decimal(str(round(monthly_revenue * cost_rise, 2))),
                        )
                    )

        cm = float(row["cm_ratio"])
        vol = float(row["total_qty"])
        if vol >= p80 and cm < 0.20:
            candidates.append(
                LeakResult(
                    item_id=item_id,
                    item_name=str(row["item_name"]),
                    leak_type="bleeding_bestseller",
                    severity="high",
                    details={"cm_ratio": round(cm, 3), "volume": vol},
                    estimated_monthly_loss_inr=Decimal(str(round(monthly_revenue * max(0.0, 0.20 - cm), 2))),
                )
            )
        if vol <= p10 and cm < 0.10:
            candidates.append(
                LeakResult(
                    item_id=item_id,
                    item_name=str(row["item_name"]),
                    leak_type="dead_weight",
                    severity="medium",
                    details={"cm_ratio": round(cm, 3), "volume": vol},
                    estimated_monthly_loss_inr=Decimal(str(round(monthly_revenue * max(0.0, 0.10 - cm), 2))),
                )
            )
            if food_cost_ratio > 0 and history_30d_df is not None and not history_30d_df.empty:
                week = orders_df
                if "order_date" in week.columns:
                    parsed = pd.to_datetime(week["order_date"], errors="coerce")
                    latest = parsed.max()
                    if pd.isna(latest):
                        continue
                    this_week = week[parsed >= latest - pd.Timedelta(days=7)]
                if not this_week.empty:
                    w = _aggregate_by_item(this_week)
                    wrow = w[w["item_id"] == item_id]
                    if not wrow.empty:
                        spike = float(wrow.iloc[0]["food_cost_ratio"]) - food_cost_ratio
                        if spike > 0.20:
                            candidates.append(
                                LeakResult(
                                    item_id=item_id,
                                    item_name=str(row["item_name"]),
                                    leak_type="waste_spike",
                                    severity="high",
                                    details={"spike": round(spike, 3)},
                                    estimated_monthly_loss_inr=Decimal(str(round(monthly_revenue * spike, 2))),
                                )
                            )

        if candidates:
            results[item_id] = max(candidates, key=lambda leak: leak.estimated_monthly_loss_inr)

    return sorted(results.values(), key=lambda leak: leak.estimated_monthly_loss_inr, reverse=True)
