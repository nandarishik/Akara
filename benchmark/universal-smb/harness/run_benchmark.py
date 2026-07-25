"""End-to-end benchmark orchestrator."""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import datetime, UTC
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from harness.copilot_runner import run_copilot_phase
from harness.import_runner import load_manifest, run_imports
from harness.parser_metrics import evaluate_manifest_import_files, summarize_parser_results
from harness.report import build_scorecard, write_report


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Akara SMB benchmark harness")
    parser.add_argument("--base-url", default=os.environ.get("BENCHMARK_BASE_URL", "http://localhost:8000"))
    parser.add_argument("--token", default=os.environ.get("BENCHMARK_JWT", ""))
    parser.add_argument("--parser-only", action="store_true", help="Skip API import/copilot; parse files locally")
    parser.add_argument("--skip-copilot", action="store_true")
    args = parser.parse_args()

    manifest = load_manifest()
    parser_results = summarize_parser_results(evaluate_manifest_import_files())

    if args.parser_only:
        metrics = evaluate_manifest_import_files()
        parser_summary = summarize_parser_results(metrics)
        scorecard = build_scorecard({"businesses": {}}, None, parser_summary)
        ts = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
        write_report(scorecard, ROOT / "reports" / ts)
        print(f"Parser-only report: reports/{ts}/scorecard.md")
        print(f"Parse success: {parser_summary['parse_success_rate']*100:.1f}%")
        return

    import_results = asyncio.run(
        run_imports(args.base_url, args.token, parser_only=False)
    )

    copilot_results = None
    if not args.skip_copilot and args.token:
        tokens = {
            "cafe_brewlab": os.environ.get("BENCHMARK_CAFE_JWT", args.token),
            "garage_autocare": os.environ.get("BENCHMARK_GARAGE_JWT", args.token),
            "pharmacy_medplus": os.environ.get("BENCHMARK_PHARMACY_JWT", args.token),
            "default": args.token,
        }
        copilot_results = asyncio.run(run_copilot_phase(args.base_url, tokens))

    parser_summary = summarize_parser_results(evaluate_manifest_import_files())
    scorecard = build_scorecard(import_results, copilot_results, parser_summary)
    ts = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    json_path, md_path = write_report(scorecard, ROOT / "reports" / ts)
    print(f"Report written: {md_path}")


if __name__ == "__main__":
    main()
