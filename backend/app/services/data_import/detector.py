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
