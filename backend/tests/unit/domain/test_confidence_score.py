from pydantic import ValidationError

from app.domain.intelligence.confidence import compute_confidence
from app.domain.intelligence.schemas import LLMRecommendationDraft


def test_fourteen_days_below_half() -> None:
    assert compute_confidence(14, 0.2, 0) < 0.5


def test_ninety_days_high_confidence() -> None:
    assert compute_confidence(90, 0.0, 0) >= 0.7


def test_extra_forbid() -> None:
    try:
        LLMRecommendationDraft(title="t", description="d", auto_apply=True)  # type: ignore[arg-type]
        raise AssertionError("should forbid extra")
    except ValidationError:
        pass
