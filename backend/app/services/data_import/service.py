import logging
from uuid import UUID

from supabase import Client

from app.services.data_import.models import ImportResult
from app.services.data_import.parser import SalesDataParser

logger = logging.getLogger(__name__)

_BATCH_SIZE = 500


class DataImportService:
    """Handles parsing and batch-inserting sales data for a tenant."""

    def __init__(self, supabase: Client) -> None:
        self._supabase = supabase
        self._parser = SalesDataParser()

    def import_file(
        self, file_content: bytes, filename: str, tenant_id: UUID
    ) -> ImportResult:
        errors: list[str] = []
        warnings: list[str] = []
        rows_inserted = 0
        rows_skipped = 0

        try:
            df = self._parser.parse(file_content, filename)
        except ValueError as exc:
            return ImportResult(
                rows_inserted=0,
                rows_skipped=0,
                errors=[str(exc)],
                warnings=[],
            )

        records = df.to_dict(orient="records")
        for i in range(0, len(records), _BATCH_SIZE):
            batch = records[i : i + _BATCH_SIZE]
            enriched = []
            for row in batch:
                try:
                    enriched.append(
                        {
                            "tenant_id": str(tenant_id),
                            "invoice_date": str(row.get("invoice_date", "")),
                            "invoice_number": str(row.get("invoice_number", "")),
                            "party_name": str(row.get("party_name", "")),
                            "party_city": str(row.get("party_city", "")),
                            "party_zone": str(row.get("party_zone", "")),
                            "route": str(row.get("route", "")),
                            "product_name": str(row.get("product_name", "")),
                            "product_group": str(row.get("product_group", "")),
                            "product_category": str(row.get("product_category", "")),
                            "hsn_code": str(row.get("hsn_code", "")),
                            "quantity": float(row.get("quantity", 0)),
                            "gross_amount": float(row.get("gross_amount", 0)),
                            "discount_amount": float(row.get("discount_amount", 0)),
                            "net_amount": float(row.get("net_amount", 0)),
                            "tax_amount": float(row.get("tax_amount", 0)),
                            "total_amount": float(row.get("total_amount", 0)),
                            "raw_data": row,
                        }
                    )
                except (TypeError, ValueError) as exc:
                    rows_skipped += 1
                    warnings.append(f"Row {i}: {exc}")
                    continue

            try:
                self._supabase.table("sales_data").insert(enriched).execute()
                rows_inserted += len(enriched)
            except Exception as exc:
                errors.append(f"Batch {i // _BATCH_SIZE}: {exc}")
                rows_skipped += len(enriched)

        return ImportResult(
            rows_inserted=rows_inserted,
            rows_skipped=rows_skipped,
            errors=errors,
            warnings=warnings,
        )
