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
    "part_desc":                    "product_name",   # Garage / workshop exports
    "part_description":             "product_name",
    "parts_description":            "product_name",
    "item_desc":                    "product_name",

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
    "line_type":                    "product_group",
    "linetype":                     "product_group",

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


def _filter_section_and_blank_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Drop section header rows (e.g. --- INSURANCE JOBS ---) and fully blank rows."""
    if df.empty:
        return df
    mask = []
    for _, row in df.iterrows():
        texts = [str(v).strip() for v in row.values if pd.notna(v) and str(v).strip()]
        if not texts:
            mask.append(False)
            continue
        if any(t.startswith("---") and t.endswith("---") for t in texts):
            mask.append(False)
            continue
        mask.append(True)
    return df.loc[mask].reset_index(drop=True)


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
        if "net_amount" not in df.columns and "total_amount" in df.columns:
            df = df.copy()
            df["net_amount"] = df["total_amount"]

        df = _validate_required(df, REQUIRED_COLUMNS)
        df = _filter_section_and_blank_rows(df)
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
