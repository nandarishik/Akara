"""Account settings, export, deletion, and notification preferences."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field

from app.core.auth import CurrentUser
from app.core.config import settings
from app.core.plan_guard import require_feature
from app.core.tenant import TenantContext, get_supabase_service_client, get_tenant_context
from app.services.billing.email import _send
from app.services.notifications.delivery_log import log_delivery

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/account", tags=["account"])

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
def update_preferences(
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
    merged = _merge_preferences(profile.data.get("preferences") if profile.data else {}, body)
    supa.table("profiles").update({"preferences": merged}).eq("id", str(user.user_id)).execute()
    return {"preferences": merged}


@router.patch("/profile")
def update_profile(body: ProfileUpdate, user: CurrentUser) -> dict[str, str]:
    update: dict = {}
    if body.display_name is not None:
        update["display_name"] = body.display_name
    if body.phone_number is not None:
        update["phone_number"] = body.phone_number.strip()
    if not update:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    get_supabase_service_client().table("profiles").update(update).eq(
        "id", str(user.user_id)
    ).execute()
    return {"status": "ok"}


@router.get("/export")
def export_account_data(user: CurrentUser, tenant: TenantContext = Depends(get_tenant_context)) -> Response:
    supa = get_supabase_service_client()
    profile = (
        supa.table("profiles")
        .select("*")
        .eq("id", str(user.user_id))
        .single()
        .execute()
    ).data or {}

    payload: dict = {
        "exported_at": datetime.now(UTC).isoformat(),
        "profile": profile,
        "conversations": [],
        "chat_history": [],
        "sales_data": [],
    }

    convos = (
        supa.table("conversations")
        .select("*")
        .eq("tenant_id", str(tenant.tenant_id))
        .eq("user_id", str(user.user_id))
        .execute()
    )
    payload["conversations"] = convos.data or []

    chats = (
        supa.table("chat_history")
        .select("*")
        .eq("tenant_id", str(tenant.tenant_id))
        .eq("user_id", str(user.user_id))
        .execute()
    )
    payload["chat_history"] = chats.data or []

    if tenant.is_admin:
        sales = (
            supa.table("sales_data")
            .select("*")
            .eq("tenant_id", str(tenant.tenant_id))
            .limit(50000)
            .execute()
        )
        payload["sales_data"] = sales.data or []

    content = json.dumps(payload, default=str, indent=2)
    filename = f"akara_export_{datetime.now(UTC).strftime('%Y%m%d')}.json"
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/preferences/test-email")
def send_test_email(
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
    _: None = Depends(require_feature("morning_brief")),
) -> dict[str, str]:
    """Send a minimal test email to verify delivery settings."""
    supa = get_supabase_service_client()
    html = """
    <p>This is a test message from AKARA.</p>
    <p>If you received this, your email delivery is working.</p>
    <p>— AKARA Team</p>
    """
    ok = _send(user.email or "", "AKARA — Test email", html, text_content="AKARA test email — delivery OK.")
    log_delivery(
        channel="email",
        template="test_email",
        status="sent" if ok else "failed",
        tenant_id=tenant.tenant_id,
        user_id=user.user_id,
    )
    if not ok:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="Email send failed")
    return {"status": "ok"}


@router.post("/preferences/unsubscribe")
def unsubscribe_preferences(
    body: UnsubscribeRequest,
    user: CurrentUser,
) -> dict[str, str]:
    """Record email suppression (morning brief unsubscribe)."""
    email = user.email or ""
    if not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No email on account")

    normalized = email.strip().lower()
    reason = f"{body.category}_unsubscribe"
    supa = get_supabase_service_client()
    supa.table("email_suppressions").upsert({
        "email_normalized": normalized,
        "reason": reason,
    }).execute()

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
    supa.table("profiles").update({"preferences": prefs}).eq("id", str(user.user_id)).execute()

    return {"status": "ok", "message": "You have been unsubscribed from morning brief emails."}


@router.post("/preferences/test-whatsapp")
async def send_test_whatsapp(
    user: CurrentUser,
    tenant: TenantContext = Depends(get_tenant_context),
    _: None = Depends(require_feature("morning_brief")),
) -> dict[str, str]:
    """Send a test WhatsApp message when BSP is enabled."""
    from app.services.notifications.whatsapp import send_whatsapp_template

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
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Add a phone number in Settings first")

    ok = await send_whatsapp_template(
        to_phone=phone,
        template_name="test_message",
        variables=["AKARA"],
        tenant_id=tenant.tenant_id,
        user_id=user.user_id,
    )
    if not ok and not settings.whatsapp_sends_enabled:
        return {"status": "skipped", "message": "WhatsApp sends disabled until templates are approved"}
    if not ok:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="WhatsApp send failed")
    return {"status": "ok"}


@router.delete("", status_code=status.HTTP_202_ACCEPTED)
def delete_account(body: DeleteAccountRequest, user: CurrentUser) -> dict[str, str]:
    if body.confirm_email.lower() != (user.email or "").lower():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Email confirmation does not match")

    supa = get_supabase_service_client()
    profile = (
        supa.table("profiles")
        .select("tenant_id, role")
        .eq("id", str(user.user_id))
        .single()
        .execute()
    ).data
    tenant_id = profile.get("tenant_id") if profile else None

    existing = (
        supa.table("account_deletion_queue")
        .select("id")
        .eq("user_id", str(user.user_id))
        .eq("status", "pending")
        .maybe_single()
        .execute()
    )
    if not existing.data:
        supa.table("account_deletion_queue").insert({
            "user_id": str(user.user_id),
            "tenant_id": tenant_id,
            "status": "pending",
        }).execute()

    try:
        supa.auth.admin.sign_out(str(user.user_id))
    except Exception as exc:
        logger.warning("Could not revoke sessions for %s: %s", user.user_id, exc)

    return {"status": "queued", "message": "Account deletion scheduled. You will be signed out."}
