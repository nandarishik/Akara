"""Weekly debrief customer routes."""

from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.services.debrief.pdf import render_debrief_pdf

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
    return DebriefDetail(
        id=UUID(row["id"]),
        title=row["title"],
        metadata=row.get("metadata") or {},
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
    return DebriefDetail(
        id=UUID(row["id"]),
        title=row["title"],
        metadata=row.get("metadata") or {},
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

    meta = result.data.get("metadata") or {}
    title = result.data.get("title", "weekly_debrief")
    pdf_bytes = render_debrief_pdf(meta, title)
    safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in title)[:80]
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
    )
