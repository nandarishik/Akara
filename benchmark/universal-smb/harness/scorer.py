"""Score copilot responses against ground truth."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


def _parse_number(text: str) -> float | None:
    cleaned = re.sub(r"[₹,\s]", "", str(text))
    # Prefer numbers with decimals or large magnitudes (avoid year 2026)
    candidates = re.findall(r"-?\d+\.?\d*", cleaned)
    best: float | None = None
    for c in candidates:
        try:
            val = float(c)
        except ValueError:
            continue
        if 1900 <= val <= 2100 and "." not in c:
            continue
        if best is None or abs(val) > abs(best):
            best = val
    return best


def _parse_numbers_from_text(text: str) -> list[float]:
    nums: list[float] = []
    for m in re.finditer(r"-?\d+\.?\d*", text.replace(",", "")):
        try:
            val = float(m.group())
            if 1900 <= val <= 2100 and "." not in m.group():
                continue
            nums.append(val)
        except ValueError:
            pass
    return nums


def score_numeric(expected: float, response: str, tolerance: float) -> tuple[bool, float]:
    actual = _parse_number(response)
    if actual is None:
        return False, 0.0
    if expected == 0:
        ok = abs(actual) < 0.01
    else:
        ok = abs(actual - expected) / abs(expected) <= tolerance
    return ok, actual


def score_list(expected: list[str], response: str) -> tuple[bool, float]:
    if not expected:
        return True, 1.0
    hits = sum(1 for item in expected if item.lower() in response.lower())
    f1 = hits / len(expected)
    return f1 >= 0.8, f1


def score_text(expected: str, response: str, keywords: list[str] | None = None) -> tuple[bool, float]:
    expected_nums = _parse_numbers_from_text(expected)
    response_nums = _parse_numbers_from_text(response)

    if expected_nums and response_nums:
        matches = 0
        for exp in expected_nums:
            for resp in response_nums:
                if exp == 0 and abs(resp) < 0.01:
                    matches += 1
                    break
                if exp != 0 and abs(resp - exp) / abs(exp) <= 0.05:
                    matches += 1
                    break
        if matches >= max(1, len(expected_nums) // 2):
            return True, matches / len(expected_nums)

    if keywords:
        hits = sum(1 for k in keywords if k.lower() in response.lower())
        score = hits / len(keywords)
        return score >= 0.5 and expected.lower() in response.lower(), score
    return expected.lower() in response.lower(), 1.0 if expected.lower() in response.lower() else 0.0


def score_answer(
    ground: dict[str, Any],
    response: str,
    question: dict[str, Any],
) -> dict[str, Any]:
    answer_type = question.get("answer_type", ground.get("answer_type", "text"))
    expected = ground["answer"]
    tolerance = question.get("tolerance", ground.get("tolerance", 0.01))
    passed = False
    score = 0.0
    parsed: Any = None

    if answer_type in ("currency", "percent", "integer"):
        exp = float(expected) if answer_type != "integer" else float(int(expected))
        passed, parsed = score_numeric(exp, response, tolerance)
        score = 1.0 if passed else 0.0
    elif answer_type == "list":
        passed, score = score_list(expected if isinstance(expected, list) else [], response)
    else:
        passed, score = score_text(str(expected), response, question.get("rubric_keywords"))

    return {
        "question_id": ground["question_id"],
        "passed": passed,
        "score": score,
        "expected": expected,
        "parsed": parsed,
        "difficulty": question.get("difficulty", 0),
        "cross_file": question.get("difficulty", 0) >= 7,
    }


def load_ground_truth(path: Path | None = None) -> dict[str, Any]:
    root = Path(__file__).resolve().parents[1]
    p = path or root / "ground_truth" / "answers.json"
    return json.loads(p.read_text(encoding="utf-8"))
