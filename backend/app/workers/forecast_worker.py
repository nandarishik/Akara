"""Daily forecast worker — register on cron_intelligence (02:00 IST / 20:30 UTC)."""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from app.core.tenant import get_supabase_service_client
from app.domain.intelligence.forecast import (
    consecutive_days,
    forecast_skip_reason,
    run_autoarima,
    unique_id,
)
from app.domain.intelligence.worker_runs import finish_run, start_run

logger = logging.getLogger("akara.workers.forecast")


def _history_for_series(supa, tenant_id: str, item_id: str, location_id: str | None) -> list[tuple[date, float]]:
    q = (
        supa.table("canonical_order_items")
        .select("line_total, canonical_orders!inner(order_time, location_id, tenant_id)")
        .eq("tenant_id", tenant_id)
        .eq("item_name", item_id)
    )
    try:
        rows = q.execute().data or []
    except Exception:
        logger.warning("forecast_history_query_failed tenant=%s", tenant_id)
        return []
    by_day: dict[date, float] = {}
    for row in rows:
        order = row.get("canonical_orders") or {}
        raw = order.get("order_time")
        if not raw:
            continue
        day = date.fromisoformat(str(raw)[:10])
        by_day[day] = by_day.get(day, 0.0) + float(row.get("line_total") or 0)
    return sorted(by_day.items())


def run_forecast_worker(*, n_jobs: int = 1) -> dict[str, Any]:
    run = start_run("forecast_worker")
    logger.info("worker_start worker=forecast_worker")
    supa = get_supabase_service_client()
    tenants = supa.table("tenants").select("id").execute().data or []
    series_total = 0
    for tenant in tenants:
        tid = tenant["id"]
        try:
            items = (
                supa.table("canonical_order_items")
                .select("item_name")
                .eq("tenant_id", tid)
                .limit(200)
                .execute()
                .data
                or []
            )
            names = {r["item_name"] for r in items if r.get("item_name")}
            for name in names:
                hist = _history_for_series(supa, tid, name, None)
                days = consecutive_days([d for d, _ in hist])
                reason = forecast_skip_reason(days)
                if reason:
                    logger.info(
                        "forecast_skip_reason=%s tenant=%s item=%s unique_id=%s",
                        reason,
                        tid,
                        name,
                        unique_id(name, None),
                    )
                    continue
                rows = run_autoarima(hist, n_jobs=n_jobs)
                for row in rows:
                    supa.table("forecasts").upsert(
                        {
                            "tenant_id": tid,
                            "location_id": None,
                            "item_id": name,
                            "forecast_date": row["forecast_date"],
                            "predicted_revenue": row["predicted_revenue"],
                            "confidence_interval_low": row["confidence_interval_low"],
                            "confidence_interval_high": row["confidence_interval_high"],
                            "model_used": "AutoARIMA",
                        }
                    ).execute()
                    series_total += 1
            run["tenants_processed"] += 1
            run["success_count"] += 1
        except Exception:
            logger.exception("tenant_processed failed tenant=%s", tid)
            run["errors_count"] += 1
    finish_run(run, status="success" if run["errors_count"] == 0 else "failed", forecast_series_total=series_total)
    try:
        supa.table("worker_runs").insert(run).execute()
    except Exception:
        logger.warning("worker_runs insert skipped")
    logger.info("worker_complete worker=forecast_worker series=%s", series_total)
    return run
