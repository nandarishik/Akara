"""Tests for messiness injectors."""

from random import Random

import pandas as pd

from generator.core.messiness import (
    MessinessConfig,
    apply_messiness,
    format_currency_messy,
    inject_duplicate_rows,
    rename_columns_messy,
)


def test_rename_columns_uses_synonyms() -> None:
    rng = Random(42)
    df = pd.DataFrame(
        {
            "party_name": ["Alice"],
            "invoice_date": ["2026-01-15"],
            "invoice_number": ["B1"],
            "total_amount": [100.0],
        }
    )
    out = rename_columns_messy(df, rng, {"party_name": "party_name", "invoice_date": "invoice_date"})
    assert "party_name" not in out.columns
    assert len(out.columns) == 4


def test_inject_duplicates_increases_rows() -> None:
    rng = Random(1)
    df = pd.DataFrame({"a": [1, 2, 3]})
    out = inject_duplicate_rows(df, rng, prob=1.0)
    assert len(out) == 6


def test_format_currency_variants() -> None:
    rng = Random(42)
    results = {format_currency_messy(rng, 1234.5) for _ in range(20)}
    assert len(results) >= 2


def test_apply_messiness_preserves_rows() -> None:
    rng = Random(99)
    df = pd.DataFrame(
        {
            "invoice_date": ["2026-01-01", "2026-01-02"],
            "invoice_number": ["A", "B"],
            "total_amount": [10.0, 20.0],
        }
    )
    cfg = MessinessConfig(duplicate_row_prob=0, blank_row_prob=0, subtotal_row_prob=0)
    out = apply_messiness(df, rng, cfg, date_col="invoice_date", amount_cols=["total_amount"])
    assert len(out) >= 2
