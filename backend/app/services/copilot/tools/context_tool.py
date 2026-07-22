import logging
from datetime import date
from uuid import UUID

from supabase import Client

logger = logging.getLogger(__name__)


class ContextTool:
    """
    Fetches cached contextual information (weather, news, holidays)
    to enrich AI responses with real-world context.
    """

    def __init__(self, supabase: Client, tenant_id: UUID) -> None:
        self._supabase = supabase
        self._tenant_id = tenant_id

    def get_context(self, context_date: date, context_type: str) -> dict | None:
        try:
            result = (
                self._supabase.table("context_cache")
                .select("content, source, expires_at")
                .eq("tenant_id", str(self._tenant_id))
                .eq("context_type", context_type)
                .eq("context_date", context_date.isoformat())
                .single()
                .execute()
            )
            return result.data
        except Exception as exc:
            logger.debug(
                "No context cache hit for %s/%s: %s", context_type, context_date, exc
            )
            return None
