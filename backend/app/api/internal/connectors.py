from fastapi import APIRouter, Header

from app.core.config import settings
from app.core.errors import AkaraHTTPException

router = APIRouter(prefix="/admin/connectors", tags=["internal-connectors"])


def _svc(x_service_key: str | None) -> None:
    if x_service_key != settings.backend_service_key:
        raise AkaraHTTPException(status_code=401, code="UNAUTHENTICATED", message="Invalid service key")


@router.post("/trigger-scheduled-sync")
def trigger(x_service_key: str | None = Header(default=None, alias="X-Service-Key")) -> dict:
    _svc(x_service_key)
    return {"ok": True}


@router.post("/{connector_id}/run-sync")
def run_sync(
    connector_id: str, x_service_key: str | None = Header(default=None, alias="X-Service-Key")
) -> dict:
    _svc(x_service_key)
    return {"ok": True, "connector_id": connector_id}
