import logging
from uuid import UUID

from supabase import Client

from app.infra.db.guard import validate_sql

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
        max_rows: int = _MAX_ROWS,
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
            if len(rows) > max_rows:
                logger.warning(
                    "Query returned %d rows, truncating to %d", len(rows), max_rows
                )
                rows = rows[:max_rows]
            return rows
        except Exception as exc:
            logger.error("SQL execution failed: %s", exc)
            raise RuntimeError(f"Query execution failed: {exc}") from exc
