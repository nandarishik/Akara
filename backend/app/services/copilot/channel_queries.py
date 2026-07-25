"""Deterministic SQL templates for channel, count, and visit analytics."""

import re

from app.services.schema.columns import COL_DATE, COL_INVOICE, SALES_DATA_TABLE

_CHANNEL_KEYWORDS: dict[str, str] = {
    "swiggy": "swiggy",
    "zomato": "zomato",
    "dine-in": "dine-in",
    "dine in": "dine-in",
    "takeaway": "takeaway",
    "delivery": "delivery",
    "otc": "otc",
    "insurance": "insurance",
    "cash": "cash",
}


def detect_channel(question: str) -> str | None:
    q = question.lower()
    for phrase, route_val in _CHANNEL_KEYWORDS.items():
        if phrase in q:
            return route_val
    return None


def channel_order_count_sql(route_value: str) -> str:
    return (
        f"SELECT COUNT(DISTINCT {COL_INVOICE}) AS order_count "
        f"FROM {SALES_DATA_TABLE} "
        f"WHERE tenant_id = :tenant_id "
        f"AND {COL_DATE} BETWEEN :start_date AND :end_date "
        f"AND route ILIKE '%{route_value}%'"
    )


def channel_revenue_sql(route_value: str, amount_col: str = "net_amount") -> str:
    return (
        f"SELECT SUM({amount_col}) AS total_revenue "
        f"FROM {SALES_DATA_TABLE} "
        f"WHERE tenant_id = :tenant_id "
        f"AND {COL_DATE} BETWEEN :start_date AND :end_date "
        f"AND route ILIKE '%{route_value}%'"
    )


def repeat_customer_count_sql(threshold: int) -> str:
    return (
        f"SELECT COUNT(*) AS customer_count FROM ("
        f"SELECT party_name FROM {SALES_DATA_TABLE} "
        f"WHERE tenant_id = :tenant_id "
        f"AND {COL_DATE} BETWEEN :start_date AND :end_date "
        f"GROUP BY party_name "
        f"HAVING COUNT(DISTINCT {COL_INVOICE}) > {threshold}"
        f") AS frequent"
    )


def product_group_filter_sql(group_keyword: str, limit: int = 5) -> str:
    return (
        f"SELECT product_name, SUM(net_amount) AS total_revenue "
        f"FROM {SALES_DATA_TABLE} "
        f"WHERE tenant_id = :tenant_id "
        f"AND {COL_DATE} BETWEEN :start_date AND :end_date "
        f"AND product_group ILIKE '%{group_keyword}%' "
        f"GROUP BY product_name "
        f"ORDER BY total_revenue DESC "
        f"LIMIT {limit}"
    )


def parse_visit_threshold(question: str) -> int | None:
    m = re.search(r"more than (\d+)", question.lower())
    if m:
        return int(m.group(1))
    return None


def match_channel_count_plan(question: str) -> str | None:
    q = question.lower()
    if not any(w in q for w in ("how many", "count", "number of")):
        return None
    if not any(w in q for w in ("order", "bill", "job", "invoice", "visit")):
        return None
    channel = detect_channel(question)
    if channel:
        return channel_order_count_sql(channel)
    return None


def match_channel_revenue_plan(question: str) -> str | None:
    q = question.lower()
    if not any(w in q for w in ("revenue", "sales")):
        return None
    channel = detect_channel(question)
    if channel:
        return channel_revenue_sql(channel)
    return None


def match_repeat_customer_plan(question: str) -> str | None:
    q = question.lower()
    if not any(w in q for w in ("customer", "patient", "visit", "purchase")):
        return None
    threshold = parse_visit_threshold(question)
    if threshold is not None:
        return repeat_customer_count_sql(threshold)
    return None
