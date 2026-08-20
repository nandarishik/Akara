import io

import pandas as pd
import pytest

from app.services.data_import.parser import SalesDataParser


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
