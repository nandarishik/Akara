"""LiteLLM cost callback stub — writes llm_cost_log_v2 when wired."""

from __future__ import annotations

from typing import Any
from uuid import UUID


def record_cost(
    tenant_id: UUID,
    model: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    cost_usd: float | None = None,
    **_: Any,
) -> None:
    _ = (tenant_id, model, input_tokens, output_tokens, cost_usd)
