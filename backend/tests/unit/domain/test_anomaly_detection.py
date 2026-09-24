from app.domain.intelligence.anomaly import detect_iforest


def test_insufficient_data() -> None:
    assert detect_iforest([1.0] * 10) is None


def test_injected_spike_is_outlier() -> None:
    values = [100.0] * 59 + [1000.0]
    result = detect_iforest(values)
    assert result is not None
    assert result["is_outlier"] is True
