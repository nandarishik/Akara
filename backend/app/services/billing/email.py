"""Billing email templates E5–E7 via SendGrid."""

from __future__ import annotations

import logging

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Attachment, Mail

from app.core.config import settings

logger = logging.getLogger(__name__)


def _send(to_email: str, subject: str, html: str, pdf_bytes: bytes | None = None, pdf_name: str = "invoice.pdf") -> bool:
    if not settings.sendgrid_api_key:
        logger.warning("SendGrid not configured — skipping email: %s", subject)
        return False

    message = Mail(
        from_email=(settings.sendgrid_from_email, settings.sendgrid_from_name),
        to_emails=to_email,
        subject=subject,
        html_content=html,
    )
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
    html = f"""
    <p>Thank you for upgrading to AKARA {plan.capitalize()}.</p>
    <p>Your GST invoice <strong>{invoice_number}</strong> is attached.</p>
    <p>Manage your subscription anytime from Billing in the app.</p>
    <p>— AKARA Team</p>
    """
    return _send(
        to_email,
        f"AKARA — Invoice {invoice_number}",
        html,
        pdf_bytes=pdf_bytes,
        pdf_name=f"{invoice_number}.pdf",
    )


def send_payment_failed_email(to_email: str) -> bool:
    html = """
    <p><strong>Payment failed</strong> for your AKARA subscription.</p>
    <p>Please update your payment method to avoid losing access.</p>
    <p><a href="{url}/billing">Update payment method →</a></p>
    """.format(url=settings.customer_frontend_url.rstrip("/"))
    return _send(to_email, "AKARA — Payment failed", html)


def send_dunning_reminder_email(to_email: str, day_offset: int) -> bool:
    messages = {
        3: "Reminder: your AKARA subscription payment is still overdue.",
        7: "Last chance — your account will be downgraded in 7 days if payment is not received.",
        14: "Your AKARA plan has been downgraded to Free. Your data is preserved.",
    }
    body = messages.get(day_offset, "Action needed on your AKARA subscription.")
    html = f"<p>{body}</p><p><a href=\"{settings.customer_frontend_url.rstrip('/')}/billing\">Go to Billing →</a></p>"
    return _send(to_email, f"AKARA — Subscription notice (day {day_offset})", html)


def send_downgrade_email(to_email: str) -> bool:
    return send_dunning_reminder_email(to_email, 14)
