import io
import logging
import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    Path,
    Query,
    Request,
    UploadFile,
    status,
)
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.config import settings
from app.core.errors import AkaraHTTPException
from app.core.plan_guard import (
    require_feature,
    require_import_quota,
    require_undo_quota,
)
from app.core.rate_limit import limiter
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.domain.data_import.detector import score_sheets
from app.domain.data_import.models import ImportResult
from app.domain.data_import.service import DataImportService, SourceType
from app.domain.user_events import record_user_event

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
@limiter.limit("10/minute")
async def list_excel_sheets(
    request: Request,
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
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message="Admins only",
        )

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


@router.post(
    "/import", response_model=ImportResult, status_code=status.HTTP_201_CREATED
)
@limiter.limit("10/minute")
async def import_data(
    request: Request,
    user: CurrentUser,
    tenant: TenantCtx,
    file: UploadFile = File(...),
    source_type: Annotated[SourceType, Query()] = "primary",
    sheet_name: Annotated[
        str | None, Query(description="Excel sheet name. Omit for auto-detect.")
    ] = None,
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
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message="Only admins can import data",
        )

    content_type = file.content_type or ""
    filename = file.filename or "upload.csv"
    ext = filename.rsplit(".", 1)[-1].lower()

    # Accept by content-type OR by file extension (browsers vary)
    if content_type not in _ALLOWED_CONTENT_TYPES and ext not in ("csv", "xlsx", "xls"):
        raise AkaraHTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            code="VALIDATION_ERROR",
            message="Unsupported file type. Upload a CSV, XLSX, or XLS file.",
        )

    content = await file.read()
    if len(content) > _MAX_FILE_SIZE:
        raise AkaraHTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            code="VALIDATION_ERROR",
            message="File exceeds 50 MB limit",
        )

    # Feature gate: secondary/scheme sources require Pro+
    if source_type in _RESTRICTED_SOURCE_TYPES:
        await require_feature("secondary_sales")(tenant)

    # Parse first to know row count for quota check
    service = DataImportService(supabase=get_supabase_service_client())
    # We do a dry row-count estimate via file size / avg row size
    # (full parse happens inside service.import_file; we use a conservative estimate here)
    estimated_rows = max(1, len(content) // 200)  # ~200 bytes/row conservative

    # Quota check (daily cap + monthly cap + row storage cap)
    await require_import_quota(estimated_rows)(tenant)

    supa = get_supabase_service_client()

    # Create import job record before importing
    import_job_id: str | None = None
    try:
        job_result = (
            supa.table("import_jobs")
            .insert(
                {
                    "tenant_id": str(tenant.tenant_id),
                    "user_id": str(user.user_id),
                    "source_type": str(source_type),
                    "filename": filename,
                    "status": "completed",
                }
            )
            .execute()
        )
        if job_result.data:
            import_job_id = job_result.data[0]["id"]
    except Exception as exc:
        logger.warning("Failed to create import_job record: %s", exc)

    result = service.import_file(
        file_content=content,
        filename=filename,
        tenant_id=tenant.tenant_id,
        source_type=source_type,
        sheet_name=sheet_name,
    )

    rows_inserted = result.rows_inserted or 0

    # Update import_job with actual row count
    if import_job_id:
        try:
            supa.table("import_jobs").update(
                {
                    "rows_inserted": rows_inserted,
                    "rows_skipped": result.rows_skipped or 0,
                }
            ).eq("id", import_job_id).execute()
        except Exception as exc:
            logger.warning("Failed to update import_job rows: %s", exc)

    # Increment usage counters after successful import
    try:
        supa.rpc(
            "increment_usage",
            {
                "p_tenant_id": str(tenant.tenant_id),
                "p_field": "rows_imported",
                "p_amount": rows_inserted,
            },
        ).execute()
        supa.rpc(
            "increment_usage",
            {
                "p_tenant_id": str(tenant.tenant_id),
                "p_field": "uploads_count",
            },
        ).execute()
        supa.rpc(
            "increment_usage",
            {
                "p_tenant_id": str(tenant.tenant_id),
                "p_field": "uploads_today",
            },
        ).execute()
    except Exception as exc:
        logger.warning("Failed to increment import usage: %s", exc)

    if rows_inserted > 0:
        record_user_event(user.user_id, "first_import")

    return result


@router.delete("/imports/{import_job_id}", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def undo_import(
    request: Request,
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
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message="Only admins can undo imports",
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
        raise AkaraHTTPException(
            status_code=404,
            code="NOT_FOUND",
            message="Import job not found",
        ) from exc

    if not job_result.data:
        raise AkaraHTTPException(
            status_code=404,
            code="NOT_FOUND",
            message="Import job not found",
        )

    job = job_result.data
    if job.get("status") == "deleted":
        raise AkaraHTTPException(
            status_code=status.HTTP_409_CONFLICT,
            code="CONFLICT",
            message="This import has already been undone",
        )

    rows_to_delete = job.get("rows_inserted", 0)

    # Delete rows tagged with this import_job_id
    try:
        supa.table("sales_data").delete().eq("tenant_id", str(tenant.tenant_id)).eq(
            "import_job_id", import_job_id
        ).execute()
    except Exception as exc:
        logger.error(
            "Failed to delete sales_data rows for job %s: %s", import_job_id, exc
        )
        raise AkaraHTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="INTERNAL_ERROR",
            message="Failed to delete imported rows. Please try again.",
        ) from exc

    # Mark job as deleted
    try:
        supa.table("import_jobs").update({"status": "deleted"}).eq(
            "id", import_job_id
        ).execute()
    except Exception as exc:
        logger.warning("Failed to mark import_job as deleted: %s", exc)

    # Increment undo counter
    try:
        supa.rpc(
            "increment_usage",
            {
                "p_tenant_id": str(tenant.tenant_id),
                "p_field": "undos_today",
            },
        ).execute()
    except Exception as exc:
        logger.warning("Failed to increment undo usage: %s", exc)

    return {"deleted": True, "rows_removed": rows_to_delete}


class SyncPayload(BaseModel):
    source_type: SourceType = "primary"
    rows: list[dict]


@router.post("/sync", response_model=ImportResult, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def sync_data(
    request: Request,
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
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message="Only admins can push sync data",
        )
    if not body.rows:
        return ImportResult(
            rows_inserted=0, rows_skipped=0, errors=[], warnings=["No rows in payload"]
        )

    await require_import_quota(len(body.rows))(tenant)

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
            supa.rpc(
                "increment_usage",
                {
                    "p_tenant_id": str(tenant.tenant_id),
                    "p_field": "rows_imported",
                    "p_amount": rows_inserted,
                },
            ).execute()
            supa.rpc(
                "increment_usage",
                {
                    "p_tenant_id": str(tenant.tenant_id),
                    "p_field": "uploads_count",
                },
            ).execute()
            supa.rpc(
                "increment_usage",
                {
                    "p_tenant_id": str(tenant.tenant_id),
                    "p_field": "uploads_today",
                },
            ).execute()
        except Exception as exc:
            logger.warning("Failed to increment sync import usage: %s", exc)

    return result


# ============================================================================
# DAY 4: Async Import Endpoints for Large File Processing
# ============================================================================


class AsyncImportResponse(BaseModel):
    job_id: str
    status: str
    message: str
    estimated_processing_time: str


class ImportJob(BaseModel):
    id: str
    tenant_id: str
    user_id: str | None
    source_type: str
    filename: str | None
    rows_inserted: int
    rows_skipped: int
    status: str
    storage_path: str | None
    error_message: str | None
    retry_count: int
    created_at: str
    completed_at: str | None


class ImportJobsResponse(BaseModel):
    jobs: list[ImportJob]
    total: int


@router.post("/import/async", response_model=AsyncImportResponse, status_code=202)
@limiter.limit("10/minute")
async def import_data_async(
    request: Request,
    user: CurrentUser,
    tenant: TenantCtx,
    file: UploadFile = File(...),
    source_type: Annotated[SourceType, Query()] = "primary",
    sheet_name: Annotated[
        str | None, Query(description="Excel sheet name for multi-sheet files")
    ] = None,
) -> AsyncImportResponse:
    """
    Async import for large files (>5000 rows estimated).

    For files under 5000 rows, use the regular POST /import endpoint.
    Large files are uploaded to Supabase Storage and processed by background workers.

    Returns a job_id that can be used to poll status via GET /import/jobs/{job_id}
    """
    if not tenant.is_admin:
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message="Only admins can import data",
        )

    content_type = file.content_type or ""
    filename = file.filename or "upload.csv"
    ext = filename.rsplit(".", 1)[-1].lower()

    # Validate file type
    if content_type not in _ALLOWED_CONTENT_TYPES and ext not in ("csv", "xlsx", "xls"):
        raise AkaraHTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            code="VALIDATION_ERROR",
            message="Unsupported file type. Upload a CSV, XLSX, or XLS file.",
        )

    content = await file.read()
    if len(content) > _MAX_FILE_SIZE:
        raise AkaraHTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            code="VALIDATION_ERROR",
            message="File exceeds 50 MB limit",
        )

    # Feature gate check
    if source_type in _RESTRICTED_SOURCE_TYPES:
        await require_feature("secondary_sales")(tenant)

    # Estimate rows and decide between sync/async
    estimated_rows = max(1, len(content) // 200)

    if estimated_rows < 5000:
        raise AkaraHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="VALIDATION_ERROR",
            message=f"File has ~{estimated_rows} rows. Use POST /import for files under 5000 rows.",
        )

    # Quota check for large imports
    await require_import_quota(estimated_rows)(tenant)

    # Upload to Supabase Storage
    supa = get_supabase_service_client()
    job_id = str(uuid.uuid4())

    # Create unique storage path
    storage_path = f"import-jobs/{tenant.tenant_id}/{job_id}/{filename}"

    try:
        # Upload file to storage
        supa.storage.from_(settings.supabase_imports_bucket).upload(
            storage_path,
            content,
            {
                "content-type": content_type,
                "x-upsert": "true",  # Overwrite if exists
            },
        )
    except Exception as e:
        logger.error(f"Failed to upload file to storage: {e}")
        raise AkaraHTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="INTERNAL_ERROR",
            message="Failed to upload file for processing. Please try again.",
        )

    # Create import job record
    try:
        job_result = (
            supa.table("import_jobs")
            .insert(
                {
                    "id": job_id,
                    "tenant_id": str(tenant.tenant_id),
                    "user_id": str(user.user_id),
                    "source_type": str(source_type),
                    "filename": filename,
                    "status": "queued",
                    "storage_path": storage_path,
                    "rows_inserted": 0,
                    "rows_skipped": 0,
                }
            )
            .execute()
        )

        if not job_result.data:
            raise AkaraHTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                code="INTERNAL_ERROR",
                message="Failed to create import job",
            )

    except Exception as e:
        logger.error(f"Failed to create import job: {e}")
        # Clean up uploaded file
        try:
            supa.storage.from_(settings.supabase_imports_bucket).remove([storage_path])
        except:
            pass

        raise AkaraHTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="INTERNAL_ERROR",
            message="Failed to queue import job. Please try again.",
        )

    # Estimate processing time based on file size
    processing_time = f"{max(1, estimated_rows // 1000)} minutes"

    return AsyncImportResponse(
        job_id=job_id,
        status="queued",
        message=f"Import job queued for processing. Estimated {estimated_rows:,} rows.",
        estimated_processing_time=processing_time,
    )


