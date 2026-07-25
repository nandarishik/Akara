"""Tests for benchmark answer scorer."""

from harness.scorer import score_answer, score_numeric, score_list


def test_score_numeric_within_tolerance() -> None:
    ok, _ = score_numeric(1000.0, "Total revenue was ₹1,010.50", 0.02)
    assert ok


def test_score_list_top_products() -> None:
    ok, f1 = score_list(["Latte", "Cappuccino"], "Top items: Latte, Cappuccino, Espresso")
    assert ok
    assert f1 >= 0.8


def test_score_answer_currency() -> None:
    ground = {"question_id": "test", "answer": 544633.06, "answer_type": "currency"}
    question = {"answer_type": "currency", "tolerance": 0.01}
    result = score_answer(ground, "March dine-in revenue was ₹544633", question)
    assert result["passed"]
