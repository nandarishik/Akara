"""Generate benchmark scorecard reports."""

from __future__ import annotations

import json
from datetime import datetime, UTC
from pathlib import Path
from typing import Any


def build_scorecard(
    import_results: dict[str, Any],
    copilot_results: list[dict[str, Any]] | None,
    parser_results: dict[str, Any] | None = None,
) -> dict[str, Any]:
    import_total = 0
    import_ok = 0
    for biz_results in import_results.get("businesses", {}).values():
        for r in biz_results:
            import_total += 1
            if r.get("success"):
                import_ok += 1
    ingestion_score = import_ok / import_total if import_total else 0.0

    copilot_score = 0.0
    cross_score = 0.0
    cross_n = 0
    cross_ok = 0
    answer_n = 0
    answer_ok = 0

    if copilot_results:
        for r in copilot_results:
            if r.get("skipped"):
                continue
            answer_n += 1
            if r.get("passed"):
                answer_ok += 1
            if r.get("cross_file") or r.get("difficulty", 0) >= 7:
                cross_n += 1
                if r.get("passed"):
                    cross_ok += 1
        copilot_score = answer_ok / answer_n if answer_n else 0.0
        cross_score = cross_ok / cross_n if cross_n else 0.0

    weights = {"ingestion": 0.30, "normalization": 0.20, "copilot_answers": 0.40, "cross_file": 0.10}
    if parser_results and "avg_required_recovery" in parser_results:
        normalization_score = float(parser_results["avg_required_recovery"])
        if not import_total and parser_results.get("parse_success_rate") is not None:
            ingestion_score = float(parser_results["parse_success_rate"])
    else:
        normalization_score = ingestion_score
    overall = (
        ingestion_score * weights["ingestion"]
        + normalization_score * weights["normalization"]
        + copilot_score * weights["copilot_answers"]
        + cross_score * weights["cross_file"]
    )

    return {
        "timestamp": datetime.now(UTC).isoformat(),
        "scores": {
            "ingestion": round(ingestion_score, 4),
            "normalization": round(normalization_score, 4),
            "copilot_answers": round(copilot_score, 4),
            "cross_file": round(cross_score, 4),
            "overall": round(overall, 4),
        },
        "counts": {
            "import_total": import_total,
            "import_ok": import_ok,
            "questions_total": answer_n,
            "questions_passed": answer_ok,
            "cross_file_total": cross_n,
            "cross_file_passed": cross_ok,
        },
        "import_results": import_results,
        "copilot_results": copilot_results,
        "parser_results": parser_results,
    }


def write_report(scorecard: dict[str, Any], out_dir: Path) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / "results.json"
    md_path = out_dir / "scorecard.md"
    json_path.write_text(json.dumps(scorecard, indent=2), encoding="utf-8")

    s = scorecard["scores"]
    c = scorecard["counts"]
    md = f"""# Akara SMB Benchmark Scorecard

Generated: {scorecard["timestamp"]}

## Overall: {s["overall"]*100:.1f}%

| Layer | Score |
|-------|-------|
| Ingestion | {s["ingestion"]*100:.1f}% ({c["import_ok"]}/{c["import_total"]} files) |
| Normalization | {s["normalization"]*100:.1f}% |
| Copilot answers | {s["copilot_answers"]*100:.1f}% ({c["questions_passed"]}/{c["questions_total"]}) |
| Cross-file (Q7+) | {s["cross_file"]*100:.1f}% ({c["cross_file_passed"]}/{c["cross_file_total"]}) |
"""
    pr = scorecard.get("parser_results")
    if pr:
        md += f"""
## Parser metrics (industry-agnostic import)

| Metric | Value |
|--------|-------|
| Parse success rate | {pr.get('parse_success_rate', 0)*100:.1f}% |
| Required column recovery | {pr.get('avg_required_recovery', 0)*100:.1f}% |
| Optional column recovery | {pr.get('avg_optional_recovery', 0)*100:.1f}% |
| Total rows parsed | {pr.get('total_rows_parsed', 0):,} |
"""
    md_path.write_text(md, encoding="utf-8")
    return json_path, md_path
