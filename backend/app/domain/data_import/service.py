import logging
import math
import uuid as uuid_lib
from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import ValidationError
from supabase import Client

from app.domain.data.canonical import PrimarySaleRecord, SchemeRecord
from app.domain.data_import.models import ImportResult
from app.domain.data_import.parser import (
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
    payload: dict[str, Any] = {
        "tenant_id": tenant_id,
        "invoice_date": row.get("invoice_date", ""),
        "invoice_number": row.get("invoice_number", ""),
        "party_name": row.get("party_name", ""),
        "party_city": row.get("party_city", ""),
        "party_zone": row.get("party_zone", ""),
        "route": row.get("route", ""),
        "product_name": row.get("product_name", ""),
        "product_group": row.get("product_group", ""),
        "product_category": row.get("product_category", ""),
        "hsn_code": row.get("hsn_code", ""),
        "quantity": row.get("quantity", 0),
        "gross_amount": row.get("gross_amount", 0),
        "discount_amount": row.get("discount_amount", 0),
        "net_amount": row.get("net_amount", 0),
        "tax_amount": row.get("tax_amount", 0),
        "total_amount": row.get("total_amount", 0),
        "outstanding_amount": row.get("outstanding_amount"),
        "raw_data": _sanitize_for_json(_build_raw_data(row)),
    }
    return PrimarySaleRecord.model_validate(payload).to_insert_dict()


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

    def _enrich_row(
        self,
        row: dict,
        tenant_id: UUID,
        source_type: SourceType,
        import_id: uuid_lib.UUID,
        import_job_id: str | None,
        data_source: str | None,
    ) -> dict:
        try:
            if source_type == "scheme":
                record = SchemeRecord.model_validate({
                    "tenant_id": tenant_id,
                    "scheme_name": row.get("scheme_name"),
                    "party_name": row.get("party_name"),
                    "product_name": row.get("product_name"),
                    "product_group": row.get("product_group"),
                    "discount_pct": row.get("discount_pct", 0),
                    "claimed_amount": row.get("claimed_amount", 0),
                    "scheme_start": row.get("scheme_start"),
                    "scheme_end": row.get("scheme_end"),
                    "raw_data": _sanitize_for_json(_build_raw_data(row)),
                    "import_id": str(import_id),
                    "import_job_id": import_job_id,
                }).to_insert_dict()
            else:
                record = _enrich_primary(row, tenant_id)
                record["import_id"] = str(import_id)
                if import_job_id:
                    record["import_job_id"] = import_job_id
                if source_type == "secondary":
                    record["data_source"] = data_source or "manual_upload"
            return record
        except (TypeError, ValueError, ValidationError) as exc:
            raise ValueError(str(exc)) from exc

    def _insert_records(
        self,
        records: list[dict],
        tenant_id: UUID,
        source_type: SourceType,
        title: str,
        import_job_id: str | None = None,
        data_source: str | None = None,
        extra_metadata: dict | None = None,
    ) -> ImportResult:
        errors: list[str] = []
        warnings: list[str] = []
        rows_inserted = 0
        rows_skipped = 0
        import_id = uuid_lib.uuid4()
        table_name = _TABLE_MAP[source_type]

        for i in range(0, len(records), _BATCH_SIZE):
            batch = records[i : i + _BATCH_SIZE]
            enriched: list[dict] = []
            for j, row in enumerate(batch):
                try:
                    enriched.append(
                        self._enrich_row(
                            row,
                            tenant_id,
                            source_type,
                            import_id,
                            import_job_id,
                            data_source,
                        )
                    )
                except (TypeError, ValueError) as exc:
                    rows_skipped += 1
                    warnings.append(f"Row {i + j}: {exc}")

            if not enriched:
                continue

            try:
                self._supabase.table(table_name).insert(enriched).execute()
                rows_inserted += len(enriched)
            except Exception as exc:
                err_msg = str(exc)
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
            metadata = {
                "import_id": str(import_id),
                "import_job_id": import_job_id,
                "source_type": source_type,
                "rows_inserted": rows_inserted,
                "rows_skipped": rows_skipped,
            }
            if extra_metadata:
                metadata.update(extra_metadata)
            self._supabase.table("generated_reports").insert({
                "tenant_id": str(tenant_id),
                "report_type": "csv_import",
                "title": title,
                "metadata": metadata,
            }).execute()

        return ImportResult(
            rows_inserted=rows_inserted,
            rows_skipped=rows_skipped,
            errors=errors,
            warnings=warnings,
            import_id=str(import_id),
        )

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
        data_source = "manual_upload" if source_type == "secondary" else None
        return self._insert_records(
            records=df.to_dict(orient="records"),
            tenant_id=tenant_id,
            source_type=source_type,
            title=filename,
            import_job_id=import_job_id,
            data_source=data_source,
            extra_metadata={"filename": filename, "sheet_name": sheet_name},
        )

    def import_rows(
        self,
        rows: list[dict],
        tenant_id: UUID,
        source_type: SourceType = "primary",
        import_job_id: str | None = None,
        source_hint: str = "sync",
    ) -> ImportResult:
        """Insert pre-normalised rows from agent sync or JSON push.

        Rows should already use canonical column names. Extra keys go into
        raw_data JSONB via _build_raw_data(). Shares the same enrich + batch
        insert path as import_dataframe().
        """
        data_source = source_hint if source_type == "secondary" else None
        return self._insert_records(
            records=rows,
            tenant_id=tenant_id,
            source_type=source_type,
            title=f"Sync import ({source_hint})",
            import_job_id=import_job_id,
            data_source=data_source,
            extra_metadata={"source_hint": source_hint},
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
