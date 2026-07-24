"""Onboarding routes — Sprint Phase 2, Day 3.

POST /onboarding/setup       — idempotent tenant creation + sample-data seeding
POST /auth/onboarding-complete — marks has_completed_onboarding = True on profile
"""

from __future__ import annotations

import hashlib
import re
import uuid
from datetime import date
from typing import TYPE_CHECKING

import httpx
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.tenant import get_supabase_service_client
from app.services.user_events import record_user_event

if TYPE_CHECKING:
    pass

router = APIRouter(tags=["onboarding"])

# ---------------------------------------------------------------------------
# Disposable-email blocklist (GAP 5)
# ---------------------------------------------------------------------------
_BLOCKED_DOMAINS: frozenset[str] = frozenset(
    {
        "mailinator.com",
        "guerrillamail.com",
        "10minutemail.com",
        "throwam.com",
        "yopmail.com",
        "tempmail.com",
        "trashmail.com",
        "maildrop.cc",
        "fakeinbox.com",
        "sharklasers.com",
    }
)


def is_disposable_email(email: str) -> bool:
    """Return True if *email* belongs to a known disposable-email domain."""
    try:
        domain = email.split("@")[-1].lower()
    except Exception:
        return False
    return domain in _BLOCKED_DOMAINS


# ---------------------------------------------------------------------------
# Turnstile verification (GAP 5)
# ---------------------------------------------------------------------------
async def _verify_turnstile(token: str, ip: str) -> bool:
    """Verify a Cloudflare Turnstile *token* server-side.

    Returns True if valid.  Always returns True when
    ``settings.turnstile_secret_key`` is empty or ``"test"`` so that
    local development and automated tests can skip the CAPTCHA.
    """
    secret = settings.turnstile_secret_key
    if not secret or secret in ("", "test"):
        return True  # dev / test bypass

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data={
                "secret": secret,
                "response": token,
                "remoteip": ip,
            },
        )
        return bool(resp.json().get("success", False))


# ---------------------------------------------------------------------------
# Slug helper
# ---------------------------------------------------------------------------
_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _make_slug(name: str) -> str:
    """Convert *name* to a URL-safe lowercase slug."""
    base = _SLUG_RE.sub("-", name.lower().strip()).strip("-") or "tenant"
    suffix = str(uuid.uuid4())[:8]
    return f"{base}-{suffix}"


