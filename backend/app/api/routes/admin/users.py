from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.routes.admin.tenants import _require_superadmin
from app.core.auth import CurrentUser
from app.core.tenant import TenantContext, get_supabase_service_client

router = APIRouter(prefix="/admin/users", tags=["admin"])


class UserOut(BaseModel):
    id: UUID
    tenant_id: UUID
    role: str
    display_name: str | None = None


class UserRoleUpdate(BaseModel):
    role: str


@router.get("/{tenant_id}", response_model=list[UserOut])
def list_users_for_tenant(
    tenant_id: UUID,
    user: CurrentUser,
    tenant: TenantContext = Depends(_require_superadmin),
) -> list[UserOut]:
    supabase = get_supabase_service_client()
    result = (
        supabase.table("profiles")
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .execute()
    )
    return [UserOut(**row) for row in (result.data or [])]


@router.patch("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: UUID,
    body: UserRoleUpdate,
    user: CurrentUser,
    tenant: TenantContext = Depends(_require_superadmin),
) -> UserOut:
    if body.role not in ("admin", "user"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'admin' or 'user'",
        )
    supabase = get_supabase_service_client()
    result = (
        supabase.table("profiles")
        .update({"role": body.role})
        .eq("id", str(user_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut(**result.data[0])
