"""Canonical records every Akara source normalises into before persist.

Physical tables stay fixed (sales_data, secondary_sales_data, scheme_master,
tenant_companion_data). Extra source columns live in raw_data JSONB.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class SemanticRole(StrEnum):
    """Logical meaning used by copilot / analytics — not physical column names."""

    revenue = "revenue"
    date = "date"
    channel = "channel"
    order_id = "order_id"
    party = "party"
    product = "product"
    region = "region"
    quantity = "quantity"
    discount = "discount"


def _coerce_date_str(value: Any) -> str:
    if value is None or value == "":
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _coerce_float(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    try:
        result = float(value)
    except (TypeError, ValueError):
        return 0.0
    if result != result or result in (float("inf"), float("-inf")):  # NaN / inf
        return 0.0
    return result


def _coerce_str(value: Any) -> str:
    if value is None:
        return ""
    text = str(value)
    if text.lower() in ("nan", "nat", "none"):
        return ""
    return text


class PrimarySaleRecord(BaseModel):
    """Maps to public.sales_data."""

    model_config = ConfigDict(extra="ignore")

    tenant_id: UUID
    invoice_date: str = ""
    invoice_number: str = ""
    party_name: str = ""
    party_city: str = ""
    party_zone: str = ""
    route: str = ""
    product_name: str = ""
    product_group: str = ""
    product_category: str = ""
    hsn_code: str = ""
    quantity: float = 0.0
    gross_amount: float = 0.0
    discount_amount: float = 0.0
    net_amount: float = 0.0
    tax_amount: float = 0.0
    total_amount: float = 0.0
    outstanding_amount: float | None = None
    raw_data: dict[str, Any] = Field(default_factory=dict)
    import_id: str | None = None
    import_job_id: str | None = None
    data_source: str | None = None

    @field_validator("invoice_date", mode="before")
    @classmethod
    def _date(cls, value: Any) -> str:
        return _coerce_date_str(value)

    @field_validator(
        "invoice_number",
        "party_name",
        "party_city",
        "party_zone",
        "route",
        "product_name",
        "product_group",
        "product_category",
        "hsn_code",
        mode="before",
    )
    @classmethod
    def _str_fields(cls, value: Any) -> str:
        return _coerce_str(value)

    @field_validator(
        "quantity",
        "gross_amount",
        "discount_amount",
        "net_amount",
        "tax_amount",
        "total_amount",
        mode="before",
    )
    @classmethod
    def _floats(cls, value: Any) -> float:
        return _coerce_float(value)

    @field_validator("outstanding_amount", mode="before")
    @classmethod
    def _optional_float(cls, value: Any) -> float | None:
        if value is None or value == "":
            return None
        return _coerce_float(value)

    def to_insert_dict(self) -> dict[str, Any]:
        payload = self.model_dump(exclude_none=True)
        payload["tenant_id"] = str(self.tenant_id)
        return payload


class SecondarySaleRecord(PrimarySaleRecord):
    """Maps to public.secondary_sales_data."""

    data_source: str = "manual_upload"


class SchemeRecord(BaseModel):
    """Maps to public.scheme_master."""

    model_config = ConfigDict(extra="ignore")

    tenant_id: UUID
    scheme_name: str = ""
    party_name: str = ""
    product_name: str = ""
    product_group: str = ""
    discount_pct: float = 0.0
    claimed_amount: float = 0.0
    scheme_start: str | None = None
    scheme_end: str | None = None
    raw_data: dict[str, Any] = Field(default_factory=dict)
    import_id: str | None = None
    import_job_id: str | None = None

    @field_validator("scheme_name", "party_name", "product_name", "product_group", mode="before")
    @classmethod
    def _str_fields(cls, value: Any) -> str:
        return _coerce_str(value)

    @field_validator("discount_pct", "claimed_amount", mode="before")
    @classmethod
    def _floats(cls, value: Any) -> float:
        return _coerce_float(value)

    @field_validator("scheme_start", "scheme_end", mode="before")
    @classmethod
    def _optional_date(cls, value: Any) -> str | None:
        text = _coerce_date_str(value)
        return text or None

    def to_insert_dict(self) -> dict[str, Any]:
        payload = self.model_dump(exclude_none=True)
        payload["tenant_id"] = str(self.tenant_id)
        return payload


class CompanionRecord(BaseModel):
    """Maps to public.tenant_companion_data."""

    model_config = ConfigDict(extra="ignore")

    tenant_id: UUID
    source_file: str
    dataset_type: str
    record_date: str | None = None
    party_name: str | None = None
    product_name: str | None = None
    amount: float | None = None
    quantity: float | None = None
    raw_data: dict[str, Any] = Field(default_factory=dict)
    import_id: str | None = None

    def to_insert_dict(self) -> dict[str, Any]:
        payload = self.model_dump(exclude_none=True)
        payload["tenant_id"] = str(self.tenant_id)
        return payload


class MappingMemoryEntry(BaseModel):
    tenant_id: UUID
    fingerprint_hash: str
    column_mapping: dict[str, str]
    source_hint: str = ""
    profile_id: str | None = None


class SyncResult(BaseModel):
    rows_inserted: int = 0
    rows_skipped: int = 0
    rows_rejected: int = 0
    status: Literal["success", "partial", "failed"] = "success"
    errors: list[str] = Field(default_factory=list)
    cursor_after: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def _legacy_accepted(cls, data: Any) -> Any:
        if isinstance(data, dict) and "rows_accepted" in data and "rows_inserted" not in data:
            data = {**data, "rows_inserted": data["rows_accepted"]}
        return data
