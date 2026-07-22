import logging
from uuid import UUID

from supabase import Client

from app.sql.guard import validate_sql

logger = logging.getLogger(__name__)

_MAX_ROWS = 2000


class SQLExecutor:
    """
    Executes validated SELECT queries against Supabase PostgreSQL.
    All queries must pass SQLGuard before execution.
    Tenant isolation is enforced via RLS on the Supabase client.
    """

    def __init__(self, client: Client) -> None:
        self._client = client

    def execute(
        self,
        query: str,
        params: dict | None = None,
        tenant_id: UUID | None = None,
    ) -> list[dict]:
        """
        Execute a SELECT query. Validates with SQLGuard first.
        Returns up to _MAX_ROWS rows.
        """
        validate_sql(query)

        logger.info("Executing SQL for tenant %s: %.100s", tenant_id, query)

        try:
            result = self._client.rpc(
                "execute_tenant_query",
                {"p_query": query, "p_params": params or {}},
            ).execute()
            rows = result.data or []
            if len(rows) > _MAX_ROWS:
                logger.warning(
                    "Query returned %d rows, truncating to %d", len(rows), _MAX_ROWS
                )
                rows = rows[:_MAX_ROWS]
            return rows
        except Exception as exc:
            logger.error("SQL execution failed: %s", exc)
            raise RuntimeError(f"Query execution failed: {exc}") from exc
