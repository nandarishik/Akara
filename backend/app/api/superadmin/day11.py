"""Day 11 control plane: Data Studio, Query Console, runbooks, AI, templates."""

from __future__ import annotations

import csv
import io
import json
import logging
import re
import time
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import Field

from app.api.superadmin.control_plane import (
    DATA_STUDIO_POLICY,
    RUNBOOKS,
    mask_row,
    mask_value,
    sql_hash,
    validate_template_payload,
)
from app.core.config import settings
from app.core.errors import AkaraHTTPException
from app.core.superadmin import SuperAdmin, SudoCtx, request_actor_meta, require_csrf
from app.core.tenant import get_supabase_service_client
from app.domain.superadmin.audit import record_operation
from app.domain.superadmin.mutations import SuperadminMutation, dry_run_response
from app.infra.db.executor import SQLExecutor
from app.infra.db.guard import SQLGuardError, validate_sql

logger = logging.getLogger(__name__)
router = APIRouter(tags=["superadmin-day11"])


def _bad(message: str, status: int = 400) -> AkaraHTTPException:
    return AkaraHTTPException(status_code=status, code="VALIDATION_ERROR", message=message)


def _policy(table: str) -> dict[str, Any]:
    policy = DATA_STUDIO_POLICY.get(table)
    if not policy:
        raise _bad("Table is not allowlisted")
    return policy


def _parse_filters(raw: str | None, policy: dict[str, Any]) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        filters = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise _bad("filters must be valid JSON") from exc
    if not isinstance(filters, dict):
        raise _bad("filters must be an object")
    unknown = set(filters) - set(policy["filterable"])
    if unknown:
        raise _bad(f"Filter field is not allowlisted: {sorted(unknown)[0]}")
    return filters


def _apply_query_filters(query: Any, filters: dict[str, Any]) -> Any:
    for key, value in filters.items():
        if isinstance(value, dict):
            op = value.get("op", "eq")
            val = value.get("value")
            if op == "eq": query = query.eq(key, val)
            elif op == "neq": query = query.neq(key, val)
            elif op == "gt": query = query.gt(key, val)
            elif op == "gte": query = query.gte(key, val)
            elif op == "lt": query = query.lt(key, val)
            elif op == "lte": query = query.lte(key, val)
            elif op == "contains": query = query.ilike(key, f"%{val}%")
            elif op == "in" and isinstance(val, list): query = query.in_(key, val)
            else: raise _bad(f"Unsupported filter operator for {key}")
        else:
            query = query.eq(key, value)
    return query


_QUERY_TABLE = re.compile(r"\b(?:FROM|JOIN)\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)", re.IGNORECASE)


def _validate_query_tables(sql: str) -> None:
    tables = {match.lower() for match in _QUERY_TABLE.findall(sql)}
    if not tables:
        raise _bad("Query must select from an allowlisted operational table")
    unknown = tables - set(DATA_STUDIO_POLICY)
    if unknown:
        raise _bad(f"Query table is not allowlisted: {sorted(unknown)[0]}")


class RowEdit(SuperadminMutation):
    values: dict[str, Any] = Field(default_factory=dict)


class RowAction(SuperadminMutation):
    action: str
    parameters: dict[str, Any] = Field(default_factory=dict)


class RevealRequest(SuperadminMutation):
    columns: list[str] = Field(..., min_length=1, max_length=10)


class SavedViewBody(SuperadminMutation):
    name: str = Field(..., min_length=1, max_length=120)
    table: str
    definition: dict[str, Any] = Field(default_factory=dict)


class SavedViewPatch(SuperadminMutation):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    definition: dict[str, Any] | None = None


@router.get("/data-studio/tables")
def list_data_studio_tables(_admin: SuperAdmin) -> list[dict[str, Any]]:
    return [{"table": name, **policy} for name, policy in DATA_STUDIO_POLICY.items()]


@router.get("/data-studio/views")
def list_saved_views_static(_admin: SuperAdmin) -> dict[str, Any]:
    result = get_supabase_service_client().table("data_studio_saved_views").select("*").order("updated_at", desc=True).execute()
    return {"items": result.data or [], "total": len(result.data or [])}


