"""Industry-agnostic parser regression tests for Akara data import."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT.parents[1] / "backend"
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(ROOT))

from harness.parser_metrics import evaluate_manifest_import_files, evaluate_parse


@pytest.fixture(scope="module")
def ensure_all_datasets():
    cafe_xlsx = ROOT / "datasets" / "cafe_brewlab" / "BrewLab_Sales_Report_Jan-Jun2026.xlsx"
    if not cafe_xlsx.exists():
        from generator.cafe.generate import run as run_cafe
        from generator.garage.generate import run as run_garage
        from generator.pharmacy.generate import run as run_pharmacy

        run_cafe(ROOT / "canonical" / "cafe_brewlab.db", ROOT / "datasets" / "cafe_brewlab")
        run_garage(ROOT / "canonical" / "garage_autocare.db", ROOT / "datasets" / "garage_autocare")
        run_pharmacy(ROOT / "canonical" / "pharmacy_medplus.db", ROOT / "datasets" / "pharmacy_medplus")


def test_all_manifest_import_files_parse(ensure_all_datasets) -> None:
    """Every manifest import:true file must parse with required columns."""
    results = evaluate_manifest_import_files()
    failures = [r for r in results if not r.success]
    assert not failures, "\n".join(f"{f.file}: {f.error}" for f in failures)


def test_cafe_primary_sheet_column_aliases(ensure_all_datasets) -> None:
    path = ROOT / "datasets" / "cafe_brewlab" / "BrewLab_Sales_Report_Jan-Jun2026.xlsx"
    m = evaluate_parse(
        path,
        sheet_name="Discount Report Item Wise",
        expected_rows_min=18000,
    )
    assert m.success, m.error
    assert "party_name" in m.columns_mapped
    assert "product_name" in m.optional_recovered
    assert m.rows_parsed >= 18000


def test_cafe_online_orders_csv(ensure_all_datasets) -> None:
    path = ROOT / "datasets" / "cafe_brewlab" / "online_orders_jan_jun.csv"
    m = evaluate_parse(path, expected_rows_min=1000)
    assert m.success, m.error
    assert "total_amount" in m.columns_mapped


def test_garage_service_invoices(ensure_all_datasets) -> None:
    path = ROOT / "datasets" / "garage_autocare" / "service_invoices.xlsx"
    m = evaluate_parse(
        path,
        sheet_name="Parts & Labour Register",
        expected_rows_min=3500,
    )
    assert m.success, m.error
    assert "party_name" in m.columns_mapped


def test_pharmacy_retail_register(ensure_all_datasets) -> None:
    path = ROOT / "datasets" / "pharmacy_medplus" / "retail_sales_register.csv"
    m = evaluate_parse(path, expected_rows_min=18000)
    assert m.success, m.error
    assert "party_name" in m.columns_mapped
    assert m.rows_parsed >= 18000


def test_cafe_metadata_header_detection(ensure_all_datasets) -> None:
    """Parser must skip 3 Petpooja metadata rows and find real headers."""
    from app.services.data_import.detector import detect_header_row_in_df
    import pandas as pd

    path = ROOT / "datasets" / "cafe_brewlab" / "BrewLab_Sales_Report_Jan-Jun2026.xlsx"
    raw = pd.read_excel(path, sheet_name="Discount Report Item Wise", header=None)
    header_row = detect_header_row_in_df(raw)
    assert header_row == 3, f"expected header row 3, got {header_row}"


def test_parser_recovery_rates(ensure_all_datasets) -> None:
    results = evaluate_manifest_import_files()
    for m in results:
        assert m.required_recovery_rate == 1.0, f"{m.file} missing {m.columns_missing}"
