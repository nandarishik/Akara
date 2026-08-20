import logging
import re

logger = logging.getLogger(__name__)

_FORBIDDEN_SCHEMAS = frozenset(["pg_catalog", "information_schema", "pg_toast"])
_FORBIDDEN_STATEMENTS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|EXECUTE|COPY)\b",
    re.IGNORECASE,
)
_FORBIDDEN_FUNCTIONS = re.compile(
    r"\b(pg_read_file|pg_ls_dir|pg_sleep|lo_import|lo_export|dblink)\b",
    re.IGNORECASE,
)


class SQLGuardError(ValueError):
    """Raised when a SQL query fails safety checks."""


def validate_sql(query: str) -> None:
    """
    Validate that a SQL query is safe to execute.
    Rules:
    - Only SELECT statements allowed
    - No access to pg_catalog, information_schema
    - No dangerous function calls
    Raises SQLGuardError on any violation.
    """
    stripped = query.strip()

    if not stripped.upper().startswith("SELECT"):
        raise SQLGuardError(
            f"Only SELECT statements are permitted. Got: {stripped[:50]!r}"
        )

    if _FORBIDDEN_STATEMENTS.search(stripped):
        raise SQLGuardError(
            "Query contains forbidden statement (INSERT/UPDATE/DELETE/etc.)"
        )

    for schema in _FORBIDDEN_SCHEMAS:
        if schema.lower() in stripped.lower():
            raise SQLGuardError(f"Access to schema '{schema}' is forbidden")

    if _FORBIDDEN_FUNCTIONS.search(stripped):
        raise SQLGuardError("Query contains forbidden function call")

    logger.debug("SQL guard passed for query: %.80s", stripped)
