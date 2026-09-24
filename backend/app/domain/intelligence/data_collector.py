"""Collect analyst frames from header+items canonical tables. No LLM."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any
from uuid import UUID

import pandas as pd


def _platform_from_channel(channel: str | None) -> str:
    raw = (channel or "").lower()
    if "swiggy" in raw:
        return "swiggy"
    if "zomato" in raw:
        return "zomato"
    if raw in {"delivery", "aggregator"}:
        return "delivery"
    return "direct"


def frames_from_rows(
    *,
    orders: list[dict[str, Any]],
    items: list[dict[str, Any]],
    menu: list[dict[str, Any]] | None = None,
    forecasts: list[dict[str, Any]] | None = None,
    anomalies: list[dict[str, Any]] | None = None,
    weather: dict[str, Any] | None = None,
    festivals: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Adapter: header order_time → order_date; item grain = item_name; revenue = line_total."""
    orders_by_id = {str(o.get("id")): o for o in orders}
    rows: list[dict[str, Any]] = []
    for it in items:
        header = orders_by_id.get(str(it.get("order_id")), {})
        order_time = header.get("order_time") or it.get("order_time")
        order_date = None
        if hasattr(order_time, "date"):
            order_date = order_time.date()
        elif isinstance(order_time, str) and len(order_time) >= 10:
            order_date = date.fromisoformat(order_time[:10])
        item_name = str(it.get("item_name") or "")
        qty = float(it.get("quantity") or 0)
        revenue = float(it.get("line_total") or it.get("revenue") or 0)
        food_cost = float(it.get("food_cost") or 0)
        channel = header.get("channel") or it.get("channel")
        rows.append(
            {
                "item_id": item_name,
                "item_name": item_name,
                "category": it.get("category") or "",
                "quantity": qty,
                "revenue": revenue,
                "food_cost": food_cost,
                "unit_price": float(it.get("unit_price") or 0),
                "order_date": order_date,
                "channel": channel,
                "platform": _platform_from_channel(str(channel or "")),
                "location_id": header.get("location_id"),
            }
        )
    orders_df = pd.DataFrame(rows)
    menu_df = pd.DataFrame(menu or [])
    if not menu_df.empty and "id" not in menu_df.columns and "item_name" in menu_df.columns:
        menu_df = menu_df.assign(id=menu_df["item_name"])
    data_days = 0
    if not orders_df.empty and "order_date" in orders_df.columns:
        dates = orders_df["order_date"].dropna()
        if len(dates):
            data_days = int((dates.max() - dates.min()).days) + 1
    return {
        "orders": orders_df,
        "menu": menu_df,
        "forecasts": pd.DataFrame(forecasts or []),
        "anomalies": anomalies or [],
        "weather": weather,
        "festivals": festivals or [],
        "data_days": data_days,
    }


def collect_for_tenant(tenant_id: UUID, client: Any | None = None) -> dict[str, Any]:
    """Load last 90d orders + menu + 7d forecasts/anomalies + weather + festivals.

    When ``client`` is None, returns empty frames (tests inject frames_from_rows).
    Weather cache miss → weather None (playbook returns []).
    Tenant-owned tables are always filtered by ``tenant_id`` (service-role client
    bypasses RLS). ``festival_calendar`` and ``weather_cache`` are global.
    """
    if client is None:
        return frames_from_rows(orders=[], items=[])
    tid = str(tenant_id)
    today = date.today()
    start = today - timedelta(days=90)
    orders = (
        client.table("canonical_orders")
        .select("id,order_time,channel,location_id,total_amount")
        .eq("tenant_id", tid)
        .gte("order_time", start.isoformat())
        .execute()
        .data
        or []
    )
    order_ids = [o["id"] for o in orders]
    items: list[dict[str, Any]] = []
    if order_ids:
        items = (
            client.table("canonical_order_items")
            .select("order_id,item_name,quantity,unit_price,line_total,category")
            .eq("tenant_id", tid)
            .in_("order_id", order_ids)
            .execute()
            .data
            or []
        )
    menu = (
        client.table("menu_items")
        .select("*")
        .eq("tenant_id", tid)
        .execute()
        .data
        or []
    )
    forecasts = (
        client.table("forecasts")
        .select("*")
        .eq("tenant_id", tid)
        .gte("forecast_date", today.isoformat())
        .lte("forecast_date", (today + timedelta(days=7)).isoformat())
        .execute()
        .data
        or []
    )
    try:
        anomalies = (
            client.table("alert_anomalies")
            .select("*")
            .eq("tenant_id", tid)
            .gte("detected_at", (today - timedelta(days=7)).isoformat())
            .execute()
            .data
            or []
        )
    except Exception:
        anomalies = []
    weather = None
    try:
        wrows = (
            client.table("weather_cache")
            .select("*")
            .gte("cache_date", today.isoformat())
            .lte("cache_date", (today + timedelta(days=1)).isoformat())
            .execute()
            .data
            or []
        )
        if wrows:
            row = wrows[0]
            weather = {
                "temp_max_c": row.get("temp_max_c"),
                "precipitation_mm": row.get("precipitation_mm"),
                "is_rainy": float(row.get("precipitation_mm") or 0) > 0,
            }
    except Exception:
        weather = None
    festivals = (
        client.table("festival_calendar")
        .select("*")
        .gte("festival_date", today.isoformat())
        .lte("festival_date", (today + timedelta(days=14)).isoformat())
        .execute()
        .data
        or []
    )
    return frames_from_rows(
        orders=orders,
        items=items,
        menu=menu,
        forecasts=forecasts,
        anomalies=anomalies,
        weather=weather,
        festivals=festivals,
    )
