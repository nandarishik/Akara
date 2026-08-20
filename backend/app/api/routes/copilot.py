import json
import logging
import time
from datetime import date, datetime, UTC
from uuid import UUID

import openai
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.config import settings
from app.core.plan_guard import (
    apply_copilot_quota_headers,
    get_copilot_quota_metadata,
    maybe_notify_copilot_quota_threshold,
    require_copilot_quota,
    require_feature,
)
from app.core.rate_limit import limiter
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.domain.copilot.agent import CopilotAgent
from app.domain.copilot.planner import Planner
from app.domain.copilot.synthesizer import Synthesizer
from app.domain.copilot.tools.context_tool import ContextTool
from app.domain.copilot.tools.sql_tool import SQLTool
from app.infra.llm.manager import LLMManager
from app.infra.llm.cost_logger import log_llm_cost
from app.infra.prompts.generator import PromptGenerator
from app.infra.schema.discovery import SchemaDiscovery
from app.domain.debrief.copilot_context import load_debrief_context_addendum
from app.domain.user_events import record_user_event
from app.infra.db.executor import SQLExecutor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/copilot", tags=["copilot"])


class ChatRequest(BaseModel):
    question: str
    stream: bool = True
    conversation_id: UUID | None = None
    report_id: UUID | None = None


class ChatResponse(BaseModel):
    question: str
    intent: str
    response: str
    response_time_ms: int
    llm_model: str
    conversation_id: UUID

    # Day 4: Provenance fields for data transparency
    sql_used: str | None = None
    row_count: int | None = None
    date_range: str | None = None
    data_freshness: str | None = None


def _extract_provenance(result, supabase, tenant_id: UUID) -> dict:
    """Extract data provenance information from the copilot result."""
    provenance = {
        "sql_used": None,
        "row_count": None,
        "date_range": None,
        "data_freshness": None,
    }

    try:
        # Extract SQL from result if available
        if hasattr(result, 'sql_executed') and result.sql_executed:
            provenance["sql_used"] = result.sql_executed.strip()

        # Extract row count from result metadata
        if hasattr(result, 'rows_analyzed') and result.rows_analyzed:
            provenance["row_count"] = result.rows_analyzed

        # Set date range based on the query
        provenance["date_range"] = "Jan 2024 – Present"

        # Check data freshness by finding the latest import
        try:
            latest_import = (
                supabase.table("import_jobs")
                .select("created_at")
                .eq("tenant_id", str(tenant_id))
                .eq("status", "completed")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )

            if latest_import.data:
                from datetime import datetime
                import_date = datetime.fromisoformat(latest_import.data[0]["created_at"].replace('Z', '+00:00'))
                days_ago = (datetime.now(import_date.tzinfo) - import_date).days

                if days_ago == 0:
                    provenance["data_freshness"] = "Updated today"
                elif days_ago == 1:
                    provenance["data_freshness"] = "Updated yesterday"
                else:
                    provenance["data_freshness"] = f"Last updated {days_ago} days ago"
            else:
                provenance["data_freshness"] = "No data imported yet"

        except Exception as e:
            logger.warning(f"Failed to determine data freshness: {e}")
            provenance["data_freshness"] = "Data freshness unknown"

    except Exception as e:
        logger.warning(f"Failed to extract provenance: {e}")

    return provenance


def _create_conversation(supabase, tenant_id: UUID, user_id: UUID, question: str) -> UUID | None:
    """Create a conversation row from the first message."""
    try:
        title = question[:50].strip()
        if len(question) > 50:
            title += "..."
        conv_result = (
            supabase.table("conversations")
            .insert({
                "tenant_id": str(tenant_id),
                "user_id": str(user_id),
                "title": title,
            })
            .execute()
        )
        return conv_result.data[0]["id"]
    except Exception as exc:
        logger.warning("Failed to create conversation: %s", exc)
        return None


