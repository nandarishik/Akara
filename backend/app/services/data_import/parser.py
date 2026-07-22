import io
import logging
import re

import pandas as pd

logger = logging.getLogger(__name__)

REQUIRED_COLUMNS = {
    "invoice_date",
    "party_name",
    "total_amount",
}

COLUMN_ALIASES: dict[str, str] = {
    "date": "invoice_date",
    "invoice_date": "invoice_date",
    "inv_date": "invoice_date",
    "customer": "party_name",
    "party": "party_name",
    "party_name": "party_name",
    "brand_name": "party_name",
    "brand": "party_name",
    "restaurant_name": "party_name",
    "location_name": "party_name",
    "location": "party_name",
    "customer_name": "party_name",
    "store": "party_name",
    "net_sales": "net_amount",
    "gross_sales": "gross_amount",
    "discount": "discount_amount",
    "tax": "tax_amount",
    "total": "total_amount",
    "bill_amt": "total_amount",
    "amount": "total_amount",
    "net_amt": "total_amount",
    "total_settlment": "total_amount",
    "total_settlement": "total_amount",
    "basic_amt": "gross_amount",
    "qty": "quantity",
    "pax": "quantity",
    "product": "product_name",
    "item": "product_name",
    "city": "party_city",
    "zone": "party_zone",
    "state": "party_zone",
    "region": "party_zone",
    "bill_no": "invoice_number",
    "web_billno": "invoice_number",
    "order_no": "invoice_number",
    "brainpower_order_no": "invoice_number",
    "channel_type": "route",
    "aggregator_name": "route",
    "order_from": "route",
}

PARTY_NAME_FALLBACKS = (
    "restaurant_name",
    "brand_name",
    "location_name",
    "location",
    "customer_name",
)

TOTAL_AMOUNT_FALLBACKS = (
    "bill_amt",
    "amount",
    "net_amt",
    "net_amount",
    "total_settlment",
    "total_settlement",
)

COALESCE_ORDER: dict[str, tuple[str, ...]] = {
    "party_name": (
        "location_name",
        "location",
        "restaurant_name",
        "brand_name",
        "customer_name",
        "store",
        "customer",
        "party",
    ),
    "total_amount": (
        "bill_amt",
        "amount",
        "total",
        "total_settlment",
        "total_settlement",
        "net_amt",
        "net_amount",
    ),
    "invoice_number": (
        "bill_no",
        "web_billno",
        "brainpower_order_no",
        "order_no",
    ),
}

NUMERIC_COLUMNS = {
    "quantity",
    "gross_amount",
    "discount_amount",
    "net_amount",
    "tax_amount",
    "total_amount",
}

_MAX_HEADER_SCAN_ROWS = 15


