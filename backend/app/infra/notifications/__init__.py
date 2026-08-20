"""Alert notification emails (Day 6 — email; Day 7 adds delivery_logs + WhatsApp)."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from app.core.config import settings
from app.domain.billing.email import _send
from app.infra.notifications.delivery_log import log_delivery


def send_alert_triggered_email(
    to_email: str,
    alert_name: str,
    metric: str,
    current_value: Decimal,
    threshold: Decimal,
    condition: str,
    *,
    tenant_id: UUID | None = None,
    user_id: UUID | None = None,
) -> bool:
    frontend = settings.customer_frontend_url.rstrip("/")
    html = f"""
    <p><strong>AKARA Alert:</strong> {alert_name}</p>
    <p>Metric <code>{metric}</code> is {condition} your threshold.</p>
    <p>Current value: <strong>{current_value}</strong><br/>
    Threshold: <strong>{threshold}</strong></p>
    <p><a href="{frontend}/alerts">View alerts →</a></p>
    <p>— AKARA Team</p>
    """
    ok = _send(to_email, f"AKARA Alert — {alert_name}", html)
    log_delivery(
        channel="email",
        template="alert_triggered",
        status="sent" if ok else "failed",
        tenant_id=tenant_id,
        user_id=user_id,
        error_message=None if ok else "sendgrid_failed",
    )
    return ok


def send_import_failed_email(
    to_email: str,
    filename: str,
    error_message: str,
    *,
    tenant_id: UUID | None = None,
    user_id: UUID | None = None,
) -> bool:
    frontend = settings.customer_frontend_url.rstrip("/")
    html = f"""
    <p><strong>Your file failed to import.</strong></p>
    <p>File: {filename}</p>
    <p>Error: {error_message[:500]}</p>
    <p><a href="{frontend}/data">Try again →</a></p>
    <p>— AKARA Team</p>
    """
    ok = _send(to_email, "AKARA — Import failed", html)
    log_delivery(
        channel="email",
        template="import_failed",
        status="sent" if ok else "failed",
        tenant_id=tenant_id,
        user_id=user_id,
        error_message=None if ok else "sendgrid_failed",
    )
    return ok
