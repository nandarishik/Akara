from app.core.plan_limits import PLAN_LIMITS
from app.infra.catalog.plan_catalog_service import _static_plan


def test_plan_codes_match_catalog():
    assert set(PLAN_LIMITS) == {"free", "pro", "business"}
    for code in PLAN_LIMITS:
        static = _static_plan(code)
        assert _static_plan(code) is not None
        assert static["code"] == code