class SalesDataParser:
    """Parses Excel (.xlsx/.xls) and CSV files into a DataFrame
    ready for insertion into sales_data.
    """

    def parse(self, file_content: bytes, filename: str) -> pd.DataFrame:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_content))
        elif filename.endswith((".xlsx", ".xls")):
            df = self._parse_excel(file_content)
        else:
            raise ValueError(f"Unsupported file type: {filename}")

        df = self._normalize_columns(df)
        df = self._fill_required_from_fallbacks(df)
        df = self._validate_required(df)
        return self._coerce_types(df)

    def _parse_excel(self, file_content: bytes) -> pd.DataFrame:
        """Scan all sheets and header rows — POS exports often use sheet 2+ with metadata rows."""
        xl = pd.ExcelFile(io.BytesIO(file_content))
        best: pd.DataFrame | None = None
        best_score = -1

        for sheet in xl.sheet_names:
            raw = pd.read_excel(xl, sheet_name=sheet, header=None)
            if raw.empty:
                continue
            for header_row in range(min(_MAX_HEADER_SCAN_ROWS, len(raw))):
                candidate = self._frame_from_header_row(raw, header_row)
                candidate = self._normalize_columns(candidate)
                candidate = self._fill_required_from_fallbacks(candidate)
                missing = REQUIRED_COLUMNS - set(candidate.columns)
                if missing:
                    continue
                score = self._score_candidate(candidate)
                if score > best_score:
                    best_score = score
                    best = candidate
                    logger.info(
                        "Excel parse candidate: sheet=%r header_row=%d rows=%d",
                        sheet,
                        header_row,
                        len(candidate),
                    )

        if best is not None:
            return best

        raise ValueError(
            "Missing required columns: "
            f"{REQUIRED_COLUMNS}. "
            "Expected columns like Date, Brand/Location/Customer, and Bill Amount. "
            "Try the Bill Register or Aggregator Details sheet exported as CSV."
        )

    def _frame_from_header_row(
        self, raw: pd.DataFrame, header_row: int
    ) -> pd.DataFrame:
        headers = raw.iloc[header_row].tolist()
        df = raw.iloc[header_row + 1 :].copy()
        df.columns = headers
        df = df.dropna(how="all")
        return df.reset_index(drop=True)

    def _score_candidate(self, df: pd.DataFrame) -> int:
        """Prefer sheets with more rows and valid dates."""
        if df.empty:
            return 0
        dates = pd.to_datetime(df.get("invoice_date"), errors="coerce")
        valid_dates = int(dates.notna().sum())
        return valid_dates * 1000 + len(df)

    def _normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df.columns = [_normalize_col_name(c) for c in df.columns]
        # Drop empty / unnamed columns from Excel exports
        keep = [c for c in df.columns if c and not c.startswith("unnamed")]
        df = df[keep]

        # Map aliases; coalesce when several source columns target the same field.
        coalesce_targets: dict[str, list[str]] = {}
        passthrough: dict[str, str] = {}
        for src, target in COLUMN_ALIASES.items():
            if src not in df.columns:
                continue
            if src == target:
                passthrough[src] = target
            else:
                coalesce_targets.setdefault(target, []).append(src)

        for src, target in passthrough.items():
            if target not in df.columns:
                df[target] = df[src]

        for target, sources in coalesce_targets.items():
            ordered = list(COALESCE_ORDER.get(target, ())) + [
                s for s in sources if s not in COALESCE_ORDER.get(target, ())
            ]
            series = None
            for src in ordered:
                col = _column_series(df, src)
                if col is None:
                    continue
                series = col if series is None else series.fillna(col)
            if series is not None:
                df[target] = series
            df = df.drop(columns=[s for s in sources if s in df.columns], errors="ignore")

        return df

    def _fill_required_from_fallbacks(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        if "party_name" not in df.columns:
            for src in PARTY_NAME_FALLBACKS:
                if src in df.columns:
                    df["party_name"] = df[src]
                    break
        if "total_amount" not in df.columns:
            for src in TOTAL_AMOUNT_FALLBACKS:
                if src in df.columns:
                    df["total_amount"] = df[src]
                    break
        if "invoice_date" not in df.columns and "date" in df.columns:
            df["invoice_date"] = df["date"]
        return df

    def _validate_required(self, df: pd.DataFrame) -> pd.DataFrame:
        missing = REQUIRED_COLUMNS - set(df.columns)
        if missing:
            raise ValueError(f"Missing required columns: {missing}")
        return df.dropna(subset=["invoice_date", "party_name"])

    def _coerce_types(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["invoice_date"] = pd.to_datetime(df["invoice_date"], errors="coerce").dt.date
        df = df.dropna(subset=["invoice_date"])
        for col in NUMERIC_COLUMNS:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
        if "total_amount" in df.columns:
            df = df[df["total_amount"] > 0]
        return df


def _normalize_col_name(col: object) -> str:
    name = str(col).strip().lower()
    name = re.sub(r"[^\w\s]", "", name)
    name = re.sub(r"\s+", "_", name)
    return name.strip("_")


def _column_series(df: pd.DataFrame, name: str) -> pd.Series | None:
    if name not in df.columns:
        return None
    data = df[name]
    if isinstance(data, pd.DataFrame):
        series = data.iloc[:, 0]
        for idx in range(1, data.shape[1]):
            series = series.fillna(data.iloc[:, idx])
        return series
    return data
