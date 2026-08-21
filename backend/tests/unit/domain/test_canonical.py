"""Canonical DTO and mapping-memory fingerprint tests."""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock
from uuid import UUID

from app.domain.connect.mapping_memory import MappingMemory, fingerprint_headers
from app.domain.data.canonical import PrimarySaleRecord, SchemeRecord, SemanticRole


TENANT = UUID("00000000-0000-0000-0000-000000000001")


def test_primary_sale_coerces_nan_and_dates():
    record = PrimarySaleRecord.model_validate({
        "tenant_id": TENANT,
        "invoice_date": date(2026, 1, 15),
        "invoice_number": "INV-1",
        "party_name": "Sharma Traders",
        "quantity": float("nan"),
        "total_amount": "1500",
        "cashier": "ignored-extra",
        "raw_data": {"cashier": "Ravi"},
    })
    payload = record.to_insert_dict()
    assert payload["invoice_date"] == "2026-01-15"
    assert payload["quantity"] == 0.0
    assert payload["total_amount"] == 1500.0
    assert payload["tenant_id"] == str(TENANT)
    assert payload["raw_data"]["cashier"] == "Ravi"
    assert "cashier" not in payload


def test_scheme_record_optional_dates():
    record = SchemeRecord.model_validate({
        "tenant_id": TENANT,
        "scheme_name": "Q1 Bonus",
        "claimed_amount": "100",
        "scheme_start": "",
    })
    payload = record.to_insert_dict()
    assert payload["claimed_amount"] == 100.0
    assert "scheme_start" not in payload


def test_semantic_role_values():
    assert SemanticRole.revenue == "revenue"
    assert SemanticRole.channel == "channel"


def test_fingerprint_headers_is_stable_and_order_independent():
    a = fingerprint_headers(["Bill Amt", "Party", "Date"])
    b = fingerprint_headers(["date", "  PARTY ", "bill amt"])
    assert a == b
    assert len(a) == 64


def test_mapping_memory_lookup_and_save():
    supabase = MagicMock()
    supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[{"column_mapping": {"Bill Amt": "total_amount"}}]
    )
    memory = MappingMemory(supabase)
    found = memory.lookup(TENANT, "abc")
    assert found == {"Bill Amt": "total_amount"}

    memory.save(TENANT, "abc", {"Bill Amt": "total_amount"}, source_hint="petpooja.csv")
    supabase.rpc.assert_called_once()
    args = supabase.rpc.call_args
    assert args.args[0] == "upsert_mapping_memory"
    assert args.args[1]["p_fingerprint"] == "abc"
