"""GET /morning-brief/preview — assemble without sending."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.core.rate_limit import limiter
from app.core.tenant import TenantContext, get_tenant_context
from app.workers.morning_brief_worker import assemble_preview

router = APIRouter(prefix="/morning-brief", tags=["morning-brief"])


@router.get("/preview")
@limiter.limit("20/minute")
async def preview(
    request: Request,
    tenant: TenantContext = Depends(get_tenant_context),
) -> dict:
    return assemble_preview(str(tenant.tenant_id))
