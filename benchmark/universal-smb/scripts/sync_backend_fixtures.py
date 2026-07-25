"""Copy benchmark dataset samples into backend/tests/fixtures/imports/."""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BENCHMARK = ROOT / "datasets"
FIXTURES = ROOT.parents[1] / "backend" / "tests" / "fixtures" / "imports"


def _sample_csv(src: Path, dest: Path, n: int = 500) -> None:
    import pandas as pd

    if src.suffix.lower() in (".xlsx", ".xls"):
        df = pd.read_excel(src, sheet_name=0 if "service" not in src.name else "Parts & Labour Register")
    else:
        df = pd.read_csv(src, nrows=n * 3)
    df.head(n).to_csv(dest, index=False)


def main() -> None:
    FIXTURES.mkdir(parents=True, exist_ok=True)

    cafe_xlsx = BENCHMARK / "cafe_brewlab" / "BrewLab_Sales_Report_Jan-Jun2026.xlsx"
    if cafe_xlsx.exists():
        import pandas as pd

        df = pd.read_excel(cafe_xlsx, sheet_name="Discount Report Item Wise")
        df.head(500).to_csv(FIXTURES / "cafe_primary_sample.csv", index=False)

    garage_xlsx = BENCHMARK / "garage_autocare" / "service_invoices.xlsx"
    if garage_xlsx.exists():
        import pandas as pd

        df = pd.read_excel(garage_xlsx, sheet_name="Parts & Labour Register")
        df.head(500).to_csv(FIXTURES / "garage_invoices_sample.csv", index=False)

    pharma = BENCHMARK / "pharmacy_medplus" / "retail_sales_register.csv"
    if pharma.exists():
        _sample_csv(pharma, FIXTURES / "pharmacy_retail_sample.csv")

    print(f"Synced fixtures to {FIXTURES}")


if __name__ == "__main__":
    main()
