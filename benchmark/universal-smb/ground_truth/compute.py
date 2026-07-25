"""Compute official benchmark answers from canonical SQLite databases."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]
CANONICAL = ROOT / "canonical"
QUESTIONS_DIR = ROOT / "questions"
OUTPUT = Path(__file__).resolve().parent / "answers.json"


def _connect(db_name: str) -> sqlite3.Connection:
    path = CANONICAL / db_name
    if not path.exists():
        raise FileNotFoundError(f"Canonical DB missing: {path}. Run: python -m generator")
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def _record(
    question_id: str,
    answer: Any,
    *,
    unit: str = "",
    calculation: list[str],
    source_tables: list[str],
    row_ids: list[str] | None = None,
    assumptions: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "question_id": question_id,
        "answer": answer,
        "unit": unit,
        "calculation": calculation,
        "source_tables": source_tables,
        "row_ids": (row_ids or [])[:20],
        "assumptions": assumptions or [],
    }


def compute_cafe(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []

    row = conn.execute(
        """
        SELECT COALESCE(SUM(sl.total_amount), 0) AS v
        FROM sales_lines sl
        JOIN invoices i ON sl.invoice_id = i.id
        WHERE i.channel = 'dine-in' AND i.status = 'ACTIVE' AND i.total_amount > 0
          AND i.invoice_date BETWEEN '2026-03-01' AND '2026-03-31'
        """
    ).fetchone()
    out.append(
        _record(
            "cafe_q01",
            round(row["v"], 2),
            unit="INR",
            calculation=[
                "SUM(sales_lines.total_amount) WHERE invoices.channel='dine-in'",
                "AND invoice_date in March 2026, status ACTIVE, total > 0",
            ],
            source_tables=["sales_lines", "invoices"],
            assumptions=["Refunds and cancelled bills excluded"],
        )
    )

    row = conn.execute(
        """
        SELECT COUNT(DISTINCT i.id) AS v
        FROM invoices i
        WHERE i.channel = 'swiggy' AND i.invoice_date BETWEEN '2026-02-01' AND '2026-02-28'
          AND i.status = 'ACTIVE'
        """
    ).fetchone()
    out.append(
        _record(
            "cafe_q02",
            int(row["v"]),
            calculation=["COUNT(DISTINCT invoices) WHERE channel='swiggy' AND Feb 2026"],
            source_tables=["invoices"],
        )
    )

    rows = conn.execute(
        """
        SELECT sl.product_name, SUM(sl.quantity) AS qty
        FROM sales_lines sl
        JOIN invoices i ON sl.invoice_id = i.id
        WHERE i.status = 'ACTIVE' AND i.total_amount > 0
        GROUP BY sl.product_name
        ORDER BY qty DESC
        LIMIT 5
        """
    ).fetchall()
    out.append(
        _record(
            "cafe_q03",
            [r["product_name"] for r in rows],
            calculation=["TOP 5 product_name BY SUM(quantity)"],
            source_tables=["sales_lines", "invoices"],
            row_ids=[r["product_name"] for r in rows],
        )
    )

    mar = conn.execute(
        "SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='ACTIVE' AND total_amount>0 "
        "AND invoice_date BETWEEN '2026-03-01' AND '2026-03-31'"
    ).fetchone()[0]
    apr = conn.execute(
        "SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='ACTIVE' AND total_amount>0 "
        "AND invoice_date BETWEEN '2026-04-01' AND '2026-04-30'"
    ).fetchone()[0]
    pct = round((apr - mar) / mar * 100, 2) if mar else 0.0
    out.append(
        _record(
            "cafe_q04",
            pct,
            unit="percent",
            calculation=[f"March revenue={mar:.2f}", f"April revenue={apr:.2f}", f"Change={pct}%"],
            source_tables=["invoices"],
        )
    )

    row = conn.execute(
        """
        SELECT COUNT(*) AS v FROM (
            SELECT party_id FROM invoices
            WHERE status='ACTIVE' AND party_id IS NOT NULL AND total_amount > 0
            GROUP BY party_id HAVING COUNT(*) > 3
        )
        """
    ).fetchone()
    out.append(
        _record(
            "cafe_q05",
            int(row["v"]),
            calculation=["COUNT parties with >3 ACTIVE invoices"],
            source_tables=["invoices"],
            assumptions=["Aggregator orders excluded (party_id NULL)"],
        )
    )

    row = conn.execute(
        """
        SELECT
            CASE WHEN SUM(sl.gross_amount) > 0
            THEN SUM(sl.discount_amount) * 100.0 / SUM(sl.gross_amount)
            ELSE 0 END AS v
        FROM sales_lines sl
        JOIN invoices i ON sl.invoice_id = i.id
        WHERE i.channel = 'dine-in' AND i.status = 'ACTIVE' AND i.total_amount > 0
        """
    ).fetchone()
    out.append(
        _record(
            "cafe_q06",
            round(row["v"], 2),
            unit="percent",
            calculation=["SUM(discount)/SUM(gross)*100 for dine-in lines"],
            source_tables=["sales_lines", "invoices"],
        )
    )

    rev = conn.execute(
        """
        SELECT COALESCE(SUM(sl.total_amount),0) FROM sales_lines sl
        JOIN invoices i ON sl.invoice_id = i.id
        WHERE i.channel IN ('dine-in','takeaway') AND i.status='ACTIVE' AND i.total_amount>0
          AND i.invoice_date BETWEEN '2026-03-01' AND '2026-03-31'
        """
    ).fetchone()[0]
    wast = conn.execute(
        "SELECT COALESCE(SUM(total_cost),0) FROM wastage WHERE wastage_date BETWEEN '2026-03-01' AND '2026-03-31'"
    ).fetchone()[0]
    out.append(
        _record(
            "cafe_q07",
            round(rev - wast, 2),
            unit="INR",
            calculation=[f"Mar dine-in+takeaway revenue={rev:.2f}", f"Mar wastage cost={wast:.2f}"],
            source_tables=["sales_lines", "invoices", "wastage"],
            assumptions=["Proxy profit = revenue minus wastage only"],
        )
    )

    dine_apr = conn.execute(
        """
        SELECT COALESCE(SUM(sl.total_amount),0) FROM sales_lines sl
        JOIN invoices i ON sl.invoice_id = i.id
        WHERE i.channel='dine-in' AND i.status='ACTIVE' AND i.total_amount>0
          AND i.invoice_date BETWEEN '2026-04-01' AND '2026-04-30'
        """
    ).fetchone()[0]
    hours = conn.execute(
        "SELECT COALESCE(SUM(hours),0) FROM shifts WHERE shift_date BETWEEN '2026-04-01' AND '2026-04-30'"
    ).fetchone()[0]
    out.append(
        _record(
            "cafe_q08",
            round(dine_apr / hours, 2) if hours else 0.0,
            unit="INR",
            calculation=[f"Apr dine-in revenue={dine_apr:.2f}", f"Apr shift hours={hours:.2f}"],
            source_tables=["sales_lines", "invoices", "shifts"],
        )
    )

    var = conn.execute(
        """
        SELECT COALESCE(SUM(expected_amount - collected_amount), 0)
        FROM settlements WHERE settlement_date BETWEEN '2026-06-01' AND '2026-06-30'
        """
    ).fetchone()[0]
    out.append(
        _record(
            "cafe_q09",
            round(var, 2),
            unit="INR",
            calculation=["SUM(expected - collected) for June settlements"],
            source_tables=["settlements"],
        )
    )

    mismatch = conn.execute(
        """
        SELECT COUNT(*) FROM (
            SELECT i.id FROM invoices i
            JOIN (
                SELECT invoice_id, SUM(total_amount) AS line_sum
                FROM sales_lines GROUP BY invoice_id
            ) ls ON ls.invoice_id = i.id
            WHERE i.status='ACTIVE' AND i.total_amount > 0
              AND ABS(i.total_amount - ls.line_sum - COALESCE(i.tip_amount,0)) > 0.05
        )
        """
    ).fetchone()[0]
    out.append(
        _record(
            "cafe_q10",
            int(mismatch),
            calculation=["Count invoices where header total != line sum + tip (tolerance 0.05)"],
            source_tables=["invoices", "sales_lines"],
        )
    )

    return out


def compute_garage(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []

    mar_rev = conn.execute(
        "SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='ACTIVE' "
        "AND invoice_date BETWEEN '2026-03-01' AND '2026-03-31'"
    ).fetchone()[0]
    out.append(
        _record(
            "garage_q01",
            round(mar_rev, 2),
            unit="INR",
            calculation=["SUM(invoice total_amount) March 2026"],
            source_tables=["invoices"],
        )
    )

    ins_feb = conn.execute(
        "SELECT COUNT(*) FROM invoices WHERE channel='insurance' AND status='ACTIVE' "
        "AND invoice_date BETWEEN '2026-02-01' AND '2026-02-28'"
    ).fetchone()[0]
    out.append(_record("garage_q02", int(ins_feb), calculation=["COUNT insurance invoices Feb"], source_tables=["invoices"]))

    rows = conn.execute(
        """
        SELECT sl.product_name, SUM(sl.total_amount) AS rev
        FROM sales_lines sl
        JOIN invoices i ON sl.invoice_id = i.id
        WHERE i.status='ACTIVE' AND json_extract(sl.metadata,'$.line_type')='part'
        GROUP BY sl.product_name ORDER BY rev DESC LIMIT 5
        """
    ).fetchall()
    out.append(
        _record(
            "garage_q03",
            [r["product_name"] for r in rows],
            calculation=["TOP 5 parts by SUM(total_amount)"],
            source_tables=["sales_lines", "invoices"],
        )
    )

    mar = conn.execute(
        "SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='ACTIVE' "
        "AND invoice_date BETWEEN '2026-03-01' AND '2026-03-31'"
    ).fetchone()[0]
    apr = conn.execute(
        "SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='ACTIVE' "
        "AND invoice_date BETWEEN '2026-04-01' AND '2026-04-30'"
    ).fetchone()[0]
    out.append(
        _record(
            "garage_q04",
            round((apr - mar) / mar * 100, 2) if mar else 0,
            unit="percent",
            calculation=[f"Mar={mar:.2f}", f"Apr={apr:.2f}"],
            source_tables=["invoices"],
        )
    )

    repeat = conn.execute(
        """
        SELECT COUNT(*) FROM (
            SELECT party_id FROM invoices WHERE status='ACTIVE' AND party_id IS NOT NULL
            GROUP BY party_id HAVING COUNT(*) > 2
        )
        """
    ).fetchone()[0]
    out.append(_record("garage_q05", int(repeat), calculation=["Parties with >2 visits"], source_tables=["invoices"]))

    parts_cnt = conn.execute(
        "SELECT COUNT(*) FROM sales_lines sl JOIN invoices i ON sl.invoice_id=i.id "
        "WHERE i.status='ACTIVE' AND json_extract(sl.metadata,'$.line_type')='part'"
    ).fetchone()[0]
    lab_cnt = conn.execute(
        "SELECT COUNT(*) FROM sales_lines sl JOIN invoices i ON sl.invoice_id=i.id "
        "WHERE i.status='ACTIVE' AND json_extract(sl.metadata,'$.line_type')='labour'"
    ).fetchone()[0]
    total = parts_cnt + lab_cnt
    out.append(
        _record(
            "garage_q06",
            f"parts={round(parts_cnt/total*100,1)}%, labour={round(lab_cnt/total*100,1)}%",
            calculation=[f"parts lines={parts_cnt}", f"labour lines={lab_cnt}"],
            source_tables=["sales_lines"],
        )
    )

    parts_rev = conn.execute(
        """
        SELECT COALESCE(SUM(sl.total_amount),0) FROM sales_lines sl
        JOIN invoices i ON sl.invoice_id=i.id
        WHERE i.status='ACTIVE' AND json_extract(sl.metadata,'$.line_type')='part'
          AND i.invoice_date BETWEEN '2026-03-01' AND '2026-03-31'
        """
    ).fetchone()[0]
    purch = conn.execute(
        "SELECT COALESCE(SUM(total_cost),0) FROM vendor_purchases "
        "WHERE purchase_date BETWEEN '2026-03-01' AND '2026-03-31'"
    ).fetchone()[0]
    out.append(
        _record(
            "garage_q07",
            round(parts_rev - purch, 2),
            unit="INR",
            calculation=[f"Mar parts revenue={parts_rev:.2f}", f"Mar vendor purchases={purch:.2f}"],
            source_tables=["sales_lines", "vendor_purchases"],
        )
    )

    rows = conn.execute(
        """
        SELECT json_extract(i.metadata,'$.mechanic') AS mechanic,
               SUM(i.total_amount) AS rev,
               SUM(CAST(json_extract(sl.metadata,'$.labour_hrs') AS REAL)) AS hrs
        FROM invoices i
        JOIN sales_lines sl ON sl.invoice_id = i.id
        WHERE i.status='ACTIVE' AND i.invoice_date BETWEEN '2026-04-01' AND '2026-06-30'
          AND json_extract(sl.metadata,'$.line_type')='labour'
        GROUP BY mechanic HAVING hrs > 0
        ORDER BY rev / hrs DESC LIMIT 1
        """
    ).fetchone()
    out.append(
        _record(
            "garage_q08",
            rows["mechanic"] if rows else "",
            calculation=["MAX(revenue/labour_hrs) by mechanic Apr-Jun"],
            source_tables=["invoices", "sales_lines"],
        )
    )

    row = conn.execute(
        """
        SELECT AVG(ABS(i.total_amount - e.estimated_amount) * 100.0 / NULLIF(e.estimated_amount, 0)) AS v
        FROM estimates e
        JOIN invoices i ON e.final_invoice_id = i.id
        WHERE e.final_invoice_id IS NOT NULL AND e.estimated_amount > 0
        """
    ).fetchone()
    out.append(
        _record(
            "garage_q09",
            round(row["v"] or 0, 2),
            unit="percent",
            calculation=["AVG(ABS(final-estimate)/estimate*100)"],
            source_tables=["estimates", "invoices"],
        )
    )

    billed = conn.execute(
        "SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE channel='insurance' AND status='ACTIVE'"
    ).fetchone()[0]
    approved = conn.execute("SELECT COALESCE(SUM(approved_amount),0) FROM insurance_claims").fetchone()[0]
    out.append(
        _record(
            "garage_q10",
            f"billed={round(billed,2)}, approved={round(approved,2)}",
            unit="INR",
            calculation=[f"Insurance billed={billed:.2f}", f"Claims approved={approved:.2f}"],
            source_tables=["invoices", "insurance_claims"],
        )
    )

    return out


def compute_pharmacy(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []

    mar = conn.execute(
        "SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='ACTIVE' "
        "AND invoice_date BETWEEN '2026-03-01' AND '2026-03-31'"
    ).fetchone()[0]
    out.append(_record("pharmacy_q01", round(mar, 2), unit="INR", calculation=["Mar total revenue"], source_tables=["invoices"]))

    otc_feb = conn.execute(
        "SELECT COUNT(*) FROM invoices WHERE channel='otc' AND status='ACTIVE' "
        "AND invoice_date BETWEEN '2026-02-01' AND '2026-02-28'"
    ).fetchone()[0]
    out.append(_record("pharmacy_q02", int(otc_feb), calculation=["OTC bills Feb"], source_tables=["invoices"]))

    rows = conn.execute(
        """
        SELECT product_name, SUM(quantity) AS q FROM sales_lines sl
        JOIN invoices i ON sl.invoice_id=i.id WHERE i.status='ACTIVE'
        GROUP BY product_name ORDER BY q DESC LIMIT 5
        """
    ).fetchall()
    out.append(_record("pharmacy_q03", [r["product_name"] for r in rows], calculation=["TOP 5 by qty"], source_tables=["sales_lines"]))

    mar_r = conn.execute(
        "SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='ACTIVE' "
        "AND invoice_date BETWEEN '2026-03-01' AND '2026-03-31'"
    ).fetchone()[0]
    apr_r = conn.execute(
        "SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='ACTIVE' "
        "AND invoice_date BETWEEN '2026-04-01' AND '2026-04-30'"
    ).fetchone()[0]
    out.append(
        _record(
            "pharmacy_q04",
            round((apr_r - mar_r) / mar_r * 100, 2) if mar_r else 0,
            unit="percent",
            calculation=[f"Mar={mar_r:.2f}", f"Apr={apr_r:.2f}"],
            source_tables=["invoices"],
        )
    )

    repeat = conn.execute(
        """
        SELECT COUNT(*) FROM (
            SELECT party_id FROM invoices WHERE status='ACTIVE' AND party_id IS NOT NULL
            GROUP BY party_id HAVING COUNT(*) > 3
        )
        """
    ).fetchone()[0]
    out.append(_record("pharmacy_q05", int(repeat), calculation=["Patients >3 purchases"], source_tables=["invoices"]))

    disc = conn.execute(
        """
        SELECT CASE WHEN SUM(sl.gross_amount)>0 THEN SUM(sl.discount_amount)*100.0/SUM(sl.gross_amount) ELSE 0 END
        FROM sales_lines sl JOIN invoices i ON sl.invoice_id=i.id WHERE i.status='ACTIVE'
        """
    ).fetchone()[0]
    out.append(_record("pharmacy_q06", round(disc, 2), unit="percent", calculation=["SUM disc/SUM gross"], source_tables=["sales_lines"]))

    jun_rev = conn.execute(
        "SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='ACTIVE' "
        "AND invoice_date BETWEEN '2026-06-01' AND '2026-06-30'"
    ).fetchone()[0]
    wo = conn.execute(
        "SELECT COALESCE(SUM(total_cost),0) FROM inventory_movements WHERE movement_type='WRITEOFF' "
        "AND movement_date BETWEEN '2026-06-01' AND '2026-06-30'"
    ).fetchone()[0]
    out.append(
        _record(
            "pharmacy_q07",
            round(jun_rev - wo, 2),
            unit="INR",
            calculation=[f"Jun revenue={jun_rev:.2f}", f"Jun writeoffs={wo:.2f}"],
            source_tables=["invoices", "inventory_movements"],
        )
    )

    row = conn.execute(
        """
        SELECT e.name, ps.revenue * 1.0 / NULLIF(ps.bills_count, 0) AS rev_per_bill
        FROM pharmacist_shifts ps
        JOIN employees e ON ps.employee_id = e.id
        WHERE ps.shift_date BETWEEN '2026-04-01' AND '2026-04-30' AND ps.bills_count > 0
        ORDER BY rev_per_bill DESC LIMIT 1
        """
    ).fetchone()
    out.append(
        _record(
            "pharmacy_q08",
            row["name"] if row else "",
            calculation=["MAX(revenue/bills_count) pharmacist Apr"],
            source_tables=["pharmacist_shifts", "employees"],
        )
    )

    ref_rev = conn.execute(
        """
        SELECT COALESCE(SUM(i.total_amount),0) FROM doctor_referrals dr
        JOIN invoices i ON dr.invoice_id = i.id
        WHERE dr.referral_date BETWEEN '2026-01-01' AND '2026-03-31' AND i.status='ACTIVE'
        """
    ).fetchone()[0]
    out.append(
        _record(
            "pharmacy_q09",
            round(ref_rev, 2),
            unit="INR",
            calculation=["SUM invoice totals linked to Q1 referrals"],
            source_tables=["doctor_referrals", "invoices"],
        )
    )

    jun_r = conn.execute(
        "SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE status='ACTIVE' "
        "AND invoice_date BETWEEN '2026-06-01' AND '2026-06-30'"
    ).fetchone()[0]
    ret = conn.execute(
        "SELECT COALESCE(SUM(refund_amount),0) FROM returns WHERE return_date BETWEEN '2026-06-01' AND '2026-06-30'"
    ).fetchone()[0]
    out.append(
        _record(
            "pharmacy_q10",
            round(ret / jun_r * 100, 2) if jun_r else 0,
            unit="percent",
            calculation=[f"Jun returns={ret:.2f}", f"Jun revenue={jun_r:.2f}"],
            source_tables=["returns", "invoices"],
        )
    )

    return out


def load_questions() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for path in sorted(QUESTIONS_DIR.glob("*.yaml")):
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        for q in data["questions"]:
            q["business"] = data["business"]
            items.append(q)
    return items


def main() -> dict[str, Any]:
    answers: list[dict[str, Any]] = []
    answers.extend(compute_cafe(_connect("cafe_brewlab.db")))
    answers.extend(compute_garage(_connect("garage_autocare.db")))
    answers.extend(compute_pharmacy(_connect("pharmacy_medplus.db")))

    questions = load_questions()
    qmap = {q["id"]: q for q in questions}
    for a in answers:
        q = qmap.get(a["question_id"], {})
        a["question"] = q.get("question", "")
        a["difficulty"] = q.get("difficulty", 0)
        a["answer_type"] = q.get("answer_type", "text")
        a["tolerance"] = q.get("tolerance", 0.01)

    payload = {"version": "1.0", "answers": answers, "questions": questions}
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return payload


if __name__ == "__main__":
    main()
