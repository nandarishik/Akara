"""Backend parser tests using benchmark fixture samples."""

from pathlib import Path

import pytest

from app.domain.data_import.parser import SalesDataParser

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "imports"


@pytest.mark.skipif(
    not (FIXTURES / "cafe_primary_sample.csv").exists(),
    reason="Run: cd akara/benchmark/universal-smb && uv run python scripts/sync_backend_fixtures.py",
)
def test_cafe_fixture_parses() -> None:
    path = FIXTURES / "cafe_primary_sample.csv"
    df = SalesDataParser().parse(path.read_bytes(), path.name)
    assert len(df) >= 100
    assert "invoice_date" in df.columns
    assert "party_name" in df.columns
    assert "total_amount" in df.columns


@pytest.mark.skipif(
    not (FIXTURES / "pharmacy_retail_sample.csv").exists(),
    reason="Run sync_backend_fixtures.py first",
)
def test_pharmacy_fixture_parses() -> None:
    path = FIXTURES / "pharmacy_retail_sample.csv"
    df = SalesDataParser().parse(path.read_bytes(), path.name)
    assert len(df) >= 100
    assert "total_amount" in df.columns


@pytest.mark.skipif(
    not (FIXTURES / "garage_invoices_sample.csv").exists(),
    reason="Run sync_backend_fixtures.py first",
)
def test_garage_fixture_has_positive_amounts() -> None:
    path = FIXTURES / "garage_invoices_sample.csv"
    df = SalesDataParser().parse(path.read_bytes(), path.name)
    assert len(df) >= 50
    assert df["total_amount"].sum() > 0
    assert df["net_amount"].sum() > 0
    assert "product_group" in df.columns
