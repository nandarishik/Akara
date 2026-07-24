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


class TenantDebriefStatus(BaseModel):
    tenant_id: str
    last_debrief_at: str | None
    debrief_count: int
    last_email_status: str | None
    last_whatsapp_status: str | None


def _require_superadmin(tenant: TenantCtx) -> TenantContext:
    """Guard: raises 403 if the caller is not a tenant admin."""
    if not tenant.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Superadmin only"
        )
    return tenant


@router.get("/{tenant_id}/debrief-status", response_model=TenantDebriefStatus)
def tenant_debrief_status(
    tenant_id: UUID,
    _admin: TenantContext = Depends(_require_superadmin),
) -> TenantDebriefStatus:
    supa = get_supabase_service_client()
    tid = str(tenant_id)

    report = (
        supa.table("generated_reports")
        .select("created_at")
        .eq("tenant_id", tid)
        .eq("report_type", "weekly_debrief")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    last_at = report.data[0]["created_at"] if report.data else None

    usage = supa.rpc("get_current_usage", {"p_tenant_id": tid}).execute()
    debrief_count = int((usage.data or {}).get("debrief_count") or 0)

    deliveries = (
        supa.table("delivery_logs")
        .select("channel, status")
        .eq("tenant_id", tid)
        .eq("template", "weekly_debrief")
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    last_email = last_wa = None
    for row in deliveries.data or []:
        if row.get("channel") == "email" and last_email is None:
            last_email = row.get("status")
        if row.get("channel") == "whatsapp" and last_wa is None:
            last_wa = row.get("status")

    return TenantDebriefStatus(
        tenant_id=tid,
        last_debrief_at=last_at,
        debrief_count=debrief_count,
        last_email_status=last_email,
        last_whatsapp_status=last_wa,
    )


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
