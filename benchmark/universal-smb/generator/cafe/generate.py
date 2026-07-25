"""Generate BrewLab Café canonical data and messy exports."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from random import Random

import pandas as pd

from generator.core.canonical import CanonicalDB
from generator.core.dates import date_range
from generator.core.messiness import (
    MessinessConfig,
    add_deprecated_columns,
    apply_messiness,
)

SEED = 42
START = date(2026, 1, 1)
END = date(2026, 6, 30)

MENU = [
    ("Cappuccino", "Hot Beverages", 180),
    ("Latte", "Hot Beverages", 200),
    ("Espresso", "Hot Beverages", 150),
    ("Cold Brew", "Cold Beverages", 220),
    ("Iced Latte", "Cold Beverages", 240),
    ("Masala Chai", "Hot Beverages", 80),
    ("Croissant", "Bakery", 120),
    ("Blueberry Muffin", "Bakery", 140),
    ("Avocado Toast", "Food", 280),
    ("Club Sandwich", "Food", 320),
    ("Veg Wrap", "Food", 260),
    ("Chocolate Brownie", "Bakery", 160),
    ("Seasonal Special", "Seasonal", 350),
]

CHANNELS = ["dine-in", "takeaway", "delivery", "swiggy", "zomato"]
CASHIERS = ["Priya S", "Amit K", "Sneha R", "Walk-in"]


def _orders_for_day(d: date, rng: Random) -> int:
    base = 95
    if d.weekday() >= 5:
        base += 35
    if d.month in (1, 3) and d.day in (26, 27, 28):
        base += 50
    if d.month == 6:
        base += 15
    return base + rng.randint(-15, 20)


def generate_canonical(db_path: Path) -> CanonicalDB:
    rng = Random(SEED)
    db = CanonicalDB(db_path)
    db.set_meta("business", "cafe_brewlab")
    db.set_meta("date_start", START.isoformat())
    db.set_meta("date_end", END.isoformat())

    for i, name in enumerate(CASHIERS):
        db.insert_employee(f"emp-{i + 1}", name, role="cashier")

    for i in range(1, 201):
        db.insert_party(
            f"party-{i:04d}",
            f"Customer {i}",
            aliases=[f"Customer {i}", f"Cust {i}", f"Guest {i}"],
            city="Bangalore",
        )

    for i, (name, cat, _price) in enumerate(MENU):
        db.insert_product(f"prod-{i + 1:03d}", name, category=cat, hsn_code="996331")

    line_counter = 0
    inv_counter = 0
    bulk_lines: list[dict] = []
    settlements: list[tuple] = []
    wastage_rows: list[tuple] = []
    shift_rows: list[tuple] = []
    payment_methods = ["cash", "upi", "card", "swiggy", "zomato"]

    for d in date_range(START, END):
        n_orders = _orders_for_day(d, rng)
        daily_by_method: dict[str, float] = dict.fromkeys(payment_methods, 0.0)

        for _ in range(n_orders):
            inv_counter += 1
            inv_id = f"inv-{d.strftime('%Y%m')}-{inv_counter:05d}"
            party_id = f"party-{rng.randint(1, 200):04d}"
            channel = rng.choices(CHANNELS, weights=[0.35, 0.15, 0.1, 0.2, 0.2])[0]
            party_name = channel.title() if channel in ("swiggy", "zomato") else f"Customer {int(party_id.split('-')[1])}"

            status = "ACTIVE"
            inv_num = f"BL-{d.strftime('%y%m%d')}-{inv_counter:04d}"
            if rng.random() < 0.008:
                status = "CANCELLED"
            elif rng.random() < 0.012:
                inv_num = f"{inv_num}-R"
                status = "REFUND"

            n_items = max(1, min(int(rng.gauss(2.3, 0.8)), 6))
            gross = discount = tax = 0.0
            lines_for_inv: list[dict] = []

            for ln in range(n_items):
                line_counter += 1
                prod_idx = rng.randint(0, len(MENU) - 1)
                pname, pcat, price = MENU[prod_idx]
                if d.month in (1, 3) and pcat == "Seasonal":
                    price = int(price * 1.1)
                qty = 2 if rng.random() > 0.85 else 1
                lg = price * qty
                disc = lg * (rng.random() * 0.12 if channel == "dine-in" else rng.random() * 0.05)
                tx = (lg - disc) * 0.05
                net = lg - disc
                tot = net + tx
                gross += lg
                discount += disc
                tax += tx
                cashier = rng.choice(CASHIERS)
                lines_for_inv.append(
                    {
                        "id": f"line-{line_counter:06d}",
                        "invoice_id": inv_id,
                        "line_no": ln + 1,
                        "product_id": f"prod-{prod_idx + 1:03d}",
                        "product_name": pname,
                        "product_category": pcat,
                        "quantity": qty,
                        "unit_price": price,
                        "gross_amount": round(lg, 2),
                        "discount_amount": round(disc, 2),
                        "tax_amount": round(tx, 2),
                        "net_amount": round(net, 2),
                        "total_amount": round(tot, 2),
                        "metadata": {"cashier": cashier, "channel": channel, "order_type": channel},
                    }
                )

            tip = round(rng.random() * 30, 2) if channel == "dine-in" and rng.random() < 0.3 else 0
            total = round(gross - discount + tax + tip, 2)
            if status == "CANCELLED" or rng.random() < 0.003:
                total = 0

            db.insert_invoice(
                {
                    "id": inv_id,
                    "invoice_number": inv_num,
                    "invoice_date": d.isoformat(),
                    "party_id": party_id if channel not in ("swiggy", "zomato") else None,
                    "channel": channel,
                    "status": status,
                    "gross_amount": round(gross, 2),
                    "discount_amount": round(discount, 2),
                    "tax_amount": round(tax, 2),
                    "net_amount": round(gross - discount, 2),
                    "total_amount": total,
                    "tip_amount": tip,
                    "metadata": {"party_name": party_name, "cashier": lines_for_inv[0]["metadata"]["cashier"]},
                }
            )
            bulk_lines.extend(lines_for_inv)

            if status == "ACTIVE" and total > 0:
                method = channel if channel in ("swiggy", "zomato") else rng.choice(["cash", "upi", "card"])
                daily_by_method[method] += total
                if rng.random() < 0.08:
                    split = total * rng.uniform(0.3, 0.7)
                    db.conn.execute(
                        "INSERT INTO payments (id, invoice_id, payment_date, method, amount, metadata) "
                        "VALUES (?, ?, ?, ?, ?, ?)",
                        (f"pay-{inv_counter}a", inv_id, d.isoformat(), method, round(split, 2), None),
                    )
                    other = "cash" if method != "cash" else "upi"
                    db.conn.execute(
                        "INSERT INTO payments (id, invoice_id, payment_date, method, amount, metadata) "
                        "VALUES (?, ?, ?, ?, ?, ?)",
                        (f"pay-{inv_counter}b", inv_id, d.isoformat(), other, round(total - split, 2), None),
                    )
                else:
                    db.conn.execute(
                        "INSERT INTO payments (id, invoice_id, payment_date, method, amount, metadata) "
                        "VALUES (?, ?, ?, ?, ?, ?)",
                        (f"pay-{inv_counter}", inv_id, d.isoformat(), method, total, None),
                    )

        db.conn.commit()

        collected = sum(daily_by_method.values())
        for method, amt in daily_by_method.items():
            if amt > 0:
                factor = 0.998 if rng.random() < 0.05 else 1.0
                settlements.append(
                    (
                        f"set-{d.isoformat()}-{method}",
                        d.isoformat(),
                        method,
                        round(amt, 2),
                        round(amt * factor, 2),
                        round(amt * (1 - factor), 2),
                        None,
                    )
                )

        if rng.random() < 0.5:
            wastage_rows.append(
                (
                    f"wast-{d.isoformat()}",
                    d.isoformat(),
                    f"prod-{rng.randint(1, len(MENU)):03d}",
                    round(rng.uniform(0.5, 3), 2),
                    80,
                    round(rng.uniform(40, 240), 2),
                    rng.choice(["expired milk", "burnt", "drop", "sample"]),
                    None,
                )
            )

        emp = CASHIERS[rng.randint(0, len(CASHIERS) - 1)]
        shift_rows.append(
            (
                f"shift-{d.isoformat()}",
                f"emp-{CASHIERS.index(emp) + 1}",
                d.isoformat(),
                "08:00",
                "16:00",
                8.0,
                json.dumps({"cashier": emp}),
            )
        )

    db.bulk_insert_sales_lines(bulk_lines)
    db.executemany(
        "INSERT INTO settlements (id, settlement_date, method, expected_amount, collected_amount, variance, metadata) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        settlements,
    )
    db.executemany(
        "INSERT INTO wastage (id, wastage_date, product_id, quantity, unit_cost, total_cost, reason, metadata) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        wastage_rows,
    )
    db.executemany(
        "INSERT INTO shifts (id, employee_id, shift_date, start_time, end_time, hours, metadata) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        shift_rows,
    )
    db.set_meta("invoice_count", str(inv_counter))
    db.set_meta("line_count", str(line_counter))
    return db


def _fetch_sales_export(db: CanonicalDB) -> pd.DataFrame:
    rows = db.query_all(
        """
        SELECT sl.id AS line_id, i.invoice_number, i.invoice_date, i.channel, i.status,
               COALESCE(json_extract(i.metadata, '$.party_name'), p.canonical_name) AS party_name,
               sl.product_name, sl.product_category, sl.quantity,
               sl.gross_amount, sl.discount_amount, sl.tax_amount, sl.net_amount, sl.total_amount,
               json_extract(sl.metadata, '$.cashier') AS cashier,
               json_extract(sl.metadata, '$.order_type') AS order_type,
               i.tip_amount, i.id AS invoice_id
        FROM sales_lines sl
        JOIN invoices i ON sl.invoice_id = i.id
        LEFT JOIN parties p ON i.party_id = p.id
        ORDER BY i.invoice_date, i.invoice_number, sl.line_no
        """
    )
    return pd.DataFrame([dict(r) for r in rows])


def _prepare_primary_sheet(df: pd.DataFrame, rng: Random) -> pd.DataFrame:
    """Primary Akara import sheet — messy data, stable Petpooja-style headers."""
    cols = [
        "invoice_date",
        "invoice_number",
        "party_name",
        "product_name",
        "product_category",
        "quantity",
        "gross_amount",
        "discount_amount",
        "net_amount",
        "total_amount",
        "cashier",
        "order_type",
    ]
    out = df[[c for c in cols if c in df.columns]].copy()
    # Stable headers mapped by Akara parser aliases (not random synonyms on import sheet)
    out = out.rename(
        columns={
            "invoice_date": "Date",
            "invoice_number": "WEB_BILLNO",
            "party_name": "Buyer",
            "product_name": "POS Display Name",
            "product_category": "Category",
            "quantity": "Qty",
            "gross_amount": "Gross Amt",
            "discount_amount": "Discount",
            "net_amount": "NET SALES",
            "total_amount": "Bill Amt",
            "cashier": "Cashier",
            "order_type": "Order Type",
        }
    )
    cfg = MessinessConfig(
        shuffle_within_month=False,
        duplicate_row_prob=0.002,
        blank_row_prob=0.0,
        subtotal_row_prob=0.0,
        date_format_mix=False,
        currency_format_mix=False,
        tags=["metadata_rows"],
    )
    out = apply_messiness(
        out,
        rng,
        cfg,
        date_col="Date",
        amount_cols=["Bill Amt", "NET SALES", "Discount"],
        duplicate_key="WEB_BILLNO",
    )
    for col in ("Date",):
        out[col] = pd.to_datetime(out[col], errors="coerce").dt.strftime("%Y-%m-%d")
    out = add_deprecated_columns(out, rng)
    return out


def _write_primary_sheet(writer: pd.ExcelWriter, df: pd.DataFrame, sheet_name: str) -> None:
    """Write Petpooja-style sheet with metadata rows above headers."""
    df.to_excel(writer, sheet_name=sheet_name, index=False, startrow=3)
    ws = writer.sheets[sheet_name]
    ws["A1"] = "Daily Sales Report - BrewLab Café"
    ws["A2"] = "Period: Jan 2026 - Jun 2026"
    ws["A3"] = "Exported from Petpooja / BrainPower"


def export_datasets(db: CanonicalDB, out_dir: Path) -> dict[str, int]:
    rng = Random(SEED + 1)
    out_dir.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    sales_df = _fetch_sales_export(db)

    primary = _prepare_primary_sheet(sales_df, rng)
    xlsx_path = out_dir / "BrewLab_Sales_Report_Jan-Jun2026.xlsx"
    sheet_names = [
        "DSR",
        "Discount Report Item Wise",
        "Bill Register",
        "Menu Mix Summary",
        "HOURLY SALE",
        "Online Orders Register",
        "Tax Charge",
        "Cashier Wise Menu Mix",
        "Counter Wise Summary",
        "SETTLEMENT SUMMARY",
        "Stock Report",
        "GRN Register",
        "WASTAGE REPORT",
        "STOCK VARIANCE REPORT",
        "Indent Register",
        "Aggregator Details",
        "Credit Card Settlement",
        "Bill Wise Item Wise NC Sales",
        "MenuMix from 0 to 704",
        "ITEM WISE HOURLY SALE",
        "Discount Analysis Report",
        "Void Bills",
        "Complimentary Bills",
        "Tips Report",
        "Loyalty Redemptions",
        "Membership Sales",
        "Kitchen Prep Log",
        "Export Metadata",
    ]
    with pd.ExcelWriter(xlsx_path, engine="openpyxl") as writer:
        for i, name in enumerate(sheet_names):
            if name == "Discount Report Item Wise":
                _write_primary_sheet(writer, primary, name)
                counts[name] = len(primary)
            elif name == "DSR":
                summary = (
                    sales_df.groupby("invoice_date")["total_amount"]
                    .sum()
                    .reset_index()
                    .rename(columns={"invoice_date": "Date", "total_amount": "Daily Total"})
                )
                summary.to_excel(writer, sheet_name=name, index=False)
            elif name == "Online Orders Register":
                online = sales_df[sales_df["channel"].isin(["swiggy", "zomato"])].head(2000)
                online.to_excel(writer, sheet_name=name, index=False)
            elif name in ("Stock Report", "GRN Register", "WASTAGE REPORT", "STOCK VARIANCE REPORT"):
                pd.DataFrame({"Item": ["Milk", "Coffee Beans"], "Qty": [10, 5]}).to_excel(
                    writer, sheet_name=name, index=False
                )
            elif i < 20:
                sample = sales_df.sample(min(400, len(sales_df)), random_state=i)
                sample.to_excel(writer, sheet_name=name[:31], index=False)
            else:
                pd.DataFrame({"note": ["placeholder"]}).to_excel(writer, sheet_name=name[:31], index=False)

    counts["BrewLab_Sales_Report_Jan-Jun2026.xlsx"] = len(primary)

    online = sales_df[sales_df["channel"].isin(["swiggy", "zomato"])].copy()
    online_export = online[
        ["invoice_date", "invoice_number", "party_name", "product_name", "total_amount"]
    ].rename(
        columns={
            "invoice_date": "Order Date",
            "invoice_number": "Client Order No",
            "party_name": "Outlet",
            "total_amount": "NET SALES",
            "product_name": "POS Display Name",
        }
    )
    online_export["Order Date"] = pd.to_datetime(
        online_export["Order Date"], errors="coerce"
    ).dt.strftime("%Y-%m-%d")
    online_path = out_dir / "online_orders_jan_jun.csv"
    online_export.to_csv(online_path, index=False)
    counts["online_orders_jan_jun.csv"] = len(online_export)

    loyalty = pd.DataFrame(
        {
            "Member ID": [f"M{i:04d}" for i in range(1, 451)],
            "Customer Name": [f"Customer {rng.randint(1, 200)}" for _ in range(450)],
            "Points": [rng.randint(0, 5000) for _ in range(450)],
        }
    )
    loyalty.to_csv(out_dir / "loyalty_members.csv", index=False)
    counts["loyalty_members.csv"] = len(loyalty)

    settlements = pd.DataFrame(
        db.query_all(
            "SELECT settlement_date AS Date, method AS Payment_Mode, expected_amount AS Expected, "
            "collected_amount AS Collections, variance AS Variance FROM settlements"
        )
    )
    settlements.to_csv(out_dir / "settlement_summary.csv", index=False)
    counts["settlement_summary.csv"] = len(settlements)

    wastage = pd.DataFrame(
        db.query_all(
            "SELECT wastage_date AS Date, product_id AS Item, quantity AS Wastage_Qty, "
            "total_cost AS Cost FROM wastage"
        )
    )
    wastage.to_csv(out_dir / "wastage_report.csv", index=False)
    counts["wastage_report.csv"] = len(wastage)

    stock = pd.DataFrame({"SKU": ["MILK-1L", "BEAN-AR"], "Opening": [100, 50], "GRN Qty": [20, 10]})
    stock.to_csv(out_dir / "stock_grn_register.csv", index=False)
    counts["stock_grn_register.csv"] = len(stock)

    shifts = pd.DataFrame(
        db.query_all(
            """
            SELECT s.shift_date AS Date, e.name AS Cashier, s.hours AS Hours
            FROM shifts s JOIN employees e ON s.employee_id = e.id
            """
        )
    )
    shifts.to_csv(out_dir / "shift_roster.csv", index=False)
    counts["shift_roster.csv"] = len(shifts)

    return counts


def run(db_path: Path, dataset_dir: Path) -> dict[str, int]:
    if db_path.exists():
        db_path.unlink()
    db = generate_canonical(db_path)
    try:
        counts = export_datasets(db, dataset_dir)
    finally:
        db.close()
    return counts
