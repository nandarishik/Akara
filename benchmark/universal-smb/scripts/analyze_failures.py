"""Analyze failure reasons from latest benchmark JSON."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def classify(q: dict) -> str:
    sql = " ".join(q.get("sql_queries") or []).lower()
    resp = (q.get("response") or "").lower()
    diff = q.get("difficulty", 0)

    if diff >= 7:
        if "tenant_companion_data" not in sql:
            if any(x in resp for x in ("no data", "unavailable", "cannot", "insufficient", "missing")):
                return "cross_file_no_companion_sql"
            return "cross_file_wrong_sql"
        if "group by" in sql and "aggregate" in resp:
            return "cross_file_sql_error"
        return "cross_file_wrong_logic"

    if "product_category" in sql and "route" not in sql:
        return "wrong_column_product_category"
    if "count(*)" in sql and "distinct" not in sql:
        return "count_lines_not_invoices"
    if "party_name" in sql and any(x in (q.get("question") or "").lower() for x in ("swiggy", "zomato", "otc", "insurance")):
        return "channel_on_party_not_route"
    if q.get("parsed") is not None and q.get("expected") is not None:
        try:
            exp = float(q["expected"]) if q.get("answer_type") != "integer" else float(int(q["expected"]))
            parsed = float(q["parsed"])
            if exp != 0 and abs(parsed - exp) / abs(exp) < 0.05:
                return "close_but_outside_tolerance"
        except (TypeError, ValueError):
            pass
    if q.get("parsed") in (0, 0.0) or (isinstance(q.get("parsed"), float) and q.get("parsed") == 0):
        return "zero_or_empty_result"
    if q.get("answer_type") == "text":
        return "text_rubric_or_numbers_mismatch"
    return "wrong_sql_or_logic"


def main() -> None:
    path = ROOT / "results" / "production_benchmark_latest.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    from collections import Counter

    reasons: Counter = Counter()
    details = []

    for t in data["tenants"]:
        for q in t["questions"]:
            if q["passed"]:
                continue
            reason = classify(q)
            reasons[reason] += 1
            details.append(
                {
                    "id": q["question_id"],
                    "reason": reason,
                    "expected": q.get("expected"),
                    "parsed": q.get("parsed"),
                    "sql_snip": (q.get("sql_queries") or [""])[0][:200],
                }
            )

    out = ROOT / "results" / "failure_analysis.txt"
    lines = ["FAILURE REASON COUNTS", "====================="]
    for r, c in reasons.most_common():
        lines.append(f"{c:2d}  {r}")
    lines.append("")
    lines.append("BY QUESTION")
    lines.append("===========")
    for d in sorted(details, key=lambda x: x["id"]):
        lines.append(f"{d['id']}: {d['reason']}")
        lines.append(f"  exp={d['expected']} parsed={d['parsed']}")
        if d["sql_snip"]:
            lines.append(f"  sql={d['sql_snip'][:180]}")
        lines.append("")

    out.write_text("\n".join(lines), encoding="utf-8")
    print(out.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
