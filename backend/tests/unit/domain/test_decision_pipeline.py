import asyncio

import pandas as pd

from app.domain.intelligence.analyst_agent import run_analyst
from app.domain.intelligence.decision_agent import generate_candidate_recommendations


def test_analyst_and_decision_on_fixture() -> None:
    frames = {
        "orders": pd.DataFrame(
            [
                {
                    "item_id": "brew",
                    "item_name": "Cold Brew",
                    "quantity": 20,
                    "revenue": 2000,
                    "food_cost": 960,
                    "order_date": "2026-09-01",
                    "platform": "direct",
                }
            ]
        ),
        "menu": pd.DataFrame(
            [
                {
                    "id": "brew",
                    "item_name": "Cold Brew",
                    "category": "bev",
                    "current_selling_price": 100,
                    "current_cost_price": 48,
                    "historical_cost": 30,
                    "price_last_changed_days": 45,
                    "gst_category": "restaurant_ac",
                    "annual_revenue": 10000,
                }
            ]
        ),
        "weather": {"is_rainy": True, "temp_max_c": 28},
        "festivals": [],
        "data_days": 45,
    }
    report = run_analyst(frames)
    assert report.leak_detections
    recs = asyncio.run(generate_candidate_recommendations(report, complete=None))
    assert recs
    assert all(r.confidence_score <= 1.0 for r in recs)
    assert all("auto_execute" not in r.title for r in recs)


def test_analyst_empty() -> None:
    report = run_analyst({})
    assert report.kasavana_smith_matrix == []


def test_collect_for_tenant_filters_tenant_owned_tables() -> None:
    from uuid import UUID

    from app.domain.intelligence.data_collector import collect_for_tenant

    tid = UUID("22222222-2222-2222-2222-222222222222")
    log: list[tuple[str, str, str]] = []

    class FakeQuery:
        def __init__(self, name: str) -> None:
            self.name = name

        def select(self, *_a, **_k):
            return self

        def eq(self, key: str, value: str):
            log.append((self.name, key, str(value)))
            return self

        def gte(self, *_a, **_k):
            return self

        def lte(self, *_a, **_k):
            return self

        def in_(self, *_a, **_k):
            return self

        def execute(self):
            return type("R", (), {"data": []})()

    class FakeClient:
        def table(self, name: str) -> FakeQuery:
            return FakeQuery(name)

    collect_for_tenant(tid, client=FakeClient())
    tenanted = {name for name, key, _ in log if key == "tenant_id"}
    assert "canonical_orders" in tenanted
    assert "menu_items" in tenanted
    assert "forecasts" in tenanted
    assert "alert_anomalies" in tenanted
    assert all(value == str(tid) for _n, key, value in log if key == "tenant_id")
    assert "festival_calendar" not in tenanted
    assert "weather_cache" not in tenanted
