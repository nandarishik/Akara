import pandas as pd

from app.domain.intelligence.playbooks.gst import (
    GST_DISCLAIMER,
    generate_gst_optimisations,
)


def test_gst_contains_consult_your_ca() -> None:
    menu = pd.DataFrame(
        [
            {
                "id": "pastry",
                "item_name": "Packaged pastry",
                "category": "bakery",
                "gst_category": "restaurant_ac",
                "annual_revenue": 100000,
            }
        ]
    )
    rows = generate_gst_optimisations(menu)
    assert rows
    assert all(GST_DISCLAIMER in r["disclaimer"] for r in rows)
    assert any("Consult your CA" in r["disclaimer"] for r in rows)
