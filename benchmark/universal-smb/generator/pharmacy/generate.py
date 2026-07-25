"""Generate MedPlus Pharmacy canonical data and messy exports."""

from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path
from random import Random

import pandas as pd

from generator.core.canonical import CanonicalDB
from generator.core.dates import date_range
from generator.core.messiness import MessinessConfig, apply_messiness, rename_columns_messy

SEED = 44
START = date(2026, 1, 1)
END = date(2026, 6, 30)

DRUGS = [
    ("Paracetamol 500mg", "OTC", "30049099", "Generic", None, 25, 18),
    ("Crocin 650mg", "OTC", "30049099", "Branded", None, 35, 18),
    ("Amoxicillin 500mg", "Rx", "30041010", "Generic", "H", 120, 12),
    ("Azithromycin 500mg", "Rx", "30042019", "Branded", "H1", 180, 12),
    ("Metformin 500mg", "Rx", "30049099", "Generic", None, 45, 12),
    ("Atorvastatin 10mg", "Rx", "30049099", "Branded", "H", 95, 12),
    ("Cetirizine 10mg", "OTC", "30049099", "Generic", None, 18, 18),
    ("ORS Sachet", "OTC", "30049099", "Branded", None, 22, 12),
    ("Insulin Glargine", "Rx", "30043100", "Branded", "H1", 850, 5),
    ("Vitamin D3 60k", "OTC", "30045039", "Branded", None, 120, 12),
]

DOCTORS = ["Dr Sharma", "Dr Patel", "Dr Reddy", "Dr Iyer", "Dr Khan"]


