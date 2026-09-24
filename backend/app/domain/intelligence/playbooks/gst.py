"""GST optimisation — advisory only. Every item includes Consult your CA."""

from __future__ import annotations

import pandas as pd

GST_SLABS = {
    "restaurant_ac": 0.05,
    "restaurant_non_ac": 0.05,
    "restaurant_alcohol": 0.18,
    "bakery_branded": 0.12,
    "bakery_unbranded": 0.00,
    "packaged_food": 0.05,
    "beverages_non_alcohol": 0.12,
    "ice_cream": 0.18,
}

GST_DISCLAIMER = "Consult your CA before changing GST categories."


def _suggest_optimal_gst_category(item: pd.Series) -> tuple[float, str, str]:
    name = str(item.get("item_name") or "").lower()
    category = str(item.get("category") or "").lower()
    current = str(item.get("gst_category") or "restaurant_ac")
    if "bakery" in category or "pastry" in name or "cake" in name:
        return 0.00, "Packaged bakery may qualify as bakery_unbranded.", "bakery_unbranded"
    if "ice cream" in name or "icecream" in name:
        return GST_SLABS.get(current, 0.05), "Ice cream stays at current slab.", current
    return GST_SLABS.get(current, 0.05), "No lower slab identified.", current


def generate_gst_optimisations(menu_items_df: pd.DataFrame) -> list[dict]:
    if menu_items_df is None or menu_items_df.empty:
        return []
    out: list[dict] = []
    for _, item in menu_items_df.iterrows():
        current_cat = item.get("gst_category") or "restaurant_ac"
        current_gst = GST_SLABS.get(str(current_cat), 0.05)
        optimal_gst, rationale, suggested_cat = _suggest_optimal_gst_category(item)
        row = {
            "item_id": str(item.get("id") or item.get("item_name")),
            "item_name": item.get("item_name"),
            "current_gst_category": current_cat,
            "current_gst_rate": current_gst,
            "suggested_gst_category": suggested_cat,
            "suggested_gst_rate": optimal_gst,
            "rationale": rationale,
            "projected_annual_saving_inr": round(
                float(item.get("annual_revenue") or 0) * max(0.0, current_gst - optimal_gst),
                2,
            ),
            "disclaimer": GST_DISCLAIMER,
        }
        out.append(row)
    return [r for r in out if r["disclaimer"] == GST_DISCLAIMER]
