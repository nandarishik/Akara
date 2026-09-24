"""Kasavana & Smith (1982) menu engineering. Code written from scratch."""

from __future__ import annotations

from decimal import Decimal

import pandas as pd

from app.domain.intelligence.schemas import KasavanaSmithItem


def compute_kasavana_smith_matrix(
    orders_df: pd.DataFrame,
    menu_items_df: pd.DataFrame,
) -> list[KasavanaSmithItem]:
    if orders_df is None or orders_df.empty:
        return []
    item_agg = (
        orders_df.groupby("item_id")
        .agg(
            total_qty=("quantity", "sum"),
            total_revenue=("revenue", "sum"),
            total_food_cost=("food_cost", "sum"),
        )
        .reset_index()
    )
    menu = menu_items_df.rename(columns={"id": "menu_id"}) if "id" in menu_items_df.columns else menu_items_df
    if "item_name" not in item_agg.columns and "item_name" in orders_df.columns:
        names = orders_df.groupby("item_id")["item_name"].first().reset_index()
        item_agg = item_agg.merge(names, on="item_id", how="left")
    if "category" not in item_agg.columns:
        if not menu.empty and "category" in menu.columns:
            item_agg = item_agg.merge(
                menu[["menu_id", "item_name", "category"]].rename(columns={"menu_id": "item_id"}),
                on="item_id",
                how="left",
                suffixes=("", "_m"),
            )
        else:
            item_agg["category"] = ""
            if "item_name" not in item_agg.columns:
                item_agg["item_name"] = item_agg["item_id"]

    total_menu_items = len(item_agg)
    if total_menu_items == 0:
        return []
    qty_sum = float(item_agg["total_qty"].sum())
    avg_qty = qty_sum / total_menu_items if total_menu_items else 0
    item_agg["popularity_index"] = item_agg["total_qty"] / avg_qty if avg_qty else 0
    item_agg["avg_cm"] = (item_agg["total_revenue"] - item_agg["total_food_cost"]) / item_agg[
        "total_qty"
    ].replace(0, 1)
    avg_cm = float(item_agg["avg_cm"].mean())
    item_agg["cm_index"] = item_agg["avg_cm"] / avg_cm if avg_cm > 0 else 0.0

    def classify(row: pd.Series) -> str:
        if row["popularity_index"] >= 1.0 and row["cm_index"] >= 1.0:
            return "star"
        if row["popularity_index"] >= 1.0 and row["cm_index"] < 1.0:
            return "plowhorse"
        if row["popularity_index"] < 1.0 and row["cm_index"] >= 1.0:
            return "puzzle"
        return "dog"

    item_agg["quadrant"] = item_agg.apply(classify, axis=1)
    out: list[KasavanaSmithItem] = []
    for _, row in item_agg.iterrows():
        out.append(
            KasavanaSmithItem(
                item_id=str(row["item_id"]),
                item_name=str(row.get("item_name") or row["item_id"]),
                category=str(row.get("category") or ""),
                popularity_index=round(float(row["popularity_index"]), 3),
                contribution_margin=Decimal(str(round(float(row["avg_cm"]), 2))),
                contribution_margin_index=round(float(row["cm_index"]), 3),
                quadrant=str(row["quadrant"]),
            )
        )
    return out
