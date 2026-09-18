"""Superadmin authentication, sudo sessions, and CSRF protection."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import Depends, HTTPException, Request, Response, status
from pydantic import BaseModel

from app.core.auth import AuthenticatedUser, CurrentUser
from app.core.config import settings
from app.core.errors import AkaraHTTPException
from app.core.tenant import get_supabase_anon_client, get_supabase_service_client

SUDO_COOKIE = "akara_sudo"
CSRF_COOKIE = "akara_csrf"
CSRF_HEADER = "X-CSRF-Token"
SUDO_TTL = timedelta(minutes=15)


class SuperadminRole(StrEnum):
    SUPER_ADMIN = "SUPER_ADMIN"
    SUPPORT = "SUPPORT"
    BILLING_OPS = "BILLING_OPS"
    CONTENT_OPS = "CONTENT_OPS"


class SudoUser(BaseModel):
    """Authenticated superadmin with a valid sudo session."""

    user_id: UUID
    email: str | None
    role: str | None
    sudo_session_id: UUID
    sudo_expires_at: datetime
    superadmin_role: SuperadminRole | None = None


class SuperAdminCtx(BaseModel):
    user_id: UUID
    email: str | None = None
    superadmin_role: SuperadminRole
    sudo_session_id: UUID | None = None
    sudo_expires_at: datetime | None = None


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def _cookie_secure() -> bool:
    return settings.is_production or settings.is_staging


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def set_sudo_cookies(
    response: Response,
    *,
    session_id: UUID,
    csrf_token: str,
    expires_at: datetime,
) -> None:
    max_age = max(1, int((expires_at - datetime.now(UTC)).total_seconds()))
    response.set_cookie(
        key=SUDO_COOKIE,
        value=str(session_id),
        httponly=True,
        secure=_cookie_secure(),
        samesite="strict",
        max_age=max_age,
        path="/",
    )
    response.set_cookie(
        key=CSRF_COOKIE,
        value=csrf_token,
        httponly=False,
        secure=_cookie_secure(),
        samesite="strict",
        max_age=max_age,
        path="/",
    )


def clear_sudo_cookies(response: Response) -> None:
    response.delete_cookie(SUDO_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")


def get_sudo_session_id(request: Request) -> UUID | None:
    raw = request.cookies.get(SUDO_COOKIE)
    if not raw:
        return None
    try:
        return UUID(raw)
    except ValueError:
        return None


def load_superadmin_role(user_id: UUID) -> SuperadminRole:
    """Load granular role; backfill SUPER_ADMIN when the column is null."""
    supa = get_supabase_service_client()
    profile = (
        supa.table("profiles")
        .select("role, superadmin_role")
        .eq("id", str(user_id))
        .maybe_single()
        .execute()
    )
    raw = (profile.data or {}).get("superadmin_role")
    if raw in SuperadminRole._value2member_map_:
        return SuperadminRole(raw)
    return SuperadminRole.SUPER_ADMIN


async def require_superadmin(
    user: CurrentUser,
) -> AuthenticatedUser:
    """Return the user if they are a superadmin; otherwise 404 (not 403)."""
    if getattr(user, "impersonated", False):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    supa = get_supabase_service_client()
    profile = (
        supa.table("profiles")
        .select("role")
        .eq("id", str(user.user_id))
        .maybe_single()
        .execute()
    )
    if not profile.data or profile.data.get("role") != "superadmin":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return user


def require_role(*allowed: SuperadminRole):
    """Gate a superadmin route to one or more SuperadminRole values."""

    async def _dep(user: SuperAdmin) -> SuperAdminCtx:
        role = load_superadmin_role(user.user_id)
        if role not in allowed:
            raise AkaraHTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                code="FORBIDDEN",
                message="Insufficient superadmin role",
            )
        return SuperAdminCtx(
            user_id=user.user_id,
            email=user.email,
            superadmin_role=role,
        )

    return _dep


SuperAdmin = Annotated[AuthenticatedUser, Depends(require_superadmin)]


def require_csrf(request: Request) -> None:
    """Double-submit cookie CSRF check for superadmin mutations."""
    cookie = request.cookies.get(CSRF_COOKIE)
    header = request.headers.get(CSRF_HEADER)
    if not cookie or not header or cookie != header:
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message="CSRF token mismatch",
        )


async def require_sudo(
    request: Request,
    user: SuperAdmin,
) -> SudoUser:
    """Require a valid, non-expired sudo session for the current superadmin."""
    session_id = get_sudo_session_id(request)
    if not session_id:
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="SUDO_REQUIRED",
            message="Superadmin sudo session required",
        )

    supa = get_supabase_service_client()
    row = (
        supa.table("sudo_sessions")
        .select("id, user_id, expires_at")
        .eq("id", str(session_id))
        .eq("user_id", str(user.user_id))
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="SUDO_REQUIRED",
            message="Superadmin sudo session required",
        )

    expires_raw = row.data["expires_at"]
    expires_at = datetime.fromisoformat(str(expires_raw).replace("Z", "+00:00"))
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at <= datetime.now(UTC):
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="SUDO_EXPIRED",
            message="Sudo session has expired",
        )

    return SudoUser(
        user_id=user.user_id,
        email=user.email,
        role=user.role,
        sudo_session_id=session_id,
        sudo_expires_at=expires_at,
        superadmin_role=load_superadmin_role(user.user_id),
    )


SudoCtx = Annotated[SudoUser, Depends(require_sudo)]


def create_sudo_session(
    *,
    user_id: UUID,
    request: Request,
) -> tuple[UUID, datetime, str]:
    """Verify is not done here — caller must authenticate password first."""
    session_id = uuid4()
    csrf_token = generate_csrf_token()
    expires_at = datetime.now(UTC) + SUDO_TTL
    supa = get_supabase_service_client()
    supa.table("sudo_sessions").insert({
        "id": str(session_id),
        "user_id": str(user_id),
        "expires_at": expires_at.isoformat(),
        "ip_address": _client_ip(request),
        "user_agent": request.headers.get("User-Agent"),
    }).execute()
    return session_id, expires_at, csrf_token


def verify_superadmin_password(email: str, password: str) -> bool:
    """Re-authenticate superadmin via Supabase Auth sign_in_with_password."""
    if not email:
        return False
    anon = get_supabase_anon_client()
    try:
        result = anon.auth.sign_in_with_password({"email": email, "password": password})
        return bool(result.user)
    except Exception:
        return False


def revoke_sudo_session(session_id: UUID, user_id: UUID) -> None:
    supa = get_supabase_service_client()
    supa.table("sudo_sessions").delete().eq("id", str(session_id)).eq(
        "user_id", str(user_id)
    ).execute()


def request_actor_meta(request: Request) -> dict[str, str | None]:
    return {
        "ip_address": _client_ip(request),
        "user_agent": request.headers.get("User-Agent"),
    }
