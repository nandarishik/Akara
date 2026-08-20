"""One-off: analyze Sales Report.xlsx sheet selection."""
from pathlib import Path

from app.domain.data_import.detector import score_sheets, best_sales_sheet
from app.domain.data_import.parser import SalesDataParser

path = Path(r"C:\Users\Admin\Desktop\Projects\Sales Report.xlsx")
content = path.read_bytes()

print("Auto-selected:", best_sales_sheet(content, path.name))
print()

for sheet in [
    "ITEM WISE HOURLY SALE",
    "Tax Charge",
    "Discount Report Item Wise",
    "HOURLY SALE",
]:
    try:
        df = SalesDataParser(sheet_name=sheet).parse(content, path.name)
        n_dates = df["invoice_date"].nunique() if len(df) and "invoice_date" in df.columns else 0
        print(f"{sheet!r}: {len(df)} rows, {n_dates} unique dates")
    except Exception as exc:
        print(f"{sheet!r}: ERROR {exc}")

print("\nAll sheets ranked:")
for s in score_sheets(content, path.name)[:12]:
    print(f"  {s.row_count:5d} rows  score={s.score:3d}  {s.sheet_name!r}")
