"""Admin Reports API — manual trigger for morning brief.

Endpoints:
  POST /admin/reports/morning-brief
    - Accepts X-Service-Key header (for Supabase Edge Function cron), OR
    - Accepts a valid superadmin JWT (Authorization: Bearer ...).
    - Computes insights, renders HTML, sends via SendGrid.
    - Returns BriefResult.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.tenant import get_supabase_service_client
from app.services.email.morning_brief import BriefResult, MorningBriefService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/reports", tags=["admin"])


class BriefRequest(BaseModel):
    tenant_id: UUID
    recipient_email: str
    recipient_name: str = ""
    tenant_name: str = "AKARA Tenant"


def _authorize(x_service_key: str | None, request: Request) -> None:
    """Allow access if service key matches OR if the caller is a superadmin.

    Raises HTTPException 401/403 if neither condition is satisfied.
    """
    # 1. Service key path (used by Supabase Edge Function)
    if (
        settings.backend_service_key
        and x_service_key == settings.backend_service_key
    ):
        return

    # 2. JWT path — verify superadmin role
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Provide X-Service-Key header or Authorization: Bearer <superadmin-jwt>",
        )

    token = auth_header.split(" ", 1)[1]
    supabase = get_supabase_service_client()

    try:
        import jose.jwt as jwt  # python-jose already installed

        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        profile = (
            supabase.table("profiles")
            .select("role")
            .eq("id", user_id)
            .single()
            .execute()
        )
        if not profile.data or profile.data.get("role") != "superadmin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Superadmin role required",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {exc}",
        ) from exc


@router.post("/morning-brief", response_model=BriefResult)
def trigger_morning_brief(
    body: BriefRequest,
    request: Request,
    x_service_key: str | None = Header(default=None),
) -> BriefResult:
    """Trigger a morning brief email for a specific tenant/recipient.

    Authorization (either of):
    - X-Service-Key header (used by Supabase Edge Function cron)
    - Valid superadmin JWT (used for manual admin console testing)
    """
    _authorize(x_service_key, request)

    supabase = get_supabase_service_client()

    # Fetch tenant name if not provided
    tenant_name = body.tenant_name
    if tenant_name == "AKARA Tenant":
        try:
            t_res = (
                supabase.table("tenants")
                .select("name")
                .eq("id", str(body.tenant_id))
                .single()
                .execute()
            )
            if t_res.data:
                tenant_name = t_res.data.get("name", tenant_name)
        except Exception:
            pass

    service = MorningBriefService(supabase=supabase)
    result = service.send_brief(
        tenant_id=body.tenant_id,
        recipient_email=body.recipient_email,
        recipient_name=body.recipient_name,
        tenant_name=tenant_name,
    )

    if not result.success:
        logger.error(
            "Morning brief failed for %s (tenant %s): %s",
            body.recipient_email,
            body.tenant_id,
            result.message,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.message,
        )

    return result
