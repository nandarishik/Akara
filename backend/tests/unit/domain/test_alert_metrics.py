from app.domain.intelligence.alert_metrics import skip_reason_for_metric


def test_legacy_fmcg_skipped() -> None:
    assert skip_reason_for_metric("secondary_sales_total") == "legacy_fmcg_metric"


def test_cafe_metric_ok() -> None:
    assert skip_reason_for_metric("revenue_below_threshold") is None
