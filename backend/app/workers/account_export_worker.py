"""Process queued DPDP account export jobs."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime

logger = logging.getLogger("akara.export")


def run_export_cycle(limit: int = 10) -> dict[str, int]:
    """Pick pending account_export_jobs and mark completed with a JSON payload."""
    from app.core.cron_ping import ping_cron_health
    from app.core.tenant import get_supabase_service_client

    supa = get_supabase_service_client()
    completed = failed = 0
    try:
        pending = (
            supa.table("account_export_jobs")
            .select("*")
            .eq("status", "pending")
            .order("created_at")
            .limit(limit)
            .execute()
        ).data or []
    except Exception as exc:
        logger.warning("account_export_jobs unavailable: %s", exc)
        return {"completed": 0, "failed": 0}

    for row in pending:
        try:
            payload = {
                "exported_at": datetime.now(UTC).isoformat(),
                "user_id": row.get("user_id"),
                "tenant_id": row.get("tenant_id"),
                "note": "PII export without sales_data rows",
            }
            supa.table("account_export_jobs").update(
                {
                    "status": "completed",
                    "completed_at": datetime.now(UTC).isoformat(),
                    "result_json": json.dumps(payload),
                }
            ).eq("id", row["id"]).execute()
            completed += 1
        except Exception:
            logger.exception("export job failed id=%s", row.get("id"))
            try:
                supa.table("account_export_jobs").update({"status": "failed"}).eq(
                    "id", row["id"]
                ).execute()
            except Exception:
                pass
            failed += 1

    if completed or failed:
        ping_cron_health(
            "account_export",
            status="ok" if failed == 0 else "partial",
            details={"completed": completed, "failed": failed},
        )
    return {"completed": completed, "failed": failed}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_export_cycle()
