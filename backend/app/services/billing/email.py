"""Billing email templates E5–E7 via SendGrid."""

from __future__ import annotations

import logging

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Attachment, Mail

from app.core.config import settings
from app.services.email.renderer import render_template

logger = logging.getLogger(__name__)


def _is_suppressed(to_email: str) -> bool:
    normalized = to_email.strip().lower()
    try:
        from app.core.tenant import get_supabase_service_client

        res = (
            get_supabase_service_client()
            .table("email_suppressions")
            .select("email_normalized")
            .eq("email_normalized", normalized)
            .maybe_single()
            .execute()
        )
        return bool(res.data)
    except Exception as exc:
        logger.debug("Suppression check skipped for %s: %s", normalized, exc)
        return False


def _send(
    to_email: str,
    subject: str,
    html: str,
    pdf_bytes: bytes | None = None,
    pdf_name: str = "invoice.pdf",
    text_content: str | None = None,
) -> bool:
    if not settings.sendgrid_api_key:
        logger.warning("SendGrid not configured — skipping email: %s", subject)
        return False
    if _is_suppressed(to_email):
        logger.info("Skipping email to suppressed address: %s", to_email)
        return False

    message = Mail(
        from_email=(settings.sendgrid_from_email, settings.sendgrid_from_name),
        to_emails=to_email,
        subject=subject,
        html_content=html,
    )
    if text_content:
        from sendgrid.helpers.mail import Content
        message.add_content(Content("text/plain", text_content))
    if pdf_bytes:
        attachment = Attachment()
        attachment.file_content = __import__("base64").b64encode(pdf_bytes).decode()
        attachment.file_type = "application/pdf"
        attachment.file_name = pdf_name
        attachment.disposition = "attachment"
        message.add_attachment(attachment)

    try:
        SendGridAPIClient(settings.sendgrid_api_key).send(message)
        return True
    except Exception as exc:
        logger.error("SendGrid send failed: %s", exc)
        return False


def send_payment_success_email(
    to_email: str,
    invoice_number: str,
    plan: str,
    pdf_bytes: bytes | None = None,
) -> bool:
    html = render_template(
        "payment_success.html",
        plan=plan.capitalize(),
        invoice_number=invoice_number,
    )
    return _send(
        to_email,
        f"AKARA — Invoice {invoice_number}",
        html,
        pdf_bytes=pdf_bytes,
        pdf_name=f"{invoice_number}.pdf",
    )


def send_payment_failed_email(to_email: str) -> bool:
    html = render_template(
        "payment_failed.html",
        billing_url=f"{settings.customer_frontend_url.rstrip('/')}/billing",
    )
    return _send(to_email, "AKARA — Payment failed", html)


def send_dunning_reminder_email(to_email: str, day_offset: int) -> bool:
    messages = {
        3: "Reminder: your AKARA subscription payment is still overdue.",
        7: "Last chance — your account will be downgraded in 7 days if payment is not received.",
        14: "Your AKARA plan has been downgraded to Free. Your data is preserved.",
    }
    body = messages.get(day_offset, "Action needed on your AKARA subscription.")
    html = render_template(
        "dunning_reminder.html",
        body=body,
        billing_url=f"{settings.customer_frontend_url.rstrip('/')}/billing",
    )
    return _send(to_email, f"AKARA — Subscription notice (day {day_offset})", html)


def send_quota_warning_email(to_email: str, plan: str, pct: int) -> bool:
    html = render_template(
        "quota_warning.html",
        plan=plan.capitalize(),
        pct=pct,
        upgrade_url=f"{settings.customer_frontend_url.rstrip('/')}/upgrade",
    )
    return _send(to_email, f"AKARA — {pct}% of Copilot quota used", html)


def send_welcome_email(to_email: str, name: str) -> bool:
    html = render_template(
        "welcome.html",
        name=name or "there",
        dashboard_url=f"{settings.customer_frontend_url.rstrip('/')}/dashboard",
    )
    return _send(to_email, "Welcome to AKARA", html)


def send_downgrade_email(to_email: str) -> bool:
    return send_dunning_reminder_email(to_email, 14)
