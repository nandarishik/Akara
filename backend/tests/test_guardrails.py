from app.services.copilot.guardrails.checks import (
    causal_postcheck,
    numeric_postcheck,
    premise_check,
)
from app.services.copilot.channel_queries import (
    channel_order_count_sql,
    match_channel_count_plan,
)


def test_numeric_postcheck_passes_normal() -> None:
    result = numeric_postcheck("Revenue was ₹50,000 yesterday")
    assert result.passed is True


def test_numeric_postcheck_fails_huge_number() -> None:
    result = numeric_postcheck("Revenue was 99999999999 billion units")
    assert result.passed is False


def test_causal_postcheck_fails_on_causal_claim() -> None:
    result = causal_postcheck(
        "The discount caused by the season resulted in higher sales"
    )
    assert result.passed is False


def test_premise_check_passes_with_allowed_terms() -> None:
    cols = ["invoice_date", "party_name", "total_amount", "route"]
    result = premise_check(
        "How many Swiggy orders were there in February 2026?",
        cols,
        allowed_terms=["swiggy", "dine-in"],
    )
    assert result.passed is True


def test_premise_check_passes_normal_question() -> None:
    cols = ["invoice_date", "party_name", "total_amount", "product_name"]
    result = premise_check("What are my top products by revenue last month?", cols)
    assert result.passed is True


def test_channel_count_sql_uses_distinct_invoice() -> None:
    sql = channel_order_count_sql("swiggy")
    assert "COUNT(DISTINCT invoice_number)" in sql
    assert "route ILIKE" in sql


def test_match_channel_count_plan() -> None:
    sql = match_channel_count_plan("How many Swiggy orders were there in February 2026?")
    assert sql is not None
    assert "COUNT(DISTINCT" in sql