def generate_canonical(db_path: Path) -> CanonicalDB:
    rng = Random(SEED)
    db = CanonicalDB(db_path)
    db.set_meta("business", "pharmacy_medplus")

    for i in range(1, 501):
        db.insert_party(f"pat-{i:04d}", f"Patient {i}", city="Mumbai")

    for i, (name, rx, hsn, brand, sched, mrp, gst) in enumerate(DRUGS):
        db.insert_product(
            f"drug-{i + 1:03d}",
            name,
            category=rx,
            hsn_code=hsn,
            metadata={"brand_type": brand, "schedule": sched, "gst_pct": gst},
        )
        for b in range(rng.randint(2, 5)):
            batch_id = f"batch-{i + 1:03d}-{b}"
            exp = END + timedelta(days=rng.randint(30, 400))
            db.conn.execute(
                "INSERT INTO medicine_batches (id, product_id, batch_no, expiry_date, mrp, ptr, quantity, schedule, metadata) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    batch_id,
                    f"drug-{i + 1:03d}",
                    f"B{rng.randint(10000, 99999)}",
                    exp.isoformat(),
                    mrp,
                    round(mrp * 0.85, 2),
                    rng.randint(20, 200),
                    sched,
                    json.dumps({"brand_type": brand}),
                ),
            )
    db.conn.commit()

    for i, name in enumerate(["Anita V", "Rohit S", "Meera K"]):
        db.insert_employee(f"ph-{i + 1}", name, role="pharmacist")

    line_counter = inv_counter = 0
    bulk_lines: list[dict] = []
    returns: list[tuple] = []
    writeoffs: list[tuple] = []
    referrals: list[tuple] = []
    deliveries: list[tuple] = []
    shift_stats: dict[str, dict] = {}

    for d in date_range(START, END):
        n_bills = 105 + rng.randint(-10, 15)
        if d.weekday() >= 5:
            n_bills += 20

        ph = rng.choice(["Anita V", "Rohit S", "Meera K"])
        ph_id = f"ph-{['Anita V', 'Rohit S', 'Meera K'].index(ph) + 1}"
        shift_key = f"{d.isoformat()}|{ph_id}"
        shift_stats.setdefault(shift_key, {"hours": 8, "bills": 0, "revenue": 0.0})

        for _ in range(n_bills):
            inv_counter += 1
            inv_id = f"inv-p-{inv_counter:06d}"
            inv_num = f"RX-{d.strftime('%y%m%d')}-{inv_counter:04d}"
            patient_id = f"pat-{rng.randint(1, 500):04d}"
            is_rx = rng.random() < 0.55
            is_delivery = rng.random() < 0.12
            channel = "rx" if is_rx else "otc"

            n_items = 2 if rng.random() < 0.6 else 1
            gross = discount = tax = 0.0

            for ln in range(n_items):
                line_counter += 1
                drug_idx = rng.randint(0, len(DRUGS) - 1)
                if is_rx and rng.random() < 0.7:
                    drug_idx = rng.randint(2, len(DRUGS) - 1)
                name, rx_type, hsn, brand, sched, mrp, gst_pct = DRUGS[drug_idx]
                if rx_type == "Rx" and not is_rx and rng.random() < 0.9:
                    continue
                qty = rng.randint(1, 3)
                lg = mrp * qty
                disc = lg * rng.uniform(0, 0.08)
                tx = (lg - disc) * (gst_pct / 100)
                bulk_lines.append(
                    {
                        "id": f"line-{line_counter:07d}",
                        "invoice_id": inv_id,
                        "line_no": ln + 1,
                        "product_id": f"drug-{drug_idx + 1:03d}",
                        "product_name": name,
                        "product_category": rx_type,
                        "quantity": qty,
                        "unit_price": mrp,
                        "gross_amount": round(lg, 2),
                        "discount_amount": round(disc, 2),
                        "tax_amount": round(tx, 2),
                        "net_amount": round(lg - disc, 2),
                        "total_amount": round(lg - disc + tx, 2),
                        "metadata": {
                            "batch_no": f"B{rng.randint(10000, 99999)}",
                            "hsn": hsn,
                            "schedule": sched,
                            "brand_type": brand,
                            "doctor": rng.choice(DOCTORS) if is_rx else None,
                            "rx_no": inv_num if is_rx else None,
                        },
                    }
                )
                gross += lg
                discount += disc
                tax += tx

            total = round(gross - discount + tax, 2)
            db.insert_invoice(
                {
                    "id": inv_id,
                    "invoice_number": inv_num,
                    "invoice_date": d.isoformat(),
                    "party_id": patient_id,
                    "channel": "delivery" if is_delivery else channel,
                    "status": "ACTIVE",
                    "gross_amount": round(gross, 2),
                    "discount_amount": round(discount, 2),
                    "tax_amount": round(tax, 2),
                    "net_amount": round(gross - discount, 2),
                    "total_amount": total,
                    "metadata": {"party_name": f"Patient {int(patient_id.split('-')[1])}", "pharmacist": ph},
                }
            )
            shift_stats[shift_key]["bills"] += 1
            shift_stats[shift_key]["revenue"] += total

            if is_rx and rng.random() < 0.25:
                referrals.append(
                    (f"ref-{inv_counter}", d.isoformat(), rng.choice(DOCTORS), patient_id, inv_id, None)
                )

            if is_delivery:
                deliveries.append(
                    (f"del-{inv_counter}", d.isoformat(), inv_id, patient_id, round(rng.uniform(30, 60), 2), None)
                )

            if rng.random() < 0.006:
                line_id = f"line-{line_counter:07d}"
                returns.append(
                    (
                        f"ret-{inv_counter}",
                        (d + timedelta(days=rng.randint(3, 14))).isoformat(),
                        inv_id,
                        line_id,
                        f"drug-{drug_idx + 1:03d}",
                        1,
                        round(total * 0.5, 2),
                        "RETURN",
                        None,
                    )
                )

            if rng.random() < 0.004:
                writeoffs.append(
                    (
                        f"wo-{d.isoformat()}-{inv_counter}",
                        d.isoformat(),
                        f"drug-{rng.randint(1, len(DRUGS)):03d}",
                        rng.randint(1, 5),
                        round(rng.uniform(50, 500), 2),
                        "expired",
                        None,
                    )
                )

        db.conn.commit()

        if rng.random() < 0.3:
            db.conn.execute(
                "INSERT INTO purchases (id, purchase_date, supplier_name, product_id, batch_id, quantity, unit_cost, total_cost, metadata) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    f"pur-{d.isoformat()}",
                    d.isoformat(),
                    rng.choice(["Sun Pharma Dist", "Cipla Wholesale", "Local Med Agency"]),
                    f"drug-{rng.randint(1, len(DRUGS)):03d}",
                    f"batch-{rng.randint(1, len(DRUGS)):03d}-0",
                    rng.randint(10, 100),
                    80,
                    800,
                    None,
                ),
            )
        db.conn.commit()

    db.bulk_insert_sales_lines(bulk_lines)
    db.executemany(
        "INSERT INTO returns (id, return_date, original_invoice_id, original_line_id, product_id, quantity, refund_amount, return_type, metadata) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        returns,
    )
    db.executemany(
        "INSERT INTO inventory_movements (id, movement_date, product_id, movement_type, quantity, unit_cost, total_cost, reference, metadata) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [(w[0], w[1], w[2], "WRITEOFF", w[3], 0, w[4], w[5], w[6]) for w in writeoffs],
    )
    db.executemany(
        "INSERT INTO doctor_referrals (id, referral_date, doctor_name, party_id, invoice_id, metadata) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        referrals,
    )
    db.executemany(
        "INSERT INTO delivery_log (id, delivery_date, invoice_id, party_id, delivery_fee, metadata) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        deliveries,
    )
    for key, stats in shift_stats.items():
        d_str, ph_id = key.split("|", 1)
        db.conn.execute(
            "INSERT INTO pharmacist_shifts (id, employee_id, shift_date, hours, bills_count, revenue, metadata) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (f"ps-{key}", ph_id, d_str, stats["hours"], stats["bills"], round(stats["revenue"], 2), None),
        )
    db.conn.commit()
    db.set_meta("line_count", str(len(bulk_lines)))
    return db


