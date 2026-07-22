from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.routes.admin.tenants import _require_superadmin
from app.core.auth import CurrentUser
from app.core.tenant import TenantContext, get_supabase_service_client


class AuditLogEntry(BaseModel):
    id: UUID
    tenant_id: UUID | None
    user_id: UUID | None
    action: str
    resource_type: str | None
    details: dict
    ip_address: str | None
    created_at: datetime


router = APIRouter(prefix="/admin/logs", tags=["admin"])


@router.get("/{tenant_id}", response_model=list[AuditLogEntry])
def get_audit_logs(
    tenant_id: UUID,
    user: CurrentUser,
    tenant: TenantContext = Depends(_require_superadmin),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[AuditLogEntry]:
    """Retrieve paginated audit logs for a specific tenant.

    Only accessible to superadmins. Returns up to 500 entries per request.
    """
    supabase = get_supabase_service_client()
    result = (
        supabase.table("audit_log")
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return [AuditLogEntry(**row) for row in (result.data or [])]
