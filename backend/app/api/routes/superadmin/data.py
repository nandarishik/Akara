"""Superadmin tenant data explorer."""

from __future__ import annotations

import csv
import io
import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel, Field

from app.core.errors import AkaraHTTPException
from app.core.rate_limit import ADMIN_READ_LIMIT, ADMIN_WRITE_LIMIT, EXPORT_LIMIT, limiter
from app.core.superadmin import SuperAdmin, SudoCtx, request_actor_meta, require_csrf
from app.core.tenant import get_supabase_service_client
from app.services.superadmin.audit import record_operation
from app.services.superadmin.mutations import SuperadminMutation, dry_run_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tenants", tags=["superadmin-data"])

PREVIEW_TABLES = frozenset({"sales_data", "secondary_sales_data", "scheme_master"})


class DataSummary(BaseModel):
    row_count: int = 0
    oldest_record_date: str | None = None
    newest_record_date: str | None = None
    distinct_parties: int = 0
    distinct_routes: int = 0
    distinct_zones: int = 0
    total_revenue: float = 0.0
    last_import_at: str | None = None


class DeleteRowsBody(SuperadminMutation):
    date_before: str = Field(..., description="ISO date — delete rows older than this")
    table: str = "sales_data"


def _get_tenant_or_404(tenant_id: UUID) -> dict[str, Any]:
    supa = get_supabase_service_client()
    row = (
        supa.table("tenants")
        .select("id, name")
        .eq("id", str(tenant_id))
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Tenant not found")
    return row.data


@router.get("/{tenant_id}/data/summary", response_model=DataSummary)
@limiter.limit(ADMIN_READ_LIMIT)
def data_summary(
    request: Request,
    tenant_id: UUID,
    _admin: SuperAdmin,
) -> DataSummary:
    _get_tenant_or_404(tenant_id)
    supa = get_supabase_service_client()
    tid = str(tenant_id)

    count = (
        supa.table("sales_data")
        .select("id", count="exact")
        .eq("tenant_id", tid)
        .execute()
    )
    row_count = count.count or 0

    oldest = newest = None
    if row_count:
        oldest_row = (
            supa.table("sales_data")
            .select("invoice_date")
            .eq("tenant_id", tid)
            .order("invoice_date", desc=False)
            .limit(1)
            .execute()
        )
        newest_row = (
            supa.table("sales_data")
            .select("invoice_date")
            .eq("tenant_id", tid)
            .order("invoice_date", desc=True)
            .limit(1)
            .execute()
        )
        oldest = oldest_row.data[0]["invoice_date"] if oldest_row.data else None
        newest = newest_row.data[0]["invoice_date"] if newest_row.data else None

    parties = (
        supa.table("sales_data")
        .select("party_name")
        .eq("tenant_id", tid)
        .not_.is_("party_name", "null")
        .limit(5000)
        .execute()
    )
    distinct_parties = len({r["party_name"] for r in (parties.data or []) if r.get("party_name")})

    routes = (
        supa.table("sales_data")
        .select("route")
        .eq("tenant_id", tid)
        .not_.is_("route", "null")
        .limit(5000)
        .execute()
    )
    distinct_routes = len({r["route"] for r in (routes.data or []) if r.get("route")})

    zones = (
        supa.table("sales_data")
        .select("party_zone")
        .eq("tenant_id", tid)
        .not_.is_("party_zone", "null")
        .limit(5000)
        .execute()
    )
    distinct_zones = len({r["party_zone"] for r in (zones.data or []) if r.get("party_zone")})

    revenue_rows = (
        supa.table("sales_data")
        .select("total_amount")
        .eq("tenant_id", tid)
        .limit(10000)
        .execute()
    )
    total_revenue = sum(float(r.get("total_amount") or 0) for r in (revenue_rows.data or []))

    last_import = (
        supa.table("import_jobs")
        .select("created_at")
        .eq("tenant_id", tid)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    return DataSummary(
        row_count=row_count,
        oldest_record_date=str(oldest) if oldest else None,
        newest_record_date=str(newest) if newest else None,
        distinct_parties=distinct_parties,
        distinct_routes=distinct_routes,
        distinct_zones=distinct_zones,
        total_revenue=round(total_revenue, 2),
        last_import_at=last_import.data[0]["created_at"] if last_import.data else None,
    )


@router.get("/{tenant_id}/data/preview")
@limiter.limit(ADMIN_READ_LIMIT)
def data_preview(
    request: Request,
    tenant_id: UUID,
    _admin: SuperAdmin,
    table: str = Query(default="sales_data"),
    limit: int = Query(default=50, le=100),
) -> dict[str, Any]:
    _get_tenant_or_404(tenant_id)
    if table not in PREVIEW_TABLES:
        raise AkaraHTTPException(
            status_code=400,
            code="VALIDATION_ERROR",
            message=f"table must be one of: {', '.join(sorted(PREVIEW_TABLES))}",
        )
    supa = get_supabase_service_client()
    rows = (
        supa.table(table)
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .limit(limit)
        .execute()
    )
    return {"table": table, "rows": rows.data or [], "count": len(rows.data or [])}


@router.get("/{tenant_id}/data/export")
@limiter.limit(EXPORT_LIMIT)
def data_export(
    request: Request,
    tenant_id: UUID,
    _admin: SuperAdmin,
    table: str = Query(default="sales_data"),
) -> Response:
    _get_tenant_or_404(tenant_id)
    if table not in PREVIEW_TABLES:
        raise AkaraHTTPException(
            status_code=400,
            code="VALIDATION_ERROR",
            message=f"table must be one of: {', '.join(sorted(PREVIEW_TABLES))}",
        )

    supa = get_supabase_service_client()
    rows = (
        supa.table(table)
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .limit(50000)
        .execute()
    )
    data = rows.data or []
    if not data:
        return Response(
            content="",
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{table}_{tenant_id}.csv"'},
        )

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(data[0].keys()))
    writer.writeheader()
    writer.writerows(data)

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{table}_{tenant_id}.csv"'},
    )


