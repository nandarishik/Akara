"""Cost-logger / CopilotResponse token field regression (DEV2).

Does not import DEV1's test_cost_logger.py.
"""

from app.domain.copilot.agent import CopilotResponse


def test_usage_attribute_is_not_the_token_source() -> None:
    result = CopilotResponse(question="q", intent="i", response="ok", tokens_used=0)
    broken = getattr(getattr(result, "usage", None), "prompt_tokens", 0) or 0
    assert broken == 0


def test_copilot_response_exposes_input_and_output_tokens() -> None:
    result = CopilotResponse(
        question="q",
        intent="i",
        response="ok",
        input_tokens=12,
        output_tokens=8,
    )
    assert result.input_tokens == 12
    assert result.output_tokens == 8
