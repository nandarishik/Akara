"""Reports API — list, download, and scheme-leakage analysis.

Endpoints:
  GET  /reports/              — list last 50 generated reports for the tenant
  GET  /reports/scheme-leakage — compare scheme claims vs. actual secondary offtake
  GET  /reports/{report_id}/download — stream XLSX from Supabase Storage
"""

import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.plan_guard import require_feature
from app.core.rate_limit import EXPORT_LIMIT, limiter
from app.core.tenant import TenantCtx, get_supabase_service_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])


class ReportOut(BaseModel):
    id: UUID
    report_type: str
    title: str
    storage_path: str | None = None
    file_size_bytes: int | None = None
    metadata: dict = {}
    created_at: datetime


class SchemeLeakageRow(BaseModel):
    party_name: str
    scheme_name: str
    product_name: str
    claimed_amount: float
    actual_offtake: float
    leakage_amount: float
    scheme_start: str
    scheme_end: str


@router.get("/scheme-leakage", response_model=list[SchemeLeakageRow])
def get_scheme_leakage(
    user: CurrentUser,
    tenant: TenantCtx,
    _: None = Depends(require_feature("scheme_leakage")),  # Business plan only
) -> list[SchemeLeakageRow]:
    """Compare scheme_master claimed amounts vs. actual secondary offtake.

    Returns distributors where claimed > actual, with deniable amount.
    Requires both scheme_master and secondary_sales_data to have data.
    Returns empty list if either table is empty.
    """
    supabase = get_supabase_service_client()
    try:
        result = supabase.rpc(
            "get_scheme_leakage",
            {"p_tenant_id": str(tenant.tenant_id)},
        ).execute()
        rows = result.data or []
        return [SchemeLeakageRow(**row) for row in rows]
    except Exception as exc:
        logger.warning("get_scheme_leakage RPC failed: %s", exc)
        # If the function doesn't exist yet, return empty list gracefully
        return []


@router.get("/", response_model=list[ReportOut])
def list_reports(
    user: CurrentUser,
    tenant: TenantCtx,
) -> list[ReportOut]:
    """List the last 50 generated reports for the tenant."""
    supabase = get_supabase_service_client()
    result = (
        supabase.table("generated_reports")
        .select("*")
        .eq("tenant_id", str(tenant.tenant_id))
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return [ReportOut(**row) for row in (result.data or [])]


@router.get("/{report_id}/download")
@limiter.limit(EXPORT_LIMIT)
def download_report(
    request: Request,
    report_id: UUID,
    user: CurrentUser,
    tenant: TenantCtx,
) -> Response:
    """Download a generated report as an XLSX file from Supabase Storage."""
    supabase = get_supabase_service_client()
    result = (
        supabase.table("generated_reports")
        .select("storage_path, title")
        .eq("id", str(report_id))
        .eq("tenant_id", str(tenant.tenant_id))
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    storage_path = result.data.get("storage_path")
    title = result.data.get("title", "report")

    if not storage_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report file not yet available",
        )

    try:
        file_bytes = supabase.storage.from_("reports").download(storage_path)
        return Response(
            content=file_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{title}.xlsx"'},
        )
    except Exception as exc:
        logger.error("Failed to download report %s: %s", report_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Download failed — file may have been deleted",
        ) from exc
