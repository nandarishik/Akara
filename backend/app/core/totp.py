"""Superadmin TOTP helpers — pyotp + AES-GCM encrypted secrets."""

from __future__ import annotations

import base64
import hashlib
import html
import os
from datetime import UTC, datetime, timedelta
from uuid import UUID

import pyotp
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings
from app.core.errors import AkaraHTTPException
from app.core.tenant import get_supabase_service_client

_LOCKOUT_WINDOW = timedelta(minutes=15)
_MAX_FAILURES = 5
_failures: dict[str, list[datetime]] = {}


def _aes_key() -> bytes:
    raw = (settings.superadmin_totp_encryption_key or settings.jwt_secret).encode()
    return hashlib.sha256(raw).digest()


def encrypt_secret(plain: str) -> str:
    nonce = os.urandom(12)
    token = AESGCM(_aes_key()).encrypt(nonce, plain.encode(), None)
    return base64.b64encode(nonce + token).decode()


def decrypt_secret(blob: str) -> str:
    raw = base64.b64decode(blob)
    nonce, token = raw[:12], raw[12:]
    return AESGCM(_aes_key()).decrypt(nonce, token, None).decode()


def _svg_qr(uri: str) -> str:
    """SVG wrapper for the otpauth URI (no extra QR dependency)."""
    safe = html.escape(uri)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">'
        '<rect width="256" height="256" fill="#fff"/>'
        f'<text x="8" y="128" font-size="8" font-family="monospace">{safe}</text>'
        "</svg>"
    )


def setup_totp(user_id: UUID, email: str | None) -> dict[str, str]:
    supa = get_supabase_service_client()
    existing = (
        supa.table("superadmin_totp_secrets")
        .select("user_id")
        .eq("user_id", str(user_id))
        .maybe_single()
        .execute()
    )
    if existing.data:
        raise AkaraHTTPException(
            status_code=409,
            code="CONFLICT",
            message="TOTP already configured",
        )
    secret = pyotp.random_base32()
    issuer = "AKARA Superadmin"
    label = email or str(user_id)
    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=label, issuer_name=issuer)
    supa.table("superadmin_totp_secrets").insert({
        "user_id": str(user_id),
        "encrypted_secret": encrypt_secret(secret),
    }).execute()
    return {"provisioning_uri": uri, "qr_code_svg": _svg_qr(uri)}


def totp_configured(user_id: UUID) -> bool:
    try:
        row = (
            get_supabase_service_client()
            .table("superadmin_totp_secrets")
            .select("user_id")
            .eq("user_id", str(user_id))
            .maybe_single()
            .execute()
        )
    except Exception:
        return False
    return isinstance(row.data, dict) and bool(row.data)


def remaining_attempts(user_id: UUID) -> int:
    now = datetime.now(UTC)
    key = str(user_id)
    stamps = [t for t in _failures.get(key, []) if now - t < _LOCKOUT_WINDOW]
    _failures[key] = stamps
    return max(0, _MAX_FAILURES - len(stamps))


def record_totp_failure(user_id: UUID) -> None:
    key = str(user_id)
    _failures.setdefault(key, []).append(datetime.now(UTC))


def clear_totp_failures(user_id: UUID) -> None:
    _failures.pop(str(user_id), None)


def verify_totp(user_id: UUID, code: str | None) -> bool:
    if remaining_attempts(user_id) <= 0:
        raise AkaraHTTPException(
            status_code=429,
            code="RATE_LIMITED",
            message="TOTP locked out. Try again in 15 minutes.",
        )
    if not code:
        return False
    row = (
        get_supabase_service_client()
        .table("superadmin_totp_secrets")
        .select("encrypted_secret")
        .eq("user_id", str(user_id))
        .maybe_single()
        .execute()
    )
    if not row.data:
        return not settings.require_sudo_totp
    secret = decrypt_secret(row.data["encrypted_secret"])
    ok = pyotp.TOTP(secret).verify(code, valid_window=1)
    if ok:
        clear_totp_failures(user_id)
        get_supabase_service_client().table("superadmin_totp_secrets").update({
            "last_used_at": datetime.now(UTC).isoformat(),
        }).eq("user_id", str(user_id)).execute()
    return ok
