from app.services.copilot.guardrails.checks import (
    causal_postcheck,
    numeric_postcheck,
    premise_check,
)


def test_numeric_postcheck_passes_normal() -> None:
    result = numeric_postcheck("Revenue was ₹50,000 yesterday")
    assert result.passed is True


def test_numeric_postcheck_fails_huge_number() -> None:
    result = numeric_postcheck("Revenue was 99999999999 billion units")
    assert result.passed is False
    assert "large number" in result.message.lower()


def test_causal_postcheck_fails_on_causal_claim() -> None:
    result = causal_postcheck(
        "The discount caused by the season resulted in higher sales"
    )
    assert result.passed is False


def test_causal_postcheck_passes_on_correlation() -> None:
    result = causal_postcheck(
        "Sales were higher, which is associated with the festive season"
    )
    assert result.passed is True


def test_premise_check_passes_normal_question() -> None:
    cols = ["invoice_date", "party_name", "total_amount", "product_name"]
    result = premise_check("What are my top products by revenue last month?", cols)
    assert result.passed is True