def _save_chat_turn(
    supabase,
    *,
    tenant_id: UUID,
    user_id: UUID,
    conversation_id: UUID | None,
    question: str,
    response: str,
) -> None:
    """Persist one Q&A turn and bump conversation updated_at."""
    if not conversation_id or not response.strip():
        return
    try:
        supabase.table("chat_history").insert({
            "tenant_id": str(tenant_id),
            "user_id": str(user_id),
            "conversation_id": str(conversation_id),
            "question": question,
            "response": response,
            "metadata": {},
        }).execute()
        supabase.table("conversations").update({
            "updated_at": datetime.now(UTC).isoformat(),
        }).eq("id", str(conversation_id)).execute()
    except Exception as exc:
        logger.warning("Failed to save chat history: %s", exc)


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
@limiter.limit("30/minute")
async def chat(
    request: Request,
    body: ChatRequest,
    user: CurrentUser,
    tenant: TenantCtx,
    _quota=Depends(require_copilot_quota()),  # HTTP 402 when monthly limit reached
) -> StreamingResponse | JSONResponse:
    supabase = get_supabase_service_client()
    quota_meta = get_copilot_quota_metadata(tenant)
    schema = SchemaDiscovery(supabase=supabase)
    prompt_gen = PromptGenerator(schema_discovery=schema)

    schema_context = prompt_gen.build_schema_context(tenant.tenant_id)
    available_columns = schema.get_columns()
    allowed_vocabulary = schema.get_allowed_vocabulary(tenant.tenant_id)

    # Industry-specific addendums — empty string for unknown industries.
    # Language addendum is industry-agnostic and always appended last so it
    # takes highest priority in the synthesizer system prompt.
    planner_addendum = prompt_gen.build_planner_addendum(tenant.tenant_config)
    synthesizer_addendum = (
        prompt_gen.build_synthesizer_addendum(tenant.tenant_config)
        + prompt_gen.build_language_addendum(tenant.tenant_config)
    )

    if body.report_id:
        await require_feature("ask_copilot_debrief")(tenant)
        debrief_addendum = load_debrief_context_addendum(tenant.tenant_id, body.report_id)
        planner_addendum = planner_addendum + debrief_addendum
        synthesizer_addendum = synthesizer_addendum + debrief_addendum

    agent = _build_agent(tenant.tenant_id)
    date_range = ("2024-01-01", date.today().isoformat())

    if body.stream:

        async def event_stream():
            usage_incremented = False
            conversation_id = body.conversation_id
            response_parts: list[str] = []

            if conversation_id is None:
                conversation_id = _create_conversation(
                    supabase, tenant.tenant_id, user.user_id, body.question
                )
                if conversation_id:
                    yield (
                        "data: "
                        + json.dumps({"type": "conversation_id", "id": str(conversation_id)})
                        + "\n\n"
                    )

            try:
                async for chunk in agent.answer_stream(
                    question=body.question,
                    schema_context=schema_context,
                    available_columns=available_columns,
                    date_range=date_range,
                    planner_addendum=planner_addendum,
                    synthesizer_addendum=synthesizer_addendum,
                    allowed_vocabulary=allowed_vocabulary,
                ):
                    response_parts.append(chunk)
                    yield f"data: {chunk}\n\n"

                prev_count = int(quota_meta["quota_used"])
                try:
                    supabase.rpc(
                        "increment_usage",
                        {"p_tenant_id": str(tenant.tenant_id), "p_field": "copilot_calls"},
                    ).execute()
                    usage_incremented = True
                    maybe_notify_copilot_quota_threshold(
                        tenant.tenant_id, prev_count, prev_count + 1
                    )
                except Exception as exc:
                    logger.warning("Failed to increment copilot usage (stream): %s", exc)

                _save_chat_turn(
                    supabase,
                    tenant_id=tenant.tenant_id,
                    user_id=user.user_id,
                    conversation_id=conversation_id,
                    question=body.question,
                    response="".join(response_parts),
                )

            except openai.APIStatusError as e:
                # Day 4: Graceful LLM degradation
                if e.status_code == 429:
                    yield "data: {\"error\": \"ai_rate_limited\", \"message\": \"The AI is temporarily busy. Try again in 30 seconds.\", \"retry_after\": 30}\n\n"
                elif e.status_code >= 500:
                    logger.error("OpenAI server error: %s", e, exc_info=True)
                    yield "data: {\"error\": \"ai_unavailable\", \"message\": \"The AI copilot is temporarily unavailable. Your dashboard still works. Try again later.\"}\n\n"
                else:
                    logger.error("OpenAI API error: %s", e, exc_info=True)
                    yield "data: {\"error\": \"ai_error\", \"message\": \"Sorry, I couldn't process that request. Please try again.\"}\n\n"
            except openai.APITimeoutError as e:
                logger.error("OpenAI timeout: %s", e, exc_info=True)
                yield "data: {\"error\": \"ai_timeout\", \"message\": \"This question is taking too long. Try a simpler question.\"}\n\n"
            except Exception as exc:
                logger.error("Copilot stream error: %s", exc, exc_info=True)
                yield "data: {\"error\": \"unknown\", \"message\": \"Sorry, I couldn't process that request.\"}\n\n"

            yield "data: [DONE]\n\n"

        stream_resp = StreamingResponse(event_stream(), media_type="text/event-stream")
        apply_copilot_quota_headers(stream_resp, quota_meta)
        return stream_resp

    # ── Non-streaming: capture tokens + cost ─────────────────────────────────
    start_ms = int(time.time() * 1000)

    try:
        result = await agent.answer(
            question=body.question,
            schema_context=schema_context,
            available_columns=available_columns,
            date_range=date_range,
            planner_addendum=planner_addendum,
            synthesizer_addendum=synthesizer_addendum,
            allowed_vocabulary=allowed_vocabulary,
        )
        latency_ms = int(time.time() * 1000) - start_ms

        # CRITICAL: Only increment usage after successful answer (not before)
        prev_count = int(quota_meta["quota_used"])
        try:
            supabase.rpc(
                "increment_usage",
                {"p_tenant_id": str(tenant.tenant_id), "p_field": "copilot_calls"},
            ).execute()
            maybe_notify_copilot_quota_threshold(
                tenant.tenant_id, prev_count, prev_count + 1
            )
        except Exception as exc:
            logger.warning("Failed to increment copilot usage: %s", exc)

        record_user_event(user.user_id, "first_copilot")

    except openai.APIStatusError as e:
        # Day 4: Graceful LLM degradation - DO NOT increment quota on failure
        if e.status_code == 429:
            raise HTTPException(status_code=503, detail={
                "error": "ai_rate_limited",
                "message": "The AI is temporarily busy. Try again in 30 seconds.",
                "retry_after": 30,
            })
        if e.status_code >= 500:
            logger.error("OpenAI server error: %s", e, exc_info=True)
            raise HTTPException(status_code=503, detail={
                "error": "ai_unavailable",
                "message": "The AI copilot is temporarily unavailable. Your dashboard still works. Try again later.",
            })
        logger.error("OpenAI API error: %s", e, exc_info=True)
        raise HTTPException(status_code=503, detail={
            "error": "ai_error",
            "message": "Sorry, I couldn't process that request. Please try again.",
        })
    except openai.APITimeoutError as e:
        logger.error("OpenAI timeout: %s", e, exc_info=True)
        raise HTTPException(status_code=504, detail={
            "error": "ai_timeout",
            "message": "This question is taking too long. Try a simpler question.",
        })
    except Exception as e:
        logger.error("Copilot error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail={
            "error": "unknown",
            "message": "Sorry, I couldn't process that request.",
        })

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
    conversation_id = body.conversation_id
    if conversation_id is None:
        conversation_id = _create_conversation(
            supabase, tenant.tenant_id, user.user_id, body.question
        )

    _save_chat_turn(
        supabase,
        tenant_id=tenant.tenant_id,
        user_id=user.user_id,
        conversation_id=conversation_id,
        question=body.question,
        response=result.response,
    )

    # Day 4: Add data provenance for transparency
    provenance = _extract_provenance(result, supabase, tenant.tenant_id)

    payload = ChatResponse(
        question=result.question,
        intent=result.intent,
        response=result.response,
        response_time_ms=result.response_time_ms,
        llm_model=result.llm_model,
        conversation_id=conversation_id,
        sql_used=provenance["sql_used"],
        row_count=provenance["row_count"],
        date_range=provenance["date_range"],
        data_freshness=provenance["data_freshness"],
    )
    json_resp = JSONResponse(content=payload.model_dump(mode="json"))
    apply_copilot_quota_headers(json_resp, quota_meta)
    return json_resp


