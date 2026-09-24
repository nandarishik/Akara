from app.api.v1.alerts import METRIC_LABELS


def test_cafe_labels() -> None:
    assert METRIC_LABELS["revenue_below_threshold"].startswith("Daily revenue")
    assert "AI" in METRIC_LABELS["anomaly"]
