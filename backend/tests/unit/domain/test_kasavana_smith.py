import pandas as pd

from app.domain.intelligence.playbooks.kasavana_smith import (
    compute_kasavana_smith_matrix,
)


def test_classifies_four_quadrants() -> None:
    orders = pd.DataFrame(
        [
            {"item_id": "star", "item_name": "Star Latte", "quantity": 40, "revenue": 8000, "food_cost": 800},
            {"item_id": "plow", "item_name": "Plow Coffee", "quantity": 40, "revenue": 4000, "food_cost": 2800},
            {"item_id": "puzzle", "item_name": "Puzzle Cake", "quantity": 5, "revenue": 2500, "food_cost": 200},
            {"item_id": "dog", "item_name": "Dog Cookie", "quantity": 5, "revenue": 200, "food_cost": 180},
        ]
    )
    menu = pd.DataFrame(
        [
            {"id": "star", "item_name": "Star Latte", "category": "bev", "current_selling_price": 200, "current_cost_price": 20},
            {"id": "plow", "item_name": "Plow Coffee", "category": "bev", "current_selling_price": 100, "current_cost_price": 70},
            {"id": "puzzle", "item_name": "Puzzle Cake", "category": "food", "current_selling_price": 500, "current_cost_price": 40},
            {"id": "dog", "item_name": "Dog Cookie", "category": "food", "current_selling_price": 40, "current_cost_price": 36},
        ]
    )
    result = {i.item_id: i.quadrant for i in compute_kasavana_smith_matrix(orders, menu)}
    assert result["star"] == "star"
    assert result["plow"] == "plowhorse"
    assert result["puzzle"] == "puzzle"
    assert result["dog"] == "dog"


def test_empty_orders() -> None:
    assert compute_kasavana_smith_matrix(pd.DataFrame(), pd.DataFrame()) == []
