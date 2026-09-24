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
