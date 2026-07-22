from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.services.data_import.models import ImportResult
from app.services.data_import.service import DataImportService

router = APIRouter(prefix="/data", tags=["data"])

_MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

_ALLOWED_CONTENT_TYPES = {
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
}


@router.post("/import", response_model=ImportResult, status_code=status.HTTP_201_CREATED)
async def import_sales_data(
    user: CurrentUser,
    tenant: TenantCtx,
    file: UploadFile = File(...),
) -> ImportResult:
    if not tenant.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can import data",
        )

    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}",
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
        filename=file.filename or "upload.csv",
        tenant_id=tenant.tenant_id,
    )
