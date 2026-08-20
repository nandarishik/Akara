"""Weekly debrief orchestration — compute, synthesize, store, deliver."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from jinja2 import Environment, FileSystemLoader, select_autoescape
from supabase import Client

from app.core.config import settings
from app.core.plan_limits import get_limit
from app.core.time_utils import last_completed_week_ist
from app.domain.billing.email import _send
from app.domain.debrief.engine import WeeklyDebriefEngine, format_inr
from app.domain.debrief.synthesizer import synthesize_metadata
from app.infra.notifications.delivery_log import log_delivery
from app.infra.notifications.whatsapp import send_weekly_debrief_whatsapp
from app.domain.user_events import record_user_event

logger = logging.getLogger(__name__)

_TEMPLATE_DIR = Path(__file__).parent.parent / "email" / "templates"


@dataclass
class DebriefResult:
    status: str
    report_id: str | None = None
    week_start: str = ""
    week_end: str = ""
    email_delivery: str = "skipped"
    whatsapp_delivery: str = "skipped"
    message: str = ""


class WeeklyDebriefService:
    def __init__(self, supabase: Client) -> None:
        self._sb = supabase
        self._engine = WeeklyDebriefEngine(supabase)
        self._jinja = Environment(
            loader=FileSystemLoader(str(_TEMPLATE_DIR)),
            autoescape=select_autoescape(["html"]),
        )

    def _tenant_plan(self, tenant_id: UUID) -> tuple[str, dict]:
        row = (
            self._sb.table("tenants")
            .select("plan, feature_overrides")
            .eq("id", str(tenant_id))
            .single()
            .execute()
        ).data or {}
        return row.get("plan") or "free", row.get("feature_overrides") or {}

    def _lifetime_debriefs(self, tenant_id: UUID) -> int:
        usage = self._sb.rpc("get_current_usage", {"p_tenant_id": str(tenant_id)}).execute()
        data = usage.data if isinstance(usage.data, dict) else {}
        return int(data.get("debrief_count") or 0)

    def _report_exists(self, tenant_id: UUID, week_start: str) -> bool:
        res = (
            self._sb.table("generated_reports")
            .select("id")
            .eq("tenant_id", str(tenant_id))
            .eq("report_type", "weekly_debrief")
            .contains("metadata", {"week_start": week_start})
            .limit(1)
            .execute()
        )
        return bool(res.data)

    def _can_generate(self, tenant_id: UUID, force: bool = False) -> tuple[bool, str]:
        plan, _ = self._tenant_plan(tenant_id)
        lifetime_limit = get_limit(plan, "weekly_debriefs_lifetime")
        if lifetime_limit != -1:
            count = self._lifetime_debriefs(tenant_id)
            if count >= lifetime_limit and not force:
                return False, "lifetime_limit_reached"

        week_start, _ = last_completed_week_ist()
        if self._report_exists(tenant_id, week_start.isoformat()) and not force:
            return False, "already_generated"

        return True, "ok"

    async def generate_for_tenant(
        self,
        tenant_id: UUID,
        *,
        force_regenerate: bool = False,
        manual: bool = False,
    ) -> DebriefResult:
        allowed, reason = self._can_generate(tenant_id, force=force_regenerate)
        if not allowed:
            return DebriefResult(status="skipped", message=reason)

        computed = self._engine.compute(tenant_id)
        week_start = computed.week_start.isoformat()
        week_end = computed.week_end.isoformat()

        if computed.days_of_data < 7:
            return DebriefResult(
                status="skipped_insufficient_data",
                week_start=week_start,
                week_end=week_end,
                message="Fewer than 7 days of data",
            )

        metadata = await synthesize_metadata(computed, tenant_id=tenant_id)
        metadata["generated_at"] = datetime.now(UTC).isoformat()
        if manual:
            metadata["manual_trigger"] = True

        title = f"Weekly Debrief — {computed.week_start.strftime('%d %b')} – {computed.week_end.strftime('%d %b %Y')}"
        insert = (
            self._sb.table("generated_reports")
            .insert({
                "tenant_id": str(tenant_id),
                "report_type": "weekly_debrief",
                "title": title,
                "metadata": metadata,
            })
            .execute()
        )
        report_id = insert.data[0]["id"] if insert.data else None

        if not force_regenerate:
            try:
                self._sb.rpc(
                    "increment_usage",
                    {
                        "p_tenant_id": str(tenant_id),
                        "p_field": "debrief_count",
                        "p_amount": 1,
                    },
                ).execute()
            except Exception as exc:
                logger.warning("Could not increment debrief_count: %s", exc)

        email_status, whatsapp_status = await self._deliver(tenant_id, metadata, report_id)

        admin_id = self._primary_admin_id(tenant_id)
        if admin_id:
            record_user_event(UUID(admin_id), "first_debrief")

        return DebriefResult(
            status="ok",
            report_id=report_id,
            week_start=week_start,
            week_end=week_end,
            email_delivery=email_status,
            whatsapp_delivery=whatsapp_status,
            message="Generated",
        )

    def _primary_admin_id(self, tenant_id: UUID) -> str | None:
        res = (
            self._sb.table("profiles")
            .select("id")
            .eq("tenant_id", str(tenant_id))
            .eq("role", "admin")
            .eq("membership_status", "active")
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0]["id"]
        return None

    def _delivery_sent(
        self, tenant_id: UUID, week_start: str, user_id: UUID, channel: str
    ) -> bool:
        try:
            res = (
                self._sb.table("debrief_delivery_ledger")
                .select("id")
                .eq("tenant_id", str(tenant_id))
                .eq("week_start", week_start)
                .eq("user_id", str(user_id))
                .eq("channel", channel)
                .maybe_single()
                .execute()
            )
            return bool(res.data)
        except Exception:
            return False

    def _record_delivery(
        self, tenant_id: UUID, week_start: str, user_id: UUID, channel: str
    ) -> None:
        try:
            self._sb.table("debrief_delivery_ledger").insert({
                "tenant_id": str(tenant_id),
                "week_start": week_start,
                "user_id": str(user_id),
                "channel": channel,
            }).execute()
        except Exception as exc:
            if "duplicate" not in str(exc).lower():
                logger.warning("Could not record debrief delivery: %s", exc)

    async def _deliver(
        self,
        tenant_id: UUID,
        metadata: dict,
        report_id: str | None,
    ) -> tuple[str, str]:
        recipients = (
            self._sb.table("profiles")
            .select("id, preferences, phone_number, display_name")
            .eq("tenant_id", str(tenant_id))
            .eq("role", "admin")
            .eq("membership_status", "active")
            .execute()
        ).data or []

        email_status = "skipped"
        whatsapp_status = "skipped"
        frontend = settings.customer_frontend_url.rstrip("/")
        debrief_url = f"{frontend}/debrief"
        week_start = metadata.get("week_start", "")

        for profile in recipients:
            prefs = profile.get("preferences") or {}
            user_id = UUID(profile["id"])
            email = self._user_email(profile["id"])
            if not email:
                continue

            if prefs.get("email_debrief_enabled", True):
                if not self._delivery_sent(tenant_id, week_start, user_id, "email"):
                    ok = self._send_email(email, metadata, debrief_url)
                    log_delivery(
                        channel="email",
                        template="weekly_debrief",
                        status="sent" if ok else "failed",
                        tenant_id=tenant_id,
                        user_id=user_id,
                    )
                    if ok:
                        self._record_delivery(tenant_id, week_start, user_id, "email")
                    email_status = "sent" if ok else "failed"

            phone = profile.get("phone_number")
            if phone and prefs.get("whatsapp_debrief_enabled", True):
                if not self._delivery_sent(tenant_id, week_start, user_id, "whatsapp"):
                    momentum = metadata.get("momentum") or {}
                    actions = metadata.get("actions") or []
                    action_line = actions[0]["title"] if actions else "Review your debrief in AKARA"
                    ok = await send_weekly_debrief_whatsapp(
                        phone=phone,
                        company_name=metadata.get("tenant_name", "Your business"),
                        week_range=f"{metadata.get('week_start')} – {metadata.get('week_end')}",
                        revenue=momentum.get("this_week_revenue_fmt", "₹—"),
                        revenue_change=f"{momentum.get('wow_change_pct', 0)}%",
                        top_zone=(metadata.get("went_right") or [{}])[0].get("title", "—"),
                        alert_line=action_line,
                        actions=action_line,
                        report_url=debrief_url,
                        tenant_id=tenant_id,
                        user_id=user_id,
                    )
                    whatsapp_status = "sent" if ok else "skipped"
                    if ok:
                        self._record_delivery(tenant_id, week_start, user_id, "whatsapp")

        return email_status, whatsapp_status

    def _user_email(self, user_id: str) -> str | None:
        try:
            user = self._sb.auth.admin.get_user_by_id(user_id)
            return user.user.email if user and user.user else None
        except Exception:
            return None

    def _send_email(self, to_email: str, metadata: dict, debrief_url: str) -> bool:
        try:
            template = self._jinja.get_template("weekly_debrief.html")
            html = template.render(
                metadata=metadata,
                debrief_url=debrief_url,
                headline=metadata.get("headline", ""),
            )
        except Exception as exc:
            logger.error("Debrief template render failed: %s", exc)
            return False

        week_start = metadata.get("week_start", "")
        week_end = metadata.get("week_end", "")
        subject = f"AKARA Weekly Debrief — Week of {week_start} – {week_end}"
        plain = (
            f"{metadata.get('headline', '')}\n\n"
            f"View full debrief: {debrief_url}"
        )
        return _send(to_email, subject, html, text_content=plain)


def run_weekly_debrief_for_all_tenants() -> dict[str, int]:
    """Sync entry for cron — runs async generation per tenant."""
    from app.core.tenant import get_supabase_service_client

    sb = get_supabase_service_client()
    tenants = (
        sb.table("tenants")
        .select("id")
        .eq("is_active", True)
        .in_("plan_status", ["active", "trialing"])
        .execute()
    )
    service = WeeklyDebriefService(sb)
    ok = skipped = errors = 0

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    async def _batch() -> None:
        nonlocal ok, skipped, errors
        for row in tenants.data or []:
            try:
                result = await service.generate_for_tenant(UUID(row["id"]))
                if result.status == "ok":
                    ok += 1
                else:
                    skipped += 1
            except Exception as exc:
                logger.error("Weekly debrief failed tenant %s: %s", row["id"], exc)
                errors += 1

    loop.run_until_complete(_batch())
    return {"ok": ok, "skipped": skipped, "errors": errors}
