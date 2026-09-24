import pandas as pd

from app.domain.intelligence.playbooks.repricing import generate_repricing_candidates


def test_reprice_capped_at_10_percent() -> None:
    menu = pd.DataFrame(
        [
            {
                "id": "brew",
                "item_name": "Cold Brew",
                "current_selling_price": 100,
                "current_cost_price": 36,
                "historical_cost": 30,
                "price_last_changed_days": 45,
            }
        ]
    )
    orders = pd.DataFrame([{"item_id": "brew", "quantity": 20}])
    cands = generate_repricing_candidates(menu, orders)
    assert cands
    assert cands[0]["price_increase_pct"] == 10
    assert cands[0]["suggested_price"] == 110
