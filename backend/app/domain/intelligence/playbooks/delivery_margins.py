"""Delivery margin — prefer canonical_channels rates else env 25/22."""

from __future__ import annotations

import pandas as pd

SWIGGY_DEFAULT_COMMISSION = 0.25
ZOMATO_DEFAULT_COMMISSION = 0.22


def analyse_delivery_margins(
    orders_df: pd.DataFrame,
    menu_items_df: pd.DataFrame | None = None,
    tenant_commission_config: dict | None = None,
) -> list[dict]:
    if orders_df is None or orders_df.empty:
        return []
    cfg = tenant_commission_config or {}
    if "platform" not in orders_df.columns:
        return []
    delivery = orders_df[orders_df["platform"].isin(["swiggy", "zomato"])]
    if delivery.empty:
        return []
    item_agg = (
        delivery.groupby(["item_id", "platform"])
        .agg(
            total_qty=("quantity", "sum"),
            avg_selling_price=("unit_price", "mean")
            if "unit_price" in delivery.columns
            else ("revenue", "mean"),
            avg_food_cost=("food_cost", "mean"),
        )
        .reset_index()
    )
    negatives: list[dict] = []
    for _, row in item_agg.iterrows():
        platform = str(row["platform"])
        commission = float(
            cfg.get(
                platform,
                SWIGGY_DEFAULT_COMMISSION if platform == "swiggy" else ZOMATO_DEFAULT_COMMISSION,
            )
        )
        price = float(row["avg_selling_price"] or 0)
        food = float(row["avg_food_cost"] or 0)
        margin = price * (1 - commission) - food
        if margin < 0:
            negatives.append(
                {
                    "item_id": str(row["item_id"]),
                    "platform": platform,
                    "avg_selling_price": round(price, 2),
                    "commission_pct": round(commission * 100, 1),
                    "avg_food_cost": round(food, 2),
                    "delivery_margin": round(margin, 2),
                    "monthly_loss_inr": round(abs(margin) * float(row["total_qty"]), 2),
                    "suggestion": (
                        f"Consider raising delivery price by ₹{abs(margin) * 1.1:.0f} "
                        "or removing from delivery menu"
                    ),
                }
            )
    return sorted(negatives, key=lambda n: n["monthly_loss_inr"], reverse=True)
