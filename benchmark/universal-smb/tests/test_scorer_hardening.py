"""Scorer regression tests."""

from harness.scorer import score_answer, score_numeric, score_text


def test_score_numeric_ignores_year() -> None:
    passed, parsed = score_numeric(544633.06, "Total dine-in revenue in March 2026 was ₹544,633.06.", 0.01)
    assert passed is True
    assert parsed == 544633.06


def test_score_text_requires_numbers_when_expected_has_numbers() -> None:
    passed, _ = score_text("parts=71.4%, labour=28.6%", "0% labour 0% parts", ["labour", "parts"])
    assert passed is False


def test_score_text_passes_with_matching_percentages() -> None:
    passed, _ = score_text(
        "parts=71.4%, labour=28.6%",
        "Parts are 71.4% and labour is 28.6% of lines",
        ["labour", "parts"],
    )
    assert passed is True


def test_garage_q10_style_billed_approved() -> None:
    ground = {"question_id": "garage_q10", "answer": "billed=424525.65, approved=360846.8"}
    question = {"answer_type": "text", "rubric_keywords": ["approved", "billed"], "difficulty": 10}
    scored = score_answer(ground, "approved ₹0 billed ₹0", question)
    assert scored["passed"] is False
