import logging
from typing import Annotated

from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.plan_guard import (
    require_feature,
    require_import_quota,
    require_undo_quota,
)
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.services.data_import.detector import score_sheets
from app.services.data_import.models import ImportResult
from app.services.data_import.service import DataImportService, SourceType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/data", tags=["data"])

_MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

_ALLOWED_CONTENT_TYPES = {
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/octet-stream",  # some browsers send this for .xlsx
}

# Source types that require the secondary_sales feature (Pro+)
_RESTRICTED_SOURCE_TYPES = {"secondary", "scheme"}


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
    """
    Import a CSV or Excel file into the appropriate table.

    - **source_type=primary**   → `sales_data`  (POS / ERP dispatch invoices)
    - **source_type=secondary** → `secondary_sales_data` (DMS offtake)
    - **source_type=scheme**    → `scheme_master` (distributor scheme claims)
    - **sheet_name**            → For multi-sheet Excel (e.g. Petpooja 49-sheet
                                   export): pass the sheet name returned by
                                   `POST /data/sheets`. Omit to auto-detect.

    **Supported formats:** CSV, XLSX, XLS from Petpooja, TallyPrime, Marg ERP,
    Vyapar, Busy, GoFrugal, myBillBook, and any generic spreadsheet.
    """
    if not tenant.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can import data",
        )

    content_type = file.content_type or ""
    filename = file.filename or "upload.csv"
    ext = filename.rsplit(".", 1)[-1].lower()

    # Accept by content-type OR by file extension (browsers vary)
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

    # Feature gate: secondary/scheme sources require Pro+
    if source_type in _RESTRICTED_SOURCE_TYPES:
        await require_feature("secondary_sales")(tenant)

    service = DataImportService(supabase=get_supabase_service_client())

    # Parse first so quota checks use actual row count (not file-size estimate)
    try:
        df = service.parse_dataframe(content, filename, source_type, sheet_name)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    row_count = len(df)
    if row_count == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No data rows found in file. Check the format and try again.",
        )

    await require_import_quota(row_count)(tenant)

    supa = get_supabase_service_client()

    # Create import job record before importing
    import_job_id: str | None = None
    try:
        job_result = supa.table("import_jobs").insert({
            "tenant_id":   str(tenant.tenant_id),
            "user_id":     str(user.user_id),
            "source_type": str(source_type),
            "filename":    filename,
            "status":      "completed",
        }).execute()
        if job_result.data:
            import_job_id = job_result.data[0]["id"]
    except Exception as exc:
        logger.warning("Failed to create import_job record: %s", exc)

    result = service.import_dataframe(
        df,
        tenant_id=tenant.tenant_id,
        source_type=source_type,
        filename=filename,
        sheet_name=sheet_name,
        import_job_id=import_job_id,
    )

    rows_inserted = result.rows_inserted or 0
    if result.errors and rows_inserted < row_count:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Import stopped after {rows_inserted:,} of {row_count:,} rows. "
                f"{result.errors[0]}"
            ),
        )

    # Update import_job with actual row count
    if import_job_id:
        try:
            supa.table("import_jobs").update({
                "rows_inserted": rows_inserted,
                "rows_skipped":  result.rows_skipped or 0,
            }).eq("id", import_job_id).execute()
        except Exception as exc:
            logger.warning("Failed to update import_job rows: %s", exc)

    # Increment usage counters after successful import
    try:
        supa.rpc("increment_usage", {
            "p_tenant_id": str(tenant.tenant_id),
            "p_field":     "rows_imported",
            "p_amount":    rows_inserted,
        }).execute()
        supa.rpc("increment_usage", {
            "p_tenant_id": str(tenant.tenant_id),
            "p_field":     "uploads_count",
        }).execute()
        supa.rpc("increment_usage", {
            "p_tenant_id": str(tenant.tenant_id),
            "p_field":     "uploads_today",
        }).execute()
    except Exception as exc:
        logger.warning("Failed to increment import usage: %s", exc)

    return result


