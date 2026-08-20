"""Founder ops context and brief smoke tests."""

from unittest.mock import patch

from app.domain.superadmin.ops_context import ops_context_prompt
from app.workers.founder_brief import generate_founder_brief_text

_MOCK_CTX = {
    "mrr_inr": 7999,
    "arr_inr": 95988,
    "tenants_by_plan": {"free": 2, "pro": 1, "business": 0},
    "total_tenants": 3,
    "churned_this_month": 0,
    "llm_cost_usd_this_month": 0.5,
    "estimated_gross_margin_pct": 90,
    "quota_hotspots": [],
    "cron_failures": [],
    "copilot_feedback": {"positive": 1, "negative": 0},
}


def test_ops_context_prompt_contains_snapshot_keys():
    prompt = ops_context_prompt(_MOCK_CTX)
    assert "OPS_SNAPSHOT" in prompt
    assert "7999" in prompt


@patch("app.workers.founder_brief.build_ops_context", return_value=_MOCK_CTX)
def test_generate_founder_brief_text_format(_mock):
    text = generate_founder_brief_text()
    assert "MRR" in text
    assert "AKARA Founder Brief" in text