@router.get("/import/jobs/{job_id}", response_model=ImportJob)
@limiter.limit("30/minute")
async def get_import_job(
    request: Request,
    job_id: Annotated[str, Path(description="Import job ID")],
    user: CurrentUser,
    tenant: TenantCtx,
) -> ImportJob:
    """
    Get status of a specific import job.

    Use this to poll the status of async imports started with POST /import/async
    """
    if not tenant.is_admin:
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message="Only admins can view import jobs",
        )

    supa = get_supabase_service_client()

    try:
        result = (
            supa.table("import_jobs")
            .select("*")
            .eq("id", job_id)
            .eq("tenant_id", str(tenant.tenant_id))
            .single()
            .execute()
        )
    except Exception as e:
        logger.error(f"Failed to fetch import job {job_id}: {e}")
        raise AkaraHTTPException(
            status_code=404,
            code="NOT_FOUND",
            message="Import job not found",
        )

    if not result.data:
        raise AkaraHTTPException(
            status_code=404,
            code="NOT_FOUND",
            message="Import job not found",
        )

    job_data = result.data
    return ImportJob(
        id=job_data["id"],
        tenant_id=job_data["tenant_id"],
        user_id=job_data.get("user_id"),
        source_type=job_data["source_type"],
        filename=job_data.get("filename"),
        rows_inserted=job_data["rows_inserted"],
        rows_skipped=job_data["rows_skipped"],
        status=job_data["status"],
        storage_path=job_data.get("storage_path"),
        error_message=job_data.get("error_message"),
        retry_count=job_data["retry_count"],
        created_at=job_data["created_at"],
        completed_at=job_data.get("completed_at"),
    )