@router.delete("/imports/{import_job_id}", status_code=status.HTTP_200_OK)
async def undo_import(
    import_job_id: str,
    user: CurrentUser,
    tenant: TenantCtx,
    _undo_quota=Depends(require_undo_quota()),  # 2/day hard cap, all plans
) -> dict:
    """Delete all rows from a specific import job (undo).

    Limited to 2 undos per day per tenant (all plans) to prevent abuse.
    UI shows this as "Undo import" with a trash icon in the Data page
    import history table.
    """
    if not tenant.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can undo imports",
        )

    supa = get_supabase_service_client()

    # Verify job belongs to this tenant and is not already deleted
    try:
        job_result = (
            supa.table("import_jobs")
            .select("id, rows_inserted, status")
            .eq("id", import_job_id)
            .eq("tenant_id", str(tenant.tenant_id))
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Import job not found") from exc

    if not job_result.data:
        raise HTTPException(status_code=404, detail="Import job not found")

    job = job_result.data
    if job.get("status") == "deleted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This import has already been undone",
        )

    rows_to_delete = job.get("rows_inserted", 0)

    # Delete rows tagged with this import_job_id
    try:
        supa.table("sales_data").delete() \
            .eq("tenant_id", str(tenant.tenant_id)) \
            .eq("import_job_id", import_job_id) \
            .execute()
    except Exception as exc:
        logger.error("Failed to delete sales_data rows for job %s: %s", import_job_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete imported rows. Please try again.",
        ) from exc

    # Mark job as deleted
    try:
        supa.table("import_jobs").update({"status": "deleted"}) \
            .eq("id", import_job_id) \
            .execute()
    except Exception as exc:
        logger.warning("Failed to mark import_job as deleted: %s", exc)

    # Increment undo counter
    try:
        supa.rpc("increment_usage", {
            "p_tenant_id": str(tenant.tenant_id),
            "p_field":     "undos_today",
        }).execute()
    except Exception as exc:
        logger.warning("Failed to increment undo usage: %s", exc)

    return {"deleted": True, "rows_removed": rows_to_delete}


class SyncPayload(BaseModel):
    source_type: SourceType = "primary"
    rows: list[dict]


@router.post("/sync", response_model=ImportResult, status_code=status.HTTP_201_CREATED)
def sync_data(
    user: CurrentUser,
    tenant: TenantCtx,
    body: Annotated[SyncPayload, Body()],
) -> ImportResult:
    """
    Accept a JSON payload from the overnight akara_agent.py script.
    The agent runs nightly on the customer's Tally machine and POSTs rows here.
    No file upload needed — rows are already transformed to the AKARA schema.
    """
    if not tenant.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can push sync data",
        )
    if not body.rows:
        return ImportResult(rows_inserted=0, rows_skipped=0, errors=[], warnings=["No rows in payload"])

    service = DataImportService(supabase=get_supabase_service_client())
    result = service.import_rows(
        rows=body.rows,
        tenant_id=tenant.tenant_id,
        source_type=body.source_type,
    )

    # Increment usage for API sync imports
    rows_inserted = result.rows_inserted or 0
    if rows_inserted > 0:
        try:
            supa = get_supabase_service_client()
            supa.rpc("increment_usage", {
                "p_tenant_id": str(tenant.tenant_id),
                "p_field":     "rows_imported",
                "p_amount":    rows_inserted,
            }).execute()
            supa.rpc("increment_usage", {
                "p_tenant_id": str(tenant.tenant_id),
                "p_field":     "uploads_count",
            }).execute()
            supa.rpc("increment_usage", {
                "p_tenant_id": str(tenant.tenant_id),
                "p_field":     "uploads_today",
            }).execute()
        except Exception as exc:
            logger.warning("Failed to increment sync import usage: %s", exc)

    return result
