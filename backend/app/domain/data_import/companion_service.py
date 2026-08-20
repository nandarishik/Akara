"""Batch insert companion/auxiliary data for a tenant."""

from __future__ import annotations

import uuid
from uuid import UUID

from supabase import Client

from app.domain.data_import.companion_parser import parse_companion_file

_BATCH_SIZE = 500


class CompanionImportService:
    def __init__(self, supabase: Client) -> None:
        self._supabase = supabase

    def import_file(
        self,
        content: bytes,
        filename: str,
        tenant_id: UUID,
        dataset_type: str,
        *,
        clear_existing: bool = False,
    ) -> dict:
        if clear_existing:
            (
                self._supabase.table("tenant_companion_data")
                .delete()
                .eq("tenant_id", str(tenant_id))
                .eq("dataset_type", dataset_type)
                .execute()
            )

        rows = parse_companion_file(content, filename, dataset_type)
        import_id = str(uuid.uuid4())
        inserted = 0
        for i in range(0, len(rows), _BATCH_SIZE):
            batch = rows[i : i + _BATCH_SIZE]
            enriched = [
                {
                    **r,
                    "tenant_id": str(tenant_id),
                    "import_id": import_id,
                }
                for r in batch
            ]
            self._supabase.table("tenant_companion_data").insert(enriched).execute()
            inserted += len(enriched)
        return {"rows_inserted": inserted, "import_id": import_id, "dataset_type": dataset_type}
