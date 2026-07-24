"""Production-grade Morning Brief email service.

Sends a daily HTML email to opted-in admin users with:
- Yesterday's KPI summary (revenue, orders, parties, avg order)
- Top 3 data-driven actions ranked by ₹ impact
- HTML template rendered with Jinja2
- Delivery via SendGrid with 3-retry exponential backoff
- Failures logged to Sentry and structured logs
"""

import logging
import time
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from uuid import UUID

import sentry_sdk
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import (
    Content,
    From,
    Mail,
    Subject,
    To,
)
from supabase import Client

from app.core.config import settings
from app.services.insights.engine import InsightsEngine, _fmt_inr
from app.services.kpi.service import KPIService

logger = logging.getLogger(__name__)

_TEMPLATE_DIR = Path(__file__).parent / "templates"
_DASHBOARD_URL = "https://app.akara.ai"
_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 1.5  # seconds


@dataclass
class BriefSummary:
    """KPI snapshot formatted for email template rendering."""

    total_revenue_fmt: str
    total_orders: int
    unique_parties: int
    avg_order_fmt: str


@dataclass
class InsightContext:
    """Insight formatted for Jinja2 template rendering."""

    title: str
    description: str
    revenue_impact_fmt: str
    priority: str
    data_points: list[str]


@dataclass
class BriefResult:
    success: bool
    message: str
    insights_count: int = 0
    recipient_email: str = ""


