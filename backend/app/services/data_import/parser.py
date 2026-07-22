import io
import logging

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
    "net_sales": "net_amount",
    "gross_sales": "gross_amount",
    "discount": "discount_amount",
    "tax": "tax_amount",
    "total": "total_amount",
    "qty": "quantity",
    "product": "product_name",
    "item": "product_name",
    "city": "party_city",
    "zone": "party_zone",
}

NUMERIC_COLUMNS = {
    "quantity",
    "gross_amount",
    "discount_amount",
    "net_amount",
    "tax_amount",
    "total_amount",
}


class SalesDataParser:
    """Parses Excel (.xlsx/.xls) and CSV files into a DataFrame
    ready for insertion into sales_data.
    """

    def parse(self, file_content: bytes, filename: str) -> pd.DataFrame:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_content))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(file_content))
        else:
            raise ValueError(f"Unsupported file type: {filename}")

        df = self._normalize_columns(df)
        df = self._validate_required(df)
        return self._coerce_types(df)

    def _normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        return df.rename(columns=COLUMN_ALIASES)

    def _validate_required(self, df: pd.DataFrame) -> pd.DataFrame:
        missing = REQUIRED_COLUMNS - set(df.columns)
        if missing:
            raise ValueError(f"Missing required columns: {missing}")
        return df.dropna(subset=["invoice_date", "party_name"])

    def _coerce_types(self, df: pd.DataFrame) -> pd.DataFrame:
        df["invoice_date"] = pd.to_datetime(df["invoice_date"], errors="coerce").dt.date
        df = df.dropna(subset=["invoice_date"])
        for col in NUMERIC_COLUMNS:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
        return df
