import time
from enum import StrEnum
from typing import Annotated, Any
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwk, jwt
from pydantic import BaseModel

from app.core.config import settings

# Supabase newer projects sign JWTs with ES256 + JWKS instead of HS256 + JWT secret.
_JWKS_CACHE: dict[str, Any] | None = None
_JWKS_CACHE_AT: float = 0.0
_JWKS_TTL_SECONDS = 3600


class Capability(StrEnum):
    INVITE_MEMBER = "INVITE_MEMBER"
    CHANGE_MEMBER_ROLE = "CHANGE_MEMBER_ROLE"
    REMOVE_MEMBER = "REMOVE_MEMBER"
    TRANSFER_OWNERSHIP = "TRANSFER_OWNERSHIP"
    DELETE_WORKSPACE = "DELETE_WORKSPACE"
    UPLOAD_DATA = "UPLOAD_DATA"
    DELETE_DATA = "DELETE_DATA"
    SET_ALERTS = "SET_ALERTS"
    MANAGE_BILLING = "MANAGE_BILLING"


ROLE_CAPABILITIES: dict[str, set[Capability]] = {
    "owner": set(Capability),
    "admin": {
        Capability.INVITE_MEMBER,
        Capability.CHANGE_MEMBER_ROLE,
        Capability.REMOVE_MEMBER,
        Capability.UPLOAD_DATA,
        Capability.DELETE_DATA,
        Capability.SET_ALERTS,
        Capability.MANAGE_BILLING,
        Capability.DELETE_WORKSPACE,
    },
    "user": set(),
}


def check_role_capability(role: str, capability: Capability) -> None:
    allowed = ROLE_CAPABILITIES.get(role, set())
    if capability not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(f"Your role ({role}) does not have permission: {capability}"),
        )


class TokenPayload(BaseModel):
    sub: str  # user UUID from Supabase
    email: str | None = None
    role: str | None = None
    aud: str | None = None
    jti: str | None = None


class AuthenticatedUser(BaseModel):
    user_id: UUID
    email: str | None
    role: str | None


_bearer = HTTPBearer()


def _fetch_jwks(force_refresh: bool = False) -> dict[str, Any]:
    global _JWKS_CACHE, _JWKS_CACHE_AT
    now = time.monotonic()
    if force_refresh:
        _JWKS_CACHE = None
        _JWKS_CACHE_AT = 0.0
    if _JWKS_CACHE is not None and (now - _JWKS_CACHE_AT) < _JWKS_TTL_SECONDS:
        return _JWKS_CACHE

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    try:
        response = httpx.get(url, timeout=10.0)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise JWTError(f"Failed to fetch JWKS: {exc}") from exc

    _JWKS_CACHE = response.json()
    _JWKS_CACHE_AT = now
    return _JWKS_CACHE


def _signing_key_from_jwks(token: str, jwks: dict[str, Any]) -> Any:
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    for key_data in jwks.get("keys", []):
        if key_data.get("kid") == kid:
            return jwk.construct(key_data)
    raise JWTError(f"No matching JWK for kid={kid!r}")


def _decode_asymmetric(token: str, alg: str, *, force_refresh: bool) -> dict[str, Any]:
    key = _signing_key_from_jwks(token, _fetch_jwks(force_refresh=force_refresh))
    return jwt.decode(
        token,
        key,
        algorithms=[alg],
        audience="authenticated",
    )


def decode_supabase_jwt(token: str) -> TokenPayload:
    """Validate and decode a Supabase-issued JWT.
    Supports legacy HS256 (JWT secret) and ES256/RS256 (JWKS).
    Raises HTTP 401 on any validation failure.
    """
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", settings.jwt_algorithm)

        if alg == "HS256":
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        elif alg in ("ES256", "RS256"):
            try:
                payload = _decode_asymmetric(token, alg, force_refresh=False)
            except JWTError as exc:
                msg = str(exc).lower()
                if "expired" in msg:
                    raise
                if "signature" in msg:
                    try:
                        payload = _decode_asymmetric(token, alg, force_refresh=True)
                    except JWTError as exc2:
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid token signature",
                            headers={"WWW-Authenticate": "Bearer"},
                        ) from exc2
                else:
                    raise
        else:
            raise JWTError(f"Unsupported JWT algorithm: {alg}")

        return TokenPayload(**payload)
    except HTTPException:
        raise
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
    request: Request,
) -> AuthenticatedUser:
    """FastAPI dependency: validates JWT, returns AuthenticatedUser."""
    payload = decode_supabase_jwt(credentials.credentials)
    user = AuthenticatedUser(
        user_id=UUID(payload.sub),
        email=payload.email,
        role=payload.role,
    )
    if payload.jti:
        from app.core.session_tracker import record_session

        ua = (request.headers.get("user-agent") or "")[:120]
        ip = request.client.host if request.client else None
        record_session(user.user_id, payload.jti, ua, ip)
    return user


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
