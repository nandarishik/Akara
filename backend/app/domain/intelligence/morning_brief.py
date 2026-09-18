from __future__ import annotations
from uuid import UUID

def build_morning_brief_context(tenant_id: UUID) -> dict:
    return {"tenant_id": str(tenant_id), "weather": None, "forecast": None}
