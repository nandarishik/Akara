from __future__ import annotations
from uuid import UUID

def run_forecast_for_tenant(tenant_id: UUID) -> dict:
    return {"tenant_id": str(tenant_id), "status": "ok", "points": []}
