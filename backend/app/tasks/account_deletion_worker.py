"""Process queued account deletions — cancel Razorpay, purge tenant data, delete user."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from app.core.tenant import get_supabase_service_client
from app.services.billing.checkout import cancel_subscription

logger = logging.getLogger(__name__)


def _purge_tenant_data(supa, tenant_id: str) -> None:
    supa.table("sales_data").delete().eq("tenant_id", tenant_id).execute()
    supa.table("conversations").delete().eq("tenant_id", tenant_id).execute()
    supa.table("chat_history").delete().eq("tenant_id", tenant_id).execute()
    supa.table("generated_reports").delete().eq("tenant_id", tenant_id).execute()
    supa.table("tenants").delete().eq("id", tenant_id).execute()


def process_deletion_queue(limit: int = 20) -> dict[str, int]:
    supa = get_supabase_service_client()
    pending = (
        supa.table("account_deletion_queue")
        .select("*")
        .eq("status", "pending")
        .order("requested_at")
        .limit(limit)
        .execute()
    )
    completed = failed = 0

    for row in pending.data or []:
        queue_id = row["id"]
        user_id = row["user_id"]
        tenant_id = row.get("tenant_id")
        try:
            profile = (
                supa.table("profiles")
                .select("role, tenant_id")
                .eq("id", user_id)
                .maybe_single()
                .execute()
            ).data
            effective_tenant = tenant_id or (profile or {}).get("tenant_id")

            if effective_tenant:
                try:
                    cancel_subscription(UUID(str(effective_tenant)), at_cycle_end=False)
                except Exception as exc:
                    logger.warning("Razorpay cancel skipped for tenant %s: %s", effective_tenant, exc)

                if profile and profile.get("role") == "admin":
                    admins = (
                        supa.table("profiles")
                        .select("id")
                        .eq("tenant_id", effective_tenant)
                        .eq("role", "admin")
                        .eq("membership_status", "active")
                        .execute()
                    )
                    if len(admins.data or []) <= 1:
                        _purge_tenant_data(supa, str(effective_tenant))

            supa.table("chat_history").delete().eq("user_id", user_id).execute()
            try:
                supa.auth.admin.sign_out(user_id)
            except Exception:
                pass
            supa.auth.admin.delete_user(user_id)

            supa.table("account_deletion_queue").update({
                "status": "completed",
                "completed_at": datetime.now(UTC).isoformat(),
            }).eq("id", queue_id).execute()
            completed += 1
        except Exception as exc:
            logger.exception("Account deletion failed queue=%s user=%s: %s", queue_id, user_id, exc)
            supa.table("account_deletion_queue").update({"status": "failed"}).eq(
                "id", queue_id
            ).execute()
            failed += 1

    stats = {"completed": completed, "failed": failed}
    logger.info("Account deletion queue processed: %s", stats)
    return stats


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(process_deletion_queue())
