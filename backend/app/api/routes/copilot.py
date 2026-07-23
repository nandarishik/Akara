import logging
import time
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.config import settings
from app.core.plan_guard import require_copilot_quota
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.services.copilot.agent import CopilotAgent
from app.services.copilot.planner import Planner
from app.services.copilot.synthesizer import Synthesizer
from app.services.copilot.tools.context_tool import ContextTool
from app.services.copilot.tools.sql_tool import SQLTool
from app.services.llm.manager import LLMManager
from app.services.llm_cost_logger import log_llm_cost
from app.services.prompts.generator import PromptGenerator
from app.services.schema.discovery import SchemaDiscovery
from app.sql.executor import SQLExecutor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/copilot", tags=["copilot"])


def _sse_event(data: str) -> str:
    """Format one SSE data event; safe for multiline text."""
    if not data:
        return ""
    return "".join(f"data: {line}\n" for line in data.split("\n")) + "\n"


class ChatRequest(BaseModel):
    question: str
    stream: bool = True
    conversation_id: UUID | None = None


class ChatResponse(BaseModel):
    question: str
    intent: str
    response: str
    response_time_ms: int
    llm_model: str
    conversation_id: UUID


def _build_agent(tenant_id: UUID) -> CopilotAgent:
    """Factory: build a CopilotAgent with all dependencies wired."""
    llm = LLMManager(openrouter_api_key=settings.openrouter_api_key)
    supabase = get_supabase_service_client()
    executor = SQLExecutor(client=supabase)
    return CopilotAgent(
        planner=Planner(llm=llm),
        synthesizer=Synthesizer(llm=llm),
        sql_tool=SQLTool(executor=executor, tenant_id=tenant_id),
        context_tool=ContextTool(supabase=supabase, tenant_id=tenant_id),
        tenant_id=tenant_id,
    )


@router.post("/chat", response_model=None)
async def chat(
    request: ChatRequest,
    user: CurrentUser,
    tenant: TenantCtx,
    _quota=Depends(require_copilot_quota()),  # HTTP 402 when monthly limit reached
) -> StreamingResponse | ChatResponse:
    supabase = get_supabase_service_client()
    schema = SchemaDiscovery(supabase=supabase)
    prompt_gen = PromptGenerator(schema_discovery=schema)

    schema_context = prompt_gen.build_schema_context(tenant.tenant_id)
    available_columns = schema.get_columns()

    # Industry-specific addendums — empty string for unknown industries.
    # Language addendum is industry-agnostic and always appended last so it
    # takes highest priority in the synthesizer system prompt.
    planner_addendum = prompt_gen.build_planner_addendum(tenant.tenant_config)
    synthesizer_addendum = (
        prompt_gen.build_synthesizer_addendum(tenant.tenant_config)
        + prompt_gen.build_language_addendum(tenant.tenant_config)
    )

    agent = _build_agent(tenant.tenant_id)
    data_bounds = schema.get_data_date_range(tenant.tenant_id)
    date_range = data_bounds or ("2024-01-01", date.today().isoformat())

    if request.stream:

        async def event_stream():
            try:
                async for chunk in agent.answer_stream(
                    question=request.question,
                    schema_context=schema_context,
                    available_columns=available_columns,
                    date_range=date_range,
                    planner_addendum=planner_addendum,
                    synthesizer_addendum=synthesizer_addendum,
                ):
                    event = _sse_event(chunk)
                    if event:
                        yield event
            except Exception as exc:
                logger.error("Copilot stream error: %s", exc, exc_info=True)
                yield _sse_event(
                    f"Sorry, I couldn't process that request. ({exc})"
                )
            yield _sse_event("[DONE]")

        # For streaming we can't easily capture token counts, so we increment
        # usage and skip detailed cost logging (best effort for streaming mode).
        try:
            supabase.rpc(
                "increment_usage",
                {"p_tenant_id": str(tenant.tenant_id), "p_field": "copilot_calls"},
            ).execute()
        except Exception as exc:
            logger.warning("Failed to increment copilot usage (stream): %s", exc)

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # ── Non-streaming: capture tokens + cost ─────────────────────────────────
    start_ms = int(time.time() * 1000)
    result = await agent.answer(
        question=request.question,
        schema_context=schema_context,
        available_columns=available_columns,
        date_range=date_range,
        planner_addendum=planner_addendum,
        synthesizer_addendum=synthesizer_addendum,
    )
    latency_ms = int(time.time() * 1000) - start_ms

    # Increment usage counter (after successful answer, not before)
    try:
        supabase.rpc(
            "increment_usage",
            {"p_tenant_id": str(tenant.tenant_id), "p_field": "copilot_calls"},
        ).execute()
    except Exception as exc:
        logger.warning("Failed to increment copilot usage: %s", exc)

    # Log token cost (best-effort; does not fail the request)
    try:
        input_tokens: int = getattr(getattr(result, "usage", None), "prompt_tokens", 0) or 0
        output_tokens: int = getattr(getattr(result, "usage", None), "completion_tokens", 0) or 0
        log_llm_cost(
            tenant_id=tenant.tenant_id,
            user_id=user.user_id,
            feature="copilot",
            model=settings.openrouter_model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
        )
    except Exception as exc:
        logger.warning("Failed to log LLM cost: %s", exc)

    # Auto-create conversation if none exists
    conversation_id = request.conversation_id
    if conversation_id is None:
        try:
            # Generate title from first 50 chars of question
            title = request.question[:50].strip()
            if len(request.question) > 50:
                title += "..."

            conv_result = (
                supabase.table("conversations")
                .insert({
                    "tenant_id": str(tenant.tenant_id),
                    "user_id": str(user.user_id),
                    "title": title,
                })
                .execute()
            )
            conversation_id = conv_result.data[0]["id"]
        except Exception as e:
            logger.warning("Failed to create conversation: %s", e)

    # Save chat history to Supabase
    try:
        supabase.table("chat_history").insert({
            "tenant_id": str(tenant.tenant_id),
            "user_id": str(user.user_id),
            "conversation_id": str(conversation_id) if conversation_id else None,
            "question": request.question,
            "response": result.response,
            "metadata": {
                "intent": result.intent,
                "response_time_ms": result.response_time_ms,
            },
        }).execute()
    except Exception as e:
        logger.warning("Failed to save chat history: %s", e)

    return ChatResponse(
        question=result.question,
        intent=result.intent,
        response=result.response,
        response_time_ms=result.response_time_ms,
        llm_model=result.llm_model,
        conversation_id=conversation_id,
    )
