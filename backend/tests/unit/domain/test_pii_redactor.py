"""Tests for PII redaction before LLM calls."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.domain.copilot.pii_redactor import redact, redact_row
from app.domain.copilot.planner import Planner


def test_redact_gst_number():
    text = "Party GST 27AABCU9603R1ZM paid invoice"
    result = redact(text)
    assert "27AABCU9603R1ZM" not in result
    assert "[GST_REDACTED]" in result


def test_redact_phone_and_email():
    text = "Call +919876543210 or email buyer@example.com"
    result = redact(text)
    assert "9876543210" not in result
    assert "buyer@example.com" not in result


def test_preserves_party_name():
    text = "Sharma Traders revenue increased"
    assert redact(text) == text


def test_redact_row_sensitive_columns():
    row = {"party_name": "Sharma Traders", "contact_number": "9876543210"}
    out = redact_row(row)
    assert out["party_name"] == "Sharma Traders"
    assert out["contact_number"] == "[REDACTED]"


@pytest.mark.asyncio
async def test_planner_redacts_pii_before_llm_call():
    gst = "27AABCU9603R1ZM"
    llm = MagicMock()
    llm.complete = AsyncMock(
        return_value='{"intent":"test","steps":[],"requires_context":[],"response_format":"summary"}'
    )
    planner = Planner(llm)
    question = f"What did party with GST {gst} buy?"
    schema = f"Sample row gst_number={gst}"

    await planner.plan(
        question=question,
        schema_context=schema,
        date_range=("2024-01-01", "2024-01-31"),
    )

    prompt = llm.complete.call_args.kwargs["prompt"]
    assert gst not in prompt
    assert "[GST_REDACTED]" in prompt
