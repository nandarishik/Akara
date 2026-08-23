import io

import pandas as pd
import pytest

from app.domain.data_import.parser import SalesDataParser, analyze_columns


@pytest.fixture
def parser() -> SalesDataParser:
    return SalesDataParser()


def make_csv(rows: list[dict]) -> bytes:
    df = pd.DataFrame(rows)
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return buf.getvalue().encode()


def test_parse_valid_csv(parser: SalesDataParser) -> None:
    csv = make_csv(
        [
            {
                "invoice_date": "2024-01-15",
                "party_name": "ABC Stores",
                "total_amount": 5000.0,
            }
        ]
    )
    df = parser.parse(csv, "test.csv")
    assert len(df) == 1
    assert df.iloc[0]["party_name"] == "ABC Stores"


def test_parse_missing_required_column_raises(parser: SalesDataParser) -> None:
    csv = make_csv([{"invoice_date": "2024-01-15", "quantity": 10}])
    with pytest.raises(ValueError, match="Missing required columns"):
        parser.parse(csv, "test.csv")


def test_parse_unsupported_extension_raises(parser: SalesDataParser) -> None:
    with pytest.raises(ValueError, match="Unsupported"):
        parser.parse(b"data", "test.pdf")


def test_parse_column_alias_mapping(parser: SalesDataParser) -> None:
    csv = make_csv(
        [
            {
                "date": "2024-01-15",
                "customer": "XYZ Corp",
                "total": 9999.99,
            }
        ]
    )
    df = parser.parse(csv, "test.csv")
    assert "invoice_date" in df.columns
    assert "party_name" in df.columns
    assert "total_amount" in df.columns


def test_parse_net_amount_from_total(parser: SalesDataParser) -> None:
    csv = make_csv(
        [
            {
                "invoice_date": "2024-01-15",
                "party_name": "Garage Co",
                "total_amount": 1500.0,
            }
        ]
    )
    df = parser.parse(csv, "test.csv")
    assert df.iloc[0]["net_amount"] == 1500.0


def test_parse_skips_section_header_rows(parser: SalesDataParser) -> None:
    csv = make_csv(
        [
            {"invoice_date": "2024-01-15", "party_name": "A", "total_amount": 100.0},
            {"invoice_date": "--- INSURANCE JOBS ---", "party_name": "", "total_amount": ""},
            {"invoice_date": "2024-01-16", "party_name": "B", "total_amount": 200.0},
        ]
    )
    df = parser.parse(csv, "test.csv")
    assert len(df) == 2


# ── analyze_columns (assisted-onboarding mapping report) ──────────────────────

def test_analyze_columns_maps_aliases_and_flags_unmapped() -> None:
    report = analyze_columns(["Bill Date", "Customer", "Bill Amt", "Cashier"], "primary")
    resolved = report["resolved_mapping"]
    assert resolved["bill_date"] == "invoice_date"
    assert resolved["customer"] == "party_name"
    assert resolved["bill_amt"] == "total_amount"
    # Unrecognised column falls through to raw_data (unmapped).
    assert [u["source"] for u in report["unmapped"]] == ["Cashier"]
    assert report["missing_required"] == []
    assert all(m["via"] == "alias" for m in report["mapped"])


def test_analyze_columns_reports_missing_required() -> None:
    report = analyze_columns(["Some Date", "Random Note"], "primary")
    # party_name and total_amount cannot be resolved.
    assert "party_name" in report["missing_required"]
    assert "total_amount" in report["missing_required"]


def test_analyze_columns_override_force_maps_and_force_unmaps() -> None:
    report = analyze_columns(
        ["Bill Date", "Customer", "Bill Amt", "Cashier"],
        "primary",
        overrides={"Cashier": "route", "Bill Amt": ""},
    )
    canonicals = {m["normalized"]: (m["canonical"], m["via"]) for m in report["mapped"]}
    # Force-mapped an otherwise-unmapped column, marked as via=override.
    assert canonicals["cashier"] == ("route", "override")
    # Force-unmapped a column that an alias would have mapped.
    assert "bill_amt" not in report["resolved_mapping"]
    assert "Bill Amt" in [u["source"] for u in report["unmapped"]]
    # Dropping total_amount (no net/gross fallback) makes it required-missing.
    assert "total_amount" in report["missing_required"]


def test_analyze_columns_primary_amount_fallback_not_missing() -> None:
    # Petpooja item sheets: net_amount present, no explicit total_amount.
    report = analyze_columns(["Sale Date", "Customer", "Net Sales"], "primary")
    assert "net_amount" in report["canonical_fields"]
    # total_amount is derivable from net_amount, so it is NOT reported missing.
    assert "total_amount" not in report["missing_required"]


def test_analyze_columns_scheme_source_type() -> None:
    report = analyze_columns(["Scheme", "Distributor", "Claimed Amt"], "scheme")
    resolved = report["resolved_mapping"]
    assert resolved["scheme"] == "scheme_name"
    assert resolved["distributor"] == "party_name"
    assert resolved["claimed_amt"] == "claimed_amount"
    assert report["missing_required"] == []
