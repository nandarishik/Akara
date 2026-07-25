"""Configurable data imperfection injectors for messy SMB exports."""

from __future__ import annotations

import copy
import re
from dataclasses import dataclass, field
from random import Random
from typing import Any

import pandas as pd

from generator.core.dates import format_date_variant


@dataclass
class MessinessConfig:
    """Severity knobs for export messiness."""

    header_space_prob: float = 0.15
    duplicate_row_prob: float = 0.004
    partial_duplicate_prob: float = 0.006
    blank_row_prob: float = 0.002
    subtotal_row_prob: float = 0.001
    shuffle_within_month: bool = True
    date_format_mix: bool = True
    currency_format_mix: bool = True
    null_variants: tuple[str, ...] = ("", "NA", "-", "null", "  ")
    tags: list[str] = field(default_factory=list)


# Column synonym pools for semantic stress testing
PARTY_SYNONYMS = [
    "Customer Name",
    "Customer",
    "Cust",
    "Buyer",
    "Party Name",
    "Client",
    "Consumer",
    "Particulars",
]

INVOICE_SYNONYMS = [
    "Invoice Number",
    "Invoice No",
    "Invoice#",
    "Bill No",
    "Receipt",
    "Voucher No",
    "Txn ID",
    "Document Number",
    "WEB_BILLNO",
]

AMOUNT_SYNONYMS = [
    "Total Amount",
    "Total",
    "Net Sales",
    "Sales",
    "Revenue",
    "Bill Amt",
    "Collections",
    "Daily Total",
    "Business Income",
]

DATE_SYNONYMS = [
    "Date",
    "Invoice Date",
    "Bill Date",
    "Txn Date",
    "Voucher Date",
    "Sale Date",
]


def pick_synonym(rng: Random, pool: list[str], default: str) -> str:
    name = rng.choice(pool)
    if rng.random() < 0.2:
        name = f" {name} "
    elif rng.random() < 0.1:
        name = name.upper()
    return name


def rename_columns_messy(
    df: pd.DataFrame,
    rng: Random,
    mapping: dict[str, str],
) -> pd.DataFrame:
    """Rename canonical columns to messy synonym headers."""
    out = df.copy()
    rename: dict[str, str] = {}
    for canonical, _target in mapping.items():
        if canonical not in out.columns:
            continue
        if canonical == "party_name":
            rename[canonical] = pick_synonym(rng, PARTY_SYNONYMS, "Customer")
        elif canonical == "invoice_number":
            rename[canonical] = pick_synonym(rng, INVOICE_SYNONYMS, "Bill No")
        elif canonical == "invoice_date":
            rename[canonical] = pick_synonym(rng, DATE_SYNONYMS, "Date")
        elif canonical == "total_amount":
            rename[canonical] = pick_synonym(rng, AMOUNT_SYNONYMS, "Total")
        else:
            rename[canonical] = canonical.replace("_", " ").title()
    return out.rename(columns=rename)


def format_currency_messy(rng: Random, value: float | int | str | None) -> str | float | None:
    if value is None or value == "" or (isinstance(value, float) and pd.isna(value)):
        return rng.choice(["", "NA", "-"])
    if isinstance(value, str):
        stripped = value.strip()
        if stripped in ("", "NA", "-", "null"):
            return rng.choice(["", "NA", "-"])
        try:
            v = float(stripped.replace(",", "").replace("₹", "").replace("Rs", "").strip())
        except ValueError:
            return value
    else:
        v = float(value)
    if v < 0:
        style = rng.randint(0, 1)
        v = abs(v)
        if style == 0:
            return f"({v:,.2f})"
        return f"-₹{v:,.2f}"
    style = rng.randint(0, 4)
    if style == 0:
        return f"₹{v:,.2f}"
    if style == 1:
        return f"Rs {v:.2f}"
    if style == 2:
        return f"{v:.2f}"
    if style == 3:
        return round(v, 2)
    return f"INR {v:,.0f}"


def format_date_column_messy(
    rng: Random,
    series: pd.Series,
    enabled: bool = True,
) -> pd.Series:
    if not enabled:
        return series
    out = []
    for val in series:
        if pd.isna(val) or val == "":
            out.append(rng.choice(["", "NA", "-"]))
            continue
        if isinstance(val, str) and re.match(r"^\d{4}-\d{2}-\d{2}$", val):
            from datetime import datetime

            d = datetime.strptime(val, "%Y-%m-%d").date()
            out.append(format_date_variant(rng, d))
        else:
            out.append(val)
    return pd.Series(out, index=series.index)


def inject_blank_rows(df: pd.DataFrame, rng: Random, prob: float) -> pd.DataFrame:
    if prob <= 0 or len(df) == 0:
        return df
    rows: list[dict[str, Any]] = df.to_dict("records")
    out: list[dict[str, Any]] = []
    for row in rows:
        out.append(row)
        if rng.random() < prob:
            out.append({k: "" for k in df.columns})
    return pd.DataFrame(out, columns=df.columns)