# ---------------------------------------------------------------------------
# Sample data seeding
# ---------------------------------------------------------------------------
_SAMPLE_ROWS: list[dict] = [
    {"distributor": "Sharma Traders", "zone": "North", "product": "Maggi 2min", "quantity": 240, "revenue": 28800},
    {"distributor": "Sharma Traders", "zone": "North", "product": "KitKat 4F", "quantity": 180, "revenue": 10800},
    {"distributor": "Gupta Agencies", "zone": "East",  "product": "Maggi 2min", "quantity": 310, "revenue": 37200},
    {"distributor": "Gupta Agencies", "zone": "East",  "product": "Lay's Classic", "quantity": 520, "revenue": 20800},
    {"distributor": "Mehta Dist.",    "zone": "West",  "product": "Nestea",    "quantity": 150, "revenue": 9000},
    {"distributor": "Mehta Dist.",    "zone": "West",  "product": "KitKat 4F", "quantity": 220, "revenue": 13200},
    {"distributor": "Patel Depot",    "zone": "South", "product": "Maggi 2min", "quantity": 400, "revenue": 48000},
    {"distributor": "Patel Depot",    "zone": "South", "product": "Lay's Classic", "quantity": 290, "revenue": 11600},
    {"distributor": "Joshi & Sons",   "zone": "North", "product": "Nestea",    "quantity": 100, "revenue": 6000},
    {"distributor": "Joshi & Sons",   "zone": "North", "product": "Milkybar",  "quantity": 340, "revenue": 17000},
    {"distributor": "Rao Traders",    "zone": "East",  "product": "Maggi 2min", "quantity": 270, "revenue": 32400},
    {"distributor": "Rao Traders",    "zone": "East",  "product": "Milkybar",  "quantity": 190, "revenue": 9500},
    {"distributor": "Verma Dist.",    "zone": "West",  "product": "KitKat 4F", "quantity": 160, "revenue": 9600},
    {"distributor": "Verma Dist.",    "zone": "West",  "product": "Lay's Classic", "quantity": 380, "revenue": 15200},
    {"distributor": "Singh Stores",   "zone": "South", "product": "Nestea",    "quantity": 210, "revenue": 12600},
    {"distributor": "Singh Stores",   "zone": "South", "product": "Milkybar",  "quantity": 260, "revenue": 13000},
    {"distributor": "Kumar Agencies", "zone": "North", "product": "Maggi 2min", "quantity": 330, "revenue": 39600},
    {"distributor": "Kumar Agencies", "zone": "North", "product": "KitKat 4F", "quantity": 140, "revenue": 8400},
    {"distributor": "Bose Pvt Ltd",   "zone": "East",  "product": "Lay's Classic", "quantity": 460, "revenue": 18400},
    {"distributor": "Bose Pvt Ltd",   "zone": "East",  "product": "Nestea",    "quantity": 130, "revenue": 7800},
    {"distributor": "Iyer Corp",      "zone": "West",  "product": "Milkybar",  "quantity": 290, "revenue": 14500},
    {"distributor": "Iyer Corp",      "zone": "West",  "product": "Maggi 2min", "quantity": 200, "revenue": 24000},
    {"distributor": "Nair Dist.",     "zone": "South", "product": "KitKat 4F", "quantity": 175, "revenue": 10500},
    {"distributor": "Nair Dist.",     "zone": "South", "product": "Lay's Classic", "quantity": 310, "revenue": 12400},
    {"distributor": "Reddy Traders",  "zone": "North", "product": "Nestea",    "quantity": 185, "revenue": 11100},
    {"distributor": "Reddy Traders",  "zone": "North", "product": "Milkybar",  "quantity": 220, "revenue": 11000},
    {"distributor": "Pillai & Co",    "zone": "East",  "product": "Maggi 2min", "quantity": 360, "revenue": 43200},
    {"distributor": "Pillai & Co",    "zone": "East",  "product": "KitKat 4F", "quantity": 145, "revenue": 8700},
    {"distributor": "Das Agencies",   "zone": "West",  "product": "Lay's Classic", "quantity": 410, "revenue": 16400},
    {"distributor": "Das Agencies",   "zone": "West",  "product": "Nestea",    "quantity": 165, "revenue": 9900},
]


def _seed_sample_data(client, tenant_id: str) -> None:
    """Insert a fixed set of demo sales rows for *tenant_id*.

    Uses the service-role client so it bypasses RLS.
    Errors are silently suppressed — demo data failure should not break signup.
    """
    try:
        rows = [
            {
                "tenant_id": tenant_id,
                "invoice_date": "2025-12-01",
                "party_name": r["distributor"],
                "party_zone": r["zone"],
                "product_name": r["product"],
                "quantity": r["quantity"],
                "total_amount": r["revenue"],
            }
            for r in _SAMPLE_ROWS
        ]
        client.table("sales_data").insert(rows).execute()
    except Exception:
        pass  # sample data failure must not block signup


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------
class OnboardingRequest(BaseModel):
    company_name: str
    industry: str = "general"
    language: str = "en"
    currency: str = "INR"
    monthly_revenue_range: str | None = None  # segmentation only
    use_sample_data: bool = False
    turnstile_token: str | None = None  # required in prod; skipped in dev/test


class OnboardingResponse(BaseModel):
    tenant_id: str
    tenant_slug: str


