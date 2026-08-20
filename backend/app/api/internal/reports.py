"""Internal reports API — service-to-service triggers (edge functions / crons).

Endpoints:
  POST /admin/reports/morning-brief
  POST /admin/reports/weekly-debrief
  POST /admin/reports/weekly-debrief/{tenant_id}
"""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.rate_limit import BROADCAST_LIMIT, limiter
from app.core.tenant import get_supabase_service_client
from app.domain.debrief.service import WeeklyDebriefService
from app.infra.email.morning_brief import BriefResult, MorningBriefService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/reports", tags=["internal"])


class BriefRequest(BaseModel):
    tenant_id: UUID
    recipient_email: str
    recipient_name: str = ""
    tenant_name: str = "AKARA Tenant"


def _authorize(x_service_key: str | None, request: Request) -> None:
    """Allow access if service key matches OR if the caller is a superadmin."""
    if settings.backend_service_key and x_service_key == settings.backend_service_key:
        return

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Provide X-Service-Key header or Authorization: Bearer <superadmin-jwt>",
        )

    token = auth_header.split(" ", 1)[1]
    supabase = get_supabase_service_client()

    try:
        from app.core.auth import decode_supabase_jwt

        payload = decode_supabase_jwt(token)
        user_id = payload.sub

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
@limiter.limit(BROADCAST_LIMIT)
def trigger_morning_brief(
    request: Request,
    body: BriefRequest,
    x_service_key: str | None = Header(default=None),
) -> BriefResult:
    """Trigger a morning brief email for a specific tenant/recipient."""
    _authorize(x_service_key, request)

    supabase = get_supabase_service_client()

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


class WeeklyDebriefRequest(BaseModel):
    tenant_id: UUID
    force_regenerate: bool = False
    reason: str = ""


class TenantWeeklyDebriefRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)
    force_regenerate: bool = False


class WeeklyDebriefResponse(BaseModel):
    status: str
    report_id: str | None = None
    week_start: str = ""
    week_end: str = ""
    email_delivery: str = "skipped"
    whatsapp_delivery: str = "skipped"
    message: str = ""


@router.post("/weekly-debrief", response_model=WeeklyDebriefResponse)
@limiter.limit(BROADCAST_LIMIT)
async def trigger_weekly_debrief(
    request: Request,
    body: WeeklyDebriefRequest,
    x_service_key: str | None = Header(default=None),
) -> WeeklyDebriefResponse:
    """Manually trigger weekly debrief for one tenant."""
    _authorize(x_service_key, request)

    supabase = get_supabase_service_client()
    service = WeeklyDebriefService(supabase=supabase)
    result = await service.generate_for_tenant(
        body.tenant_id,
        force_regenerate=body.force_regenerate,
        manual=True,
    )

    if result.status not in ("ok", "skipped", "skipped_insufficient_data"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.message,
        )

    return WeeklyDebriefResponse(
        status=result.status,
        report_id=result.report_id,
        week_start=result.week_start,
        week_end=result.week_end,
        email_delivery=result.email_delivery,
        whatsapp_delivery=result.whatsapp_delivery,
        message=result.message,
    )


@router.post("/weekly-debrief/{tenant_id}", response_model=WeeklyDebriefResponse)
@limiter.limit(BROADCAST_LIMIT)
async def trigger_weekly_debrief_for_tenant(
    request: Request,
    tenant_id: UUID,
    body: TenantWeeklyDebriefRequest,
    x_service_key: str | None = Header(default=None),
) -> WeeklyDebriefResponse:
    """Superadmin/service trigger for a specific tenant with audit reason."""
    _authorize(x_service_key, request)
    logger.info(
        "Manual weekly debrief tenant=%s reason=%s force=%s",
        tenant_id,
        body.reason[:120],
        body.force_regenerate,
    )

    supabase = get_supabase_service_client()
    service = WeeklyDebriefService(supabase=supabase)
    result = await service.generate_for_tenant(
        tenant_id,
        force_regenerate=body.force_regenerate,
        manual=True,
    )

    if result.status not in ("ok", "skipped", "skipped_insufficient_data"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.message,
        )

    return WeeklyDebriefResponse(
        status=result.status,
        report_id=result.report_id,
        week_start=result.week_start,
        week_end=result.week_end,
        email_delivery=result.email_delivery,
        whatsapp_delivery=result.whatsapp_delivery,
        message=result.message,
    )
