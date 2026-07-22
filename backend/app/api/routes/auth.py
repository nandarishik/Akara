from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx

router = APIRouter(prefix="/auth", tags=["auth"])


class MeResponse(BaseModel):
    user_id: UUID
    email: str | None
    tenant_id: UUID
    role: str


@router.get("/me", response_model=MeResponse)
async def me(user: CurrentUser, tenant: TenantCtx) -> MeResponse:
    """Returns the authenticated user's identity and tenant context.
    Called by the React frontend on every page load to validate the session.
    """
    return MeResponse(
        user_id=user.user_id,
        email=user.email,
        tenant_id=tenant.tenant_id,
        role=tenant.role,
    )