def inject_duplicate_rows(df: pd.DataFrame, rng: Random, prob: float) -> pd.DataFrame:
    if prob <= 0 or len(df) == 0:
        return df
    rows = df.to_dict("records")
    out = list(rows)
    for row in rows:
        if rng.random() < prob:
            out.append(copy.deepcopy(row))
    return pd.DataFrame(out, columns=df.columns)


def inject_partial_duplicates(
    df: pd.DataFrame,
    rng: Random,
    prob: float,
    key_col: str,
    amount_col: str,
) -> pd.DataFrame:
    if prob <= 0 or key_col not in df.columns or amount_col not in df.columns:
        return df
    rows = df.to_dict("records")
    out = list(rows)
    for row in rows:
        if rng.random() < prob:
            dup = copy.deepcopy(row)
            try:
                dup[amount_col] = float(dup[amount_col]) * 1.01
            except (TypeError, ValueError):
                pass
            out.append(dup)
    return pd.DataFrame(out, columns=df.columns)


def inject_subtotal_rows(
    df: pd.DataFrame,
    rng: Random,
    prob: float,
    label_col: str | None = None,
) -> pd.DataFrame:
    if prob <= 0 or len(df) < 10:
        return df
    col = label_col or df.columns[0]
    rows = df.to_dict("records")
    out: list[dict[str, Any]] = []
    for i, row in enumerate(rows):
        out.append(row)
        if i > 0 and i % 500 == 0 and rng.random() < 0.3:
            sub = {k: "" for k in df.columns}
            sub[col] = rng.choice(["TOTAL", "Sub Total", "Grand Total", "---"])
            out.append(sub)
    return pd.DataFrame(out, columns=df.columns)


def inject_section_headers(
    df: pd.DataFrame,
    rng: Random,
    sections: list[str],
    interval: int,
    col: str | None = None,
) -> pd.DataFrame:
    label_col = col or df.columns[0]
    rows = df.to_dict("records")
    out: list[dict[str, Any]] = []
    section_idx = 0
    for i, row in enumerate(rows):
        if i > 0 and i % interval == 0 and section_idx < len(sections):
            header = {k: "" for k in df.columns}
            header[label_col] = sections[section_idx]
            out.append(header)
            section_idx += 1
        out.append(row)
    return pd.DataFrame(out, columns=df.columns)


def shuffle_within_month_blocks(
    df: pd.DataFrame,
    date_col: str,
    rng: Random,
) -> pd.DataFrame:
    if date_col not in df.columns:
        return df
    df = df.copy()
    df["_month"] = pd.to_datetime(df[date_col], errors="coerce").dt.to_period("M")
    parts: list[pd.DataFrame] = []
    for _, grp in df.groupby("_month", dropna=False):
        idx = list(grp.index)
        rng.shuffle(idx)
        parts.append(grp.loc[idx])
    result = pd.concat(parts).drop(columns=["_month"])
    return result.reset_index(drop=True)


def add_metadata_rows(
    df: pd.DataFrame,
    metadata: list[list[str]],
) -> pd.DataFrame:
    """Prepend title/metadata rows (Petpooja/Tally style)."""
    meta_df = pd.DataFrame(metadata, columns=df.columns[: len(metadata[0])])
    if meta_df.shape[1] < df.shape[1]:
        for c in df.columns[meta_df.shape[1] :]:
            meta_df[c] = ""
    return pd.concat([meta_df, df], ignore_index=True)


def apply_messiness(
    df: pd.DataFrame,
    rng: Random,
    config: MessinessConfig,
    *,
    date_col: str | None = None,
    amount_cols: list[str] | None = None,
    duplicate_key: str | None = None,
) -> pd.DataFrame:
    """Apply full messiness pipeline to a DataFrame."""
    out = df.copy()
    if config.shuffle_within_month and date_col and date_col in out.columns:
        out = shuffle_within_month_blocks(out, date_col, rng)
    out = inject_blank_rows(out, rng, config.blank_row_prob)
    out = inject_duplicate_rows(out, rng, config.duplicate_row_prob)
    if duplicate_key and "total_amount" in out.columns:
        out = inject_partial_duplicates(
            out, rng, config.partial_duplicate_prob, duplicate_key, "total_amount"
        )
    out = inject_subtotal_rows(out, rng, config.subtotal_row_prob)
    if date_col and date_col in out.columns and config.date_format_mix:
        out[date_col] = format_date_column_messy(rng, out[date_col])
    if config.currency_format_mix and amount_cols:
        for col in amount_cols:
            if col in out.columns:
                out[col] = out[col].apply(lambda v: format_currency_messy(rng, v))
    return out


def add_deprecated_columns(df: pd.DataFrame, rng: Random) -> pd.DataFrame:
    out = df.copy()
    if rng.random() < 0.7:
        out["OLD_SKU"] = ""
    if rng.random() < 0.5:
        out["legacy_flag"] = rng.choice(["Y", "N", ""])
    if rng.random() < 0.4:
        out["export_helper"] = rng.randint(1, 9999)
    return out
