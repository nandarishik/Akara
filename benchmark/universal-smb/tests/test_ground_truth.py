"""Ground truth stability tests."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

CANONICAL = ROOT / "canonical"
ANSWERS = ROOT / "ground_truth" / "answers.json"


@pytest.fixture(scope="module")
def ensure_data():
    if not (CANONICAL / "cafe_brewlab.db").exists():
        from generator.cafe.generate import run as run_cafe
        from generator.garage.generate import run as run_garage
        from generator.pharmacy.generate import run as run_pharmacy

        CANONICAL.mkdir(parents=True, exist_ok=True)
        run_cafe(CANONICAL / "cafe_brewlab.db", ROOT / "datasets" / "cafe_brewlab")
        run_garage(CANONICAL / "garage_autocare.db", ROOT / "datasets" / "garage_autocare")
        run_pharmacy(CANONICAL / "pharmacy_medplus.db", ROOT / "datasets" / "pharmacy_medplus")
        from ground_truth.compute import main as compute_gt

        compute_gt()


def test_all_questions_have_answers(ensure_data) -> None:
    payload = json.loads(ANSWERS.read_text(encoding="utf-8"))
    assert len(payload["answers"]) == 30
    ids = {a["question_id"] for a in payload["answers"]}
    assert len(ids) == 30


def test_cafe_q01_positive(ensure_data) -> None:
    payload = json.loads(ANSWERS.read_text(encoding="utf-8"))
    q01 = next(a for a in payload["answers"] if a["question_id"] == "cafe_q01")
    assert q01["answer"] > 0
    assert q01["unit"] == "INR"


def test_regenerate_matches_committed(ensure_data) -> None:
    from ground_truth.compute import main as compute_gt

    before = json.loads(ANSWERS.read_text(encoding="utf-8"))
    after = compute_gt()
    before_map = {a["question_id"]: a["answer"] for a in before["answers"]}
    for a in after["answers"]:
        assert a["question_id"] in before_map
        assert a["answer"] == before_map[a["question_id"]]


def test_dataset_files_exist(ensure_data) -> None:
    expected = [
        ROOT / "datasets" / "cafe_brewlab" / "BrewLab_Sales_Report_Jan-Jun2026.xlsx",
        ROOT / "datasets" / "garage_autocare" / "service_invoices.xlsx",
        ROOT / "datasets" / "pharmacy_medplus" / "retail_sales_register.csv",
    ]
    for p in expected:
        assert p.exists(), f"Missing {p}"
        assert p.stat().st_size > 100
