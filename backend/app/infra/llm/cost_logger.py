"""LLM cost logger — records token usage and USD cost after every LLM call.

Used by copilot.py, and will be reused by morning_brief, weekly_debrief,
schema_discovery in later days.

Usage:
    from app.infra.llm.cost_logger import log_llm_cost

    log_llm_cost(
        tenant_id=tenant.tenant_id,
        user_id=user.user_id,
        feature="copilot",
        model=settings.openrouter_model,
        input_tokens=123,
        output_tokens=456,
        latency_ms=320,
        request_id=request_id_header,
    )
"""

from __future__ import annotations

import logging
from uuid import UUID

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Token rate table (USD per 1M tokens, input / output)
# Update when OpenRouter pricing changes.
# Prices as of July 2026 via OpenRouter.
# ---------------------------------------------------------------------------
_TOKEN_RATES: dict[str, tuple[float, float]] = {
    # OpenRouter model slug → (input_per_1m_usd, output_per_1m_usd)
    "openai/gpt-4o-mini":                  (0.15,  0.60),
    "openai/gpt-4o-mini-2024-07-18":       (0.15,  0.60),
    "openai/gpt-4o":                       (2.50, 10.00),
    "openai/gpt-4o-2024-11-20":            (2.50, 10.00),
    "anthropic/claude-3-5-sonnet":         (3.00, 15.00),
    "anthropic/claude-3-5-sonnet-20241022":(3.00, 15.00),
    "anthropic/claude-3-haiku":            (0.25,  1.25),
    "anthropic/claude-3-haiku-20240307":   (0.25,  1.25),
    "google/gemini-flash-1.5":             (0.075, 0.30),
    "meta-llama/llama-3.1-8b-instruct":    (0.06,  0.06),
}

# Default fallback rate when model not in table (gpt-4o pricing = conservative)
_DEFAULT_RATE: tuple[float, float] = (2.50, 10.00)


def estimate_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    """Estimate USD cost for a single LLM call.

    Args:
        model: OpenRouter model slug, e.g. 'openai/gpt-4o-mini-2024-07-18'.
        input_tokens: Prompt token count from usage object.
        output_tokens: Completion token count from usage object.

    Returns:
        Cost in USD as a float (e.g. 0.00012).
    """
    input_rate, output_rate = _TOKEN_RATES.get(model, _DEFAULT_RATE)
    return (input_tokens / 1_000_000 * input_rate) + (
        output_tokens / 1_000_000 * output_rate
    )


def log_llm_cost(
    *,
    tenant_id: UUID,
    user_id: UUID,
    feature: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    latency_ms: int | None = None,
    request_id: str | None = None,
) -> None:
    """Insert a row into llm_cost_log after every LLM call.

    Errors are caught and logged — never allowed to interrupt the user response.

    Args:
        tenant_id: UUID of the tenant making the call.
        user_id: UUID of the user (for per-user cost reporting).
        feature: One of 'copilot' | 'morning_brief' | 'weekly_debrief'
                 | 'schema_discovery' | 'other'.
        model: OpenRouter model slug.
        input_tokens: Prompt token count.
        output_tokens: Completion token count.
        latency_ms: Wall-clock time for the LLM call in milliseconds.
        request_id: X-Request-ID header value for tracing.
    """
    from app.core.tenant import (
        get_supabase_service_client,  # local import avoids circular
    )

    cost_usd = estimate_cost_usd(model, input_tokens, output_tokens)

    try:
        get_supabase_service_client().table("llm_cost_log").insert({
            "tenant_id":     str(tenant_id),
            "user_id":       str(user_id),
            "feature":       feature,
            "model":         model,
            "input_tokens":  input_tokens,
            "output_tokens": output_tokens,
            "cost_usd":      cost_usd,
            "latency_ms":    latency_ms,
            "request_id":    request_id,
        }).execute()
        logger.debug(
            "llm_cost: tenant=%s feature=%s model=%s tokens=%d+%d cost=$%.6f",
            tenant_id, feature, model, input_tokens, output_tokens, cost_usd,
        )
    except Exception as exc:
        # Cost logging failure must never fail the user request
        logger.warning("Failed to log LLM cost: %s", exc)
