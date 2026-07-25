"""SQL pattern tests for copilot channel templates (no LLM)."""

from app.services.copilot.channel_queries import (
    channel_order_count_sql,
    channel_revenue_sql,
    match_channel_count_plan,
    match_channel_revenue_plan,
    match_repeat_customer_plan,
    repeat_customer_count_sql,
)


def test_channel_order_count_sql() -> None:
    sql = channel_order_count_sql("swiggy")
    assert "COUNT(DISTINCT invoice_number)" in sql
    assert "route ILIKE" in sql
    assert "product_category" not in sql


def test_channel_revenue_sql() -> None:
    sql = channel_revenue_sql("dine-in")
    assert "route ILIKE" in sql
    assert "net_amount" in sql


def test_repeat_customer_sql() -> None:
    sql = repeat_customer_count_sql(3)
    assert "COUNT(DISTINCT invoice_number)" in sql
    assert "> 3" in sql


def test_match_swiggy_orders() -> None:
    q = "How many Swiggy orders were there in February 2026?"
    assert match_channel_count_plan(q) is not None


def test_match_dine_in_revenue() -> None:
    q = "What was total dine-in revenue in March 2026?"
    assert match_channel_revenue_plan(q) is not None


def test_match_repeat_visits() -> None:
    q = "How many customers visited more than 3 times during the six-month period?"
    sql = match_repeat_customer_plan(q)
    assert sql is not None
    assert "DISTINCT" in sql


def test_no_final_bill_in_templates() -> None:
    for fn in (channel_order_count_sql, channel_revenue_sql, repeat_customer_count_sql):
        sql = fn("test") if fn != repeat_customer_count_sql else fn(2)
        assert "final_bill" not in sql