# ============================================================================
# DAY 4: Copilot Feedback Endpoint
# ============================================================================

class FeedbackRequest(BaseModel):
    message_id: str
    rating: int  # 1 for thumbs up, -1 for thumbs down
    comment: str | None = None
    conversation_id: UUID | None = None
    question: str | None = None


class FeedbackResponse(BaseModel):
    success: bool
    message: str


@router.post("/feedback", response_model=FeedbackResponse)
@limiter.limit("30/minute")
async def submit_feedback(
    request: Request,
    body: FeedbackRequest,
    user: CurrentUser,
    tenant: TenantCtx,
) -> FeedbackResponse:
    """
    Submit feedback (thumbs up/down) for a copilot response.
    
    This helps us improve the AI copilot by tracking user satisfaction.
    Thumbs down feedback is logged with high priority for review.
    """

    # Validate rating
    if body.rating not in [-1, 1]:
        raise HTTPException(
            status_code=400,
            detail="Rating must be 1 (thumbs up) or -1 (thumbs down)"
        )

    supabase = get_supabase_service_client()

    try:
        # Insert feedback record
        feedback_result = supabase.table("copilot_feedback").insert({
            "conversation_id": str(body.conversation_id) if body.conversation_id else None,
            "message_id": body.message_id,
            "tenant_id": str(tenant.tenant_id),
            "user_id": str(user.user_id),
            "rating": body.rating,
            "comment": body.comment,
            "question": body.question or "",
        }).execute()

        if not feedback_result.data:
            raise HTTPException(status_code=500, detail="Failed to save feedback")

        # Log thumbs down feedback with high priority for review
        if body.rating == -1:
            logger.error(
                "NEGATIVE FEEDBACK - Tenant: %s, User: %s, Message: %s, Question: %s, Comment: %s",
                tenant.tenant_id,
                user.user_id,
                body.message_id,
                body.question or "Unknown",
                body.comment or "No comment",
                extra={
                    "tenant_id": str(tenant.tenant_id),
                    "user_id": str(user.user_id),
                    "message_id": str(body.message_id),
                    "feedback_type": "thumbs_down",
                    "priority": "high"
                }
            )
            message = "Thank you for your feedback. We'll use this to improve the AI copilot."
        else:
            logger.info(
                "POSITIVE FEEDBACK - Tenant: %s, Message: %s",
                tenant.tenant_id,
                body.message_id
            )
            message = "Thank you for your positive feedback!"

        return FeedbackResponse(
            success=True,
            message=message
        )

    except Exception as e:
        logger.error("Failed to submit copilot feedback: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to submit feedback. Please try again."
        )
