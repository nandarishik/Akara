"""Canonical SQLite database builder."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from generator.core.schema import SCHEMA_SQL


class CanonicalDB:
    """Thin wrapper around canonical SQLite for ground truth."""

    def __init__(self, path: Path) -> None:
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA_SQL)
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()

    def set_meta(self, key: str, value: str) -> None:
        self.conn.execute(
            "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
            (key, value),
        )
        self.conn.commit()

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> sqlite3.Cursor:
        return self.conn.execute(sql, params)

    def executemany(self, sql: str, rows: list[tuple[Any, ...]]) -> None:
        self.conn.executemany(sql, rows)
        self.conn.commit()

    def insert_party(
        self,
        id: str,
        canonical_name: str,
        aliases: list[str] | None = None,
        **kwargs: Any,
    ) -> None:
        meta = {k: v for k, v in kwargs.items() if k not in ("party_type", "city", "phone")}
        self.conn.execute(
            "INSERT INTO parties (id, canonical_name, party_type, city, phone, metadata) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                id,
                canonical_name,
                kwargs.get("party_type", "customer"),
                kwargs.get("city"),
                kwargs.get("phone"),
                json.dumps(meta) if meta else None,
            ),
        )
        for alias in aliases or [canonical_name]:
            self.conn.execute(
                "INSERT OR IGNORE INTO party_aliases (party_id, alias) VALUES (?, ?)",
                (id, alias),
            )
        self.conn.commit()

    def insert_product(self, id: str, name: str, **kwargs: Any) -> None:
        meta = {k: v for k, v in kwargs.items() if k not in ("category", "unit", "hsn_code")}
        self.conn.execute(
            "INSERT INTO products (id, name, category, unit, hsn_code, metadata) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                id,
                name,
                kwargs.get("category"),
                kwargs.get("unit", "pcs"),
                kwargs.get("hsn_code"),
                json.dumps(meta) if meta else None,
            ),
        )
        self.conn.commit()

    def insert_employee(self, id: str, name: str, **kwargs: Any) -> None:
        self.conn.execute(
            "INSERT INTO employees (id, name, role, metadata) VALUES (?, ?, ?, ?)",
            (id, name, kwargs.get("role"), json.dumps(kwargs.get("metadata")) if kwargs.get("metadata") else None),
        )
        self.conn.commit()

    def insert_invoice(self, inv: dict[str, Any]) -> None:
        self.conn.execute(
            """
            INSERT INTO invoices (
                id, invoice_number, invoice_date, party_id, channel, status,
                gross_amount, discount_amount, tax_amount, net_amount, total_amount,
                tip_amount, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                inv["id"],
                inv["invoice_number"],
                inv["invoice_date"],
                inv.get("party_id"),
                inv.get("channel"),
                inv.get("status", "ACTIVE"),
                inv.get("gross_amount", 0),
                inv.get("discount_amount", 0),
                inv.get("tax_amount", 0),
                inv.get("net_amount", 0),
                inv.get("total_amount", 0),
                inv.get("tip_amount", 0),
                json.dumps(inv.get("metadata")) if inv.get("metadata") else None,
            ),
        )
        self.conn.commit()

    def insert_sales_line(self, line: dict[str, Any]) -> None:
        self.conn.execute(
            """
            INSERT INTO sales_lines (
                id, invoice_id, line_no, product_id, product_name, product_category,
                quantity, unit_price, gross_amount, discount_amount, tax_amount,
                net_amount, total_amount, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                line["id"],
                line["invoice_id"],
                line["line_no"],
                line.get("product_id"),
                line["product_name"],
                line.get("product_category"),
                line.get("quantity", 1),
                line.get("unit_price", 0),
                line.get("gross_amount", 0),
                line.get("discount_amount", 0),
                line.get("tax_amount", 0),
                line.get("net_amount", 0),
                line.get("total_amount", 0),
                json.dumps(line.get("metadata")) if line.get("metadata") else None,
            ),
        )
        self.conn.commit()

    def bulk_insert_sales_lines(self, lines: list[dict[str, Any]]) -> None:
        rows = [
            (
                ln["id"],
                ln["invoice_id"],
                ln["line_no"],
                ln.get("product_id"),
                ln["product_name"],
                ln.get("product_category"),
                ln.get("quantity", 1),
                ln.get("unit_price", 0),
                ln.get("gross_amount", 0),
                ln.get("discount_amount", 0),
                ln.get("tax_amount", 0),
                ln.get("net_amount", 0),
                ln.get("total_amount", 0),
                json.dumps(ln.get("metadata")) if ln.get("metadata") else None,
            )
            for ln in lines
        ]
        self.executemany(
            """
            INSERT INTO sales_lines (
                id, invoice_id, line_no, product_id, product_name, product_category,
                quantity, unit_price, gross_amount, discount_amount, tax_amount,
                net_amount, total_amount, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )

    def query_one(self, sql: str, params: tuple[Any, ...] = ()) -> Any:
        row = self.conn.execute(sql, params).fetchone()
        return row[0] if row else None

    def query_all(self, sql: str, params: tuple[Any, ...] = ()) -> list[sqlite3.Row]:
        return self.conn.execute(sql, params).fetchall()