@router.delete("/{tenant_id}/data/rows")
@limiter.limit(ADMIN_WRITE_LIMIT)
def delete_data_rows(
    request: Request,
    tenant_id: UUID,
    body: DeleteRowsBody,
    admin: SudoCtx,
    _: None = Depends(require_csrf),
) -> dict[str, Any]:
    _get_tenant_or_404(tenant_id)
    if body.table not in PREVIEW_TABLES:
        raise AkaraHTTPException(
            status_code=400,
            code="VALIDATION_ERROR",
            message=f"table must be one of: {', '.join(sorted(PREVIEW_TABLES))}",
        )

    supa = get_supabase_service_client()
    date_col = "invoice_date" if body.table == "sales_data" else "created_at"
    count = (
        supa.table(body.table)
        .select("id", count="exact")
        .eq("tenant_id", str(tenant_id))
        .lt(date_col, body.date_before)
        .execute()
    )
    to_delete = count.count or 0

    if body.dry_run:
        return dry_run_response(
            action="superadmin.data.delete_rows",
            impact={
                "table": body.table,
                "date_before": body.date_before,
                "rows_to_delete": to_delete,
            },
        )

    supa.table(body.table).delete().eq("tenant_id", str(tenant_id)).lt(
        date_col, body.date_before
    ).execute()

    meta = request_actor_meta(request)
    audit = record_operation(
        action="superadmin.data.delete_rows",
        actor_id=admin.user_id,
        actor_email=admin.email,
        reason=body.reason,
        tenant_id=tenant_id,
        before_state={"rows_matched": to_delete},
        after_state={"rows_deleted": to_delete},
        operation_id=body.operation_id,
        resource_type="data",
        resource_id=str(tenant_id),
        details={"table": body.table, "date_before": body.date_before},
        **meta,
    )
    return {"ok": True, "rows_deleted": to_delete, "audit": audit}
