"""Repricing — 15% cost rise, 30d stale, +10% cap, nearest ₹5."""

from __future__ import annotations

import pandas as pd

REPRICE_COST_RISE_THRESHOLD = 0.15
REPRICE_STALE_DAYS = 30
REPRICE_MAX_INCREASE_PCT = 0.10


def generate_repricing_candidates(
    menu_items_df: pd.DataFrame,
    orders_df: pd.DataFrame,
) -> list[dict]:
    if menu_items_df is None or menu_items_df.empty:
        return []
    volumes = (
        orders_df.groupby("item_id")["quantity"].sum()
        if orders_df is not None and not orders_df.empty and "item_id" in orders_df.columns
        else pd.Series(dtype=float)
    )
    candidates: list[dict] = []
    for _, item in menu_items_df.iterrows():
        selling = float(item.get("current_selling_price") or 0)
        cost = float(item.get("current_cost_price") or 0)
        if selling <= 0:
            continue
        hist = float(item.get("historical_cost") or 0)
        if hist > 0:
            cost_rise = (cost - hist) / hist
        else:
            cost_rise = (cost / selling) - 1 if selling else 0
        stale = int(item.get("price_last_changed_days") or 0)
        if cost_rise < REPRICE_COST_RISE_THRESHOLD:
            continue
        if stale < REPRICE_STALE_DAYS:
            continue
        item_id = str(item.get("id") or item.get("item_id") or item.get("item_name"))
        volume = float(volumes.get(item_id, item.get("monthly_volume") or 0))
        if volume < 10:
            continue
        suggested = round((selling * (1 + REPRICE_MAX_INCREASE_PCT)) / 5) * 5
        monthly_gain = (suggested - selling) * volume
        candidates.append(
            {
                "item_id": item_id,
                "item_name": item.get("item_name"),
                "current_price": selling,
                "current_cost": cost,
                "suggested_price": float(suggested),
                "price_increase_pct": REPRICE_MAX_INCREASE_PCT * 100,
                "projected_monthly_gain_inr": round(monthly_gain, 2),
                "price_unchanged_days": stale,
                "cost_rise_pct": round(cost_rise * 100, 1),
            }
        )
    return sorted(candidates, key=lambda c: c["projected_monthly_gain_inr"], reverse=True)
