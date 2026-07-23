from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from supabase import Client, create_client

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.config import settings


def get_supabase_service_client() -> Client:
    """Returns a Supabase client using the service role key (bypasses RLS).
    Use for admin operations and tenant lookups.
    """
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_supabase_anon_client() -> Client:
    """Returns a Supabase client using the anon key (respects RLS).
    Use for user-scoped queries.
    """
    return create_client(settings.supabase_url, settings.supabase_anon_key)


class TenantContext:
    """Resolved per-request: tenant_id, user role, plan, and tenant config."""

    def __init__(
        self,
        tenant_id: UUID,
        role: str,
        user_id: UUID,
        tenant_config: dict | None = None,
        plan: str = "free",
        plan_status: str = "active",
        feature_overrides: dict | None = None,
    ) -> None:
        self.tenant_id = tenant_id
        self.role = role
        self.user_id = user_id
        self.tenant_config: dict = tenant_config or {}
        self.plan: str = plan or "free"
        self.plan_status: str = plan_status or "active"
        self.feature_overrides: dict = feature_overrides or {}

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def industry(self) -> str:
        """The tenant's industry slug, e.g. 'fmcg_distribution', 'retail', 'pharma'."""
        return self.tenant_config.get("industry", "")

    @property
    def currency(self) -> str:
        """ISO currency code from tenant config, defaults to 'INR'."""
        return self.tenant_config.get("currency", "INR")

    @property
    def language(self) -> str:
        """Primary language for copilot responses, defaults to 'en'."""
        return self.tenant_config.get("language", "en")

    @property
    def is_active(self) -> bool:
        """True for active and trialing tenants; False for past_due / cancelled."""
        return self.plan_status in ("active", "trialing")


def get_tenant_context(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> TenantContext:
    """FastAPI dependency: looks up the authenticated user's tenant_id, role,
    plan, plan_status, feature_overrides, and tenant config.
    Raises 403 if profile doesn't exist.
    """
    client = get_supabase_service_client()

    # ── 1. Profile lookup ────────────────────────────────────────────────────
    try:
        profile_result = (
            client.table("profiles")
            .select("tenant_id, role")
            .eq("id", str(user.user_id))
            .single()
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
    if not raw_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Complete onboarding setup before accessing the app",
        )

    tenant_id = UUID(raw_tenant_id)

    # ── 2. Tenant lookup — config + billing fields ───────────────────────────
    tenant_config: dict = {}
    plan: str = "free"
    plan_status: str = "active"
    feature_overrides: dict = {}

    try:
        tenant_result = (
            client.table("tenants")
            .select("config, plan, plan_status, feature_overrides")
            .eq("id", str(tenant_id))
            .single()
            .execute()
        )
        if tenant_result.data:
            data = tenant_result.data
            tenant_config = data.get("config") or {}
            plan = data.get("plan") or "free"
            plan_status = data.get("plan_status") or "active"
            feature_overrides = data.get("feature_overrides") or {}
    except Exception:
        pass  # degrade gracefully — use free defaults

    return TenantContext(
        tenant_id=tenant_id,
        role=profile_result.data["role"],
        user_id=user.user_id,
        tenant_config=tenant_config,
        plan=plan,
        plan_status=plan_status,
        feature_overrides=feature_overrides,
    )


TenantCtx = Annotated[TenantContext, Depends(get_tenant_context)]
