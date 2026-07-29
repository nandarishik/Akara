from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.rate_limit import limiter
from app.core.tenant import get_supabase_service_client

router = APIRouter(prefix="/auth", tags=["auth"])


class MeResponse(BaseModel):
    user_id: UUID
    email: str | None
    tenant_id: UUID | None
    role: str
    display_name: str | None = None
    impersonating_tenant_id: UUID | None = None
    impersonating_tenant_name: str | None = None
    impersonation_session_id: UUID | None = None


def _active_impersonation(user_id: UUID) -> dict | None:
    supa = get_supabase_service_client()
    now = datetime.now(UTC).isoformat()
    row = (
        supa.table("impersonation_sessions")
        .select("id, tenant_id, expires_at")
        .eq("target_user_id", str(user_id))
        .is_("ended_at", "null")
        .gt("expires_at", now)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not row.data:
        return None
    session = row.data[0]
    tenant_name = None
    tid = session.get("tenant_id")
    if tid:
        tenant = (
            supa.table("tenants")
            .select("name")
            .eq("id", tid)
            .maybe_single()
            .execute()
        )
        if tenant.data:
            tenant_name = tenant.data.get("name")
    return {
        "session_id": session.get("id"),
        "tenant_id": tid,
        "tenant_name": tenant_name,
    }


@router.get("/me", response_model=MeResponse)
@limiter.limit("60/minute")
async def me(request: Request, user: CurrentUser) -> MeResponse:
    """Returns the authenticated user's identity and tenant context.

    ``tenant_id`` is ``null`` for self-signup users who have not yet completed
    onboarding step 1. Called by the React frontend on every page load.
    """
    client = get_supabase_service_client()

    try:
        profile_result = (
            client.table("profiles")
            .select("tenant_id, role, display_name")
            .eq("id", str(user.user_id))
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User profile not found",
        ) from exc

    if not profile_result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User profile not found",
        )

    raw_tenant_id = profile_result.data.get("tenant_id")
    tenant_id = UUID(raw_tenant_id) if raw_tenant_id else None

    impersonation = _active_impersonation(user.user_id)
    imp_tid = imp_sid = None
    imp_name = None
    if impersonation:
        if impersonation.get("tenant_id"):
            imp_tid = UUID(str(impersonation["tenant_id"]))
        if impersonation.get("session_id"):
            imp_sid = UUID(str(impersonation["session_id"]))
        imp_name = impersonation.get("tenant_name")

    return MeResponse(
        user_id=user.user_id,
        email=user.email,
        tenant_id=tenant_id,
        role=profile_result.data.get("role") or "user",
        display_name=profile_result.data.get("display_name"),
        impersonating_tenant_id=imp_tid,
        impersonating_tenant_name=imp_name,
        impersonation_session_id=imp_sid,
    )
