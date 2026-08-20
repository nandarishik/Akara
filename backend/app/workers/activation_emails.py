"""Daily activation emails — E8/E9 (Day 1/3), Day 7 phone nudge, Day 14 upgrade nudge."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.config import settings
from app.core.cron_ping import ping_cron_health
from app.core.plan_limits import PLAN_LIMITS
from app.core.tenant import get_supabase_service_client
from app.domain.billing.email import _send
from app.infra.notifications.delivery_log import log_delivery

logger = logging.getLogger(__name__)

_TEMPLATE_DIR = Path(__file__).parent.parent / "services" / "email" / "templates"

STAGES = (
    ("day0_welcome", None, "activation_day0.html", "Welcome to AKARA — let's get started", 0),
    ("day1_no_import", "first_import", "activation_day1.html", "Upload your first file to AKARA", 1),
    ("day3_no_copilot", "first_copilot", "activation_day3.html", "Ask AKARA Copilot your first question", 3),
    ("day7_no_phone", "first_debrief", "activation_day7.html", "Add your phone for WhatsApp debrief", 7),
    ("day14_upgrade_nudge", None, "activation_day14.html", "Upgrade for unlimited Copilot", 14),
)


def _days_since_signup(created_at: str) -> int:
    start = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    return (datetime.now(UTC) - start).days


def _already_sent(supa, user_id: str, stage: str) -> bool:
    res = (
        supa.table("activation_send_ledger")
        .select("id")
        .eq("user_id", user_id)
        .eq("stage", stage)
        .maybe_single()
        .execute()
    )
    return bool(res.data)


def _record_sent(supa, user_id: str, stage: str) -> None:
    supa.table("activation_send_ledger").insert({
        "user_id": user_id,
        "stage": stage,
    }).execute()


def _has_event(supa, user_id: str, event: str) -> bool:
    res = (
        supa.table("user_events")
        .select("event")
        .eq("user_id", user_id)
        .eq("event", event)
        .maybe_single()
        .execute()
    )
    return bool(res.data)


def _tenant_plan(supa, tenant_id: str) -> str:
    try:
        res = (
            supa.table("tenants")
            .select("plan")
            .eq("id", tenant_id)
            .single()
            .execute()
        )
        return (res.data or {}).get("plan", "free")
    except Exception:
        return "free"


def _copilot_usage_pct(supa, tenant_id: str) -> float:
    try:
        usage = supa.rpc("get_current_usage", {"p_tenant_id": tenant_id}).execute()
        data = usage.data or {}
        used = int(data.get("copilot_calls") or 0)
        limit = PLAN_LIMITS.get("free", {}).get("copilot_calls_per_month", 15)
        if limit <= 0:
            return 0.0
        return used / limit * 100
    except Exception:
        return 0.0


def _should_send_stage(
    supa,
    profile: dict,
    stage: str,
    required_event: str | None,
    min_days: int,
    days: int,
    email: str,
) -> bool:
    if days < min_days:
        return False
    if _already_sent(supa, profile["id"], stage):
        return False

    if stage == "day0_welcome":
        return days == 0

    if stage == "day7_no_phone":
        if _has_event(supa, profile["id"], "first_debrief"):
            return False
        phone = profile.get("phone_number")
        return not phone or not str(phone).strip()

    if stage == "day14_upgrade_nudge":
        tenant_id = profile.get("tenant_id")
        if not tenant_id:
            return False
        if _tenant_plan(supa, tenant_id) != "free":
            return False
        return _copilot_usage_pct(supa, tenant_id) >= 80.0

    if required_event and _has_event(supa, profile["id"], required_event):
        return False
    return True


def run_activation_emails() -> dict[str, int]:
    supa = get_supabase_service_client()
    jinja = Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        autoescape=select_autoescape(["html"]),
    )
    frontend = settings.customer_frontend_url.rstrip("/")
    sent = skipped = errors = 0

    profiles = (
        supa.table("profiles")
        .select("id, created_at, tenant_id, phone_number, display_name")
        .not_.is_("tenant_id", "null")
        .execute()
    )

    for profile in profiles.data or []:
        user_id = profile["id"]
        days = _days_since_signup(profile.get("created_at", datetime.now(UTC).isoformat()))
        try:
            auth_user = supa.auth.admin.get_user_by_id(user_id)
            email = auth_user.user.email if auth_user and auth_user.user else None
        except Exception:
            email = None
        if not email:
            skipped += 1
            continue

        for stage, required_event, template_name, subject, min_days in STAGES:
            if not _should_send_stage(
                supa, profile, stage, required_event, min_days, days, email
            ):
                continue

            try:
                extra: dict = {"dashboard_url": frontend}
                if stage in ("day0_welcome", "day1_no_import"):
                    extra["name"] = profile.get("display_name") or "there"
                if stage == "day14_upgrade_nudge":
                    tenant_id = profile.get("tenant_id")
                    extra["usage_pct"] = int(_copilot_usage_pct(supa, tenant_id or ""))
                html = jinja.get_template(template_name).render(**extra)
                ok = _send(email, f"AKARA — {subject}", html)
                if ok:
                    _record_sent(supa, user_id, stage)
                    log_delivery(
                        channel="email",
                        template=stage,
                        status="sent",
                        tenant_id=profile.get("tenant_id"),
                        user_id=__import__("uuid").UUID(user_id),
                    )
                    sent += 1
                else:
                    errors += 1
            except Exception as exc:
                logger.error("Activation email failed user=%s stage=%s: %s", user_id, stage, exc)
                errors += 1

    stats = {"sent": sent, "skipped": skipped, "errors": errors}
    logger.info("Activation emails complete: %s", stats)
    ping_cron_health("activation_emails", status="ok" if errors == 0 else "partial")
    return stats


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(run_activation_emails())
