import logging
import math
import uuid as uuid_lib
from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from supabase import Client

from app.services.data_import.models import ImportResult
from app.services.data_import.parser import (
    SalesDataParser,
    SchemeDataParser,
    SecondarySalesParser,
)

logger = logging.getLogger(__name__)

_BATCH_SIZE = 500

SourceType = Literal["primary", "secondary", "scheme"]

_TABLE_MAP: dict[SourceType, str] = {
    "primary": "sales_data",
    "secondary": "secondary_sales_data",
    "scheme": "scheme_master",
}

_PRIMARY_KNOWN = {
    "invoice_date", "invoice_number", "party_name", "party_city", "party_zone",
    "route", "product_name", "product_group", "product_category", "hsn_code",
    "quantity", "gross_amount", "discount_amount", "net_amount",
    "tax_amount", "total_amount", "outstanding_amount",
}


def _safe_float(value: Any) -> float:
    if value is None:
        return 0.0
    try:
        f = float(value)
    except (TypeError, ValueError):
        return 0.0
    if math.isnan(f) or math.isinf(f):
        return 0.0
    return f


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    s = str(value)
    if s.lower() in ("nan", "nat", "none"):
        return ""
    return s


def _sanitize_for_json(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _sanitize_for_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_for_json(v) for v in value]
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _build_raw_data(row: dict) -> dict:
    """
    Aggregate all columns NOT in the DB schema into raw_data JSONB.
    This preserves extra columns from any ERP/POS export (e.g. Petpooja
    columns like WOKID, CASHIER, HOURS) so the copilot can query them
    via raw_data->>'column_name'.
    """
    return {
        k: (None if str(v) in ("nan", "NaT", "None") else str(v))
        for k, v in row.items()
        if k not in _PRIMARY_KNOWN
    }


def _enrich_primary(row: dict, tenant_id: UUID) -> dict:
    record: dict = {
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
        "quantity": _safe_float(row.get("quantity", 0)),
        "gross_amount": _safe_float(row.get("gross_amount", 0)),
        "discount_amount": _safe_float(row.get("discount_amount", 0)),
        "net_amount": _safe_float(row.get("net_amount", 0)),
        "tax_amount": _safe_float(row.get("tax_amount", 0)),
        "total_amount": _safe_float(row.get("total_amount", 0)),
        "raw_data": _sanitize_for_json(_build_raw_data(row)),
    }
    if row.get("outstanding_amount") is not None:
        record["outstanding_amount"] = _safe_float(row["outstanding_amount"])
    return record


class DataImportService:
    """
    Handles parsing and batch-inserting sales data for a tenant.
    source_type controls which Supabase table receives the rows:
      - "primary"   → sales_data (ERP/Tally dispatch invoices)
      - "secondary" → secondary_sales_data (DMS offtake)
      - "scheme"    → scheme_master (distributor scheme claims)
    """

    def __init__(self, supabase: Client) -> None:
        self._supabase = supabase

    def parse_dataframe(
        self,
        file_content: bytes,
        filename: str,
        source_type: SourceType = "primary",
        sheet_name: str | int | None = None,
    ):
        """Parse upload bytes into a DataFrame. Raises ValueError on bad format."""
        if source_type == "primary":
            return SalesDataParser(sheet_name=sheet_name).parse(file_content, filename)
        if source_type == "secondary":
            return SecondarySalesParser(sheet_name=sheet_name).parse(file_content, filename)
        return SchemeDataParser().parse(file_content, filename)

    def import_dataframe(
        self,
        df,
        tenant_id: UUID,
        source_type: SourceType,
        filename: str,
        sheet_name: str | int | None = None,
        import_job_id: str | None = None,
    ) -> ImportResult:
        """Insert a pre-parsed DataFrame. Used after quota checks on actual row count."""
        errors: list[str] = []
        warnings: list[str] = []
        rows_inserted = 0
        rows_skipped = 0
        import_id = uuid_lib.uuid4()

        records = df.to_dict(orient="records")
        for i in range(0, len(records), _BATCH_SIZE):
            batch = records[i : i + _BATCH_SIZE]
            enriched = []
            for row in batch:
                try:
                    if source_type == "scheme":
                        record = {
                            "tenant_id": str(tenant_id),
                            "scheme_name": str(row.get("scheme_name", "")),
                            "party_name": str(row.get("party_name", "")),
                            "product_name": str(row.get("product_name", "")),
                            "product_group": str(row.get("product_group", "")),
                            "discount_pct": float(row.get("discount_pct", 0)),
                            "claimed_amount": float(row.get("claimed_amount", 0)),
                            "scheme_start": str(row.get("scheme_start", "")) or None,
                            "scheme_end": str(row.get("scheme_end", "")) or None,
                            "raw_data": row,
                        }
                    elif source_type == "secondary":
                        record = _enrich_primary(row, tenant_id)
                        record["data_source"] = "manual_upload"
                    else:
                        record = _enrich_primary(row, tenant_id)
                    record["import_id"] = str(import_id)
                    if import_job_id:
                        record["import_job_id"] = import_job_id
                    enriched.append(record)
                except (TypeError, ValueError) as exc:
                    rows_skipped += 1
                    warnings.append(f"Row {i}: {exc}")
                    continue

            try:
                table_name = _TABLE_MAP[source_type]
                self._supabase.table(table_name).insert(enriched).execute()
                rows_inserted += len(enriched)
            except Exception as exc:
                err_msg = str(exc)
                # Retry without import_job_id if column missing (partial 011 migration)
                if import_job_id and "import_job_id" in err_msg.lower():
                    for rec in enriched:
                        rec.pop("import_job_id", None)
                    try:
                        self._supabase.table(table_name).insert(enriched).execute()
                        rows_inserted += len(enriched)
                        continue
                    except Exception as retry_exc:
                        err_msg = str(retry_exc)
                errors.append(f"Batch {i // _BATCH_SIZE}: {err_msg}")
                rows_skipped += len(enriched)

        if rows_inserted > 0:
            self._supabase.table("generated_reports").insert({
                "tenant_id":   str(tenant_id),
                "report_type": "csv_import",
                "title":       filename,
                "metadata": {
                    "import_id":     str(import_id),
                    "import_job_id": import_job_id,
                    "source_type":   source_type,
                    "rows_inserted": rows_inserted,
                    "rows_skipped":  rows_skipped,
                    "filename":      filename,
                    "sheet_name":    sheet_name,
                },
            }).execute()

        return ImportResult(
            rows_inserted=rows_inserted,
            rows_skipped=rows_skipped,
            errors=errors,
            warnings=warnings,
            import_id=str(import_id),
        )

    def import_file(
        self,
        file_content: bytes,
        filename: str,
        tenant_id: UUID,
        source_type: SourceType = "primary",
        sheet_name: str | int | None = None,
        import_job_id: str | None = None,
    ) -> ImportResult:
        try:
            df = self.parse_dataframe(file_content, filename, source_type, sheet_name)
        except ValueError as exc:
            return ImportResult(
                rows_inserted=0,
                rows_skipped=0,
                errors=[str(exc)],
                warnings=[],
                import_id=str(uuid_lib.uuid4()),
            )

        return self.import_dataframe(
            df,
            tenant_id=tenant_id,
            source_type=source_type,
            filename=filename,
            sheet_name=sheet_name,
            import_job_id=import_job_id,
        )
