import logging
import re

logger = logging.getLogger(__name__)

_FORBIDDEN_SCHEMAS = frozenset(
    ["pg_catalog", "information_schema", "pg_toast", "auth", "storage", "vault", "secrets"]
)
_FORBIDDEN_STATEMENTS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|EXECUTE|COPY)\b",
    re.IGNORECASE,
)
_FORBIDDEN_FUNCTIONS = re.compile(
    r"\b(pg_read_file|pg_ls_dir|pg_sleep|lo_import|lo_export|dblink|"
    r"pg_terminate_backend|pg_cancel_backend|http_get|http_post|net\.|"
    r"aws_|supabase_functions\.)\b",
    re.IGNORECASE,
)
_COMMENT = re.compile(r"(--|/\*)")
_MULTI_STATEMENT = re.compile(r";\s*\S")
_MAX_QUERY_LENGTH = 50_000


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
    if not isinstance(query, str) or len(query) > _MAX_QUERY_LENGTH:
        raise SQLGuardError(f"Query exceeds maximum length of {_MAX_QUERY_LENGTH} characters")

    stripped = query.strip()
    if not stripped:
        raise SQLGuardError("Query must not be empty")
    if _COMMENT.search(stripped):
        raise SQLGuardError("SQL comments are not permitted")
    if _MULTI_STATEMENT.search(stripped):
        raise SQLGuardError("Exactly one SQL statement is permitted")
    if stripped.endswith(";"):
        stripped = stripped[:-1].rstrip()

    if not re.match(r"^SELECT\b", stripped, re.IGNORECASE):
        raise SQLGuardError(
            f"Only SELECT statements are permitted. Got: {stripped[:50]!r}"
        )

    if _FORBIDDEN_STATEMENTS.search(stripped):
        raise SQLGuardError(
            "Query contains forbidden statement (INSERT/UPDATE/DELETE/etc.)"
        )

    for schema in _FORBIDDEN_SCHEMAS:
        if re.search(rf"\b{re.escape(schema)}\s*\.", stripped, re.IGNORECASE):
            raise SQLGuardError(f"Access to schema '{schema}' is forbidden")

    if _FORBIDDEN_FUNCTIONS.search(stripped):
        raise SQLGuardError("Query contains forbidden function call")

    if re.search(r"\b(CALL|DO|EXECUTE|SET|PREPARE|LISTEN|NOTIFY|VACUUM|ANALYZE)\b", stripped, re.IGNORECASE):
        raise SQLGuardError("Query contains a forbidden command")

    # Prevent common tenant-bypass attempts in the browser console. The read-only
    # role is still restricted at the database layer, but this gives operators a
    # deterministic, actionable validation error before a query is sent.
    if re.search(r"\b(current_user|session_user|row_security|set_config)\b", stripped, re.IGNORECASE):
        raise SQLGuardError("Session and row-security manipulation is not permitted")

    logger.debug("SQL guard passed for query: %.80s", stripped)


class GuardResult:
    """Phase 9 sqlglot-shaped result. ok=False does not raise."""

    def __init__(self, ok: bool, reason: str = "") -> None:
        self.ok = ok
        self.reason = reason


def add_row_limit(sql: str, limit: int = 1000) -> str:
    stripped = sql.rstrip().rstrip(";")
    if re.search(r"\bLIMIT\b", stripped, re.IGNORECASE):
        return stripped
    return f"{stripped} LIMIT {int(limit)}"


def _guard_with_sqlglot(sql: str) -> GuardResult:
    try:
        import sqlglot
        from sqlglot import exp
    except ImportError:
        return GuardResult(False, "sqlglot_not_installed")

    try:
        statements = sqlglot.parse(sql, dialect="postgres")
    except Exception as exc:
        return GuardResult(False, f"SQL parse error: {exc}")

    if len(statements) != 1:
        return GuardResult(False, "Multiple statements not allowed")
    stmt = statements[0]
    if not isinstance(stmt, exp.Select):
        return GuardResult(False, f"Only SELECT statements allowed; got {type(stmt).__name__}")

    dangerous = {"pg_read_file", "pg_ls_dir", "copy", "lo_export", "pg_sleep"}
    for func in stmt.find_all(exp.Anonymous, exp.Func):
        name = (getattr(func, "name", None) or "").lower()
        if name in dangerous:
            return GuardResult(False, f"Function '{func.name}' is not allowed")
    return GuardResult(True, "")


def guard_sql(sql: str) -> GuardResult:
    """SELECT-only guard. Prefers sqlglot AST; falls back to validate_sql."""
    ast = _guard_with_sqlglot(sql)
    if ast.reason != "sqlglot_not_installed":
        return ast
    try:
        validate_sql(sql)
    except SQLGuardError as exc:
        return GuardResult(False, str(exc))
    return GuardResult(True, "regex_fallback")