@router.get("/import/jobs", response_model=ImportJobsResponse)
@limiter.limit("30/minute")
async def list_import_jobs(
    request: Request,
    user: CurrentUser,
    tenant: TenantCtx,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ImportJobsResponse:
    """
    List import jobs for this tenant, ordered by creation time (newest first).

    Includes both sync and async import jobs for the import history view.
    """
    if not tenant.is_admin:
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message="Only admins can view import jobs",
        )

    supa = get_supabase_service_client()

    try:
        # Get jobs with pagination
        result = (
            supa.table("import_jobs")
            .select("*")
            .eq("tenant_id", str(tenant.tenant_id))
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )

        # Get total count for pagination
        count_result = (
            supa.table("import_jobs")
            .select("*", count="exact")
            .eq("tenant_id", str(tenant.tenant_id))
            .execute()
        )

    except Exception as e:
        logger.error(f"Failed to fetch import jobs: {e}")
        raise AkaraHTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="INTERNAL_ERROR",
            message="Failed to fetch import jobs",
        )

    jobs_data = result.data or []
    total = count_result.count or 0

    jobs = [
        ImportJob(
            id=job["id"],
            tenant_id=job["tenant_id"],
            user_id=job.get("user_id"),
            source_type=job["source_type"],
            filename=job.get("filename"),
            rows_inserted=job["rows_inserted"],
            rows_skipped=job["rows_skipped"],
            status=job["status"],
            storage_path=job.get("storage_path"),
            error_message=job.get("error_message"),
            retry_count=job["retry_count"],
            created_at=job["created_at"],
            completed_at=job.get("completed_at"),
        )
        for job in jobs_data
    ]

    return ImportJobsResponse(jobs=jobs, total=total)


