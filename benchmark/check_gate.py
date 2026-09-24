#!/usr/bin/env python3
"""Exit 0 if Promptfoo result accuracy >= threshold; else exit 1. Stdlib only."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Café copilot eval gate (≥75%)")
    parser.add_argument("--result", required=True, help="Promptfoo JSON result path")
    parser.add_argument("--threshold", type=float, default=75.0)
    args = parser.parse_args()

    path = Path(args.result)
    if not path.is_file():
        print(f"ERROR: result file not found: {path}", file=sys.stderr)
        return 1

    data = json.loads(path.read_text(encoding="utf-8-sig"))
    stats = data.get("stats") or data.get("results", {}).get("stats") or {}
    successes = int(stats.get("successes", 0))
    failures = int(stats.get("failures", 0))
    total = successes + failures
    if total == 0:
        print("ERROR: no successes/failures in result stats", file=sys.stderr)
        return 1

    accuracy = successes / total * 100.0
    print(f"accuracy={accuracy:.1f}% ({successes}/{total}) threshold={args.threshold}")
    if accuracy < args.threshold:
        print("GATE FAIL", file=sys.stderr)
        return 1
    print("GATE PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
