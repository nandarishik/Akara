import pandas as pd

from app.domain.intelligence.playbooks.delivery_margins import analyse_delivery_margins


def test_negative_swiggy_margin() -> None:
    orders = pd.DataFrame(
        [
            {
                "item_id": "tea",
                "platform": "swiggy",
                "quantity": 10,
                "unit_price": 40,
                "food_cost": 35,
            }
        ]
    )
    rows = analyse_delivery_margins(orders)
    assert rows
    assert rows[0]["delivery_margin"] < 0