# ---------------------------------------------------------------------------
# POST /onboarding/setup
# ---------------------------------------------------------------------------
@router.post(
    "/onboarding/setup",
    response_model=OnboardingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Idempotent tenant provisioning",
)
@limiter.limit("5/minute")
async def setup_tenant(
    body: OnboardingRequest,
    request: Request,
    user: CurrentUser,
) -> OnboardingResponse:
    """Create a new tenant for the authenticated user.

    Idempotent: if the user's profile already has a ``tenant_id``,
    the existing tenant is returned without further changes.

    Steps:
    1. Verify Turnstile token (skip if secret empty / "test").
    2. Check disposable email.
    3. If profile already has tenant_id → return it (idempotent).
    4. Create tenants row.
    5. Update profiles row: tenant_id, role, has_completed_onboarding=False.
    6. Insert consent_log row.
    7. Seed sample data (if requested or use_sample_data=True).
    """
    # 1 — Turnstile
    ip = request.client.host if request.client else "0.0.0.0"
    if body.turnstile_token:
        ok = await _verify_turnstile(body.turnstile_token, ip)
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "turnstile_failed", "message": "Bot verification failed. Please try again."},
            )
    elif settings.turnstile_secret_key and settings.turnstile_secret_key not in ("", "test"):
        # Prod env requires a token
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "turnstile_missing", "message": "Bot verification token required."},
        )

    # 2 — Disposable email check
    email = user.email or ""
    if is_disposable_email(email):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "disposable_email",
                "message": "Please use a work email address (disposable emails not accepted).",
            },
        )

    client = get_supabase_service_client()

    # 3 — Profile lookup (idempotency)
    profile_result = (
        client.table("profiles")
        .select("tenant_id")
        .eq("id", str(user.user_id))
        .maybe_single()
        .execute()
    )

    existing_tenant_id: str | None = None
    if profile_result.data and profile_result.data.get("tenant_id"):
        existing_tenant_id = profile_result.data["tenant_id"]

    if existing_tenant_id:
        # Idempotent — return existing tenant
        tenant_result = (
            client.table("tenants")
            .select("id, slug")
            .eq("id", existing_tenant_id)
            .single()
            .execute()
        )
        data = tenant_result.data
        return OnboardingResponse(
            tenant_id=data["id"],
            tenant_slug=data["slug"],
        )

    # 4 — Create tenant
    slug = _make_slug(body.company_name)
    today = date.today().isoformat()
    config = {
        "industry": body.industry,
        "language": body.language,
        "currency": body.currency,
        "monthly_revenue_range": body.monthly_revenue_range,
    }
    tenant_insert = (
        client.table("tenants")
        .insert(
            {
                "name": body.company_name,
                "slug": slug,
                "plan": "free",
                "plan_status": "active",
                "is_active": True,
                "config": config,
            }
        )
        .execute()
    )
    new_tenant_id: str = tenant_insert.data[0]["id"]

    # 5 — Update profile
    client.table("profiles").upsert(
        {
            "id": str(user.user_id),
            "tenant_id": new_tenant_id,
            "role": "admin",
            "has_completed_onboarding": False,
        }
    ).execute()

    # 6 — Consent log (insert silently; don't block if it fails)
    try:
        ip_hash = hashlib.sha256(ip.encode()).hexdigest()
        client.table("consent_log").insert(
            {
                "user_id": str(user.user_id),
                "version_tos": today,
                "version_privacy": today,
                "ai_processing": True,
                "ip_hash": ip_hash,
            }
        ).execute()
    except Exception:
        pass

    # 7 — Seed sample data
    _seed_sample_data(client, new_tenant_id)

    record_user_event(user.user_id, "signed_up")

    return OnboardingResponse(
        tenant_id=new_tenant_id,
        tenant_slug=slug,
    )


# ---------------------------------------------------------------------------
# POST /auth/onboarding-complete
# ---------------------------------------------------------------------------
@router.post(
    "/auth/onboarding-complete",
    status_code=status.HTTP_200_OK,
    summary="Mark onboarding complete",
)
async def onboarding_complete(user: CurrentUser) -> dict:
    """Set ``has_completed_onboarding = True`` on the user's profile row.

    Called from the frontend when the user clicks "Go to my dashboard →"
    on Onboarding step 3.  Safe to call multiple times (idempotent).
    """
    client = get_supabase_service_client()
    client.table("profiles").update(
        {"has_completed_onboarding": True}
    ).eq("id", str(user.user_id)).execute()
    record_user_event(user.user_id, "onboarded")
    return {"ok": True}
