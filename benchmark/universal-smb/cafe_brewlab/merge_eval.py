#!/usr/bin/env python3
"""Optional join of questions.yaml + expected_outputs.yaml for Promptfoo.

DEV2 owns this helper. Does not modify expected_outputs.yaml.
Emits combined tests YAML to stdout when both files exist.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def _parse_simple_yaml_list(text: str) -> list[dict[str, object]]:
    """Minimal list-of-maps parser for our frozen schemas (no nested maps)."""
    items: list[dict[str, object]] = []
    current: dict[str, object] | None = None
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line.strip() or line.strip().startswith("#"):
            continue
        if line.startswith("- "):
            if current:
                items.append(current)
            current = {}
            rest = line[2:]
            if ":" in rest:
                k, v = rest.split(":", 1)
                current[k.strip()] = v.strip().strip('"').strip("'")
            continue
        if current is None:
            continue
        if line.startswith("  tags:"):
            current["tags"] = []
            continue
        if line.startswith("    - ") and isinstance(current.get("tags"), list):
            current["tags"].append(line.strip()[2:].strip())
            continue
        if line.startswith("  ") and ":" in line:
            k, v = line.strip().split(":", 1)
            current[k.strip()] = v.strip().strip('"').strip("'")
    if current:
        items.append(current)
    return items


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--questions", default="questions.yaml")
    p.add_argument("--expected", default="expected_outputs.yaml")
    args = p.parse_args()
    q_path = Path(args.questions)
    e_path = Path(args.expected)
    if not q_path.is_file():
        print(f"missing {q_path}", file=sys.stderr)
        return 1
    questions = _parse_simple_yaml_list(q_path.read_text(encoding="utf-8"))
    expected_by_id: dict[str, dict[str, object]] = {}
    if e_path.is_file():
        for row in _parse_simple_yaml_list(e_path.read_text(encoding="utf-8")):
            rid = str(row.get("id", ""))
            if rid:
                expected_by_id[rid] = row
    for q in questions:
        eid = str(q.get("id", ""))
        exp = expected_by_id.get(eid, {})
        fact = exp.get("expected_fact", "")
        print(f"- id: {eid}")
        print(f"  category: {q.get('category', '')}")
        print(f"  question: \"{q.get('question', '')}\"")
        if fact:
            print(f"  expected_fact: \"{fact}\"")
        print("  vars:")
        print(f"    question: \"{q.get('question', '')}\"")
        if fact:
            print(f"    expected_fact: \"{fact}\"")
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