class MorningBriefService:
    """Send a production-grade daily brief email via SendGrid.

    Usage:
        service = MorningBriefService(supabase_client)
        result = service.send_brief(tenant_id, "user@example.com")
    """

    def __init__(self, supabase: Client) -> None:
        self._sb = supabase
        self._jinja = Environment(
            loader=FileSystemLoader(str(_TEMPLATE_DIR)),
            autoescape=select_autoescape(["html"]),
        )

    def send_brief(
        self,
        tenant_id: UUID,
        recipient_email: str,
        recipient_name: str = "",
        tenant_name: str = "Your Tenant",
    ) -> BriefResult:
        """Compute insights, render HTML, and send via SendGrid.

        Retries up to 3 times with exponential backoff.
        Returns BriefResult indicating success or failure.
        """
        if not settings.sendgrid_api_key:
            logger.warning("SENDGRID_API_KEY not configured — skipping email send")
            return BriefResult(
                success=False,
                message="SendGrid API key not configured",
                recipient_email=recipient_email,
            )

        # ---- 1. Fetch KPI summary for yesterday ----
        today = date.today()
        yesterday = today - timedelta(days=1)

        try:
            kpi_service = KPIService(supabase=self._sb)
            summary_raw = kpi_service.get_summary(
                tenant_id=tenant_id,
                start_date=yesterday.isoformat(),
                end_date=yesterday.isoformat(),
            )
            summary = BriefSummary(
                total_revenue_fmt=_fmt_inr(int(summary_raw.total_revenue)),
                total_orders=summary_raw.total_orders,
                unique_parties=summary_raw.unique_parties,
                avg_order_fmt=_fmt_inr(int(summary_raw.avg_order_value)),
            )
        except Exception as exc:
            logger.exception("Failed to fetch KPI summary for brief")
            sentry_sdk.capture_exception(exc)
            summary = BriefSummary(
                total_revenue_fmt="₹—",
                total_orders=0,
                unique_parties=0,
                avg_order_fmt="₹—",
            )

        # ---- 2. Compute insights ----
        try:
            engine = InsightsEngine(supabase=self._sb)
            raw_insights = engine.compute_insights(tenant_id)
        except Exception as exc:
            logger.exception("Failed to compute insights for brief")
            sentry_sdk.capture_exception(exc)
            raw_insights = []

        insight_contexts = [
            InsightContext(
                title=ins.title,
                description=ins.description,
                revenue_impact_fmt=_fmt_inr(ins.revenue_impact),
                priority=ins.priority,
                data_points=ins.data_points,
            )
            for ins in raw_insights
        ]

        # ---- 3. Render HTML template ----
        try:
            template = self._jinja.get_template("morning_brief.html")
            html_body = template.render(
                brief_date=yesterday.strftime("%-d %b %Y"),
                recipient_name=recipient_name or recipient_email.split("@")[0].title(),
                tenant_name=tenant_name,
                summary=summary,
                insights=insight_contexts,
                dashboard_url=_DASHBOARD_URL,
                unsubscribe_url=f"{_DASHBOARD_URL}/settings?unsubscribe=morning-brief",
            )
        except Exception as exc:
            logger.exception("Failed to render morning brief template")
            sentry_sdk.capture_exception(exc)
            return BriefResult(
                success=False,
                message=f"Template render failed: {exc}",
                recipient_email=recipient_email,
            )

        # ---- 4. Build SendGrid message ----
        subject_str = f"AKARA Daily Brief — {yesterday.strftime('%-d %b %Y')}"

        mail = Mail()
        mail.from_email = From(
            email=settings.sendgrid_from_email,
            name=settings.sendgrid_from_name,
        )
        mail.to = To(email=recipient_email)
        mail.subject = Subject(subject_str)
        mail.content = [Content("text/html", html_body)]
        mail.tracking_settings = {
            "click_tracking": {"enable": True},
            "open_tracking": {"enable": True},
        }

        # ---- 5. Send with retry ----
        last_error: Exception | None = None
        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                sg = SendGridAPIClient(settings.sendgrid_api_key)
                response = sg.send(mail)
                status_code = response.status_code

                if 200 <= status_code < 300:
                    logger.info(
                        "Morning brief sent to %s (tenant=%s, status=%d)",
                        recipient_email,
                        tenant_id,
                        status_code,
                    )
                    self._maybe_send_whatsapp(
                        tenant_id=tenant_id,
                        recipient_email=recipient_email,
                        tenant_name=tenant_name,
                        summary=summary,
                        raw_insights=raw_insights,
                    )
                    return BriefResult(
                        success=True,
                        message=f"Sent (HTTP {status_code})",
                        insights_count=len(raw_insights),
                        recipient_email=recipient_email,
                    )
                if status_code == 429:
                    # Rate limited — back off longer
                    delay = _RETRY_BASE_DELAY * (3**attempt)
                    logger.warning(
                        "SendGrid rate limit (429) on attempt %d, waiting %.1fs",
                        attempt,
                        delay,
                    )
                    time.sleep(delay)
                else:
                    logger.error(
                        "SendGrid returned %d on attempt %d",
                        status_code,
                        attempt,
                    )
                    last_error = Exception(f"SendGrid HTTP {status_code}")

            except Exception as exc:
                last_error = exc
                if attempt < _MAX_RETRIES:
                    delay = _RETRY_BASE_DELAY * (2 ** (attempt - 1))
                    logger.warning(
                        "SendGrid attempt %d failed: %s — retrying in %.1fs",
                        attempt,
                        exc,
                        delay,
                    )
                    time.sleep(delay)
                else:
                    logger.exception(
                        "All %d SendGrid attempts failed for %s",
                        _MAX_RETRIES,
                        recipient_email,
                    )
                    sentry_sdk.capture_exception(exc)

        return BriefResult(
            success=False,
            message=f"Failed after {_MAX_RETRIES} attempts: {last_error}",
            insights_count=len(raw_insights),
            recipient_email=recipient_email,
        )

    def _maybe_send_whatsapp(
        self,
        *,
        tenant_id: UUID,
        recipient_email: str,
        tenant_name: str,
        summary: BriefSummary,
        raw_insights: list,
    ) -> None:
        if not settings.whatsapp_sends_enabled:
            return

        profiles = (
            self._sb.table("profiles")
            .select("id, phone_number, preferences")
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        target = None
        for row in profiles.data or []:
            try:
                auth_user = self._sb.auth.admin.get_user_by_id(row["id"])
                email = auth_user.user.email if auth_user and auth_user.user else None
            except Exception:
                email = None
            if email and email.lower() == recipient_email.lower():
                target = row
                break
        if not target:
            return

        prefs = target.get("preferences") or {}
        if not prefs.get("whatsapp_morning_brief_enabled", True):
            return
        phone = target.get("phone_number")
        if not phone:
            return

        top_insight = raw_insights[0].title if raw_insights else "Review dashboard for actions"
        import asyncio

        from app.services.notifications.whatsapp import send_morning_brief_whatsapp

        try:
            asyncio.run(
                send_morning_brief_whatsapp(
                    phone=str(phone),
                    company_name=tenant_name,
                    revenue=summary.total_revenue_fmt,
                    orders=str(summary.total_orders),
                    top_insight=top_insight,
                    dashboard_url=_DASHBOARD_URL,
                    tenant_id=tenant_id,
                    user_id=target.get("id"),
                )
            )
        except Exception as exc:
            logger.warning("Morning brief WhatsApp failed for %s: %s", recipient_email, exc)
