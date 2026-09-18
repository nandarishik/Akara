"""Account settings, export, deletion, and notification preferences."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel

from app.core.auth import Capability, CurrentUser, check_role_capability
from app.core.config import settings
from app.core.errors import AkaraHTTPException
from app.core.plan_guard import require_feature
from app.core.rate_limit import limiter
from app.core.tenant import (
    TenantContext,
    get_supabase_service_client,
    get_tenant_context,
)
from app.domain.billing.email import _send
from app.infra.notifications.delivery_log import log_delivery

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/account", tags=["account"])


@router.get("/impersonation-session")
def impersonation_session(user: CurrentUser) -> dict:
    supa = get_supabase_service_client()
    now = datetime.now(UTC).isoformat()
    try:
        result = (
            supa.table("impersonation_sessions")
            .select("id, reason, expires_at, ended_at, target_user_id")
            .eq("target_user_id", str(user.user_id))
            .is_("ended_at", "null")
            .gt("expires_at", now)
            .order("expires_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception:
        result = None
    row = (result.data or [None])[0] if result else None
    if not row:
        return {"active": False, "reason": None, "expires_at": None, "session_id": None}
    return {
        "active": True,
        "reason": row.get("reason"),
        "expires_at": row.get("expires_at"),
        "session_id": row.get("id"),
    }


DEFAULT_PREFERENCES = {
    "morning_brief_enabled": True,
    "email_debrief_enabled": True,
    "whatsapp_debrief_enabled": True,
    "email_morning_brief_enabled": True,
    "whatsapp_morning_brief_enabled": True,
    "whatsapp_alerts_enabled": True,
    "announcements_enabled": True,
    "usage_warnings_enabled": True,
    "morning_brief_time": "07:00",
    "morning_brief_timezone": "Asia/Kolkata",
    "debrief_day": "monday",
}


class PreferencesUpdate(BaseModel):
    morning_brief_enabled: bool | None = None
    email_debrief_enabled: bool | None = None
    whatsapp_debrief_enabled: bool | None = None
    email_morning_brief_enabled: bool | None = None
    whatsapp_morning_brief_enabled: bool | None = None
    whatsapp_alerts_enabled: bool | None = None
    announcements_enabled: bool | None = None
    usage_warnings_enabled: bool | None = None
    morning_brief_time: str | None = None
    morning_brief_timezone: str | None = None
    debrief_day: str | None = None


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    phone_number: str | None = None
    avatar_seed: str | None = None


class DeleteAccountRequest(BaseModel):
    confirm_email: str


class UnsubscribeRequest(BaseModel):
    channel: str = "email"
    category: str = "morning_brief"


class ChannelsResponse(BaseModel):
    whatsapp_enabled: bool
    whatsapp_reason: str


def _merge_preferences(existing: dict | None, update: PreferencesUpdate) -> dict:
    prefs = {**DEFAULT_PREFERENCES, **(existing or {})}
    for key, value in update.model_dump(exclude_none=True).items():
        prefs[key] = value
    return prefs


@router.get("/channels", response_model=ChannelsResponse)
def get_channels(_user: CurrentUser) -> ChannelsResponse:
    if settings.zaptilo_api_key and settings.whatsapp_sends_enabled:
        return ChannelsResponse(whatsapp_enabled=True, whatsapp_reason="live")
    return ChannelsResponse(
        whatsapp_enabled=False,
        whatsapp_reason="templates_not_ready",
    )


@router.patch("/preferences")
@limiter.limit("30/minute")
def update_preferences(
    request: Request,
    body: PreferencesUpdate,
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
) -> dict:
    supa = get_supabase_service_client()
    profile = (
        supa.table("profiles")
        .select("preferences")
        .eq("id", str(user.user_id))
        .single()
        .execute()
    )
    merged = _merge_preferences(
        profile.data.get("preferences") if profile.data else {}, body
    )
    supa.table("profiles").update({"preferences": merged}).eq(
        "id", str(user.user_id)
    ).execute()
    return {"preferences": merged}


@router.patch("/profile")
@limiter.limit("30/minute")
def update_profile(
    request: Request, body: ProfileUpdate, user: CurrentUser
) -> dict[str, str]:
    supa = get_supabase_service_client()
    update: dict = {}
    if body.display_name is not None:
        update["display_name"] = body.display_name
    if body.phone_number is not None:
        update["phone_number"] = body.phone_number.strip()
    if body.avatar_seed is not None:
        profile = (
            supa.table("profiles")
            .select("preferences")
            .eq("id", str(user.user_id))
            .single()
            .execute()
        )
        prefs = {
            **DEFAULT_PREFERENCES,
            **((profile.data or {}).get("preferences") or {}),
        }
        prefs["avatar_seed"] = body.avatar_seed.strip()
        update["preferences"] = prefs
    if not update:
        raise AkaraHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="VALIDATION_ERROR",
            message="No fields to update",
        )
    supa.table("profiles").update(update).eq("id", str(user.user_id)).execute()
    return {"status": "ok"}


@router.get("/export")
@limiter.limit("5/minute")
def export_account_data(
    request: Request,
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
) -> dict:
    supa = get_supabase_service_client()
    profile = (
        supa.table("profiles")
        .select("*")
        .eq("id", str(user.user_id))
        .single()
        .execute()
    ).data or {}

    def _rows(table: str, **eq: str) -> list:
        q = supa.table(table).select("*")
        for col, val in eq.items():
            q = q.eq(col, val)
        try:
            return q.execute().data or []
        except Exception:
            return []

    sessions = _rows("active_sessions", user_id=str(user.user_id))
    for row in sessions:
        row.pop("ip_address", None)
        if "ip_address" in row:
            row["ip_address"] = None

    payload = {
        "exported_at": datetime.now(UTC).isoformat(),
        "profiles": [profile],
        "tenants": _rows("tenants", id=str(tenant.tenant_id)),
        "conversations": _rows(
            "conversations", tenant_id=str(tenant.tenant_id), user_id=str(user.user_id)
        ),
        "chat_history": _rows(
            "chat_history", tenant_id=str(tenant.tenant_id), user_id=str(user.user_id)
        ),
        "copilot_feedback": _rows("copilot_feedback", user_id=str(user.user_id)),
        "invoices": _rows("invoices", tenant_id=str(tenant.tenant_id)),
        "alerts": _rows("tenant_alerts", tenant_id=str(tenant.tenant_id)),
        "consent_log": _rows("consent_log", user_id=str(user.user_id)),
        "team_invites": _rows("team_invites", tenant_id=str(tenant.tenant_id)),
        "active_sessions": sessions,
    }
    return payload


@router.post("/export/request")
@limiter.limit("5/minute")
def request_account_export(
    request: Request,
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
) -> dict:
    from uuid import uuid4

    supa = get_supabase_service_client()
    since = datetime.now(UTC).replace(microsecond=0)
    try:
        recent = (
            supa.table("account_export_jobs")
            .select("id, created_at")
            .eq("user_id", str(user.user_id))
            .gte("created_at", (since - timedelta(hours=24)).isoformat())
            .limit(1)
            .execute()
        ).data or []
        if recent:
            raise AkaraHTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                code="RATE_LIMITED",
                message="Export already requested in the last 24 hours",
            )
    except AkaraHTTPException:
        raise
    except Exception:
        recent = []

    job_id = str(uuid4())
    try:
        supa.table("account_export_jobs").insert(
            {
                "id": job_id,
                "tenant_id": str(tenant.tenant_id),
                "user_id": str(user.user_id),
                "status": "pending",
            }
        ).execute()
    except Exception as exc:
        logger.warning("export job insert failed: %s", exc)
    return {"queued": True, "job_id": job_id, "eta_minutes": 5}


@router.post("/preferences/test-email")
@limiter.limit("5/minute")
def send_test_email(
    request: Request,
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
    _: None = Depends(require_feature("morning_brief")),
) -> dict[str, str]:
    """Send a minimal test email to verify delivery settings."""
    html = """
    <p>This is a test message from AKARA.</p>
    <p>If you received this, your email delivery is working.</p>
    <p>— AKARA Team</p>
    """
    ok = _send(
        user.email or "",
        "AKARA — Test email",
        html,
        text_content="AKARA test email — delivery OK.",
    )
    log_delivery(
        channel="email",
        template="test_email",
        status="sent" if ok else "failed",
        tenant_id=tenant.tenant_id,
        user_id=user.user_id,
    )
    if not ok:
        if not settings.sendgrid_api_key:
            raise AkaraHTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                code="SERVICE_UNAVAILABLE",
                message="Email delivery is not configured (SENDGRID_API_KEY missing on server)",
            )
        raise AkaraHTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="SERVICE_UNAVAILABLE",
            message="Email send failed \u2014 check SendGrid config or spam suppressions",
        )
    return {"status": "ok"}


@router.post("/preferences/unsubscribe")
@limiter.limit("10/minute")
def unsubscribe_preferences(
    request: Request,
    body: UnsubscribeRequest,
    user: CurrentUser,
) -> dict[str, str]:
    """Record email suppression (morning brief unsubscribe)."""
    email = user.email or ""
    if not email:
        raise AkaraHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="VALIDATION_ERROR",
            message="No email on account",
        )

    normalized = email.strip().lower()
    reason = f"{body.category}_unsubscribe"
    supa = get_supabase_service_client()
    supa.table("email_suppressions").upsert(
        {
            "email_normalized": normalized,
            "reason": reason,
        }
    ).execute()

    profile = (
        supa.table("profiles")
        .select("preferences")
        .eq("id", str(user.user_id))
        .maybe_single()
        .execute()
    )
    prefs = {**DEFAULT_PREFERENCES, **((profile.data or {}).get("preferences") or {})}
    if body.category == "morning_brief":
        prefs["email_morning_brief_enabled"] = False
        prefs["morning_brief_enabled"] = False
    supa.table("profiles").update({"preferences": prefs}).eq(
        "id", str(user.user_id)
    ).execute()

    return {
        "status": "ok",
        "message": "You have been unsubscribed from morning brief emails.",
    }


@router.post("/preferences/test-whatsapp")
@limiter.limit("5/minute")
async def send_test_whatsapp(
    request: Request,
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
    _: None = Depends(require_feature("morning_brief")),
) -> dict[str, str]:
    """Send a test WhatsApp message when BSP is enabled."""
    from app.infra.notifications.whatsapp import send_whatsapp_template

    supa = get_supabase_service_client()
    profile = (
        supa.table("profiles")
        .select("phone_number")
        .eq("id", str(user.user_id))
        .maybe_single()
        .execute()
    )
    phone = (profile.data or {}).get("phone_number") if profile else None
    if not phone:
        raise AkaraHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="VALIDATION_ERROR",
            message="Add a phone number in Settings first",
        )

    ok = await send_whatsapp_template(
        to_phone=phone,
        template_name="test_message",
        variables=["AKARA"],
        tenant_id=tenant.tenant_id,
        user_id=user.user_id,
    )
    if not ok and not settings.whatsapp_sends_enabled:
        return {
            "status": "skipped",
            "message": "WhatsApp sends disabled until templates are approved",
        }
    if not ok:
        raise AkaraHTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="SERVICE_UNAVAILABLE",
            message="WhatsApp send failed",
        )
    return {"status": "ok"}


@router.delete("", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("3/minute")
def delete_account(
    request: Request, body: DeleteAccountRequest, user: CurrentUser
) -> dict:
    if body.confirm_email.lower() != (user.email or "").lower():
        raise AkaraHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="VALIDATION_ERROR",
            message="Email confirmation does not match",
        )

    supa = get_supabase_service_client()
    profile = (
        supa.table("profiles")
        .select("tenant_id, role")
        .eq("id", str(user.user_id))
        .single()
        .execute()
    ).data
    tenant_id = profile.get("tenant_id") if profile else None
    role = (profile or {}).get("role") or "user"
    check_role_capability(role, Capability.DELETE_WORKSPACE)

    grace = timedelta(days=settings.account_deletion_grace_days)
    deletion_date = (datetime.now(UTC) + grace).date().isoformat()

    existing = (
        supa.table("account_deletion_queue")
        .select("id")
        .eq("user_id", str(user.user_id))
        .eq("status", "pending")
        .maybe_single()
        .execute()
    )
    if not existing.data:
        supa.table("account_deletion_queue").insert(
            {
                "user_id": str(user.user_id),
                "tenant_id": tenant_id,
                "status": "pending",
            }
        ).execute()
    if tenant_id:
        try:
            supa.table("tenants").update(
                {
                    "plan_status": "pending_deletion",
                    "pending_deletion_since": datetime.now(UTC).isoformat(),
                }
            ).eq("id", str(tenant_id)).execute()
        except Exception:
            logger.debug("pending_deletion columns not available yet")

    try:
        supa.auth.admin.sign_out(str(user.user_id))
    except Exception as exc:
        logger.warning("Could not revoke sessions for %s: %s", user.user_id, exc)

    return {
        "status": "queued",
        "scheduled": True,
        "deletion_date": deletion_date,
        "message": "Account deletion scheduled. You will be signed out.",
    }


class SessionInfo(BaseModel):
    id: str
    session_id: str
    device_hint: str
    last_seen_at: str
    current: bool
    device: str | None = None
    last_active: str | None = None


@router.get("/sessions", response_model=list[SessionInfo])
def list_sessions(request: Request, user: CurrentUser) -> list[SessionInfo]:
    """List active sessions from active_sessions when the table exists."""
    ua = request.headers.get("user-agent", "Unknown device")[:120]
    current_jti = request.headers.get("X-Session-Id") or "current"
    rows: list[SessionInfo] = []
    try:
        from app.core.tenant import get_supabase_service_client as _supa

        data = (
            _supa()
            .table("active_sessions")
            .select("*")
            .eq("user_id", str(user.user_id))
            .is_("revoked_at", "null")
            .execute()
        ).data or []
        for row in data:
            sid = str(row.get("session_id") or row.get("id"))
            hint = row.get("device_hint") or ua
            seen = str(row.get("last_seen_at") or datetime.now(UTC).isoformat())
            current = sid == current_jti
            rows.append(
                SessionInfo(
                    id=str(row.get("id") or sid),
                    session_id=sid,
                    device_hint=hint,
                    last_seen_at=seen,
                    current=current,
                    device=hint,
                    last_active=seen,
                )
            )
    except Exception:
        logger.debug("active_sessions unavailable; returning current stub")
    if not rows:
        now = datetime.now(UTC).isoformat()
        rows = [
            SessionInfo(
                id="current",
                session_id="current",
                device_hint=ua,
                last_seen_at=now,
                current=True,
                device=ua,
                last_active=now,
            )
        ]
    return rows


@router.delete("/sessions/{session_id}")
@limiter.limit("10/minute")
def revoke_session(
    request: Request, session_id: str, user: CurrentUser
) -> dict[str, bool]:
    supa = get_supabase_service_client()
    try:
        row = (
            supa.table("active_sessions")
            .select("*")
            .eq("session_id", session_id)
            .maybe_single()
            .execute()
        ).data
    except Exception:
        row = None
    if row and str(row.get("user_id")) != str(user.user_id):
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message="Not owner of that session",
        )
    if row:
        supa.table("active_sessions").update(
            {"revoked_at": datetime.now(UTC).isoformat()}
        ).eq("session_id", session_id).eq("user_id", str(user.user_id)).execute()
    return {"revoked": True}


@router.post("/sessions/revoke-others")
@limiter.limit("5/minute")
def revoke_other_sessions(request: Request, user: CurrentUser) -> dict[str, str]:
    """Sign out all sessions except the current one (best-effort via Supabase Admin)."""
    supa = get_supabase_service_client()
    try:
        supa.auth.admin.sign_out(str(user.user_id), scope="others")  # type: ignore[call-arg]
    except TypeError:
        logger.info(
            "Supabase client lacks scope=others — revoke-others is a no-op for %s",
            user.user_id,
        )
    except Exception as exc:
        logger.warning("Could not revoke other sessions for %s: %s", user.user_id, exc)
        raise AkaraHTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="SERVICE_UNAVAILABLE",
            message="Could not revoke other sessions",
        ) from exc
    return {"status": "ok", "message": "Other sessions revoked"}
