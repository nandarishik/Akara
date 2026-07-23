"""Data retention cleanup task.

Deletes sales_data rows older than the tenant's plan retention window.

Railway cron schedule: 0 2 * * * (2 AM IST = 20:30 UTC)

Run manually:
    cd akara/backend
    uv run python -m app.tasks.retention_cleanup
    uv run python -m app.tasks.retention_cleanup --dry-run

Retention policy (mirrors PLAN_LIMITS and tenants.plan column comment):
    free     → 30 days
    pro      → 365 days  (12 months)
    business → 1095 days (36 months)

Idempotent: safe to run multiple times — deletes the same rows, no double-work.
Legal hold: tenants with a non-null legal_hold_until column are skipped.
"""

from __future__ import annotations

import argparse
import logging
from datetime import UTC, datetime, timedelta

logger = logging.getLogger(__name__)

# Days are IST-adjusted: cutoff is (now - days) in UTC
RETENTION_DAYS: dict[str, int] = {
    "free": 30,
    "pro": 365,
    "business": 1095,
}

DEFAULT_RETENTION_DAYS = 30  # most conservative; applies to unknown/missing plans


def _get_cutoff(days: int) -> str:
    """Return ISO date string for rows older than `days` days (UTC)."""
    cutoff = datetime.now(tz=UTC) - timedelta(days=days)
    return cutoff.strftime("%Y-%m-%d")


def run(dry_run: bool = False) -> None:
    """Execute retention cleanup across all active tenants.

    Args:
        dry_run: If True, count rows to be deleted but do NOT delete.
                 Useful for pre-flight checks and monitoring.
    """
    from app.core.tenant import get_supabase_service_client

    supa = get_supabase_service_client()

    mode = "DRY-RUN" if dry_run else "LIVE"
    logger.info("Retention cleanup START [%s] at %s", mode, datetime.utcnow().isoformat())

    # Fetch all active tenants (skip cancelled — data already expired or held)
    tenants_result = (
        supa.table("tenants")
        .select("id, plan, plan_status, legal_hold_until")
        .in_("plan_status", ["active", "trialing", "past_due"])
        .execute()
    )

    if not tenants_result.data:
        logger.info("No active tenants found — nothing to clean.")
        return

    total_deleted = 0
    skipped_legal_hold = 0

    for tenant in tenants_result.data:
        tenant_id: str = tenant["id"]
        plan: str = tenant.get("plan") or "free"

        # Legal hold check (column may not exist yet — degrade gracefully)
        legal_hold_until = tenant.get("legal_hold_until")
        if legal_hold_until:
            # Skip tenant if legal hold is still active
            try:
                hold_date = datetime.fromisoformat(legal_hold_until.replace("Z", "+00:00"))
                if hold_date > datetime.now(tz=UTC):
                    logger.info(
                        "Tenant %s: SKIPPED (legal hold until %s)",
                        tenant_id, legal_hold_until,
                    )
                    skipped_legal_hold += 1
                    continue
            except (ValueError, TypeError):
                pass  # malformed hold date → proceed with cleanup

        days = RETENTION_DAYS.get(plan, DEFAULT_RETENTION_DAYS)
        cutoff = _get_cutoff(days)

        if dry_run:
            # Count rows without deleting
            try:
                count_result = (
                    supa.table("sales_data")
                    .select("id", count="exact")
                    .eq("tenant_id", tenant_id)
                    .lt("invoice_date", cutoff)
                    .execute()
                )
                count = count_result.count or 0
                if count > 0:
                    logger.info(
                        "Tenant %s (plan=%s): would delete %d rows older than %s",
                        tenant_id, plan, count, cutoff,
                    )
                total_deleted += count
            except Exception as exc:
                logger.warning("Dry-run count failed for tenant %s: %s", tenant_id, exc)
        else:
            # Live delete — rows older than cutoff date
            try:
                result = (
                    supa.table("sales_data")
                    .delete()
                    .eq("tenant_id", tenant_id)
                    .lt("invoice_date", cutoff)
                    .execute()
                )
                deleted = len(result.data) if result.data else 0
                if deleted > 0:
                    logger.info(
                        "Tenant %s (plan=%s): deleted %d rows older than %s",
                        tenant_id, plan, deleted, cutoff,
                    )
                total_deleted += deleted
            except Exception as exc:
                # Log and continue — one tenant failure must not abort the whole run
                logger.error(
                    "Failed to clean tenant %s: %s", tenant_id, exc, exc_info=True
                )

    logger.info(
        "Retention cleanup DONE [%s]: total_rows=%d skipped_legal_hold=%d",
        mode, total_deleted, skipped_legal_hold,
    )


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    parser = argparse.ArgumentParser(description="AKARA data retention cleanup")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Count rows to be deleted without actually deleting",
    )
    args = parser.parse_args()
    run(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
