"""Zaptilo WhatsApp delivery — gated until BSP templates are approved."""

from __future__ import annotations

import logging

import httpx

from app.core.config import settings
from app.services.notifications.delivery_log import log_delivery

logger = logging.getLogger(__name__)

ZAPTILO_API_URL = "https://api.zaptilo.ai/v1"


def _whatsapp_enabled() -> bool:
    return bool(settings.zaptilo_api_key and settings.whatsapp_sends_enabled)


async def send_whatsapp_template(
    *,
    to_phone: str,
    template_name: str,
    variables: list[str],
    tenant_id=None,
    user_id=None,
) -> bool:
    """Send template or log skipped when WhatsApp is not enabled."""
    if not _whatsapp_enabled():
        log_delivery(
            channel="whatsapp",
            template=template_name,
            status="skipped",
            tenant_id=tenant_id,
            user_id=user_id,
            error_message="templates_not_ready",
            metadata={"variables_count": len(variables)},
        )
        return False

    phone = to_phone.lstrip("+")
    if phone.startswith("91") and len(phone) > 10:
        phone = phone[2:]

    payload = {
        "token": settings.zaptilo_api_key,
        "to": phone,
        "template": template_name,
        "language": "en",
        "variables": variables,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{ZAPTILO_API_URL}/message/template", json=payload)
            resp.raise_for_status()
            data = resp.json() if resp.content else {}
            log_delivery(
                channel="whatsapp",
                template=template_name,
                status="sent",
                tenant_id=tenant_id,
                user_id=user_id,
                provider_id=str(data.get("id", "")),
            )
            return True
    except httpx.HTTPError as exc:
        logger.error("WhatsApp failed template=%s: %s", template_name, exc)
        log_delivery(
            channel="whatsapp",
            template=template_name,
            status="failed",
            tenant_id=tenant_id,
            user_id=user_id,
            error_message=str(exc),
        )
        return False


async def send_weekly_debrief_whatsapp(
    *,
    phone: str,
    company_name: str,
    week_range: str,
    revenue: str,
    revenue_change: str,
    top_zone: str,
    alert_line: str,
    actions: str,
    report_url: str,
    tenant_id=None,
    user_id=None,
) -> bool:
    return await send_whatsapp_template(
        to_phone=phone,
        template_name="weekly_debrief_brief",
        variables=[
            company_name,
            week_range,
            revenue,
            revenue_change,
            top_zone,
            alert_line,
            actions,
            report_url,
        ],
        tenant_id=tenant_id,
        user_id=user_id,
    )


async def send_alert_whatsapp(
    *,
    phone: str,
    alert_name: str,
    metric: str,
    current: str,
    threshold: str,
    tenant_id=None,
    user_id=None,
) -> bool:
    return await send_whatsapp_template(
        to_phone=phone,
        template_name="alert_triggered",
        variables=[alert_name, metric, current, threshold],
        tenant_id=tenant_id,
        user_id=user_id,
    )


async def send_morning_brief_whatsapp(
    *,
    phone: str,
    company_name: str,
    revenue: str,
    orders: str,
    top_insight: str,
    dashboard_url: str,
    tenant_id=None,
    user_id=None,
) -> bool:
    return await send_whatsapp_template(
        to_phone=phone,
        template_name="morning_brief_summary",
        variables=[company_name, revenue, orders, top_insight, dashboard_url],
        tenant_id=tenant_id,
        user_id=user_id,
    )
