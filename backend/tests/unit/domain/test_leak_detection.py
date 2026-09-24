import pandas as pd

from app.domain.intelligence.playbooks.leaks import detect_leaks


def test_high_food_cost_48_percent() -> None:
    orders = pd.DataFrame(
        [
            {
                "item_id": "pricey",
                "item_name": "Pricey Wrap",
                "quantity": 20,
                "revenue": 1000,
                "food_cost": 480,
                "order_date": "2026-09-01",
            }
        ]
    )
    leaks = detect_leaks(orders, pd.DataFrame())
    assert leaks
    assert leaks[0].leak_type == "high_food_cost"


def test_biggest_leak_wins() -> None:
    orders = pd.DataFrame(
        [
            {
                "item_id": "a",
                "item_name": "A",
                "quantity": 100,
                "revenue": 1000,
                "food_cost": 600,
                "order_date": "2026-09-01",
            }
        ]
    )
    leaks = detect_leaks(orders, pd.DataFrame())
    assert len([x for x in leaks if x.item_id == "a"]) == 1
