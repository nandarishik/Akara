from app.domain.intelligence.outcome import calibrate_weight, measure_outcome


def test_overprediction_reduces_weight() -> None:
    nxt = calibrate_weight(1.0, 100.0, 50.0, alpha=0.3)
    assert nxt is not None
    assert nxt < 1.0


def test_skip_non_positive_predicted() -> None:
    assert calibrate_weight(1.0, 0.0, 10.0) is None


def test_statistical_note_present() -> None:
    out = measure_outcome(1000, 18200, 10000)
    assert "No control group" in out["statistical_note"]
