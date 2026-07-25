"""Compare two production benchmark JSON files."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def qmap(data: dict) -> dict:
    m = {}
    for t in data["tenants"]:
        for q in t["questions"]:
            m[q["question_id"]] = {
                "passed": q["passed"],
                "parsed": q.get("parsed"),
                "expected": q.get("expected"),
            }
    return m


def main() -> None:
    old_path = ROOT / "results" / "production_benchmark_20260725_075601.json"
    new_path = ROOT / "results" / "production_benchmark_20260725_084906.json"
    old = json.loads(old_path.read_text(encoding="utf-8"))
    new = json.loads(new_path.read_text(encoding="utf-8"))
    o, n = qmap(old), qmap(new)

    print("BEFORE passed:", sorted(k for k, v in o.items() if v["passed"]))
    print("AFTER  passed:", sorted(k for k, v in n.items() if v["passed"]))
    print("Gained:", sorted(k for k in o if not o[k]["passed"] and n[k]["passed"]))
    print("Lost:", sorted(k for k in o if o[k]["passed"] and not n[k]["passed"]))
    print("Summary old:", old.get("summary"))
    print("Summary new:", new.get("summary"))
    for qid in sorted(o.keys()):
        if o[qid]["passed"] != n[qid]["passed"]:
            print(
                f"  {qid}: {o[qid]['passed']} -> {n[qid]['passed']} "
                f"(exp={n[qid]['expected']}, parsed={n[qid]['parsed']})"
            )


if __name__ == "__main__":
    main()