def _get_tenant_import_job(supa, tenant_id: str, job_id: str) -> dict:
    try:
        result = (
            supa.table("import_jobs")
            .select("*")
            .eq("id", job_id)
            .eq("tenant_id", tenant_id)
            .single()
            .execute()
        )
    except Exception as e:
        logger.error("Failed to fetch import job %s: %s", job_id, e)
        raise AkaraHTTPException(
            status_code=404,
            code="NOT_FOUND",
            message="Import job not found",
        ) from e
    if not result.data:
        raise AkaraHTTPException(
            status_code=404,
            code="NOT_FOUND",
            message="Import job not found",
        )
    return result.data


@router.post("/import/jobs/{job_id}/cancel")
@limiter.limit("10/minute")
async def cancel_import_job(
    request: Request,
    job_id: Annotated[str, Path(description="Import job ID")],
    user: CurrentUser,
    tenant: TenantCtx,
) -> dict[str, str]:
    """Cancel a queued or processing async import job."""
    if not tenant.is_admin:
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message="Only admins can cancel import jobs",
        )

    supa = get_supabase_service_client()
    job = _get_tenant_import_job(supa, str(tenant.tenant_id), job_id)

    if job["status"] not in ("queued", "processing"):
        raise AkaraHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="VALIDATION_ERROR",
            message=f"Cannot cancel job in status '{job['status']}'",
        )

    supa.table("import_jobs").update(
        {
            "status": "cancelled",
            "error_message": "Cancelled by user",
            "worker_id": None,
            "completed_at": datetime.now(UTC).isoformat(),
        }
    ).eq("id", job_id).execute()

    return {"status": "cancelled", "job_id": job_id}


@router.post("/import/jobs/{job_id}/retry")
@limiter.limit("10/minute")
async def retry_import_job(
    request: Request,
    job_id: Annotated[str, Path(description="Import job ID")],
    user: CurrentUser,
    tenant: TenantCtx,
) -> dict[str, str]:
    """Re-queue a failed or cancelled async import job for processing."""
    if not tenant.is_admin:
        raise AkaraHTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message="Only admins can retry import jobs",
        )

    supa = get_supabase_service_client()
    job = _get_tenant_import_job(supa, str(tenant.tenant_id), job_id)

    if job["status"] not in ("failed", "cancelled"):
        raise AkaraHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="VALIDATION_ERROR",
            message=f"Cannot retry job in status '{job['status']}'",
        )
    if not job.get("storage_path"):
        raise AkaraHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="VALIDATION_ERROR",
            message="Job has no stored file \u2014 upload again instead",
        )

    supa.table("import_jobs").update(
        {
            "status": "queued",
            "error_message": None,
            "worker_id": None,
            "heartbeat_at": None,
            "completed_at": None,
            "rows_inserted": 0,
            "rows_skipped": 0,
        }
    ).eq("id", job_id).execute()

    return {"status": "queued", "job_id": job_id}


