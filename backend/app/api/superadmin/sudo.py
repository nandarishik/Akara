"""Superadmin sudo session endpoints."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.errors import AkaraHTTPException
from app.core.superadmin import (
    SuperAdmin,
    clear_sudo_cookies,
    create_sudo_session,
    get_sudo_session_id,
    load_superadmin_role,
    require_csrf,
    revoke_sudo_session,
    set_sudo_cookies,
    verify_superadmin_password,
)
from app.core.tenant import get_supabase_service_client
from app.core.totp import (
    record_totp_failure,
    remaining_attempts,
    setup_totp,
    totp_configured,
    verify_totp,
)

router = APIRouter(prefix="/sudo", tags=["superadmin-sudo"])


class SudoStartRequest(BaseModel):
    password: str = Field(..., min_length=1)
    totp_code: str | None = None


class SudoStatusResponse(BaseModel):
    active: bool
    expires_at: str | None = None
    superadmin_role: str | None = None


class SudoStartResponse(BaseModel):
    ok: bool = True
    expires_at: str
    csrf_token: str
    superadmin_role: str


@router.post("/totp/setup")
def totp_setup(user: SuperAdmin) -> dict[str, str]:
    return setup_totp(user.user_id, user.email)


@router.get("/totp/status")
def totp_status(user: SuperAdmin) -> dict[str, bool]:
    return {"configured": totp_configured(user.user_id)}


@router.post("", response_model=SudoStartResponse)
def start_sudo(
    body: SudoStartRequest,
    request: Request,
    response: Response,
    user: SuperAdmin,
) -> SudoStartResponse:
    if not verify_superadmin_password(user.email or "", body.password):
        raise AkaraHTTPException(
            status_code=401,
            code="UNAUTHENTICATED",
            message="Invalid password",
        )

    needs_totp = settings.require_sudo_totp or totp_configured(user.user_id)
    if needs_totp and not verify_totp(user.user_id, body.totp_code):
        record_totp_failure(user.user_id)
        left = remaining_attempts(user.user_id)
        raise AkaraHTTPException(
            status_code=401,
            code="UNAUTHENTICATED",
            message=f"Invalid TOTP. Remaining attempts: {left}",
        )

    session_id, expires_at, csrf_token = create_sudo_session(
        user_id=user.user_id,
        request=request,
    )
    set_sudo_cookies(
        response,
        session_id=session_id,
        csrf_token=csrf_token,
        expires_at=expires_at,
    )
    role = load_superadmin_role(user.user_id)
    return SudoStartResponse(
        expires_at=expires_at.isoformat(),
        csrf_token=csrf_token,
        superadmin_role=role.value,
    )


@router.get("", response_model=SudoStatusResponse)
def sudo_status(
    request: Request,
    user: SuperAdmin,
) -> SudoStatusResponse:
    role = load_superadmin_role(user.user_id).value
    session_id = get_sudo_session_id(request)
    if not session_id:
        return SudoStatusResponse(active=False, superadmin_role=role)

    supa = get_supabase_service_client()
    row = (
        supa.table("sudo_sessions")
        .select("expires_at")
        .eq("id", str(session_id))
        .eq("user_id", str(user.user_id))
        .maybe_single()
        .execute()
    )
    if not row.data:
        return SudoStatusResponse(active=False, superadmin_role=role)

    expires_at = datetime.fromisoformat(str(row.data["expires_at"]).replace("Z", "+00:00"))
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at <= datetime.now(UTC):
        return SudoStatusResponse(active=False, superadmin_role=role)

    return SudoStatusResponse(active=True, expires_at=expires_at.isoformat(), superadmin_role=role)


@router.delete("")
def end_sudo(
    request: Request,
    response: Response,
    user: SuperAdmin,
    _: None = Depends(require_csrf),
) -> dict[str, bool]:
    session_id = get_sudo_session_id(request)
    if session_id:
        revoke_sudo_session(session_id, user.user_id)
    clear_sudo_cookies(response)
    return {"ok": True}
