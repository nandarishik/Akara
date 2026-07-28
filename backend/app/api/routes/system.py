"""Public system settings endpoints (no auth required)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.tenant import get_supabase_service_client

router = APIRouter(prefix="/system", tags=["system"])


class SystemSettingsResponse(BaseModel):
    maintenance_mode: bool
    signup_open: bool
    environment_banner: str | None = None


class SystemBannerResponse(BaseModel):
    active: bool
    message: str | None = None
    severity: str | None = None
    expires_at: str | None = None


def _load_setting(key: str, default: Any) -> Any:
    supa = get_supabase_service_client()
    row = (
        supa.table("global_settings")
        .select("value")
        .eq("key", key)
        .maybe_single()
        .execute()
    )
    if not row.data:
        return default
    return row.data.get("value", default)


@router.get("/settings", response_model=SystemSettingsResponse)
def get_system_settings() -> SystemSettingsResponse:
    maintenance = _load_setting("maintenance_mode", False)
    signup_open = _load_setting("signup_open", True)
    banner = _load_setting("system_banner", None)
    env_banner = None
    if isinstance(banner, dict) and banner.get("message"):
        env_banner = banner.get("message")
    return SystemSettingsResponse(
        maintenance_mode=bool(maintenance),
        signup_open=bool(signup_open),
        environment_banner=env_banner,
    )


@router.get("/banner", response_model=SystemBannerResponse)
def get_system_banner() -> SystemBannerResponse:
    banner = _load_setting("system_banner", None)
    if not banner or banner is None:
        return SystemBannerResponse(active=False)

    if isinstance(banner, dict):
        expires_at = banner.get("expires_at")
        if expires_at:
            try:
                exp = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=UTC)
                if exp <= datetime.now(UTC):
                    return SystemBannerResponse(active=False)
            except ValueError:
                pass
        message = banner.get("message")
        if not message:
            return SystemBannerResponse(active=False)
        return SystemBannerResponse(
            active=True,
            message=message,
            severity=banner.get("severity", "info"),
            expires_at=expires_at,
        )

    return SystemBannerResponse(active=False)