def _require_cafe_import(tenant: TenantCtx) -> None:
    from app.core.plan_limits import is_feature_enabled

    if not tenant.is_admin:
        raise AkaraHTTPException(status_code=status.HTTP_403_FORBIDDEN, code="FORBIDDEN", message="Admins only")
    if not is_feature_enabled(tenant.plan, "cafe_import", tenant.feature_overrides or {}):
        raise AkaraHTTPException(status_code=status.HTTP_403_FORBIDDEN, code="FORBIDDEN", message="Cafe import is not enabled")


def _cafe_headers(content: bytes, filename: str) -> list[str]:
    import pandas as pd

    if filename.lower().endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content), nrows=5)
    else:
        df = pd.read_excel(io.BytesIO(content), nrows=5)
    return [str(c) for c in df.columns]


@router.post("/imports/cafe-orders")
@router.post("/imports/cafe-expenses")
@router.post("/imports/cafe-inventory")
@limiter.limit("10/minute")
async def cafe_import_upload(
    request: Request,
    tenant: TenantCtx,
    file: UploadFile = File(...),
    import_type: str | None = Query(default=None),
) -> dict:
    import hashlib

    from app.domain.data_import.cafe.mapping_service import AIMappingService
    from app.domain.data_import.detector import classify_import_type

    _require_cafe_import(tenant)
    path_type = request.url.path.rstrip("/").split("/")[-1].replace("-", "_")
    if path_type.startswith("cafe_"):
        detected_path = path_type
    else:
        detected_path = "cafe_orders"
    content = await file.read()
    filename = file.filename or "upload.csv"
    if import_type and import_type != detected_path:
        raise AkaraHTTPException(status_code=422, code="VALIDATION_ERROR", message="import_type does not match path")
    file_hash = hashlib.sha256(content).hexdigest()
    supa = get_supabase_service_client()
    existing = (
        supa.table("import_jobs")
        .select("id")
        .eq("tenant_id", str(tenant.tenant_id))
        .eq("source_file_hash", file_hash)
        .eq("status", "completed")
        .limit(1)
        .execute()
    )
    if existing.data:
        return {"status": "skipped", "existing_import_id": existing.data[0]["id"]}
    headers = _cafe_headers(content, filename)
    classified = classify_import_type(headers)
    chosen = import_type or detected_path or classified
    job_id = str(uuid.uuid4())
    proposal = AIMappingService().propose(headers, {}, chosen)
    supa.table("import_jobs").insert({
        "id": job_id,
        "tenant_id": str(tenant.tenant_id),
        "status": "mapping_proposed",
        "import_type": chosen,
        "source_type": chosen,
        "source_file_hash": file_hash,
        "column_mapping": proposal,
        "filename": filename,
    }).execute()
    return {"import_id": job_id, "status": "mapping_proposed", "import_type": chosen}


@router.get("/imports/{import_id}/mapping-proposal")
def cafe_mapping_proposal(import_id: str, tenant: TenantCtx) -> dict:
    _require_cafe_import(tenant)
    job = _get_cafe_job(import_id, tenant)
    mapping = job.get("column_mapping") or {}
    return {"import_id": import_id, **mapping, "status": job.get("status")}


@router.post("/imports/{import_id}/mapping-confirm")
def cafe_mapping_confirm(import_id: str, tenant: TenantCtx, body: dict = Body(...)) -> dict:
    _require_cafe_import(tenant)
    _get_cafe_job(import_id, tenant)
    mappings = body.get("mappings") or []
    raws = [m.get("raw_column") for m in mappings]
    if len(raws) != len(set(raws)):
        raise AkaraHTTPException(status_code=422, code="VALIDATION_ERROR", message="duplicate raw_column")
    get_supabase_service_client().table("import_jobs").update({
        "status": "mapping_confirmed",
        "column_mapping": {**(body or {}), "status": "confirmed"},
    }).eq("id", import_id).eq("tenant_id", str(tenant.tenant_id)).execute()
    return {"import_id": import_id, "status": "mapping_confirmed"}


