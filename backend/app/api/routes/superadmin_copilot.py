"""Founder ops copilot — answers over aggregated platform metrics."""

from __future__ import annotations

import json
import logging
from typing import AsyncIterator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.rate_limit import ADMIN_READ_LIMIT, limiter
from app.core.superadmin import SuperAdmin
from app.core.tenant import get_supabase_service_client
from app.services.llm.manager import LLMManager
from app.services.superadmin.ops_context import build_ops_context, ops_context_prompt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/copilot", tags=["superadmin-copilot"])

CHIPS = [
    "Who's about to hit quota?",
    "What's our MRR and margin this month?",
    "Any cron failures in the last 24 hours?",
    "How is copilot feedback trending?",
    "Which plans drive most revenue?",
    "How many tenants churned this month?",
    "Summarize upsell opportunities.",
    "Give me a 3-bullet founder brief.",
]


class CopilotChatBody(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    stream: bool = True


@router.get("/chips")
def list_chips(_admin: SuperAdmin) -> dict:
    return {"chips": CHIPS}


@router.get("/ops-context")
def get_ops_context(_admin: SuperAdmin) -> dict:
    return build_ops_context()


@router.post("/founder-brief/run")
@limiter.limit("5/minute")
def run_founder_brief_now(request: Request, _admin: SuperAdmin) -> dict:
    from app.tasks.founder_brief import run_founder_brief

    return run_founder_brief()


@router.get("/founder-brief/history")
@limiter.limit(ADMIN_READ_LIMIT)
def founder_brief_history(
    request: Request,
    _admin: SuperAdmin,
    limit: int = 10,
) -> dict:
    supa = get_supabase_service_client()
    rows = (
        supa.table("founder_brief_runs")
        .select("id, brief_text, generated_at, delivery_status")
        .order("generated_at", desc=True)
        .limit(limit)
        .execute()
    ).data or []
    return {"items": rows, "total": len(rows)}


@router.post("/chat")
@limiter.limit("30/minute")
async def founder_chat(request: Request, body: CopilotChatBody, _admin: SuperAdmin):
    ctx = build_ops_context()
    system = ops_context_prompt(ctx)
    llm = LLMManager(openrouter_api_key=settings.openrouter_api_key)

    if not body.stream:
        text = await llm.complete(prompt=body.question, system=system)
        return {"answer": text, "context_generated_at": ctx["generated_at"]}

    async def stream() -> AsyncIterator[str]:
        try:
            async for chunk in llm.stream(prompt=body.question, system=system):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            logger.error("Founder copilot stream failed: %s", exc)
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
