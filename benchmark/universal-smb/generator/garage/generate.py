"""Generate AutoCare Garage canonical data and messy exports."""

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
    apply_messiness,
    inject_section_headers,
    rename_columns_messy,
)

SEED = 43
START = date(2026, 1, 1)
END = date(2026, 6, 30)

PARTS = [
    ("Engine Oil 5W30", "Lubricants", 850),
    ("Oil Filter", "Filters", 320),
    ("Brake Pad Set", "Brakes", 1800),
    ("Air Filter", "Filters", 450),
    ("Spark Plug", "Ignition", 280),
    ("Wiper Blade", "Accessories", 350),
    ("Coolant 1L", "Lubricants", 220),
    ("Battery 45Ah", "Electrical", 4500),
]

LABOUR = [
    ("General Service", 1200),
    ("Brake Service", 800),
    ("AC Service", 1500),
    ("Wheel Alignment", 600),
    ("Engine Diagnostics", 900),
]

MECHANICS = ["Ravi M", "Suresh P", "Kiran D"]
MAKES = [("Maruti Swift", "Swift"), ("Hyundai i20", "i20"), ("Honda City", "City"), ("Tata Nexon", "Nexon")]


def _name_variants(canonical: str, rng: Random) -> list[str]:
    parts = canonical.split()
    return [
        canonical,
        canonical.upper(),
        f"Mr {parts[0]}",
        f"{parts[0]} K" if len(parts) > 1 else f"{parts[0]} K",
    ]


