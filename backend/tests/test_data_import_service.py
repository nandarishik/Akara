import io
import json
import math

import pandas as pd
import pytest

from app.services.data_import.service import (
    DataImportService,
    _safe_float,
    _sanitize_for_json,
)


def test_safe_float_handles_nan() -> None:
    assert _safe_float(float("nan")) == 0.0
    assert _safe_float(None) == 0.0
    assert _safe_float("12.5") == 12.5


def test_sanitize_for_json_removes_nan() -> None:
    payload = {"qty": float("nan"), "name": "QAFFEINE", "nested": {"rate": float("inf")}}
    clean = _sanitize_for_json(payload)
    json.dumps(clean)
    assert clean["qty"] is None
    assert clean["nested"]["rate"] is None


def test_import_records_are_json_serializable() -> None:
    df = pd.DataFrame(
        [
            {
                "invoice_date": "2025-12-01",
                "party_name": "QAFFEINE HITECH CITY",
                "total_amount": 203.0,
                "quantity": float("nan"),
                "refund_amt": float("nan"),
            }
        ]
    )
    records = df.to_dict(orient="records")
    row = records[0]
    payload = {
        "quantity": _safe_float(row.get("quantity")),
        "total_amount": _safe_float(row.get("total_amount")),
        "raw_data": _sanitize_for_json(row),
    }
    encoded = json.dumps(payload)
    assert "NaN" not in encoded
    assert math.isfinite(payload["quantity"])
