"""Weekly debrief customer routes."""

from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.services.debrief.metadata_enrich import enrich_debrief_metadata
from app.services.debrief.pdf import render_debrief_pdf
from app.services.debrief.service import WeeklyDebriefService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/debrief", tags=["debrief"])


class DebriefSummary(BaseModel):
    id: UUID
    title: str
    week_start: str
    week_end: str
    generated_at: str | None = None
    limited_mode: bool = False
    headline: str = ""


class DebriefDetail(BaseModel):
    id: UUID
    title: str
    metadata: dict
    created_at: datetime


class DebriefGenerateResponse(BaseModel):
    status: str
    message: str | None = None
    report_id: str | None = None


DEBRIEF_SKIP_MESSAGES: dict[str, str] = {
    "already_generated": "Debrief already exists for this week — no action taken.",
    "lifetime_limit_reached": "Lifetime debrief limit reached.",
    "Fewer than 7 days of data": "Need at least 7 days of sales data.",
}


@router.post("/generate", response_model=DebriefGenerateResponse)
async def generate_debrief(user: CurrentUser, tenant: TenantCtx) -> DebriefGenerateResponse:
    """Generate this week's debrief if missing. No-op when one already exists."""
    if tenant.role not in ("admin", "superadmin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Admin access required")

    service = WeeklyDebriefService(supabase=get_supabase_service_client())
    result = await service.generate_for_tenant(
        tenant.tenant_id,
        force_regenerate=False,
        manual=True,
    )
    friendly = DEBRIEF_SKIP_MESSAGES.get(result.message or "", result.message)
    if result.status == "ok":
        friendly = "Weekly debrief generated."
    elif result.status == "skipped_insufficient_data":
        friendly = DEBRIEF_SKIP_MESSAGES["Fewer than 7 days of data"]
    return DebriefGenerateResponse(
        status=result.status,
        message=friendly,
        report_id=result.report_id,
    )


@router.get("/latest", response_model=DebriefDetail)
def get_latest_debrief(user: CurrentUser, tenant: TenantCtx) -> DebriefDetail:
    supa = get_supabase_service_client()
    result = (
        supa.table("generated_reports")
        .select("*")
        .eq("tenant_id", str(tenant.tenant_id))
        .eq("report_type", "weekly_debrief")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "no_debrief_yet", "message": "No weekly debrief yet"},
        )
    row = result.data[0]
    meta = enrich_debrief_metadata(
        row.get("metadata") or {},
        tenant_id=tenant.tenant_id,
        supabase=supa,
    )
    return DebriefDetail(
        id=UUID(row["id"]),
        title=row["title"],
        metadata=meta,
        created_at=row["created_at"],
    )


@router.get("", response_model=list[DebriefSummary])
def list_debriefs(user: CurrentUser, tenant: TenantCtx) -> list[DebriefSummary]:
    supa = get_supabase_service_client()
    result = (
        supa.table("generated_reports")
        .select("id, title, metadata, created_at")
        .eq("tenant_id", str(tenant.tenant_id))
        .eq("report_type", "weekly_debrief")
        .order("created_at", desc=True)
        .limit(12)
        .execute()
    )
    summaries: list[DebriefSummary] = []
    for row in result.data or []:
        meta = row.get("metadata") or {}
        summaries.append(
            DebriefSummary(
                id=UUID(row["id"]),
                title=row["title"],
                week_start=meta.get("week_start", ""),
                week_end=meta.get("week_end", ""),
                generated_at=meta.get("generated_at"),
                limited_mode=bool(meta.get("limited_mode")),
                headline=meta.get("headline", ""),
            )
        )
    return summaries


@router.get("/{report_id}", response_model=DebriefDetail)
def get_debrief(
    report_id: UUID,
    user: CurrentUser,
    tenant: TenantCtx,
) -> DebriefDetail:
    supa = get_supabase_service_client()
    result = (
        supa.table("generated_reports")
        .select("*")
        .eq("id", str(report_id))
        .eq("tenant_id", str(tenant.tenant_id))
        .eq("report_type", "weekly_debrief")
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Report not found")
    row = result.data
    meta = enrich_debrief_metadata(
        row.get("metadata") or {},
        tenant_id=tenant.tenant_id,
        supabase=supa,
    )
    return DebriefDetail(
        id=UUID(row["id"]),
        title=row["title"],
        metadata=meta,
        created_at=row["created_at"],
    )


@router.get("/{report_id}/pdf")
def download_debrief_pdf(
    report_id: UUID,
    user: CurrentUser,
    tenant: TenantCtx,
) -> Response:
    supa = get_supabase_service_client()
    result = (
        supa.table("generated_reports")
        .select("title, metadata")
        .eq("id", str(report_id))
        .eq("tenant_id", str(tenant.tenant_id))
        .eq("report_type", "weekly_debrief")
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Report not found")

    meta = enrich_debrief_metadata(
        result.data.get("metadata") or {},
        tenant_id=tenant.tenant_id,
        supabase=supa,
    )
    title = result.data.get("title", "weekly_debrief")
    pdf_bytes = render_debrief_pdf(meta, title)
    safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in title)[:80]
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
    )
