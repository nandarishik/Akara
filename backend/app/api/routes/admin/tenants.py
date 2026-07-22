from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.tenant import TenantContext, TenantCtx, get_supabase_service_client

router = APIRouter(prefix="/admin/tenants", tags=["admin"])


class TenantOut(BaseModel):
    id: UUID
    name: str
    slug: str
    is_active: bool
    config: dict


class TenantCreate(BaseModel):
    name: str
    slug: str
    config: dict = {}


class TenantConfigUpdate(BaseModel):
    config: dict


def _require_superadmin(tenant: TenantCtx) -> TenantContext:
    """Guard: raises 403 if the caller is not a tenant admin."""
    if not tenant.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Superadmin only"
        )
    return tenant


@router.get("/", response_model=list[TenantOut])
def list_tenants(
    user: CurrentUser,
    tenant: TenantContext = Depends(_require_superadmin),
) -> list[TenantOut]:
    supabase = get_supabase_service_client()
    result = (
        supabase.table("tenants").select("*").order("created_at", desc=True).execute()
    )
    return [TenantOut(**row) for row in (result.data or [])]


@router.post("/", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
def create_tenant(
    body: TenantCreate,
    user: CurrentUser,
    tenant: TenantContext = Depends(_require_superadmin),
) -> TenantOut:
    supabase = get_supabase_service_client()
    result = (
        supabase.table("tenants")
        .insert({"name": body.name, "slug": body.slug, "config": body.config})
        .execute()
    )
    return TenantOut(**result.data[0])


@router.patch("/{tenant_id}/config", response_model=TenantOut)
def update_tenant_config(
    tenant_id: UUID,
    body: TenantConfigUpdate,
    user: CurrentUser,
    tenant: TenantContext = Depends(_require_superadmin),
) -> TenantOut:
    """Merge-update a tenant's config JSONB.
    Existing keys not in the request body are preserved (concat operator ||).
    Use this endpoint to set language, industry, currency, or any config field
    after tenant creation — e.g. from the Settings page.
    """
    supabase = get_supabase_service_client()
    result = (
        supabase.rpc(
            "update_tenant_config",
            {"p_tenant_id": str(tenant_id), "p_patch": body.config},
        ).execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return TenantOut(**result.data[0])


@router.patch("/{tenant_id}/deactivate", response_model=TenantOut)
def deactivate_tenant(
    tenant_id: UUID,
    user: CurrentUser,
    tenant: TenantContext = Depends(_require_superadmin),
) -> TenantOut:
    supabase = get_supabase_service_client()
    result = (
        supabase.table("tenants")
        .update({"is_active": False})
        .eq("id", str(tenant_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return TenantOut(**result.data[0])
