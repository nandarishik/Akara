"""Daily alert evaluator — checks tenant_alerts and sends email notifications."""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from app.core.cron_ping import ping_cron_health
from app.core.tenant import get_supabase_service_client
from app.domain.alerts.metrics import check_condition, get_metric_value
from app.infra.notifications import send_alert_triggered_email

logger = logging.getLogger(__name__)


def _resolve_admin_email(supa, tenant_id: str) -> str | None:
    profiles = (
        supa.table("profiles")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("role", "admin")
        .limit(1)
        .execute()
    )
    if not profiles.data:
        return None
    try:
        user = supa.auth.admin.get_user_by_id(profiles.data[0]["id"])
        return user.user.email if user and user.user else None
    except Exception as exc:
        logger.warning("Could not resolve admin email for %s: %s", tenant_id, exc)
        return None


def _in_cooldown(alert: dict) -> bool:
    last = alert.get("last_triggered")
    if not last:
        return False
    try:
        parsed = datetime.fromisoformat(str(last).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        hours = int(alert.get("cooldown_hours") or 24)
        return datetime.now(UTC) - parsed < timedelta(hours=hours)
    except ValueError:
        return False


def evaluate_alerts() -> dict[str, int]:
    supa = get_supabase_service_client()
    alerts = supa.table("tenant_alerts").select("*").eq("is_active", True).execute()
    triggered = 0
    skipped = 0
    errors = 0

    for alert in alerts.data or []:
        alert_id = alert["id"]
        tenant_id = alert["tenant_id"]
        try:
            if _in_cooldown(alert):
                skipped += 1
                continue

            current = get_metric_value(
                tenant_id=__import__("uuid").UUID(str(tenant_id)),
                metric=alert["metric"],
                dimension=alert.get("dimension"),
            )
            threshold = Decimal(str(alert["threshold"]))
            if not check_condition(current, alert["condition"], threshold):
                continue

            try:
                supa.table("alert_trigger_events").insert({
                    "tenant_id": tenant_id,
                    "alert_id": alert_id,
                    "metric_value": float(current),
                    "threshold": float(threshold),
                    "channel": "email",
                    "status": "sent",
                }).execute()
            except Exception as exc:
                if "duplicate" in str(exc).lower() or "unique" in str(exc).lower():
                    skipped += 1
                    continue
                raise

            email = _resolve_admin_email(supa, tenant_id)
            if email and "email" in (alert.get("delivery") or ["email"]):
                send_alert_triggered_email(
                    email,
                    alert["name"],
                    alert["metric"],
                    current,
                    threshold,
                    alert["condition"],
                    tenant_id=__import__("uuid").UUID(str(tenant_id)),
                )

            delivery = alert.get("delivery") or ["email"]
            if "whatsapp" in delivery:
                admin_profile = (
                    supa.table("profiles")
                    .select("id, phone_number, preferences")
                    .eq("tenant_id", tenant_id)
                    .eq("role", "admin")
                    .limit(1)
                    .execute()
                )
                if admin_profile.data:
                    prof = admin_profile.data[0]
                    prefs = prof.get("preferences") or {}
                    phone = prof.get("phone_number")
                    if phone and prefs.get("whatsapp_alerts_enabled", True):
                        import asyncio
                        from app.infra.notifications.whatsapp import send_alert_whatsapp

                        try:
                            loop = asyncio.get_event_loop()
                        except RuntimeError:
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                        loop.run_until_complete(
                            send_alert_whatsapp(
                                phone=phone,
                                alert_name=alert["name"],
                                metric=alert["metric"],
                                current=str(current),
                                threshold=str(threshold),
                                tenant_id=__import__("uuid").UUID(str(tenant_id)),
                                user_id=__import__("uuid").UUID(prof["id"]),
                            )
                        )

            supa.table("tenant_alerts").update({
                "last_triggered": datetime.now(UTC).isoformat(),
            }).eq("id", alert_id).execute()
            triggered += 1
        except Exception as exc:
            logger.error("Alert evaluation failed for %s: %s", alert_id, exc)
            errors += 1

    return {"triggered": triggered, "skipped": skipped, "errors": errors}


async def alert_evaluator_loop(interval_seconds: int = 86400) -> None:
    while True:
        try:
            stats = evaluate_alerts()
            logger.info("Alert evaluator complete: %s", stats)
            ping_cron_health("alerts")
        except Exception as exc:
            logger.exception("Alert evaluator cycle failed: %s", exc)
            raise
        await asyncio.sleep(interval_seconds)


def run_alert_evaluator_cycle() -> dict[str, int]:
    return evaluate_alerts()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    stats = run_alert_evaluator_cycle()
    print(stats)
    ping_cron_health("alerts")
