"""Parse companion/auxiliary CSV files into normalized rows for tenant_companion_data."""

from __future__ import annotations

import io
import re
from typing import Any

import pandas as pd

from app.services.data_import.detector import read_file_smart


def _norm(col: str) -> str:
    col = col.strip().lower()
    col = re.sub(r"\s+", "_", col)
    col = re.sub(r"[^a-z0-9_]", "", col)
    return col.strip("_")


_DATE_ALIASES = frozenset({
    "date", "record_date", "shift_date", "writeoff_date", "claim_date",
    "referral_date", "return_date", "purchase_date", "estimate_date",
})
_AMOUNT_ALIASES = frozenset({
    "amount", "cost", "total", "total_amount", "writeoff_amount", "refund_amount",
    "variance", "approved_amount", "billed_amount", "purchase_cost", "revenue",
})
_PARTY_ALIASES = frozenset({"party_name", "customer", "patient", "pharmacist", "mechanic", "doctor", "name"})
_PRODUCT_ALIASES = frozenset({"product_name", "item", "medicine", "part", "description"})
_QTY_ALIASES = frozenset({"quantity", "qty", "hours", "shift_hours", "labour_hours"})


def _pick_column(norm_cols: dict[str, str], aliases: frozenset[str]) -> str | None:
    for alias in aliases:
        if alias in norm_cols:
            return norm_cols[alias]
    return None


def parse_companion_file(
    content: bytes,
    filename: str,
    dataset_type: str,
) -> list[dict[str, Any]]:
    """Return list of row dicts ready for tenant_companion_data insert."""
    df = read_file_smart(content, filename)
    if df.empty:
        return []

    norm_map = {_norm(c): c for c in df.columns}
    date_col = _pick_column(norm_map, _DATE_ALIASES)
    amount_col = _pick_column(norm_map, _AMOUNT_ALIASES)
    party_col = _pick_column(norm_map, _PARTY_ALIASES)
    product_col = _pick_column(norm_map, _PRODUCT_ALIASES)
    qty_col = _pick_column(norm_map, _QTY_ALIASES)

    records: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        raw: dict[str, Any] = {}
        used: set[str] = set()
        for alias_set, col in (
            (_DATE_ALIASES, date_col),
            (_AMOUNT_ALIASES, amount_col),
            (_PARTY_ALIASES, party_col),
            (_PRODUCT_ALIASES, product_col),
            (_QTY_ALIASES, qty_col),
        ):
            if col:
                used.add(col)
        for c in df.columns:
            if c not in used:
                val = row.get(c)
                if pd.notna(val) and str(val).strip():
                    raw[_norm(c)] = str(val)

        rec: dict[str, Any] = {
            "source_file": filename,
            "dataset_type": dataset_type,
            "record_date": str(row[date_col])[:10] if date_col and pd.notna(row.get(date_col)) else None,
            "party_name": str(row[party_col]) if party_col and pd.notna(row.get(party_col)) else None,
            "product_name": str(row[product_col]) if product_col and pd.notna(row.get(product_col)) else None,
            "amount": _safe_float(row.get(amount_col)) if amount_col else None,
            "quantity": _safe_float(row.get(qty_col)) if qty_col else None,
            "raw_data": raw,
        }
        if rec["record_date"] in ("NaT", "None", "nan", ""):
            rec["record_date"] = None
        records.append(rec)
    return records


def _safe_float(value: Any) -> float | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        s = str(value).replace(",", "").replace("₹", "").strip()
        if not s or s.lower() in ("nan", "none"):
            return None
        return float(s)
    except (TypeError, ValueError):
        return None
