import json
import logging
import math
from datetime import date, datetime
from uuid import UUID

import pandas as pd
from supabase import Client

from app.services.data_import.models import ImportResult
from app.services.data_import.parser import SalesDataParser

logger = logging.getLogger(__name__)

_BATCH_SIZE = 500


def _safe_float(value: object, default: float = 0.0) -> float:
    if value is None or (isinstance(value, float) and (math.isnan(value) or math.isinf(value))):
        return default
    try:
        num = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default
    if math.isnan(num) or math.isinf(num):
        return default
    return num


def _safe_str(value: object, default: str = "") -> str:
    if value is None or pd.isna(value):
        return default
    text = str(value).strip()
    return default if text.lower() == "nan" else text


def _sanitize_for_json(value: object) -> object:
    if isinstance(value, dict):
        return {str(k): _sanitize_for_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_for_json(v) for v in value]
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if isinstance(value, (int, str, bool)) or value is None:
        return value
    if pd.isna(value):
        return None
    # numpy / decimal scalars
    if hasattr(value, "item"):
        try:
            return _sanitize_for_json(value.item())
        except (TypeError, ValueError):
            pass
    return str(value)


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
                    clean_row = _sanitize_for_json(row)
                    enriched.append(
                        {
                            "tenant_id": str(tenant_id),
                            "invoice_date": _safe_str(row.get("invoice_date")),
                            "invoice_number": _safe_str(row.get("invoice_number")),
                            "party_name": _safe_str(row.get("party_name")),
                            "party_city": _safe_str(row.get("party_city")),
                            "party_zone": _safe_str(row.get("party_zone")),
                            "route": _safe_str(row.get("route")),
                            "product_name": _safe_str(row.get("product_name")),
                            "product_group": _safe_str(row.get("product_group")),
                            "product_category": _safe_str(row.get("product_category")),
                            "hsn_code": _safe_str(row.get("hsn_code")),
                            "quantity": _safe_float(row.get("quantity")),
                            "gross_amount": _safe_float(row.get("gross_amount")),
                            "discount_amount": _safe_float(row.get("discount_amount")),
                            "net_amount": _safe_float(row.get("net_amount")),
                            "tax_amount": _safe_float(row.get("tax_amount")),
                            "total_amount": _safe_float(row.get("total_amount")),
                            "raw_data": clean_row,
                        }
                    )
                    # Fail fast on bad payloads before hitting Supabase.
                    json.dumps(enriched[-1])
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