@router.get("/imports/{import_id}/status")
def cafe_import_status(import_id: str, tenant: TenantCtx) -> dict:
    job = _get_cafe_job(import_id, tenant)
    total = int(job.get("total_batches") or 0)
    last = int(job.get("last_completed_batch") or 0)
    progress = 0 if total <= 0 else int(100 * last / total)
    return {
        "import_id": import_id,
        "status": job.get("status"),
        "import_type": job.get("import_type"),
        "last_completed_batch": last,
        "total_batches": total,
        "progress_pct": progress,
        "canonical_row_count": job.get("canonical_row_count") or 0,
        "quarantine_row_count": job.get("quarantine_row_count") or 0,
        "error_message": job.get("error_message"),
    }


@router.get("/imports/{import_id}/reconciliation")
def cafe_reconciliation(import_id: str, tenant: TenantCtx) -> dict:
    job = _get_cafe_job(import_id, tenant)
    totals = job.get("reconciliation_totals") or {}
    return {
        "import_id": import_id,
        "order_count": totals.get("order_count", 0),
        "total_amount": totals.get("total_amount", 0),
        "currency": "INR",
        "date_range_start": totals.get("date_range_start"),
        "date_range_end": totals.get("date_range_end"),
        "span_days": totals.get("span_days", 0),
        "span_alert": bool(totals.get("span_days", 0) > 31),
        "channels": totals.get("channels") or [],
        "quarantine_row_count": job.get("quarantine_row_count") or 0,
        "top_failure_types": totals.get("top_failure_types") or [],
        "totals_delta_pct": totals.get("totals_delta_pct", 0),
        "totals_flag": bool(totals.get("totals_delta_pct", 0) > 5),
        "reconciliation_confirmed": bool(job.get("reconciliation_confirmed")),
        "reconciliation_notes": job.get("reconciliation_notes"),
    }


@router.post("/imports/{import_id}/reconciliation/confirm")
def cafe_reconciliation_confirm(import_id: str, tenant: TenantCtx, body: dict = Body(...)) -> dict:
    job = _get_cafe_job(import_id, tenant)
    if body.get("accepted") is False and body.get("action") == "undo":
        get_supabase_service_client().table("canonical_orders").delete().eq("import_id", import_id).eq("tenant_id", str(tenant.tenant_id)).execute()
        get_supabase_service_client().table("import_jobs").update({
            "status": "undone",
            "undone_at": datetime.now(UTC).isoformat(),
        }).eq("id", import_id).execute()
        return {"undone": True}
    get_supabase_service_client().table("import_jobs").update({
        "reconciliation_confirmed": True,
        "reconciliation_notes": body.get("notes"),
    }).eq("id", import_id).eq("tenant_id", str(tenant.tenant_id)).execute()
    return {"accepted": True}


@router.get("/imports/{import_id}/quarantine")
def cafe_quarantine_list(import_id: str, tenant: TenantCtx, unresolved: bool = True) -> dict:
    _get_cafe_job(import_id, tenant)
    query = (
        get_supabase_service_client()
        .table("import_quarantine")
        .select("id, row_number, failure_type, failure_reason, canonical_field, raw_row, resolved")
        .eq("import_id", import_id)
        .eq("tenant_id", str(tenant.tenant_id))
    )
    if unresolved:
        query = query.eq("resolved", False)
    rows = query.execute().data or []
    return {"rows": rows, "unresolved_count": len([r for r in rows if not r.get("resolved")])}


@router.post("/imports/{import_id}/quarantine/{row_id}/resubmit")
def cafe_quarantine_resubmit(import_id: str, row_id: str, tenant: TenantCtx, body: dict = Body(...)) -> dict:
    from uuid import UUID

    from app.domain.data_import.cafe.quarantine import resubmit_quarantine_row

    _get_cafe_job(import_id, tenant)
    return resubmit_quarantine_row(UUID(row_id), tenant.tenant_id, body.get("corrected_values") or {})


@router.post("/imports/{import_id}/quarantine/{row_id}/ignore")
def cafe_quarantine_ignore(import_id: str, row_id: str, tenant: TenantCtx, body: dict = Body(default_factory=dict)) -> dict:
    _get_cafe_job(import_id, tenant)
    get_supabase_service_client().table("import_quarantine").update({
        "resolved": True,
        "resolution_notes": body.get("resolution_notes") or "ignored",
    }).eq("id", row_id).eq("tenant_id", str(tenant.tenant_id)).execute()
    return {"resolved": True}


def _get_cafe_job(import_id: str, tenant: TenantCtx) -> dict:
    row = (
        get_supabase_service_client()
        .table("import_jobs")
        .select("*")
        .eq("id", import_id)
        .eq("tenant_id", str(tenant.tenant_id))
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Import not found")
    return row.data

