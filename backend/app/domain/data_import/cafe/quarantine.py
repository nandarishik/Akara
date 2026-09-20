from __future__ import annotations

from typing import Any
from uuid import UUID

from app.core.errors import AkaraHTTPException
from app.core.tenant import get_supabase_service_client
from app.domain.data_import.cafe.validator import ValidationEngine


def resubmit_quarantine_row(row_id: UUID, tenant_id: UUID, corrected_values: dict[str, Any]) -> dict[str, Any]:
    errors = ValidationEngine().validate_order(corrected_values)
    if errors:
        return {"resolved": False, "errors": errors}
    supa = get_supabase_service_client()
    inserted = supa.table("canonical_orders").insert({
        "tenant_id": str(tenant_id),
        **{k: v for k, v in corrected_values.items() if k in {
            "order_time", "total_amount", "channel", "external_order_id", "covers",
        }},
    }).execute()
    canonical_id = (inserted.data or [{}])[0].get("id")
    supa.table("import_quarantine").update({
        "resolved": True,
        "resolution_notes": "resubmitted",
    }).eq("id", str(row_id)).eq("tenant_id", str(tenant_id)).execute()
    return {"resolved": True, "canonical_id": canonical_id}
