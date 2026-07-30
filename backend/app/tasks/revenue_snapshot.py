"""Daily revenue snapshot — upserts into revenue_snapshots."""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime

from app.core.cron_ping import ping_cron_health
from app.core.tenant import get_supabase_service_client
from app.services.superadmin.revenue import compute_revenue_summary

logger = logging.getLogger(__name__)


def run_revenue_snapshot() -> dict:
    summary = compute_revenue_summary()
    today = date.today().isoformat()
    supa = get_supabase_service_client()
    row = {
        "snapshot_date": today,
        "mrr_inr": summary["mrr_inr"],
        "arr_inr": summary["arr_inr"],
        "tenant_count": summary["total_active_tenants"],
        "llm_cost_usd": summary["total_llm_cost_usd_this_month"],
    }
    supa.table("revenue_snapshots").upsert(row, on_conflict="snapshot_date").execute()
    logger.info("Revenue snapshot upserted for %s", today)
    return {"ok": True, "snapshot_date": today, **row}


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    try:
        details = run_revenue_snapshot()
        ping_cron_health("revenue_snapshot", details=details)
    except Exception:
        logger.exception("Revenue snapshot failed")
        ping_cron_health("revenue_snapshot", status="failed")
        raise


if __name__ == "__main__":
    main()
