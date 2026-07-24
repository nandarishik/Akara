"""Alert notification emails (Day 6 — email only; WhatsApp Day 7)."""

from __future__ import annotations

from decimal import Decimal

from app.core.config import settings
from app.services.billing.email import _send


def send_alert_triggered_email(
    to_email: str,
    alert_name: str,
    metric: str,
    current_value: Decimal,
    threshold: Decimal,
    condition: str,
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
    return _send(to_email, f"AKARA Alert — {alert_name}", html)


def send_import_failed_email(to_email: str, filename: str, error_message: str) -> bool:
    frontend = settings.customer_frontend_url.rstrip("/")
    html = f"""
    <p><strong>Your file failed to import.</strong></p>
    <p>File: {filename}</p>
    <p>Error: {error_message[:500]}</p>
    <p><a href="{frontend}/data">Try again →</a></p>
    <p>— AKARA Team</p>
    """
    return _send(to_email, "AKARA — Import failed", html)