def generate_canonical(db_path: Path) -> CanonicalDB:
    rng = Random(SEED)
    db = CanonicalDB(db_path)
    db.set_meta("business", "garage_autocare")

    for i, name in enumerate(MECHANICS):
        db.insert_employee(f"mec-{i + 1}", name, role="mechanic")

    customers: list[tuple[str, str, list[str]]] = []
    for i in range(1, 121):
        cname = f"Rajesh Kumar {i}" if i % 5 == 0 else f"Customer {i}"
        aliases = _name_variants(cname, rng) if i % 5 == 0 else [cname]
        pid = f"party-{i:04d}"
        db.insert_party(pid, cname, aliases=aliases, city="Pune")
        customers.append((pid, cname, aliases))

    for i, (name, cat, cost) in enumerate(PARTS):
        db.insert_product(f"part-{i + 1:03d}", name, category=cat, unit="pcs")
        db.conn.execute(
            "INSERT INTO parts_inventory (product_id, quantity_on_hand, unit_cost, metadata) VALUES (?, ?, ?, ?)",
            (f"part-{i + 1:03d}", rng.randint(5, 40), cost * 0.7, None),
        )
    db.conn.commit()

    line_counter = inv_counter = job_counter = 0
    bulk_lines: list[dict] = []
    estimates: list[tuple] = []
    timesheets: list[tuple] = []
    insurance: list[tuple] = []
    pending_jobs: list[tuple] = []

    for d in date_range(START, END):
        n_jobs = 8 + rng.randint(-2, 4)
        if d.weekday() >= 5:
            n_jobs += 2

        for _ in range(n_jobs):
            job_counter += 1
            inv_counter += 1
            party_id, cname, aliases = rng.choice(customers)
            make, model = rng.choice(MAKES)
            reg = f"MH{rng.randint(10, 20)}-{chr(rng.randint(65, 90))}{chr(rng.randint(65, 90))}-{rng.randint(1000, 9999)}"
            mech = rng.choice(MECHANICS)
            mech_id = f"mec-{MECHANICS.index(mech) + 1}"
            job_id = f"job-{job_counter:05d}"
            inv_id = f"inv-g-{inv_counter:05d}"
            inv_num = f"JC-{d.strftime('%y%m')}-{job_counter:04d}"

            is_insurance = rng.random() < 0.06
            is_warranty = rng.random() < 0.04
            is_pending = rng.random() < 0.008

            if is_pending:
                pending_jobs.append((job_id, f"WO-{job_counter:04d}", d.isoformat(), reg, "OPEN"))
                continue

            db.conn.execute(
                "INSERT INTO job_cards (id, job_number, job_date, party_id, vehicle_reg, vehicle_make, status, mechanic_id, metadata) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (job_id, f"WO-{job_counter:04d}", d.isoformat(), party_id, reg, make, "COMPLETED", mech_id, None),
            )

            est_amt = 0.0
            if rng.random() < 0.5:
                est_amt = rng.uniform(2000, 12000)
                est_id = f"est-{job_counter:04d}"
                final_link = inv_id if rng.random() > 0.08 else None
                estimates.append(
                    (est_id, f"EST-{job_counter:04d}", d.isoformat(), party_id, job_id, round(est_amt, 2), final_link, None)
                )

            gross = discount = tax = 0.0
            n_parts = rng.randint(1, 4)
            for ln in range(n_parts):
                line_counter += 1
                pname, pcat, price = rng.choice(PARTS)
                qty = 1
                lg = price * qty
                disc = lg * 0.05 if is_warranty else 0
                tx = (lg - disc) * 0.18
                bulk_lines.append(
                    {
                        "id": f"line-{line_counter:06d}",
                        "invoice_id": inv_id,
                        "line_no": ln + 1,
                        "product_id": f"part-{PARTS.index((pname, pcat, price)) + 1:03d}",
                        "product_name": pname,
                        "product_category": pcat,
                        "quantity": qty,
                        "unit_price": price,
                        "gross_amount": round(lg, 2),
                        "discount_amount": round(disc, 2),
                        "tax_amount": round(tx, 2),
                        "net_amount": round(lg - disc, 2),
                        "total_amount": round(lg - disc + tx, 2),
                        "metadata": {
                            "vehicle_reg": reg,
                            "mechanic": mech,
                            "line_type": "part",
                            "insurance": is_insurance,
                        },
                    }
                )
                gross += lg
                discount += disc
                tax += tx

            line_counter += 1
            lname, lprice = rng.choice(LABOUR)
            hrs = round(rng.uniform(0.5, 3.0), 1)
            lg = lprice
            tx = lg * 0.18
            bulk_lines.append(
                {
                    "id": f"line-{line_counter:06d}",
                    "invoice_id": inv_id,
                    "line_no": n_parts + 1,
                    "product_id": None,
                    "product_name": lname,
                    "product_category": "Labour",
                    "quantity": hrs,
                    "unit_price": lprice,
                    "gross_amount": round(lg, 2),
                    "discount_amount": 0,
                    "tax_amount": round(tx, 2),
                    "net_amount": round(lg, 2),
                    "total_amount": round(lg + tx, 2),
                    "metadata": {"vehicle_reg": reg, "mechanic": mech, "line_type": "labour", "labour_hrs": hrs},
                }
            )
            gross += lg
            tax += tx
            total = round(gross - discount + tax, 2)

            if is_warranty and rng.random() < 0.3:
                total = -abs(total * 0.1)

            alias = rng.choice(aliases)
            db.insert_invoice(
                {
                    "id": inv_id,
                    "invoice_number": inv_num,
                    "invoice_date": d.isoformat(),
                    "party_id": party_id,
                    "channel": "insurance" if is_insurance else "walk-in",
                    "status": "ACTIVE",
                    "gross_amount": round(gross, 2),
                    "discount_amount": round(discount, 2),
                    "tax_amount": round(tax, 2),
                    "net_amount": round(gross - discount, 2),
                    "total_amount": total,
                    "metadata": {
                        "party_name": alias,
                        "vehicle_reg": reg,
                        "make_model": make,
                        "mechanic": mech,
                        "job_card": f"WO-{job_counter:04d}",
                    },
                }
            )

            timesheets.append(
                (f"ts-{job_counter}", mech_id, d.isoformat(), hrs, json.dumps({"job": job_id}), None)
            )

            if is_insurance:
                insurance.append(
                    (
                        f"ins-{job_counter}",
                        job_id,
                        inv_id,
                        rng.choice(["ICICI Lombard", "HDFC Ergo", "Bajaj Allianz"]),
                        total,
                        total * 0.85,
                        None,
                    )
                )

            if rng.random() < 0.15:
                db.conn.execute(
                    "INSERT INTO vendor_purchases (id, purchase_date, vendor_name, product_id, quantity, unit_cost, total_cost, metadata) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        f"vp-{line_counter}",
                        d.isoformat(),
                        rng.choice(["AutoParts Wholesale", "Spares Hub"]),
                        f"part-{rng.randint(1, len(PARTS)):03d}",
                        1,
                        500,
                        500,
                        None,
                    ),
                )

        db.conn.commit()

    db.bulk_insert_sales_lines(bulk_lines)
    db.executemany(
        "INSERT INTO estimates (id, estimate_number, estimate_date, party_id, job_card_id, estimated_amount, final_invoice_id, metadata) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        estimates,
    )
    db.executemany(
        "INSERT INTO insurance_claims (id, job_card_id, invoice_id, insurer, claim_amount, approved_amount, metadata) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        insurance,
    )
    for pj in pending_jobs:
        db.conn.execute(
            "INSERT INTO job_cards (id, job_number, job_date, party_id, vehicle_reg, vehicle_make, status, mechanic_id, metadata) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (pj[0], pj[1], pj[2], "party-0001", pj[3], "Unknown", pj[4], "mec-1", None),
        )
    db.conn.commit()

    for ts in timesheets:
        db.conn.execute(
            "INSERT INTO shifts (id, employee_id, shift_date, start_time, end_time, hours, metadata) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (ts[0], ts[1], ts[2], "09:00", "18:00", ts[3], ts[4]),
        )
    db.conn.commit()

    db.set_meta("line_count", str(line_counter))
    return db


