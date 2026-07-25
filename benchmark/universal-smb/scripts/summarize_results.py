import json
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "results" / "production_benchmark_latest.json"
r = json.loads(p.read_text(encoding="utf-8"))
print("SUMMARY", r["summary"])
for t in r["tenants"]:
    print(f"\n=== {t['business']} ({t['email']}) {t['passed']}/{t['total']} ===")
    for imp in t["imports"]:
        print("  import", imp)
    for q in t["questions"]:
        status = "PASS" if q["passed"] else "FAIL"
        sql = (q.get("sql_queries") or [""])[0][:140] if q.get("sql_queries") else ""
        print(f"  [{status}] {q['question_id']}: expected={q['expected']} parsed={q.get('parsed')}")
        print(f"    Q: {q['question'][:80]}")
        if not q["passed"]:
            resp = q["response"][:180].replace("\n", " ")
            print(f"    R: {resp}")
            if sql:
                print(f"    SQL: {sql}")
