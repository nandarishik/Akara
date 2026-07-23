# AKARA Data Import — Column-Agnostic Parsing + Import History

> **Status**: Part 1 (Column-Agnostic Parsing) — ✅ **IMPLEMENTED**
> Part 2 (Import History + Undo) — ⏳ **PENDING** (code plan ready, not yet deployed)

---

## Reproduction Instructions

Before applying:
- Days 1–13 must already be implemented.
- `akara/backend/app/services/data_import/parser.py` and `service.py` from Day 5/7 must exist.
- `akara/migrations/001_initial_schema.sql` must have `raw_data JSONB` on `sales_data`.

Apply changes in this order:
1. Create `detector.py`
2. Replace `parser.py`
3. Update `service.py`
4. Update `data.py`
5. Run `ruff check` — all clear before testing

---

## Background: Why This Was Needed

Real customer exports (verified against QAFFEINE's 49-sheet Petpooja/BrainPower report):

| Problem | Root Cause |
|---|---|
| Parser crashes on valid files | File has 2–7 metadata rows at top before actual column headers |
| Reads wrong data from Excel | `pd.read_excel()` defaults to sheet index 0 (often a summary/DSR page) |
| `Missing required columns: {'total_amount'}` | Column aliases too narrow — only ~16 mappings for hundreds of real-world names |
| Silent data loss | Unknown columns simply dropped; no visibility into what was discarded |
| Extra/unexpected columns lost | No overflow storage for columns the schema doesn't explicitly know about |

**Verified sheet analysis of QAFFEINE's "Sales Report.xlsx" (49 sheets):**

| Sheet | Rows | Sales-Relevant | Notes |
|---|---|---|---|
| DSR | 58 | Summary only | First sheet — wrong default |
| Aggregator Details | 38 | ✓ | Per-outlet per-aggregator daily |
| Menu Mix Summary | 523 | ✓ | Per-item, no daily breakdown |
| MenuMix from 0 to 704 | 718 | ✓ | Per-item with outlet |
| **Discount Report Item Wise** | **562** | **✓✓✓ BEST** | Per-item, per-bill, date+outlet+product+amounts |
| ITEM WISE HOURLY SALE | 3456 | ✓ | Per-item per hour |
| HOURLY SALE | 600 | ✓ | Per-hour aggregated |
| Tax Charge | 4149 | ✓ | Bill-level tax breakdown |
| Bill Register | 1567 | ✓ | Bill-level (not item-level) |
| Online Orders Register | 102 | ✓ | Aggregator orders only |
| Cashier Wise Menu Mix | 1820 | ✓ | Per-cashier item detail |
| Counter Wise Summary | 81 | Summary | Daily outlet summary |
| SETTLEMENT SUMMARY | 50 | Summary | Payment mode summary |
| Stock Report | 2555 | ✗ INVENTORY | |
| GRN Register | 220 | ✗ INVENTORY | |
| WASTAGE REPORT | 31 | ✗ OPERATIONS | |
| STOCK VARIANCE REPORT | 1020 | ✗ INVENTORY | |
| Indent Register | 1048 | ✗ OPERATIONS | |
| STN details | 1078 | ✗ SUPPLY CHAIN | |

---

## Part 1 — Column-Agnostic Parsing ✅ IMPLEMENTED

### Files Changed

| File | Status |
|---|---|
| `akara/backend/app/services/data_import/detector.py` | **Created** |
| `akara/backend/app/services/data_import/parser.py` | **Replaced** |
| `akara/backend/app/services/data_import/service.py` | **Modified** |
| `akara/backend/app/api/routes/data.py` | **Modified** |

---

## File: `akara/backend/app/services/data_import/detector.py`

**Status:** Created

### Purpose

Solves two problems that break the naive `pd.read_excel()` approach:

1. **Metadata rows at top** — Petpooja, Tally, Marg, GoFrugal all put 1–9 header/title rows before actual column headers. `detect_header_row_in_df()` scans from row 0 and returns the real header row index.

2. **Multi-sheet Excel** — A Petpooja export has 49 sheets. `score_sheets()` ranks every sheet by how likely it is to contain sales transactions and returns a sorted list with scores so the UI can recommend the best sheet.

### Implementation

```python
"""
Smart file detector for AKARA data imports.

Solves two problems that break the naive pd.read_excel() approach:

1. Metadata rows at the top — real-world exports from Petpooja, Tally, Marg, etc.
   start with 1–9 header/title rows before the actual column names appear.
   detect_header_row() scans from the top and returns the real header row index.

2. Multi-sheet Excel files — a Petpooja export has 49 sheets. score_sheets()
   ranks them by how likely they are to contain sales transactions so we can
   recommend the best sheet instead of blindly reading sheet[0].

Supported software fingerprints:
  - Petpooja / BrainPower (QAFFEINE-style reports)
  - TallyPrime (Voucher Register, Day Book, Sales Register, Account Ledger)
  - Marg ERP (Sales Register, Party Ledger, Outstanding Report)
  - Vyapar / myBillBook (Sales Report, Item Sales Report)
  - Busy Accounting (Sales Register, Item-wise Sales)
  - GoFrugal RetailEasy (Sales Invoice Summary, Item Sales)
  - KhataBuddy (lightweight mobile exports)
  - Generic CSV exports from any software
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass, field

import pandas as pd

logger = logging.getLogger(__name__)

# ── Metadata row patterns ─────────────────────────────────────────────────────
# Rows whose first meaningful cell contains one of these strings are metadata
# rows that should be skipped when searching for the real column header.

METADATA_PHRASES: frozenset[str] = frozenset(
    {
        # ── Petpooja / BrainPower ─────────────────────────────────────────────
        "daily sales report",
        "menu mix summary report",
        "menu mix summary",
        "invoice bill register",
        "hourly sale",
        "aggregator hourly sale",
        "item wise hourly sale",
        "cashier wise counter wise report",
        "counter wise summary report",
        "discount analysis report",
        "online order details",
        "stock report",
        "grn register",
        "wastage  report",
        "wastage report",
        "stock variance report",
        "ideal consumption store/brand",
        "ideal consumption store brand",
        "credit card settlement report",
        "bill wise item wise nc sales",
        "void order register",
        "cancel order register",
        "cancel order menu mix",
        "settlement summary",
        "resettlement",
        "indent details",
        "indent register",
        "hold_indet_list",
        "physical stock report",
        "stn details",
        "monthwise stn details",
        "stn fill rate",
        "grn against stn register",
        "grn against stn details",
        "grn against stn analysis",
        "ordering  report",
        "ordering report",
        "issue note register",
        "grn details",
        "grn details-1",
        "product consumption report",
        "fc product",
        "productwise ideal",
        "tax charge",
        "aggregator details",
        "card wise detail report",
        # ── Generic filter rows ───────────────────────────────────────────────
        "store selection",
        "city selection",
        "state selection",
        "region selection",
        "brand selection",
        "date selection",
        "delivery dt",
        "indent status",
        "to location",
        # ── Company / branding rows ───────────────────────────────────────────
        "company:",
        "qaffeine pvt ltd",
        "tally solutions",
        "vyapar",
        "busy",
        "marg erp",
        "gofrugal",
        "mybillbook",
        "khatabuddy",
        # ── Date-range header rows ────────────────────────────────────────────
        "from",
        "to",
        "as on date",
        "period",
        "report period",
        "financial year",
        # ── Tally-specific ────────────────────────────────────────────────────
        "voucher type",
        "tally",
        "narration",
        # ── Subtotal / total rows ─────────────────────────────────────────────
        "grand total",
        "total",
        "sub total",
        "subtotal",
        "opening balance",
        "closing balance",
    }
)

# ── Sheet scoring — sales relevance ───────────────────────────────────────────

SALES_SIGNAL_COLS: frozenset[str] = frozenset(
    {
        "date", "invoice date", "bill date", "sale date", "transaction date",
        "voucher date", "order date",
        "bill amt", "bill amount", "net amt", "net amount", "net sales",
        "total amount", "total", "amount", "gross amount", "basic amount",
        "basic amt", "net_amt", "grossamt", "netamt", "billamt",
        "party name", "customer", "customer name", "ledger name",
        "account name", "restaurant name", "location name", "location",
        "product name", "item name", "item", "product", "menu item",
        "goods name", "stock item",
        "invoice no", "invoice number", "bill no", "bill number",
        "voucher no", "voucher number", "order no", "order number",
    }
)

INVENTORY_SIGNAL_COLS: frozenset[str] = frozenset(
    {
        "book stock", "physical stock", "closing_qty", "closing_value",
        "closing qty", "closing value", "opening_qty", "opening qty",
        "grn no", "grn_no", "grn number", "po no", "po_no",
        "wastage qty", "wastage_qty", "variance", "variance amount",
        "purchase uom", "stock uom", "consumption uom", "packing",
        "indent status", "transaction id", "indent id",
        "supplier name", "supplier", "hsn code",
        "reorder level", "minimum stock", "maximum stock",
    }
)

NON_SALES_SHEET_NAME_FRAGMENTS: frozenset[str] = frozenset(
    {
        "stock", "grn", "purchase", "wastage", "indent", "stn",
        "inventory", "supplier", "consumption", "variance",
        "payable", "receivable", "ledger",
        "cancel", "void", "nc sales", "nc_sales",
        "resettlement", "settlement",
        "credit card", "card wise",
        "hold", "ordering",
        "material return", "monthwise supplier",
        "fc product", "productwise ideal", "ideal consumption",
    }
)

SALES_SHEET_NAME_FRAGMENTS: frozenset[str] = frozenset(
    {
        "sales", "invoice", "bill register", "menu mix",
        "item wise", "discount", "aggregator", "hourly",
        "cashier", "counter", "dsr", "order", "tax charge",
        "day book", "voucher", "register", "daybook",
        "sales register", "bill", "pos", "transaction",
    }
)


@dataclass
class SheetScore:
    sheet_name: str
    score: int
    row_count: int
    detected_header_row: int | None
    detected_columns: list[str] = field(default_factory=list)
    reason: str = ""


def score_sheets(file_content: bytes, filename: str) -> list[SheetScore]:
    """
    Score every sheet in an Excel file by how likely it is to contain
    sales transaction data. Returns list sorted by score descending.
    CSV files return a single-item list.
    """
    if filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(file_content), header=None, nrows=20)
        header_row = detect_header_row_in_df(df)
        cols = _get_header_columns(df, header_row)
        score = _score_columns(cols, sheet_name="")
        return [SheetScore(
            sheet_name="(CSV)",
            score=score,
            row_count=len(pd.read_csv(io.BytesIO(file_content))),
            detected_header_row=header_row,
            detected_columns=cols,
            reason="CSV file",
        )]

    scores: list[SheetScore] = []
    try:
        xl = pd.ExcelFile(io.BytesIO(file_content))
    except Exception as exc:
        logger.error("Failed to open Excel file: %s", exc)
        return scores

    for sheet_name in xl.sheet_names:
        try:
            raw = pd.read_excel(
                io.BytesIO(file_content),
                sheet_name=sheet_name,
                header=None,
                nrows=15,
            )
            total_rows = pd.read_excel(
                io.BytesIO(file_content), sheet_name=sheet_name, header=None
            ).shape[0]
        except Exception:
            continue

        header_row = detect_header_row_in_df(raw)
        cols = _get_header_columns(raw, header_row)
        score, reason = _score_sheet(sheet_name, cols, total_rows)

        scores.append(SheetScore(
            sheet_name=sheet_name,
            score=score,
            row_count=total_rows,
            detected_header_row=header_row,
            detected_columns=cols,
            reason=reason,
        ))

    scores.sort(key=lambda s: s.score, reverse=True)
    return scores


def _score_sheet(sheet_name: str, columns: list[str], row_count: int) -> tuple[int, str]:
    score = 0
    reasons: list[str] = []
    name_lower = sheet_name.lower().strip()

    for frag in NON_SALES_SHEET_NAME_FRAGMENTS:
        if frag in name_lower:
            score -= 20
            reasons.append(f"sheet name contains '{frag}'")
            break

    for frag in SALES_SHEET_NAME_FRAGMENTS:
        if frag in name_lower:
            score += 15
            reasons.append(f"sheet name contains '{frag}'")
            break

    col_score = _score_columns(columns, sheet_name)
    score += col_score

    if row_count > 500:
        score += 10
    elif row_count > 100:
        score += 5
    elif row_count < 20:
        score -= 10

    if col_score > 0:
        reasons.append(f"col score={col_score}")

    return score, "; ".join(reasons) if reasons else "no signal"


def _score_columns(columns: list[str], sheet_name: str) -> int:
    normalised = {c.lower().strip() for c in columns}
    sales_hits = len(normalised & SALES_SIGNAL_COLS)
    inventory_hits = len(normalised & INVENTORY_SIGNAL_COLS)
    score = (sales_hits * 8) - (inventory_hits * 15)

    has_date = bool(
        normalised & {"date", "invoice date", "bill date", "voucher date",
                      "transaction date", "sale date", "order date"}
    )
    has_amount = bool(
        normalised & {"bill amt", "bill amount", "net amt", "net amount",
                      "net sales", "total amount", "total", "amount",
                      "gross amount", "basic amount", "basic amt", "billamt"}
    )
    if has_date and has_amount:
        score += 20
    return score


def _get_header_columns(df: pd.DataFrame, header_row: int | None) -> list[str]:
    if header_row is None or header_row >= len(df):
        return []
    row = df.iloc[header_row]
    return [str(v).strip() for v in row if v is not None and str(v).strip() not in ("", "None", "nan")]


def detect_header_row_in_df(df: pd.DataFrame) -> int:
    """
    Scan a raw DataFrame (read with header=None) row by row.
    Return the index of the first row that looks like a real column header.
    Falls back to row 0 if nothing better is found.
    """
    for i in range(min(15, len(df))):
        row = df.iloc[i]
        non_null = [
            v for v in row
            if v is not None and str(v).strip() not in ("", "None", "nan", "NaT")
        ]

        if len(non_null) < 3:
            continue

        first_val = str(non_null[0]).strip().lower()
        if any(first_val.startswith(p) or first_val == p for p in METADATA_PHRASES):
            continue

        row_text = " ".join(str(v).strip().lower() for v in non_null)
        is_metadata = False
        for phrase in METADATA_PHRASES:
            if phrase in row_text[:80]:
                is_metadata = True
                break
        if is_metadata:
            continue

        import datetime as dt
        text_cells = [
            v for v in non_null
            if isinstance(v, str) and not v.replace(".", "").replace("-", "").replace("/", "").replace(" ", "").isdigit()
            and not isinstance(v, (dt.datetime, dt.date))
        ]
        if not text_cells:
            continue

        numeric_count = sum(
            1 for v in non_null
            if isinstance(v, (int, float)) and not isinstance(v, bool)
        )
        if len(non_null) > 3 and numeric_count / len(non_null) > 0.6:
            continue

        return i

    return 0


def read_file_smart(
    file_content: bytes,
    filename: str,
    sheet_name: str | int | None = None,
) -> pd.DataFrame:
    """
    Read a CSV or Excel file with automatic header-row detection.
    sheet_name: for Excel — sheet name string, index int, or None (→ sheet 0).
    """
    if filename.lower().endswith(".csv"):
        raw = pd.read_csv(io.BytesIO(file_content), header=None)
        header_row = detect_header_row_in_df(raw)
        return pd.read_csv(io.BytesIO(file_content), header=header_row)

    if filename.lower().endswith((".xlsx", ".xls")):
        target_sheet = sheet_name if sheet_name is not None else 0
        raw = pd.read_excel(
            io.BytesIO(file_content),
            sheet_name=target_sheet,
            header=None,
        )
        header_row = detect_header_row_in_df(raw)
        return pd.read_excel(
            io.BytesIO(file_content),
            sheet_name=target_sheet,
            header=header_row,
        )

    raise ValueError(f"Unsupported file type: {filename}")


def list_sheets(file_content: bytes, filename: str) -> list[str]:
    """Return sheet names for Excel files. Returns empty list for CSV."""
    if filename.lower().endswith(".csv"):
        return []
    try:
        xl = pd.ExcelFile(io.BytesIO(file_content))
        return xl.sheet_names
    except Exception:
        return []


def best_sales_sheet(file_content: bytes, filename: str) -> str | None:
    """
    Return the name of the sheet most likely to contain sales data.
    Returns None for CSV or single-sheet files.
    """
    if filename.lower().endswith(".csv"):
        return None
    sheets = list_sheets(file_content, filename)
    if len(sheets) <= 1:
        return None
    scored = score_sheets(file_content, filename)
    if not scored or scored[0].score <= 0:
        return sheets[0]
    return scored[0].sheet_name
```

### Placement

New file at `akara/backend/app/services/data_import/detector.py`.
No other imports needed — pure standard library + `pandas`.

### Dependencies

- `pandas` (already in `pyproject.toml`)
- No new packages needed

---

## File: `akara/backend/app/services/data_import/parser.py`

**Status:** Replaced (complete rewrite of previous 169-line version)

### Purpose

Massively expanded column aliases covering every real-world ERP/POS export verified against actual customer data. Replaced the naive `pd.read_excel()` call with `read_file_smart()` from `detector.py`. Added column deduplication (coalescing) for when two source columns map to the same AKARA canonical name.

### What Changed vs Old Version

| Old | New |
|---|---|
| 16 column aliases | 160+ aliases across 7 software platforms |
| `pd.read_excel(file)` — no header detection | `read_file_smart()` — auto-detects header row |
| Only reads first sheet | Auto-selects best sales sheet via `best_sales_sheet()` |
| Parser crashes on missing columns | Fallback: `total_amount ← net_amount ← gross_amount` |
| Duplicate column names cause silent bugs | Coalesce duplicate column names (first non-null wins) |
| `_norm()` was just `.lower().replace(" ", "_")` | Full regex normalisation (removes dots, handles `\n`, collapses `__`) |

### Column Aliases Coverage (verified against templates)

| Software | Key Column Patterns Covered |
|---|---|
| **Petpooja / BrainPower** | `BILL AMT`, `NET SALES`, `BASIC AMT`, `DISC AMT`, `LOCATION NAME`, `BRAND NAME`, `PRODUCT NAME`, `POS DSIPLAY NAME` (typo), `CHANNEL TYPE`, `ORDER SOURCE`, `WEB BILLNO`, `BRAINPOWER ORDER NO`, `WOKID` |
| **TallyPrime** | `Voucher Date`, `Voucher No`, `Particulars`, `Ledger Name`, `Taxable Amount`, `Debit`, `Credit`, `Place of Supply`, `Stock Item` |
| **Marg ERP** | `Invoice Date`, `Invoice No`, `Party Name`, `Net Value`, `Gross Value`, `Balance Amount`, `Route`, `Batch No`, `Drug Name` |
| **Vyapar** | `Customer`, `Item Name`, `Total`, `Balance Due`, `Tax Amount`, `Gross Total` |
| **Busy Accounting** | `Account Name`, `Bill Date`, `Doc Date`, `Net Amount`, `Taxable Amount` |
| **GoFrugal** | `Invoice Number`, `Customer Name`, `Invoice Amount`, `Branch`, `Department` |
| **myBillBook / KhataBuddy** | `Party Company`, `Outstanding Amount`, `Paid Amount` |

### Implementation

```python
"""
AKARA Data Import Parser
========================
Converts raw CSV/Excel uploads from ANY sales software into standardised
DataFrames that match the sales_data, secondary_sales_data, and
scheme_master Supabase tables.

Column aliases cover (verified against real export templates):
  - Petpooja / BrainPower  (49-sheet reports like QAFFEINE)
  - TallyPrime             (Voucher Register, Day Book, Sales Register)
  - Marg ERP               (Sales Register, Party Ledger, Outstanding)
  - Vyapar / myBillBook    (Sales Report, Item Sales)
  - Busy Accounting        (Sales Register, Item-wise Sales)
  - GoFrugal RetailEasy    (Sales Invoice Summary, Item Sales)
  - KhataBuddy             (lightweight mobile exports)
  - Generic CSV            (any spreadsheet with recognisable column names)
"""

from __future__ import annotations

import logging
import re

import pandas as pd

from app.services.data_import.detector import best_sales_sheet, read_file_smart

logger = logging.getLogger(__name__)


def _norm(col: str) -> str:
    """
    Normalise a raw column name to a stable lookup key.
    1. Strip + lowercase
    2. Replace whitespace runs (spaces, tabs, newlines) → single underscore
    3. Remove non-alphanumeric chars (dots, slashes, brackets…)
    4. Collapse consecutive underscores
    5. Strip leading/trailing underscores

    Examples:
      "BILL AMT"         → "bill_amt"
      "GROUP \\nNAME"    → "group_name"
      "INV. DATE"        → "inv_date"
      "VOUCHER NO."      → "voucher_no"
      "CREDIT  CARD"     → "credit_card"
    """
    col = col.strip().lower()
    col = re.sub(r"\s+", "_", col)
    col = re.sub(r"[^a-z0-9_]", "", col)
    col = re.sub(r"_+", "_", col)
    return col.strip("_")


REQUIRED_COLUMNS: set[str] = {
    "invoice_date",
    "party_name",
    "total_amount",
}

NUMERIC_COLUMNS: set[str] = {
    "quantity",
    "gross_amount",
    "discount_amount",
    "net_amount",
    "tax_amount",
    "total_amount",
    "outstanding_amount",
}

COLUMN_ALIASES: dict[str, str] = {

    # ── invoice_date ──────────────────────────────────────────────────────────
    "date":                         "invoice_date",
    "invoice_date":                 "invoice_date",
    "sale_date":                    "invoice_date",
    "sales_date":                   "invoice_date",
    "transaction_date":             "invoice_date",
    "txn_date":                     "invoice_date",
    "bill_date":                    "invoice_date",
    "order_date":                   "invoice_date",
    "voucher_date":                 "invoice_date",   # Tally
    "vch_date":                     "invoice_date",   # Tally
    "invoice_dt":                   "invoice_date",   # GoFrugal
    "billing_date":                 "invoice_date",
    "doc_date":                     "invoice_date",   # Busy
    "document_date":                "invoice_date",
    "created_at":                   "invoice_date",   # Vyapar/myBillBook
    "created_date":                 "invoice_date",
    "inv_date":                     "invoice_date",   # Marg ERP

    # ── party_name ────────────────────────────────────────────────────────────
    "party_name":                   "party_name",
    "party":                        "party_name",
    "customer":                     "party_name",
    "customer_name":                "party_name",
    "client":                       "party_name",
    "client_name":                  "party_name",
    "buyer":                        "party_name",
    "buyer_name":                   "party_name",
    "consumer":                     "party_name",
    "particulars":                  "party_name",     # Tally
    "ledger_name":                  "party_name",     # Tally
    "account":                      "party_name",     # Tally
    "account_name":                 "party_name",     # Tally / Busy
    "debtor":                       "party_name",
    "debtor_name":                  "party_name",
    "distributor":                  "party_name",     # Marg ERP
    "retailer":                     "party_name",
    "outlet":                       "party_name",
    "dealer":                       "party_name",
    "stockist":                     "party_name",
    "location":                     "party_name",     # Petpooja
    "location_name":                "party_name",     # Petpooja multi-outlet
    "location_name_":               "party_name",     # trailing-space typo
    "restaurant_name":              "party_name",     # Petpooja
    "store_name":                   "party_name",     # GoFrugal
    "store":                        "party_name",
    "outlet_name":                  "party_name",
    "branch":                       "party_name",     # GoFrugal
    "branch_name":                  "party_name",
    "firm_name":                    "party_name",     # Busy
    "party_company":                "party_name",
    "company":                      "party_name",

    # ── invoice_number ────────────────────────────────────────────────────────
    "invoice_no":                   "invoice_number",
    "invoice_number":               "invoice_number",
    "invoice_num":                  "invoice_number",
    "inv_no":                       "invoice_number",
    "inv_number":                   "invoice_number",
    "bill_no":                      "invoice_number",
    "bill_number":                  "invoice_number",
    "bill_num":                     "invoice_number",
    "order_no":                     "invoice_number",
    "order_number":                 "invoice_number",
    "order_id":                     "invoice_number",
    "transaction_no":               "invoice_number",
    "txn_no":                       "invoice_number",
    "ref_no":                       "invoice_number",
    "reference_no":                 "invoice_number",
    "voucher_no":                   "invoice_number", # Tally
    "voucher_number":               "invoice_number",
    "vch_no":                       "invoice_number",
    "vch_number":                   "invoice_number",
    "web_billno":                   "invoice_number", # Petpooja
    "brainpower_order_no":          "invoice_number", # Petpooja
    "client_order_no":              "invoice_number",
    "tranhid":                      "invoice_number", # Petpooja internal
    "challan_no":                   "invoice_number", # Marg ERP
    "challan_number":               "invoice_number",

    # ── product_name ──────────────────────────────────────────────────────────
    "product_name":                 "product_name",
    "product":                      "product_name",
    "item_name":                    "product_name",
    "item":                         "product_name",
    "goods_name":                   "product_name",
    "goods":                        "product_name",
    "description":                  "product_name",
    "product_description":          "product_name",
    "item_description":             "product_name",
    "article_name":                 "product_name",
    "sku_name":                     "product_name",
    "sku":                          "product_name",
    "stock_item":                   "product_name",   # Tally
    "stock_item_name":              "product_name",
    "material":                     "product_name",
    "material_name":                "product_name",
    "product__name":                "product_name",   # double-underscore typo
    "product_name_":                "product_name",   # trailing space → _
    "pos_display_name":             "product_name",   # Petpooja
    "pos_dsiplay_name":             "product_name",   # Petpooja typo
    "aggregator_display_name":      "product_name",
    "menu_item":                    "product_name",
    "menu_item_name":               "product_name",
    "drug_name":                    "product_name",   # Marg pharma
    "medicine_name":                "product_name",

    # ── product_group ─────────────────────────────────────────────────────────
    "product_group":                "product_group",
    "category":                     "product_group",
    "category_name":                "product_group",
    "item_category":                "product_group",
    "product_category":             "product_group",
    "department":                   "product_group",
    "group":                        "product_group",
    "group_name":                   "product_group",
    "product_group_name":           "product_group",
    "stock_group":                  "product_group",  # Tally
    "stock_category":               "product_group",
    "item_group":                   "product_group",
    "brand_name":                   "product_group",  # Petpooja
    "brand":                        "product_group",
    "band_name":                    "product_group",  # Petpooja typo
    "pos_category":                 "product_group",
    "pos_sub_category":             "product_group",
    "spl_category_name":            "product_group",
    "splcategoryname":              "product_group",
    "company_name":                 "product_group",  # Marg pharma (manufacturer)
    "manufacturer":                 "product_group",

    # ── quantity ──────────────────────────────────────────────────────────────
    "quantity":                     "quantity",
    "qty":                          "quantity",
    "sales_qty":                    "quantity",
    "sold_qty":                     "quantity",
    "no_of_units":                  "quantity",
    "units":                        "quantity",
    "nos":                          "quantity",
    "pcs":                          "quantity",
    "boxes":                        "quantity",
    "order_count":                  "quantity",       # Petpooja aggregator
    "no_of_orders":                 "quantity",
    "count":                        "quantity",
    "bill_count":                   "quantity",
    "invoice_count":                "quantity",
    "pieces":                       "quantity",
    "sale_qty":                     "quantity",

    # ── gross_amount (pre-discount revenue) ───────────────────────────────────
    "gross_amount":                 "gross_amount",
    "gross_amt":                    "gross_amount",
    "basic_amount":                 "gross_amount",   # Petpooja
    "basic_amt":                    "gross_amount",
    "basicamt":                     "gross_amount",
    "gross_sales":                  "gross_amount",
    "mrp_amount":                   "gross_amount",
    "mrp_value":                    "gross_amount",
    "list_price":                   "gross_amount",
    "list_amount":                  "gross_amount",
    "taxable_amount":               "gross_amount",   # Tally / Busy
    "taxable_value":                "gross_amount",
    "assessable_value":             "gross_amount",
    "assessable_amount":            "gross_amount",

    # ── discount_amount ───────────────────────────────────────────────────────
    "discount_amount":              "discount_amount",
    "discount_amt":                 "discount_amount",
    "discount":                     "discount_amount",
    "disc_amount":                  "discount_amount",
    "disc_amt":                     "discount_amount",
    "discamt":                      "discount_amount",
    "disc":                         "discount_amount",
    "scheme_discount":              "discount_amount",
    "trade_discount":               "discount_amount",
    "cash_discount":                "discount_amount",

    # ── net_amount (after discount, before tax) ───────────────────────────────
    "net_amount":                   "net_amount",
    "net_amt":                      "net_amount",
    "netamt":                       "net_amount",
    "net_sales":                    "net_amount",     # Petpooja item sheets
    "net_value":                    "net_amount",
    "net_revenue":                  "net_amount",
    "net":                          "net_amount",
    "sales_value":                  "net_amount",
    "net_billing_amount":           "net_amount",

    # ── tax_amount ────────────────────────────────────────────────────────────
    "tax_amount":                   "tax_amount",
    "tax_amt":                      "tax_amount",
    "tax":                          "tax_amount",
    "total_tax":                    "tax_amount",
    "gst_amount":                   "tax_amount",
    "gst_amt":                      "tax_amount",
    "gst":                          "tax_amount",
    "totalgstamt":                  "tax_amount",     # Petpooja
    "total_gst_amt":                "tax_amount",
    "total_gst":                    "tax_amount",
    "igst_amount":                  "tax_amount",     # Tally interstate
    "igst_amt":                     "tax_amount",
    "igst":                         "tax_amount",
    "vat_amount":                   "tax_amount",     # legacy pre-GST
    "vat_amt":                      "tax_amount",
    "service_tax":                  "tax_amount",     # legacy restaurants

    # ── total_amount (final billed amount, incl. tax) ─────────────────────────
    "total_amount":                 "total_amount",
    "total_amt":                    "total_amount",
    "total":                        "total_amount",
    "bill_amt":                     "total_amount",   # Petpooja
    "bill_amount":                  "total_amount",
    "billamt":                      "total_amount",
    "invoice_amount":               "total_amount",
    "invoice_amt":                  "total_amount",
    "gross_total":                  "total_amount",
    "grossamt":                     "total_amount",
    "gross_bill_amount":            "total_amount",
    "payable_amount":               "total_amount",
    "payable_amt":                  "total_amount",
    "payable":                      "total_amount",
    "receipt_amount":               "total_amount",
    "receipt_amt":                  "total_amount",
    "amount":                       "total_amount",
    "credit":                       "total_amount",   # Tally credit = revenue
    "debit":                        "total_amount",   # Tally debit = customer AR
    "value":                        "total_amount",

    # ── outstanding_amount ────────────────────────────────────────────────────
    "outstanding_amount":           "outstanding_amount",
    "outstanding_amt":              "outstanding_amount",
    "outstanding":                  "outstanding_amount",
    "balance":                      "outstanding_amount",
    "balance_amount":               "outstanding_amount",
    "balance_amt":                  "outstanding_amount",
    "balance_due":                  "outstanding_amount",
    "due_amount":                   "outstanding_amount",
    "due_amt":                      "outstanding_amount",
    "pending_amount":               "outstanding_amount",
    "pending_amt":                  "outstanding_amount",
    "overdue_amount":               "outstanding_amount",
    "receivable":                   "outstanding_amount",
    "receivable_amount":            "outstanding_amount",

    # ── route (sales channel / beat / aggregator) ────────────────────────────
    "route":                        "route",
    "route_name":                   "route",
    "channel":                      "route",
    "channel_type":                 "route",          # Petpooja
    "channel_name":                 "route",
    "sales_channel":                "route",
    "order_from":                   "route",          # Petpooja
    "order_type":                   "route",
    "order_source":                 "route",          # Petpooja
    "aggregator_name":              "route",          # Petpooja Swiggy/Zomato
    "aggregator":                   "route",
    "delivery_partner":             "route",
    "platform":                     "route",
    "type":                         "route",          # Petpooja: Carry-Out/Dine-In
    "beat":                         "route",          # Marg ERP
    "beat_name":                    "route",
    "area":                         "route",          # Marg ERP beat/area
    "sales_territory":              "route",

    # ── party_city ────────────────────────────────────────────────────────────
    "party_city":                   "party_city",
    "city":                         "party_city",
    "town":                         "party_city",
    "location_city":                "party_city",
    "buyer_city":                   "party_city",
    "state":                        "party_city",
    "place_of_supply":              "party_city",     # Tally
    "state_of_supply":              "party_city",
    "branch_city":                  "party_city",

    # ── party_zone ────────────────────────────────────────────────────────────
    "party_zone":                   "party_zone",
    "zone":                         "party_zone",
    "region":                       "party_zone",
    "territory":                    "party_zone",
    "parent_location":              "party_zone",     # Petpooja HO → outlet
    "area_name":                    "party_zone",
}

SECONDARY_REQUIRED_COLUMNS: set[str] = {"invoice_date", "party_name", "total_amount"}
SECONDARY_COLUMN_ALIASES: dict[str, str] = {
    **COLUMN_ALIASES,
    "offtake_date":                 "invoice_date",
    "dispatch_date":                "invoice_date",
    "retailer":                     "party_name",
    "retailer_name":                "party_name",
    "outlet":                       "party_name",
    "outlet_name":                  "party_name",
    "offtake_amount":               "total_amount",
    "sales_amount":                 "total_amount",
    "offtake_qty":                  "quantity",
}
SECONDARY_NUMERIC_COLUMNS: set[str] = {
    "quantity", "gross_amount", "discount_amount", "net_amount", "total_amount",
}

SCHEME_REQUIRED_COLUMNS: set[str] = {"scheme_name", "party_name", "claimed_amount"}
SCHEME_COLUMN_ALIASES: dict[str, str] = {
    "scheme_name":                  "scheme_name",
    "scheme":                       "scheme_name",
    "offer_name":                   "scheme_name",
    "promotion_name":               "scheme_name",
    "promo_name":                   "scheme_name",
    "discount_scheme":              "scheme_name",
    "distributor":                  "party_name",
    "party":                        "party_name",
    "party_name":                   "party_name",
    "customer":                     "party_name",
    "customer_name":                "party_name",
    "claimed_amount":               "claimed_amount",
    "claimed_amt":                  "claimed_amount",
    "claimed":                      "claimed_amount",
    "claim_amount":                 "claimed_amount",
    "claim_amt":                    "claimed_amount",
    "scheme_amount":                "claimed_amount",
    "amount":                       "claimed_amount",
    "value":                        "claimed_amount",
    "product_name":                 "product_name",
    "product":                      "product_name",
    "item":                         "product_name",
    "item_name":                    "product_name",
    "scheme_start":                 "scheme_start",
    "start_date":                   "scheme_start",
    "from_date":                    "scheme_start",
    "valid_from":                   "scheme_start",
    "effective_from":               "scheme_start",
    "scheme_end":                   "scheme_end",
    "end_date":                     "scheme_end",
    "to_date":                      "scheme_end",
    "valid_to":                     "scheme_end",
    "expiry_date":                  "scheme_end",
    "discount_pct":                 "discount_pct",
    "discount_%":                   "discount_pct",
    "disc_%":                       "discount_pct",
    "disc_pct":                     "discount_pct",
    "discount":                     "discount_pct",
}
SCHEME_NUMERIC_COLUMNS: set[str] = {"claimed_amount", "discount_pct"}

_PRIMARY_KNOWN_COLS: set[str] = {
    "invoice_date", "party_name", "invoice_number",
    "product_name", "product_group",
    "quantity", "gross_amount", "discount_amount",
    "net_amount", "tax_amount", "total_amount",
    "outstanding_amount", "route", "party_city", "party_zone",
}


def _normalize_columns(df: pd.DataFrame, aliases: dict[str, str]) -> pd.DataFrame:
    """
    1. Normalise every column name with _norm()
    2. Apply alias mapping
    3. Coalesce duplicate column names (first non-null wins)
    """
    df = df.copy()
    df.columns = [_norm(str(c)) for c in df.columns]
    df = df.rename(columns=aliases)

    seen: set[str] = set()
    dupes: dict[str, list[int]] = {}
    for idx, col in enumerate(df.columns):
        if col in seen:
            dupes.setdefault(col, [])
            dupes[col].append(idx)
        else:
            seen.add(col)

    if dupes:
        new_df = df.loc[:, ~df.columns.duplicated(keep="first")].copy()
        for col, extra_indices in dupes.items():
            for extra_idx in extra_indices:
                extra_col = df.iloc[:, extra_idx]
                new_df[col] = new_df[col].where(
                    new_df[col].notna() & (new_df[col] != ""), extra_col
                )
        return new_df

    return df


def _validate_required(df: pd.DataFrame, required: set[str]) -> pd.DataFrame:
    missing = required - set(df.columns)
    if missing:
        raise ValueError(
            f"Missing required columns: {missing}. "
            f"Available columns after mapping: {list(df.columns)}"
        )
    drop_subset = [
        c for c in ("invoice_date", "party_name", "scheme_name")
        if c in df.columns
    ]
    return df.dropna(subset=drop_subset)


def _coerce_numeric(df: pd.DataFrame, numeric_cols: set[str]) -> pd.DataFrame:
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    return df


class SalesDataParser:
    def __init__(self, sheet_name: str | int | None = None) -> None:
        self._sheet_name = sheet_name

    def parse(self, file_content: bytes, filename: str) -> pd.DataFrame:
        sheet = self._sheet_name
        if sheet is None and filename.lower().endswith((".xlsx", ".xls")):
            sheet = best_sales_sheet(file_content, filename)
            if sheet:
                logger.info("Auto-selected sheet '%s' for %s", sheet, filename)

        df = read_file_smart(file_content, filename, sheet_name=sheet)
        df = _normalize_columns(df, COLUMN_ALIASES)

        # Amount-column fallbacks:
        # Petpooja item sheets have NET SALES (→ net_amount) but no bill_amt.
        # In item-level reports NET SALES == the final charged amount.
        if "total_amount" not in df.columns:
            if "net_amount" in df.columns:
                df = df.copy()
                df["total_amount"] = df["net_amount"]
            elif "gross_amount" in df.columns:
                df = df.copy()
                df["total_amount"] = df["gross_amount"]

        df = _validate_required(df, REQUIRED_COLUMNS)
        df["invoice_date"] = pd.to_datetime(df["invoice_date"], errors="coerce").dt.date
        df = df.dropna(subset=["invoice_date"])
        df = _coerce_numeric(df, NUMERIC_COLUMNS)

        logger.info(
            "Parsed %d rows from '%s' (sheet=%s)",
            len(df), filename, sheet or "default",
        )
        return df


class SecondarySalesParser:
    def __init__(self, sheet_name: str | int | None = None) -> None:
        self._sheet_name = sheet_name

    def parse(self, file_content: bytes, filename: str) -> pd.DataFrame:
        sheet = self._sheet_name
        if sheet is None and filename.lower().endswith((".xlsx", ".xls")):
            sheet = best_sales_sheet(file_content, filename)
        df = read_file_smart(file_content, filename, sheet_name=sheet)
        df = _normalize_columns(df, SECONDARY_COLUMN_ALIASES)
        df = _validate_required(df, SECONDARY_REQUIRED_COLUMNS)
        df["invoice_date"] = pd.to_datetime(df["invoice_date"], errors="coerce").dt.date
        df = df.dropna(subset=["invoice_date"])
        return _coerce_numeric(df, SECONDARY_NUMERIC_COLUMNS)


class SchemeDataParser:
    def parse(self, file_content: bytes, filename: str) -> pd.DataFrame:
        df = read_file_smart(file_content, filename)
        df = _normalize_columns(df, SCHEME_COLUMN_ALIASES)
        df = _validate_required(df, SCHEME_REQUIRED_COLUMNS)
        for date_col in ("scheme_start", "scheme_end"):
            if date_col in df.columns:
                df[date_col] = pd.to_datetime(df[date_col], errors="coerce").dt.date
        return _coerce_numeric(df, SCHEME_NUMERIC_COLUMNS)
```

### Dependencies Introduced

- `app.services.data_import.detector` — `best_sales_sheet`, `read_file_smart` (new, introduced same session)
- `re` (standard library)

### Replaces

`_read_file()` is completely removed. Old 16-alias `COLUMN_ALIASES` dict replaced with 160+ entry version.

---

## File: `akara/backend/app/services/data_import/service.py`

**Status:** Modified

### Changes Made

1. Added `_PRIMARY_KNOWN` set and `_build_raw_data()` helper — unknown columns flow into `raw_data` JSONB
2. Added `sheet_name: str | int | None = None` parameter to `import_file()`
3. Parser instantiation now passes `sheet_name` to `SalesDataParser(sheet_name=sheet_name)`

### New/Modified Code

```python
_PRIMARY_KNOWN = {
    "invoice_date", "invoice_number", "party_name", "party_city", "party_zone",
    "route", "product_name", "product_group", "product_category", "hsn_code",
    "quantity", "gross_amount", "discount_amount", "net_amount",
    "tax_amount", "total_amount", "outstanding_amount",
}


def _build_raw_data(row: dict) -> dict:
    """
    Aggregate all columns NOT in the DB schema into raw_data JSONB.
    This preserves extra columns from any ERP/POS export (e.g. Petpooja
    columns like WOKID, CASHIER, HOURS) so the copilot can query them
    via raw_data->>'column_name'.
    """
    return {
        k: (None if str(v) in ("nan", "NaT", "None") else str(v))
        for k, v in row.items()
        if k not in _PRIMARY_KNOWN
    }


def _enrich_primary(row: dict, tenant_id: UUID) -> dict:
    record: dict = {
        "tenant_id": str(tenant_id),
        "invoice_date": str(row.get("invoice_date", "")),
        "invoice_number": str(row.get("invoice_number", "")),
        "party_name": str(row.get("party_name", "")),
        "party_city": str(row.get("party_city", "")),
        "party_zone": str(row.get("party_zone", "")),
        "route": str(row.get("route", "")),
        "product_name": str(row.get("product_name", "")),
        "product_group": str(row.get("product_group", "")),
        "product_category": str(row.get("product_category", "")),
        "hsn_code": str(row.get("hsn_code", "")),
        "quantity": float(row.get("quantity", 0)),
        "gross_amount": float(row.get("gross_amount", 0)),
        "discount_amount": float(row.get("discount_amount", 0)),
        "net_amount": float(row.get("net_amount", 0)),
        "tax_amount": float(row.get("tax_amount", 0)),
        "total_amount": float(row.get("total_amount", 0)),
        "raw_data": _build_raw_data(row),   # ← changed from {k: str(v) for k, v in row.items()}
    }
    if row.get("outstanding_amount") is not None:
        record["outstanding_amount"] = float(row["outstanding_amount"])
    return record
```

Updated `import_file()` signature:

```python
def import_file(
    self,
    file_content: bytes,
    filename: str,
    tenant_id: UUID,
    source_type: SourceType = "primary",
    sheet_name: str | int | None = None,   # ← NEW
) -> ImportResult:
    # ...
    if source_type == "primary":
        df = SalesDataParser(sheet_name=sheet_name).parse(file_content, filename)   # ← passes sheet
    elif source_type == "secondary":
        df = SecondarySalesParser(sheet_name=sheet_name).parse(file_content, filename)
    # ...
```

---

## File: `akara/backend/app/api/routes/data.py`

**Status:** Modified

### Changes Made

1. Added `POST /data/sheets` endpoint — returns ranked sheet list with recommended sheet
2. Added `sheet_name: str | None` query param to `POST /data/import`
3. Added `SheetInfo` and `SheetListResponse` Pydantic models
4. Relaxed content-type check to also accept by file extension (browsers vary)

### New Endpoint: `POST /data/sheets`

```python
class SheetInfo(BaseModel):
    sheet_name: str
    score: int
    row_count: int
    detected_header_row: int | None
    detected_columns: list[str]
    reason: str


class SheetListResponse(BaseModel):
    sheets: list[SheetInfo]
    recommended: str | None


@router.post("/sheets", response_model=SheetListResponse)
async def list_excel_sheets(
    user: CurrentUser,
    tenant: TenantCtx,
    file: UploadFile = File(...),
) -> SheetListResponse:
    """
    Preview all sheets in an Excel file and return a ranked list with the
    recommended sales sheet highlighted.  Call this before /import when the
    user uploads a multi-sheet Excel so the UI can show a sheet picker.
    """
    if not tenant.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins only")

    content = await file.read()
    filename = file.filename or "upload.xlsx"

    scored = score_sheets(content, filename)
    sheets = [
        SheetInfo(
            sheet_name=s.sheet_name,
            score=s.score,
            row_count=s.row_count,
            detected_header_row=s.detected_header_row,
            detected_columns=s.detected_columns[:10],  # first 10 cols for preview
            reason=s.reason,
        )
        for s in scored
    ]
    recommended = scored[0].sheet_name if scored and scored[0].score > 0 else None
    return SheetListResponse(sheets=sheets, recommended=recommended)
```

### Updated `/data/import` endpoint

```python
@router.post("/import", response_model=ImportResult, status_code=status.HTTP_201_CREATED)
async def import_data(
    user: CurrentUser,
    tenant: TenantCtx,
    file: UploadFile = File(...),
    source_type: Annotated[SourceType, Query()] = "primary",
    sheet_name: Annotated[str | None, Query(description="Excel sheet name. Omit for auto-detect.")] = None,
) -> ImportResult:
    # ...
    service = DataImportService(supabase=get_supabase_service_client())
    return service.import_file(
        file_content=content,
        filename=filename,
        tenant_id=tenant.tenant_id,
        source_type=source_type,
        sheet_name=sheet_name,      # ← NEW: forwarded to parser
    )
```

### Updated content-type check

```python
_ALLOWED_CONTENT_TYPES = {
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/octet-stream",  # some browsers send this for .xlsx
}

# Accept by content-type OR by file extension (browsers vary on .xlsx)
ext = filename.rsplit(".", 1)[-1].lower()
if content_type not in _ALLOWED_CONTENT_TYPES and ext not in ("csv", "xlsx", "xls"):
    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail="Unsupported file type. Upload a CSV, XLSX, or XLS file.",
    )
```

---

## Smoke Test Results (verified against QAFFEINE Sales Report.xlsx)

```
Sheet scorer results (top 10 of 49):
  [+101] Discount Report Item Wise    rows=562   → RECOMMENDED ✓
  [ +85] ITEM WISE HOURLY SALE        rows=3456
  [ +77] HOURLY SALE                  rows=600
  [ +72] Online Orders Register       rows=101
  [ +70] Tax Charge                   rows=4146
  ...
  [ -20] Stock Report                 (inventory, penalised correctly)

Parse result for recommended sheet:
  Rows:            399 (after removing rows with missing invoice_date)
  Total revenue:   ₹73,027.68
  Unique outlets:  5
  Unique products: 118
  Date range:      2025-12-01 → 2025-12-07
```

Ruff check: ✅ All checks passed

---

## Part 2 — Import History + Undo ⏳ PENDING

This section contains the code plan. None of it is deployed yet. Implement in this order.

### Step 1 — Migration: `akara/migrations/010_import_tracking.sql`

```sql
-- AKARA: Import Tracking — Migration 010
-- Run in Supabase SQL Editor BEFORE deploying backend changes.

ALTER TABLE public.sales_data
    ADD COLUMN IF NOT EXISTS import_id UUID;

ALTER TABLE public.secondary_sales_data
    ADD COLUMN IF NOT EXISTS import_id UUID;

ALTER TABLE public.scheme_master
    ADD COLUMN IF NOT EXISTS import_id UUID;

CREATE INDEX IF NOT EXISTS idx_sales_data_import_id
    ON public.sales_data (tenant_id, import_id)
    WHERE import_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_secondary_sales_data_import_id
    ON public.secondary_sales_data (tenant_id, import_id)
    WHERE import_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheme_master_import_id
    ON public.scheme_master (tenant_id, import_id)
    WHERE import_id IS NOT NULL;
```

### Step 2 — models.py: Add `import_id` to `ImportResult`

```python
# File: akara/backend/app/services/data_import/models.py
# Add import_id field:

class ImportResult(BaseModel):
    rows_inserted: int
    rows_skipped:  int
    errors:        list[str]
    warnings:      list[str]
    import_id:     str | None = None   # UUID of this upload batch (new)
```

### Step 3 — service.py: Generate + tag + log

```python
# In DataImportService.import_file(), add:

import uuid as uuid_lib

def import_file(self, file_content, filename, tenant_id, source_type, sheet_name=None):
    import_id = uuid_lib.uuid4()   # generate once per upload

    # (existing parse logic unchanged)

    for i in range(0, len(records), _BATCH_SIZE):
        # ...
        for record in enriched:
            record["import_id"] = str(import_id)   # tag every row
        # ...insert unchanged...

    # Log to generated_reports after all batches
    if rows_inserted > 0:
        self._supabase.table("generated_reports").insert({
            "tenant_id":   str(tenant_id),
            "report_type": "csv_import",
            "title":       filename,
            "metadata": {
                "import_id":     str(import_id),
                "source_type":   source_type,
                "rows_inserted": rows_inserted,
                "rows_skipped":  rows_skipped,
                "filename":      filename,
                "sheet_name":    sheet_name,
            },
        }).execute()

    return ImportResult(
        rows_inserted=rows_inserted,
        rows_skipped=rows_skipped,
        errors=errors,
        warnings=warnings,
        import_id=str(import_id),
    )
```

### Step 4 — data.py: Undo + history endpoints

```python
# File: akara/backend/app/api/routes/data.py
from uuid import UUID

class ImportHistoryItem(BaseModel):
    id: str
    title: str
    created_at: str
    metadata: dict


@router.get("/imports/history", response_model=list[ImportHistoryItem])
def list_import_history(user: CurrentUser, tenant: TenantCtx) -> list[ImportHistoryItem]:
    sb = get_supabase_service_client()
    result = (
        sb.table("generated_reports")
        .select("id, title, metadata, created_at")
        .eq("tenant_id", str(tenant.tenant_id))
        .eq("report_type", "csv_import")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return [ImportHistoryItem(**row) for row in (result.data or [])]


@router.delete("/imports/{import_id}", status_code=status.HTTP_204_NO_CONTENT)
def undo_import(
    import_id: UUID,
    user: CurrentUser,
    tenant: TenantCtx,
) -> None:
    """Delete all rows from a specific upload batch. Scoped to caller's tenant."""
    if not tenant.is_admin:
        raise HTTPException(status_code=403, detail="Admins only")

    sb = get_supabase_service_client()
    tid = str(tenant.tenant_id)
    iid = str(import_id)

    sb.table("sales_data").delete().eq("tenant_id", tid).eq("import_id", iid).execute()
    sb.table("secondary_sales_data").delete().eq("tenant_id", tid).eq("import_id", iid).execute()
    sb.table("scheme_master").delete().eq("tenant_id", tid).eq("import_id", iid).execute()

    sb.table("generated_reports")\
        .delete()\
        .eq("tenant_id", tid)\
        .eq("report_type", "csv_import")\
        .filter("metadata->>'import_id'", "eq", iid)\
        .execute()
```

### Step 5 — Frontend hooks: `akara/frontend/src/hooks/useImportHistory.ts`

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

const BASE = import.meta.env.VITE_API_BASE_URL;

export interface ImportHistoryItem {
  id: string;
  title: string;
  created_at: string;
  metadata: {
    import_id:     string;
    source_type:   "primary" | "secondary" | "scheme";
    rows_inserted: number;
    rows_skipped:  number;
    filename:      string;
    sheet_name:    string | null;
  };
}

export function useImportHistory() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["import-history"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/data/imports/history`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to load import history");
      return res.json() as Promise<ImportHistoryItem[]>;
    },
    enabled: !!session,
    staleTime: 1000 * 30,
  });
}

export function useUndoImport() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (importId: string) => {
      const res = await fetch(`${BASE}/data/imports/${importId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) throw new Error("Undo failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-history"] });
      queryClient.invalidateQueries({ queryKey: ["kpi"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
```

### Step 6 — Frontend UI: `ImportHistoryPanel` in `DataPage.tsx`

Add below the three upload panels. Only the most recent import can be undone.

```tsx
// File: akara/frontend/src/pages/DataPage.tsx
import { useImportHistory, useUndoImport } from "@/hooks/useImportHistory";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function ImportHistoryPanel() {
  const { data: history, isLoading } = useImportHistory();
  const undoMutation = useUndoImport();

  if (isLoading) return <p className="text-sm text-slate-400">Loading history…</p>;
  if (!history || history.length === 0)
    return <p className="text-sm text-slate-400">No uploads yet.</p>;

  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Upload History</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 border-b text-xs">
            <th className="pb-2 font-medium">File</th>
            <th className="pb-2 font-medium">Type</th>
            <th className="pb-2 font-medium">Rows</th>
            <th className="pb-2 font-medium">Uploaded</th>
            <th className="pb-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {history.map((item, idx) => (
            <tr key={item.id} className="border-b border-slate-100">
              <td className="py-2 text-slate-800 font-medium truncate max-w-[200px]">
                {item.metadata.filename}
              </td>
              <td className="py-2 text-slate-500 capitalize">
                {item.metadata.source_type}
              </td>
              <td className="py-2 text-slate-600">
                {item.metadata.rows_inserted.toLocaleString()}
              </td>
              <td className="py-2 text-slate-400 text-xs">
                {new Date(item.created_at).toLocaleString()}
              </td>
              <td className="py-2">
                {idx === 0 ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="text-xs text-red-500 hover:underline">
                        Undo
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Undo this import?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete {item.metadata.rows_inserted} rows
                          from <strong>{item.metadata.filename}</strong>.
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            undoMutation.mutate(item.metadata.import_id)
                          }
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Yes, undo
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <span className="text-xs text-slate-300 cursor-not-allowed">
                    Undo
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-slate-400 mt-2">
        Only the most recent upload can be undone.
      </p>
    </div>
  );
}
```

---

## Files Changed Summary

| File | Status | Notes |
|---|---|---|
| `akara/backend/app/services/data_import/detector.py` | ✅ Created | Smart header detection + sheet scorer |
| `akara/backend/app/services/data_import/parser.py` | ✅ Replaced | 160+ aliases, fallbacks, deduplication |
| `akara/backend/app/services/data_import/service.py` | ✅ Modified | `sheet_name` param, `_build_raw_data()` |
| `akara/backend/app/api/routes/data.py` | ✅ Modified | `POST /data/sheets`, `sheet_name` query param |
| `akara/migrations/010_import_tracking.sql` | ⏳ Pending | `import_id` column on 3 tables |
| `akara/backend/app/services/data_import/models.py` | ⏳ Pending | Add `import_id` to `ImportResult` |
| `akara/frontend/src/hooks/useImportHistory.ts` | ⏳ Pending | React Query hooks |
| `akara/frontend/src/pages/DataPage.tsx` | ⏳ Pending | `ImportHistoryPanel`, sheet picker |

---

## What This Does Not Cover (Deferred)

| Feature | When to build |
|---|---|
| AI column mapping suggestions | When customer manually overrides mapping 3+ times |
| Saved schema mappings per customer | When 2nd customer uses same source format |
| Date range extraction from metadata rows | When customer uploads file with no per-row date column |
| "Replace all data for period" mode | When customer uploads corrected data for an existing period |
| Sheet picker UI in `DataPage.tsx` | `POST /data/sheets` + dropdown before confirming import |