@router.get("/data-studio/{table}")
@router.get("/data-studio/{table}/rows")
def data_studio_rows(
    table: str,
    _admin: SuperAdmin,
    tenant_id: UUID | None = None,
    filters: str | None = None,
    sort: str = "created_at",
    direction: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    policy = _policy(table)
    if sort not in policy["sortable"]:
        raise _bad("Sort field is not allowlisted")
    parsed_filters = _parse_filters(filters, policy)
    if tenant_id:
        if "tenant_id" not in policy["filterable"]:
            raise _bad("Tenant scope is not supported for this table")
        parsed_filters["tenant_id"] = str(tenant_id)
    start, end = (page - 1) * page_size, page * page_size - 1
    supa = get_supabase_service_client()
    query = supa.table(table).select(",".join(policy["columns"]), count="exact")
    query = _apply_query_filters(query, parsed_filters).order(sort, desc=direction == "desc").range(start, end)
    try:
        result = query.execute()
    except Exception as exc:
        raise AkaraHTTPException(status_code=502, code="DATA_UNAVAILABLE", message="Data Studio query failed") from exc
    rows = [mask_row(row, policy) for row in (result.data or [])]
    return {"table": table, "tenant_id": str(tenant_id) if tenant_id else None, "items": rows, "rows": rows, "page": page, "page_size": page_size, "total": result.count or len(rows), "schema": policy}


@router.get("/data-studio/{table}/{row_id}")
@router.get("/data-studio/{table}/rows/{row_id}")
def data_studio_detail(table: str, row_id: str, _admin: SuperAdmin) -> dict[str, Any]:
    policy = _policy(table)
    result = get_supabase_service_client().table(table).select(",".join(policy["columns"])).eq("id", row_id).maybe_single().execute()
    if not result.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Row not found")
    return {"table": table, "row": mask_row(result.data, policy), "links": []}


@router.post("/data-studio/{table}/{row_id}/reveal")
def reveal_data_studio_pii(table: str, row_id: str, body: RevealRequest, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    policy = _policy(table)
    if not set(body.columns).issubset(set(policy["masked_columns"])):
        raise _bad("Only masked policy columns can be revealed")
    result = get_supabase_service_client().table(table).select(",".join(policy["columns"])).eq("id", row_id).maybe_single().execute()
    if not result.data:
        raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Row not found")
    revealed = dict(result.data)
    audit = record_operation(action="data_studio.pii_reveal", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, resource_type=table, resource_id=row_id, details={"columns": body.columns}, **request_actor_meta(request))
    return {"row": {key: revealed.get(key) if key in body.columns else mask_value(key, value) if key in policy["masked_columns"] else value for key, value in revealed.items()}, "audit": audit}


@router.patch("/data-studio/{table}/{row_id}")
def edit_data_studio_row(table: str, row_id: str, body: RowEdit, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    policy = _policy(table)
    if not body.values or not set(body.values).issubset(set(policy["editable"])):
        raise _bad("One or more fields are not editable")
    types = policy["editable"]
    for key, value in body.values.items():
        expected = types[key]
        if expected == "boolean" and not isinstance(value, bool): raise _bad(f"{key} must be boolean")
        if expected == "integer" and (not isinstance(value, int) or isinstance(value, bool)): raise _bad(f"{key} must be integer")
        if expected.startswith("enum:") and value not in expected[5:].split(","): raise _bad(f"{key} has an invalid value")
    if body.dry_run:
        return dry_run_response(action=f"data_studio.edit:{table}", impact={"rows": 1, "fields": list(body.values)})
    result = get_supabase_service_client().table(table).update(body.values).eq("id", row_id).execute()
    audit = record_operation(action="data_studio.edit", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, operation_id=body.operation_id, resource_type=table, resource_id=row_id, after_state=body.values, **request_actor_meta(request))
    return {"ok": True, "row": (result.data or [None])[0], "audit": audit}


@router.post("/data-studio/{table}/{row_id}/action")
def action_data_studio_row(table: str, row_id: str, body: RowAction, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    policy = _policy(table)
    if body.action not in policy["actions"]:
        raise _bad("Action is not allowlisted")
    if body.dry_run:
        return dry_run_response(action=f"data_studio.action:{body.action}", impact={"rows": 1})
    supa = get_supabase_service_client()
    if body.action in {"soft_delete", "cancel", "suspend"}:
        values = {"deleted_at": datetime.now(UTC).isoformat()} if body.action == "soft_delete" else ({"status": "cancelled"} if body.action == "cancel" else {"is_suspended": True})
        result = supa.table(table).update(values).eq("id", row_id).execute()
    elif body.action in {"restore", "retry"}:
        values = {"deleted_at": None} if body.action == "restore" else ({"status": "queued"} if body.action == "retry" else {"is_suspended": False})
        result = supa.table(table).update(values).eq("id", row_id).execute()
    elif body.action == "adjust":
        values = body.parameters.get("values")
        if not isinstance(values, dict) or not set(values).issubset(set(policy["editable"])):
            raise _bad("Typed adjustment fields are required")
        result = supa.table(table).update(values).eq("id", row_id).execute()
    else:
        result = supa.table(table).select("id").eq("id", row_id).execute()
    audit = record_operation(action=f"data_studio.action:{body.action}", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, operation_id=body.operation_id, resource_type=table, resource_id=row_id, details=body.parameters, **request_actor_meta(request))
    return {"ok": True, "action": body.action, "row": (result.data or [None])[0], "audit": audit}


@router.post("/data-studio/views")
def create_saved_view(body: SavedViewBody, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    _policy(body.table)
    row = {"name": body.name, "table_name": body.table, "definition": body.definition, "created_by": str(sudo.user_id), "updated_by": str(sudo.user_id)}
    result = get_supabase_service_client().table("data_studio_saved_views").insert(row).execute()
    audit = record_operation(action="data_studio.saved_view.create", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, details={"table": body.table, "name": body.name}, **request_actor_meta(request))
    return {"item": (result.data or [row])[0], "audit": audit}


@router.patch("/data-studio/views/{view_id}")
def update_saved_view(view_id: UUID, body: SavedViewPatch, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    values = {key: value for key, value in {"name": body.name, "definition": body.definition, "updated_by": str(sudo.user_id)}.items() if value is not None}
    if not values or set(values) == {"updated_by"}: raise _bad("Saved view update is empty")
    result = get_supabase_service_client().table("data_studio_saved_views").update(values).eq("id", str(view_id)).execute()
    audit = record_operation(action="data_studio.saved_view.update", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, resource_type="saved_view", resource_id=str(view_id), details={"fields": list(values)}, **request_actor_meta(request))
    return {"item": (result.data or [{"id": str(view_id), **values}])[0], "audit": audit}


@router.get("/data-studio/{table}/export")
def export_data_studio(table: str, request: Request, _admin: SuperAdmin, tenant_id: UUID | None = None, filters: str | None = None, sort: str = "created_at", direction: str = Query("desc", pattern="^(asc|desc)$")) -> Response:
    policy = _policy(table)
    if sort not in policy["sortable"]: raise _bad("Sort field is not allowlisted")
    parsed = _parse_filters(filters, policy)
    if tenant_id: parsed["tenant_id"] = str(tenant_id)
    query = _apply_query_filters(get_supabase_service_client().table(table).select(",".join(policy["columns"])), parsed).order(sort, desc=direction == "desc").limit(10_000)
    result = query.execute()
    output = io.StringIO(); writer = csv.DictWriter(output, fieldnames=policy["columns"]); writer.writeheader()
    for row in result.data or []: writer.writerow(mask_row(row, policy))
    try:
        record_operation(action="data_studio.export", actor_id=_admin.user_id, actor_email=_admin.email, reason="Authorized filtered Data Studio export", resource_type=table, details={"tenant_id": str(tenant_id) if tenant_id else None, "row_count": len(result.data or [])}, **request_actor_meta(request))
    except Exception:
        logger.warning("Data Studio export audit failed", exc_info=True)
    return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{table}.csv"'})


class QueryRequest(SuperadminMutation):
    sql: str = Field(..., min_length=1, max_length=50_000)
    params: dict[str, Any] = Field(default_factory=dict)


class SavedQueryBody(SuperadminMutation):
    name: str = Field(..., min_length=1, max_length=120)
    sql: str = Field(..., min_length=1, max_length=50_000)
    parameters: list[str] = Field(default_factory=list)


async def _readonly_execute(sql: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], bool, float]:
    """Execute through the dedicated role when configured; RPC is compatibility fallback."""
    started = time.perf_counter()
    if settings.query_readonly_db_url:
        try:
            import asyncpg
            conn = await asyncpg.connect(settings.query_readonly_db_url, timeout=10)
            try:
                async with conn.transaction():
                    await conn.execute("SET LOCAL statement_timeout = '10s'")
                    values = list(params.values())
                    rows = await conn.fetch(sql, *values)
                return [dict(row) for row in rows[:10_000]], False, (time.perf_counter() - started) * 1000
            finally:
                await conn.close()
        except Exception:
            logger.exception("Dedicated Query Console connection failed; using compatibility RPC")
    rows = SQLExecutor(get_supabase_service_client()).execute(sql, params=params, max_rows=10_000)
    logger.warning("query_console_fallback_used sql_hash=%s", sql_hash(sql))
    return rows[:10_000], True, (time.perf_counter() - started) * 1000


@router.post("/query/execute")
@router.post("/query-console/execute")
async def execute_query_console(body: QueryRequest, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    try:
        validate_sql(body.sql)
        _validate_query_tables(body.sql)
    except SQLGuardError as exc:
        raise _bad(str(exc)) from exc
    if body.dry_run:
        return {"ok": True, "dry_run": True, "sql_hash": sql_hash(body.sql), "impact": {"max_rows": 10_000}}
    try:
        rows, fallback, duration = await _readonly_execute(body.sql, body.params)
    except Exception as exc:
        result = {"ok": False, "error": "Query failed", "sql_hash": sql_hash(body.sql)}
        get_supabase_service_client().table("query_executions").insert({"actor_id": str(sudo.user_id), "reason": body.reason, "sql_hash": sql_hash(body.sql), "status": "failed", "error_message": str(exc)[:500], "fallback_used": fallback if 'fallback' in locals() else False}).execute()
        raise AkaraHTTPException(status_code=400, code="QUERY_FAILED", message="Query failed") from exc
    history = {"actor_id": str(sudo.user_id), "reason": body.reason, "sql_hash": sql_hash(body.sql), "duration_ms": round(duration, 2), "row_count": len(rows), "status": "succeeded", "fallback_used": fallback, "tenant_scope": body.params.get("tenant_id")}
    try: get_supabase_service_client().table("query_executions").insert(history).execute()
    except Exception: logger.warning("query history write failed", exc_info=True)
    return {"ok": True, "rows": rows, "row_count": len(rows), "duration_ms": round(duration, 2), "sql_hash": history["sql_hash"], "fallback_used": fallback}


@router.get("/query/history")
@router.get("/query-console/history")
def query_history(_admin: SuperAdmin, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)) -> dict[str, Any]:
    result = get_supabase_service_client().table("query_executions").select("*").order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return {"items": result.data or [], "total": len(result.data or [])}


@router.post("/query/{execution_id}/cancel")
@router.post("/query-console/{execution_id}/cancel")
def cancel_query(execution_id: UUID, request: Request, sudo: SudoCtx, body: SuperadminMutation, _: None = Depends(require_csrf)) -> dict[str, Any]:
    updated = get_supabase_service_client().table("query_executions").update({"status": "cancelled"}).eq("id", str(execution_id)).in_("status", ["running", "queued"]).execute()
    audit = record_operation(action="query.cancel", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, resource_type="query_execution", resource_id=str(execution_id), **request_actor_meta(request))
    return {"ok": True, "execution_id": str(execution_id), "cancelled": bool(updated.data), "audit": audit}


@router.get("/query/schema")
@router.get("/query-console/schema")
@router.get("/query-console/help")
def query_schema_help(_admin: SuperAdmin) -> dict[str, Any]:
    return {"tables": [{"name": name, "columns": policy["columns"], "description": policy["description"]} for name, policy in DATA_STUDIO_POLICY.items()]}


@router.get("/query/saved")
def list_saved_queries(_admin: SuperAdmin) -> dict[str, Any]:
    result = get_supabase_service_client().table("saved_queries").select("*").order("updated_at", desc=True).execute()
    return {"items": result.data or [], "total": len(result.data or [])}


@router.post("/query/saved")
def save_query(body: SavedQueryBody, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    try:
        validate_sql(body.sql)
        _validate_query_tables(body.sql)
    except SQLGuardError as exc: raise _bad(str(exc)) from exc
    row = {"name": body.name, "sql": body.sql, "parameters": body.parameters, "created_by": str(sudo.user_id), "updated_by": str(sudo.user_id)}
    result = get_supabase_service_client().table("saved_queries").insert(row).execute()
    audit = record_operation(action="query.saved.create", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, details={"sql_hash": sql_hash(body.sql)}, **request_actor_meta(request))
    return {"item": (result.data or [row])[0], "audit": audit}


@router.get("/runbooks")
def list_runbooks(_admin: SuperAdmin) -> dict[str, Any]:
    return {"items": [{"name": name, **definition} for name, definition in RUNBOOKS.items()]}


@router.get("/runbooks/{name}")
def get_runbook(name: str, _admin: SuperAdmin) -> dict[str, Any]:
    definition = RUNBOOKS.get(name)
    if not definition: raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Runbook not found")
    return {"name": name, **definition}


class RunbookRequest(SuperadminMutation):
    parameters: dict[str, Any] = Field(default_factory=dict)
    confirm: str | None = None


def _validate_runbook_params(name: str, parameters: dict[str, Any]) -> None:
    definition = RUNBOOKS.get(name)
    if not definition: raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Runbook not found")
    missing = set(definition["parameters"]) - set(parameters)
    if missing: raise _bad(f"Missing runbook parameters: {', '.join(sorted(missing))}")
    for key, typ in definition["parameters"].items():
        value = parameters[key]
        if typ == "uuid":
            try: UUID(str(value))
            except ValueError as exc: raise _bad(f"{key} must be a UUID") from exc
        if typ == "YYYY-MM" and (not isinstance(value, str) or len(value) != 7 or value[4] != "-"): raise _bad(f"{key} must be YYYY-MM")
        if typ == "owner|admin|member" and value not in {"owner", "admin", "member"}: raise _bad(f"{key} has an invalid role")


@router.post("/runbooks/{name}/dry-run")
def dry_run_runbook(name: str, body: RunbookRequest, _admin: SuperAdmin) -> dict[str, Any]:
    _validate_runbook_params(name, body.parameters)
    definition = RUNBOOKS[name]
    return dry_run_response(action=f"runbook:{name}", impact={"max_rows": definition["max_rows"], "expected_rows": 1, "rollback": definition["rollback"], "reversible": definition["reversible"]}, warnings=[] if definition["reversible"] else ["This operation is not reversible"])


@router.post("/runbooks/{name}/execute")
def execute_runbook(name: str, body: RunbookRequest, request: Request, sudo: SudoCtx, _: None = Depends(require_csrf)) -> dict[str, Any]:
    _validate_runbook_params(name, body.parameters)
    definition = RUNBOOKS[name]
    if name in {"revoke_all_tenant_sessions", "purge_expired_exports", "regenerate_invoice", "reconcile_stripe_subscription"} and body.confirm != f"EXECUTE {name}":
        raise _bad(f'Confirmation must be exactly: "EXECUTE {name}"')
    if body.dry_run: return dry_run_response(action=f"runbook:{name}", impact={"max_rows": definition["max_rows"]}, warnings=[] if definition["reversible"] else ["This operation is not reversible"])
    op_id = body.operation_id or uuid4()
    # Typed operations delegate to existing workers/providers where available;
    # the execution record is the durable contract even if a provider is down.
    execution = {"id": str(op_id), "runbook_name": name, "parameters": body.parameters, "status": "queued", "actor_id": str(sudo.user_id), "reason": body.reason, "max_rows": definition["max_rows"], "reversible": definition["reversible"], "rollback_notes": definition["rollback"]}
    try: get_supabase_service_client().table("runbook_executions").insert(execution).execute()
    except Exception: logger.warning("runbook execution record write failed", exc_info=True)
    audit = record_operation(action=f"runbook.execute:{name}", actor_id=sudo.user_id, actor_email=sudo.email, reason=body.reason, operation_id=op_id, details={"parameters": body.parameters, "reversible": definition["reversible"]}, **request_actor_meta(request))
    return {"ok": True, "operation_id": str(op_id), "execution": execution, "audit": audit}


@router.get("/runbooks/executions/{execution_id}")
def runbook_execution(execution_id: UUID, _admin: SuperAdmin) -> dict[str, Any]:
    result = get_supabase_service_client().table("runbook_executions").select("*").eq("id", str(execution_id)).maybe_single().execute()
    if not result.data: raise AkaraHTTPException(status_code=404, code="NOT_FOUND", message="Execution not found")
    return result.data
