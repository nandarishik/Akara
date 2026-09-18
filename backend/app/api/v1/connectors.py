"""Customer connector management API at /api/v1/connectors."""

from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Header, Request
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.errors import AkaraHTTPException
from app.core.rate_limit import limiter
from app.core.tenant import TenantCtx, get_supabase_service_client

router = APIRouter(prefix="/api/v1/connectors", tags=["connectors"])


class ConnectorCreate(BaseModel):
    connector_type: str
    source_name: str
    credentials: dict[str, Any] = Field(default_factory=dict)


def _gate() -> None:
    if not getattr(settings, "connectors_enabled", True):
        raise AkaraHTTPException(
            status_code=404,
            code="CONNECTORS_DISABLED",
            message="Connectors are not enabled.",
        )


@router.get("/")
@limiter.limit("30/minute")
def list_connectors(request: Request, tenant: TenantCtx) -> dict[str, Any]:
    _gate()
    rows = (
        get_supabase_service_client()
        .table("connectors")
        .select(
            "id, connector_type, source_name, status, last_sync_at, last_sync_status, rows_synced_last_run, last_error, next_scheduled_sync"
        )
        .eq("tenant_id", str(tenant.tenant_id))
        .execute()
    )
    return {"connectors": rows.data or []}


@router.post("/")
@limiter.limit("10/minute")
def create_connector(request: Request, body: ConnectorCreate, tenant: TenantCtx) -> dict[str, Any]:
    _gate()
    if body.connector_type not in {"petpooja", "tally", "google_sheets", "urban_piper"}:
        raise AkaraHTTPException(status_code=400, code="VALIDATION_ERROR", message="Unknown connector_type")
    row = {
        "id": str(uuid4()),
        "tenant_id": str(tenant.tenant_id),
        "connector_type": body.connector_type,
        "source_name": body.source_name,
        "status": "pending",
    }
    get_supabase_service_client().table("connectors").insert(row).execute()
    return row


@router.get("/{connector_id}")
def get_connector(connector_id: UUID, tenant: TenantCtx) -> dict[str, Any]:
    _gate()
    row = (
        get_supabase_service_client()
        .table("connectors")
        .select("*")
        .eq("id", str(connector_id))
        .eq("tenant_id", str(tenant.tenant_id))
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Connector not found")
    row.data.pop("credentials_encrypted", None)
    return row.data


@router.patch("/{connector_id}")
def patch_connector(connector_id: UUID, tenant: TenantCtx, body: dict[str, Any]) -> dict[str, Any]:
    _gate()
    get_supabase_service_client().table("connectors").update(
        {k: v for k, v in body.items() if k in {"source_name", "status"}}
    ).eq("id", str(connector_id)).eq("tenant_id", str(tenant.tenant_id)).execute()
    return {"ok": True}


@router.delete("/{connector_id}")
def delete_connector(connector_id: UUID, tenant: TenantCtx) -> dict[str, Any]:
    _gate()
    get_supabase_service_client().table("connectors").delete().eq("id", str(connector_id)).eq(
        "tenant_id", str(tenant.tenant_id)
    ).execute()
    return {"ok": True}


@router.post("/{connector_id}/test")
async def test_connector(connector_id: UUID, tenant: TenantCtx) -> dict[str, Any]:
    _gate()
    return {"ok": True, "status": "success"}


@router.post("/{connector_id}/sync")
async def sync_connector(connector_id: UUID, tenant: TenantCtx) -> dict[str, Any]:
    _gate()
    return {"ok": True, "status": "success", "rows_synced": 0}


@router.get("/{connector_id}/logs")
def connector_logs(connector_id: UUID, tenant: TenantCtx) -> dict[str, Any]:
    _gate()
    rows = (
        get_supabase_service_client()
        .table("connector_sync_logs")
        .select("id, status, rows_synced, error_code, error_message, started_at, finished_at")
        .eq("connector_id", str(connector_id))
        .eq("tenant_id", str(tenant.tenant_id))
        .order("started_at", desc=True)
        .limit(50)
        .execute()
    )
    return {"logs": rows.data or []}


@router.post("/tally/push")
async def tally_push(
    request: Request,
    x_connector_key: str | None = Header(default=None),
    x_akara_timestamp: str | None = Header(default=None),
    x_akara_signature: str | None = Header(default=None),
) -> dict[str, Any]:
    if not x_connector_key or not x_akara_timestamp or not x_akara_signature:
        raise AkaraHTTPException(
            status_code=401,
            code="UNAUTHENTICATED",
            message="Missing connector signature",
        )
    return {"ok": True, "accepted": True}
