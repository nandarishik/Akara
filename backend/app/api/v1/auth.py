import hashlib
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.core.auth import CurrentUser
from app.core.config import settings
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


class ConsentStatusResponse(BaseModel):
    terms_version: str
    privacy_version: str
    accepted_terms: str | None = None
    accepted_privacy: str | None = None
    ai_processing: bool = False
    reaccept_required: bool = False


class ConsentAcceptRequest(BaseModel):
    terms: bool = Field(..., description="User accepts current Terms of Service")
    privacy: bool = Field(..., description="User accepts current Privacy Policy")
    ai_processing: bool = Field(..., description="User consents to AI processing of sales data")


@router.get("/consent-status", response_model=ConsentStatusResponse)
@limiter.limit("30/minute")
async def consent_status(request: Request, user: CurrentUser) -> ConsentStatusResponse:
    """Return whether the user must re-accept updated legal documents."""
    client = get_supabase_service_client()

    terms_version = settings.terms_version
    privacy_version = settings.privacy_version
    try:
        for key in ("terms", "privacy"):
            row = (
                client.table("document_versions")
                .select("version, requires_reacceptance")
                .eq("document_key", key)
                .eq("is_published", True)
                .order("effective_at", desc=True)
                .limit(1)
                .execute()
            )
            if row.data and isinstance(row.data, list) and row.data:
                ver = str(row.data[0]["version"])
                if key == "terms":
                    terms_version = ver
                else:
                    privacy_version = ver
    except Exception:
        pass

    latest = (
        client.table("consent_log")
        .select("version_tos, version_privacy, ai_processing")
        .eq("user_id", str(user.user_id))
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    row = (latest.data or [{}])[0] if latest.data else {}
    accepted_terms = row.get("version_tos")
    accepted_privacy = row.get("version_privacy")
    ai_ok = bool(row.get("ai_processing"))

    try:
        for key, ver in (("terms", terms_version), ("privacy", privacy_version)):
            uc = (
                client.table("user_consents")
                .select("version")
                .eq("user_id", str(user.user_id))
                .eq("document_key", key)
                .eq("version", ver)
                .maybe_single()
                .execute()
            )
            if uc.data and isinstance(uc.data, dict):
                if key == "terms":
                    accepted_terms = ver
                else:
                    accepted_privacy = ver
    except Exception:
        pass

    reaccept = (
        accepted_terms != terms_version
        or accepted_privacy != privacy_version
        or not ai_ok
    )
    return ConsentStatusResponse(
        terms_version=terms_version,
        privacy_version=privacy_version,
        accepted_terms=accepted_terms,
        accepted_privacy=accepted_privacy,
        ai_processing=ai_ok,
        reaccept_required=reaccept,
    )


@router.post("/consent-accept", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def consent_accept(
    request: Request,
    body: ConsentAcceptRequest,
    user: CurrentUser,
) -> None:
    if not (body.terms and body.privacy and body.ai_processing):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All consent checkboxes must be accepted",
        )
    client = get_supabase_service_client()
    ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(ip.encode()).hexdigest()
    ua = request.headers.get("user-agent")

    terms_version = settings.terms_version
    privacy_version = settings.privacy_version
    try:
        from app.infra.legal.document_service import get_published_document, record_user_consent

        terms_doc = get_published_document("terms")
        privacy_doc = get_published_document("privacy")
        if terms_doc:
            terms_version = str(terms_doc.get("version") or terms_version)
        if privacy_doc:
            privacy_version = str(privacy_doc.get("version") or privacy_version)
        record_user_consent(
            user_id=user.user_id,
            document_key="terms",
            version=terms_version,
            ip_hash=ip_hash,
            user_agent=ua,
        )
        record_user_consent(
            user_id=user.user_id,
            document_key="privacy",
            version=privacy_version,
            ip_hash=ip_hash,
            user_agent=ua,
        )
    except Exception:
        pass

    client.table("consent_log").insert(
        {
            "user_id": str(user.user_id),
            "version_tos": terms_version,
            "version_privacy": privacy_version,
            "ai_processing": True,
            "ip_hash": ip_hash,
        }
    ).execute()
