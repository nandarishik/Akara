"""Marketing routes — Sprint Phase 2, Day 3.

POST /marketing/email-capture — landing-page email capture (Slot C, no auth required)
"""

from __future__ import annotations

import contextlib
import hashlib

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.core.rate_limit import limiter
from app.core.tenant import get_supabase_service_client

router = APIRouter(prefix="/marketing", tags=["marketing"])


class EmailCaptureRequest(BaseModel):
    email: str  # Basic validation: must be non-empty; stricter check done in DB
    name: str | None = None
    source: str | None = None  # e.g. "landing_footer", "landing_hero"
    # Honeypot — must be empty in legitimate submissions.
    # CSS hides this field from real users; bots fill it in.
    website: str = ""


@router.post(
    "/email-capture",
    status_code=200,
    summary="Landing-page email capture (no auth required)",
)
@limiter.limit("5/minute")
async def email_capture(body: EmailCaptureRequest, request: Request) -> dict:
    """Insert *email* into the ``marketing_emails`` table.

    Honeypot: if ``body.website`` is non-empty the row is still stored (for
    analysis) but flagged as ``honeypot_triggered = True`` and never exported
    for marketing use.

    Uses an INSERT ... ON CONFLICT DO NOTHING so duplicate submissions are
    silently ignored.
    """
    honeypot = bool(body.website)
    ip = request.client.host if request.client else "0.0.0.0"
    ip_hash = hashlib.sha256(ip.encode()).hexdigest()

    client = get_supabase_service_client()
    with contextlib.suppress(Exception):
        # Never expose internal errors to unauthenticated callers.
        client.table("marketing_emails").upsert(
            {
                "email": str(body.email),
                "name": body.name,
                "source": body.source,
                "ip_hash": ip_hash,
                "honeypot_triggered": honeypot,
            },
            on_conflict="email",
            ignore_duplicates=True,
        ).execute()

    # Always return 200 — even for honeypot hits or duplicates.
    return {"ok": True}
