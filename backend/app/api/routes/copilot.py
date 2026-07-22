import logging
from datetime import date
from uuid import UUID

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.auth import CurrentUser
from app.core.config import settings
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.services.copilot.agent import CopilotAgent
from app.services.copilot.planner import Planner
from app.services.copilot.synthesizer import Synthesizer
from app.services.copilot.tools.context_tool import ContextTool
from app.services.copilot.tools.sql_tool import SQLTool
from app.services.llm.manager import LLMManager
from app.services.schema.discovery import SchemaDiscovery
from app.sql.executor import SQLExecutor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/copilot", tags=["copilot"])


class ChatRequest(BaseModel):
    question: str
    stream: bool = True


class ChatResponse(BaseModel):
    question: str
    intent: str
    response: str
    response_time_ms: int
    llm_model: str


def _build_agent(tenant_id: UUID) -> CopilotAgent:
    """Factory: build a CopilotAgent with all dependencies wired."""
    llm = LLMManager(
        gemini_api_key=settings.gemini_api_key,
        openrouter_api_key=settings.openrouter_api_key,
    )
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
) -> StreamingResponse | ChatResponse:
    supabase = get_supabase_service_client()
    schema = SchemaDiscovery(supabase=supabase)
    schema_context = schema.get_schema_context(tenant.tenant_id)
    available_columns = schema.get_columns()

    agent = _build_agent(tenant.tenant_id)
    date_range = ("2024-01-01", date.today().isoformat())

    if request.stream:

        async def event_stream():
            async for chunk in agent.answer_stream(
                question=request.question,
                schema_context=schema_context,
                available_columns=available_columns,
                date_range=date_range,
            ):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    result = await agent.answer(
        question=request.question,
        schema_context=schema_context,
        available_columns=available_columns,
        date_range=date_range,
    )
    return ChatResponse(
        question=result.question,
        intent=result.intent,
        response=result.response,
        response_time_ms=result.response_time_ms,
        llm_model=result.llm_model,
    )