def export_datasets(db: CanonicalDB, out_dir: Path) -> dict[str, int]:
    rng = Random(SEED + 1)
    out_dir.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}

    rows = db.query_all(
        """
        SELECT sl.id, i.invoice_number, i.invoice_date,
               json_extract(i.metadata, '$.party_name') AS party_name,
               sl.product_name, sl.product_category, sl.quantity,
               sl.gross_amount, sl.discount_amount, sl.tax_amount, sl.total_amount,
               json_extract(sl.metadata, '$.batch_no') AS batch_no,
               json_extract(sl.metadata, '$.hsn') AS hsn_code,
               json_extract(sl.metadata, '$.schedule') AS schedule,
               json_extract(sl.metadata, '$.brand_type') AS brand_type,
               json_extract(sl.metadata, '$.doctor') AS doctor_ref,
               i.channel
        FROM sales_lines sl
        JOIN invoices i ON sl.invoice_id = i.id
        WHERE i.status = 'ACTIVE'
        """
    )
    df = pd.DataFrame([dict(r) for r in rows])
    export = df.copy()
    export = export.rename(
        columns={
            "invoice_date": "Sale Date",
            "invoice_number": "Bill No",
            "party_name": "Consumer",
            "product_name": "Drug Name",
            "product_category": "Type",
            "quantity": "Qty",
            "total_amount": "Net Sales",
            "tax_amount": "GST Amt",
            "discount_amount": "Discount",
            "batch_no": "Batch No",
            "hsn_code": "HSN",
            "schedule": "Schedule",
            "brand_type": "Generic/Branded",
            "doctor_ref": "Doctor Ref",
            "channel": "Channel",
        }
    )
    cfg = MessinessConfig(
        shuffle_within_month=False,
        date_format_mix=False,
        duplicate_row_prob=0.002,
        blank_row_prob=0.0,
        currency_format_mix=False,
    )
    export = apply_messiness(
        export,
        rng,
        cfg,
        date_col="Sale Date",
        amount_cols=["Net Sales", "GST Amt", "Discount"],
        duplicate_key="Bill No",
    )
    export["Sale Date"] = pd.to_datetime(export["Sale Date"], errors="coerce").dt.strftime("%Y-%m-%d")
    export.to_csv(out_dir / "retail_sales_register.csv", index=False)
    counts["retail_sales_register.csv"] = len(export)

    purch = pd.DataFrame(
        db.query_all(
            "SELECT purchase_date, supplier_name, quantity, unit_cost, total_cost FROM purchases"
        )
    )
    purch.to_csv(out_dir / "purchase_register.csv", index=False)
    counts["purchase_register.csv"] = len(purch)

    batches = pd.DataFrame(
        db.query_all(
            """
            SELECT p.name AS Drug_Name, b.batch_no AS Batch_No, b.expiry_date AS Exp_Dt,
                   b.mrp AS MRP, b.ptr AS PTR, b.quantity AS Qty, b.schedule AS Schedule
            FROM medicine_batches b JOIN products p ON b.product_id = p.id
            """
        )
    )
    batches.to_csv(out_dir / "batch_stock.csv", index=False)
    counts["batch_stock.csv"] = len(batches)

    wo = pd.DataFrame(
        db.query_all(
            "SELECT movement_date AS Date, product_id, quantity AS Qty, total_cost AS Loss "
            "FROM inventory_movements WHERE movement_type = 'WRITEOFF'"
        )
    )
    wo.to_csv(out_dir / "expired_writeoffs.csv", index=False)
    counts["expired_writeoffs.csv"] = len(wo)

    ret = pd.DataFrame(
        db.query_all(
            "SELECT return_date, original_invoice_id, refund_amount, return_type FROM returns"
        )
    )
    ret.to_csv(out_dir / "returns_substitutions.csv", index=False)
    counts["returns_substitutions.csv"] = len(ret)

    otc = pd.DataFrame(
        db.query_all(
            """
            SELECT invoice_date AS Date,
                   SUM(CASE WHEN channel = 'otc' THEN total_amount ELSE 0 END) AS OTC_Sales,
                   SUM(CASE WHEN channel = 'rx' THEN total_amount ELSE 0 END) AS Rx_Sales
            FROM invoices WHERE status = 'ACTIVE'
            GROUP BY invoice_date
            """
        )
    )
    otc.to_csv(out_dir / "otc_vs_rx_summary.csv", index=False)
    counts["otc_vs_rx_summary.csv"] = len(otc)

    refs = pd.DataFrame(
        db.query_all(
            "SELECT referral_date, doctor_name, party_id, invoice_id FROM doctor_referrals"
        )
    )
    refs.to_csv(out_dir / "doctor_referrals.csv", index=False)
    counts["doctor_referrals.csv"] = len(refs)

    deliv = pd.DataFrame(
        db.query_all(
            "SELECT delivery_date, invoice_id, delivery_fee FROM delivery_log"
        )
    )
    deliv.to_csv(out_dir / "home_delivery_log.csv", index=False)
    counts["home_delivery_log.csv"] = len(deliv)

    shifts = pd.DataFrame(
        db.query_all(
            "SELECT shift_date, employee_id, hours, bills_count, revenue FROM pharmacist_shifts"
        )
    )
    shifts.to_csv(out_dir / "pharmacist_shifts.csv", index=False)
    counts["pharmacist_shifts.csv"] = len(shifts)

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