def export_datasets(db: CanonicalDB, out_dir: Path) -> dict[str, int]:
    rng = Random(SEED + 1)
    out_dir.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}

    rows = db.query_all(
        """
        SELECT sl.id, i.invoice_number, i.invoice_date,
               json_extract(i.metadata, '$.party_name') AS party_name,
               sl.product_name, sl.product_category, sl.quantity, sl.total_amount,
               json_extract(sl.metadata, '$.vehicle_reg') AS vehicle_reg,
               json_extract(sl.metadata, '$.mechanic') AS mechanic,
               json_extract(i.metadata, '$.job_card') AS job_card,
               json_extract(sl.metadata, '$.line_type') AS line_type,
               json_extract(sl.metadata, '$.labour_hrs') AS labour_hrs,
               i.channel
        FROM sales_lines sl
        JOIN invoices i ON sl.invoice_id = i.id
        WHERE i.status = 'ACTIVE'
        """
    )
    df = pd.DataFrame([dict(r) for r in rows])
    export_df = df.rename(
        columns={
            "invoice_date": "Voucher Date",
            "invoice_number": "Voucher No",
            "party_name": "Party Name",
            "product_name": "Part Desc",
            "product_category": "Category",
            "quantity": "Qty",
            "total_amount": "Bill Amt",
            "vehicle_reg": "Reg No",
            "mechanic": "Mechanic",
            "job_card": "Job Card No",
            "line_type": "Line Type",
            "labour_hrs": "Labour Hrs",
            "channel": "Channel",
        }
    )
    cfg = MessinessConfig(shuffle_within_month=False, date_format_mix=False)
    export_df = inject_section_headers(
        export_df,
        rng,
        ["--- INSURANCE JOBS ---", "--- WARRANTY JOBS ---"],
        800,
    )
    export_df = apply_messiness(
        export_df, rng, cfg, date_col="Voucher Date", amount_cols=["Bill Amt"]
    )

    xlsx = out_dir / "service_invoices.xlsx"
    with pd.ExcelWriter(xlsx, engine="openpyxl") as writer:
        export_df.to_excel(writer, sheet_name="Parts & Labour Register", index=False)
        df.groupby("product_name")["quantity"].sum().reset_index().to_excel(
            writer, sheet_name="Summary", index=False
        )
        df[df["channel"] == "insurance"].to_excel(writer, sheet_name="Insurance Jobs", index=False)
        pd.DataFrame({"note": ["Tally export placeholder"]}).to_excel(writer, sheet_name="Voucher Register", index=False)
    counts["service_invoices.xlsx"] = len(export_df)

    jobs = pd.DataFrame(
        db.query_all(
            """
            SELECT j.job_number AS Job_Card_No, j.job_date AS Date,
                   j.vehicle_reg AS Vehicle_No, p.canonical_name AS Party_Name,
                   j.vehicle_make AS Make_Model, j.status, e.name AS Mechanic
            FROM job_cards j
            LEFT JOIN parties p ON j.party_id = p.id
            LEFT JOIN employees e ON j.mechanic_id = e.id
            """
        )
    )
    jobs.to_csv(out_dir / "job_cards_jan_jun.csv", index=False)
    counts["job_cards_jan_jun.csv"] = len(jobs)

    est = pd.DataFrame(
        db.query_all(
            """
            SELECT e.estimate_number, e.estimate_date, e.estimated_amount,
                   e.final_invoice_id, i.invoice_number AS final_bill_no
            FROM estimates e
            LEFT JOIN invoices i ON e.final_invoice_id = i.id
            """
        )
    )
    est.to_csv(out_dir / "estimates_vs_final.csv", index=False)
    counts["estimates_vs_final.csv"] = len(est)

    parts = pd.DataFrame(
        db.query_all(
            "SELECT p.name AS Part_Desc, pi.quantity_on_hand AS Qty, pi.unit_cost AS Unit_Cost "
            "FROM parts_inventory pi JOIN products p ON pi.product_id = p.id"
        )
    )
    parts.to_csv(out_dir / "parts_inventory.csv", index=False)
    counts["parts_inventory.csv"] = len(parts)

    vp = pd.DataFrame(
        db.query_all(
            "SELECT purchase_date, vendor_name, quantity, unit_cost, total_cost FROM vendor_purchases"
        )
    )
    vp.to_csv(out_dir / "vendor_purchases.csv", index=False)
    counts["vendor_purchases.csv"] = len(vp)

    ins = pd.DataFrame(
        db.query_all(
            "SELECT insurer AS Insurance_Co, claim_amount, approved_amount, invoice_id FROM insurance_claims"
        )
    )
    ins.to_csv(out_dir / "insurance_claims.csv", index=False)
    counts["insurance_claims.csv"] = len(ins)

    ts = pd.DataFrame(
        db.query_all(
            """
            SELECT s.shift_date AS Date, e.name AS Mechanic, s.hours AS Labour_Hrs
            FROM shifts s JOIN employees e ON s.employee_id = e.id
            """
        )
    )
    ts.to_csv(out_dir / "mechanic_timesheets.csv", index=False)
    counts["mechanic_timesheets.csv"] = len(ts)

    pending_rows = db.query_all(
        "SELECT job_number AS Job_Card_No, job_date AS Date, vehicle_reg AS Vehicle_No, status "
        "FROM job_cards WHERE status = 'OPEN'"
    )
    pending = pd.DataFrame([dict(r) for r in pending_rows])
    pending.to_csv(out_dir / "pending_jobs.csv", index=False)
    counts["pending_jobs.csv"] = len(pending)

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
