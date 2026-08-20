"""Canonical sale / sync DTOs (scaffold)."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class PrimarySaleRecord(BaseModel):
    tenant_id: UUID
    invoice_date: date
    invoice_number: str | None = None
    party_name: str | None = None
    product_name: str | None = None
    quantity: float = 0
    total_amount: float = 0
    raw_data: dict = Field(default_factory=dict)


class SyncResult(BaseModel):
    rows_accepted: int = 0
    rows_rejected: int = 0
    message: str = ""
