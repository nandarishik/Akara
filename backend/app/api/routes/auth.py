from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.rate_limit import limiter
from app.core.tenant import get_supabase_service_client

router = APIRouter(prefix="/auth", tags=["auth"])


class MeResponse(BaseModel):
    user_id: UUID
    email: str | None
    tenant_id: UUID | None
    role: str


@router.get("/me", response_model=MeResponse)
@limiter.limit("60/minute")
async def me(request: Request, user: CurrentUser) -> MeResponse:
    """Returns the authenticated user's identity and tenant context.

    ``tenant_id`` is ``null`` for self-signup users who have not yet completed
    onboarding step 1. Called by the React frontend on every page load.
    """
    client = get_supabase_service_client()

    try:
        profile_result = (
            client.table("profiles")
            .select("tenant_id, role")
            .eq("id", str(user.user_id))
            .maybe_single()
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
    tenant_id = UUID(raw_tenant_id) if raw_tenant_id else None

    return MeResponse(
        user_id=user.user_id,
        email=user.email,
        tenant_id=tenant_id,
        role=profile_result.data.get("role") or "user",
    )
