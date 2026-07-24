"""Tests for PII redaction before LLM calls."""

from app.services.copilot.pii_redactor import redact, redact_row


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
