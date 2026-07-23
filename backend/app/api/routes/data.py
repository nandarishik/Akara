from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.services.data_import.detector import score_sheets
from app.services.data_import.models import ImportResult
from app.services.data_import.service import DataImportService, SourceType

router = APIRouter(prefix="/data", tags=["data"])

_MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

_ALLOWED_CONTENT_TYPES = {
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/octet-stream",  # some browsers send this for .xlsx
}


class SheetInfo(BaseModel):
    sheet_name: str
    score: int
    row_count: int
    detected_header_row: int | None
    detected_columns: list[str]
    reason: str


class SheetListResponse(BaseModel):
    sheets: list[SheetInfo]
    recommended: str | None


class ImportHistoryItem(BaseModel):
    id: str
    title: str
    created_at: str
    metadata: dict


class SyncPayload(BaseModel):
    """
    JSON body for the overnight agent push endpoint.
    The akara_agent.py script POSTs here instead of uploading a file.
    Rows must already be in the canonical column format.
    """
    rows: list[dict[str, Any]]
    source_type: SourceType = "primary"


@router.post("/sheets", response_model=SheetListResponse)
async def list_excel_sheets(
    user: CurrentUser,
    tenant: TenantCtx,
    file: UploadFile = File(...),
) -> SheetListResponse:
    """
    Preview all sheets in an Excel file and return a ranked list with the
    recommended sales sheet highlighted.  Call this before /import when the
    user uploads a multi-sheet Excel so the UI can show a sheet picker.
    """
    if not tenant.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins only")

    content = await file.read()
    filename = file.filename or "upload.xlsx"

    scored = score_sheets(content, filename)
    sheets = [
        SheetInfo(
            sheet_name=s.sheet_name,
            score=s.score,
            row_count=s.row_count,
            detected_header_row=s.detected_header_row,
            detected_columns=s.detected_columns[:10],  # first 10 cols for preview
            reason=s.reason,
        )
        for s in scored
    ]
    recommended = scored[0].sheet_name if scored and scored[0].score > 0 else None
    return SheetListResponse(sheets=sheets, recommended=recommended)


@router.post("/import", response_model=ImportResult, status_code=status.HTTP_201_CREATED)
async def import_data(
    user: CurrentUser,
    tenant: TenantCtx,
    file: UploadFile = File(...),
    source_type: Annotated[SourceType, Query()] = "primary",
    sheet_name: Annotated[str | None, Query(description="Excel sheet name. Omit for auto-detect.")] = None,
) -> ImportResult:
    if not tenant.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can import data",
        )

    content_type = file.content_type or ""
    filename = file.filename or "upload.csv"

    # Accept by content-type OR by file extension (browsers vary on .xlsx)
    ext = filename.rsplit(".", 1)[-1].lower()
    if content_type not in _ALLOWED_CONTENT_TYPES and ext not in ("csv", "xlsx", "xls"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type. Upload a CSV, XLSX, or XLS file.",
        )

    content = await file.read()
    if len(content) > _MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 50 MB limit",
        )

    service = DataImportService(supabase=get_supabase_service_client())
    return service.import_file(
        file_content=content,
        filename=filename,
        tenant_id=tenant.tenant_id,
        source_type=source_type,
        sheet_name=sheet_name,
    )


@router.get("/imports/history", response_model=list[ImportHistoryItem])
def list_import_history(user: CurrentUser, tenant: TenantCtx) -> list[ImportHistoryItem]:
    sb = get_supabase_service_client()
    result = (
        sb.table("generated_reports")
        .select("id, title, metadata, created_at")
        .eq("tenant_id", str(tenant.tenant_id))
        .eq("report_type", "csv_import")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return [ImportHistoryItem(**row) for row in (result.data or [])]


@router.delete("/imports/{import_id}", status_code=status.HTTP_204_NO_CONTENT)
def undo_import(
    import_id: UUID,
    user: CurrentUser,
    tenant: TenantCtx,
) -> None:
    """Delete all rows from a specific upload batch. Scoped to caller's tenant."""
    if not tenant.is_admin:
        raise HTTPException(status_code=403, detail="Admins only")

    sb = get_supabase_service_client()
    tid = str(tenant.tenant_id)
    iid = str(import_id)

    sb.table("sales_data").delete().eq("tenant_id", tid).eq("import_id", iid).execute()
    sb.table("secondary_sales_data").delete().eq("tenant_id", tid).eq("import_id", iid).execute()
    sb.table("scheme_master").delete().eq("tenant_id", tid).eq("import_id", iid).execute()

    sb.table("generated_reports")\
        .delete()\
        .eq("tenant_id", tid)\
        .eq("report_type", "csv_import")\
        .filter("metadata->>'import_id'", "eq", iid)\
        .execute()


@router.post("/sync", response_model=ImportResult, status_code=status.HTTP_201_CREATED)
async def sync_data(
    body: SyncPayload,
    user: CurrentUser,
    tenant: TenantCtx,
) -> ImportResult:
    """
    Accepts a JSON payload of rows from the overnight agent script.
    Used by akara_agent.py running on the customer's Tally/DMS machine.
    Same pipeline as /data/import — tenant-isolated, admin-only.
    """
    if not tenant.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can push data",
        )
    if not body.rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="rows must be a non-empty list",
        )

    import pandas as pd

    df = pd.DataFrame(body.rows)
    csv_bytes = df.to_csv(index=False).encode()

    service = DataImportService(supabase=get_supabase_service_client())
    return service.import_file(
        file_content=csv_bytes,
        filename="agent_push.csv",
        tenant_id=tenant.tenant_id,
        source_type=body.source_type,
    )
