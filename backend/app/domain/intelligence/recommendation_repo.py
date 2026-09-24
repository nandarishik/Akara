"""In-memory recommendation store used by APIs/tests; swap for supabase in workers."""

from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from app.core.config import settings

_STORE: dict[str, dict[str, Any]] = {}
_WEIGHTS: dict[tuple[str | None, str], dict[str, Any]] = {}


def reset_store() -> None:
    _STORE.clear()
    _WEIGHTS.clear()


def now_utc() -> datetime:
    return datetime.now(UTC)


def sweep(tenant_id: str | None = None) -> None:
    current = now_utc()
    for row in _STORE.values():
        if tenant_id and row["tenant_id"] != tenant_id:
            continue
        if row["status"] == "snoozed" and row.get("snooze_until"):
            until = row["snooze_until"]
            if isinstance(until, str):
                until = datetime.fromisoformat(until.replace("Z", "+00:00"))
            if until <= current:
                row["status"] = "open"
        if row["status"] == "open" and row.get("expires_at"):
            exp = row["expires_at"]
            if isinstance(exp, str):
                exp = datetime.fromisoformat(exp.replace("Z", "+00:00"))
            if exp <= current:
                row["status"] = "expired"


def upsert(row: dict[str, Any], *, cap: int | None = None) -> dict[str, Any]:
    tenant = row["tenant_id"]
    open_count = sum(1 for r in _STORE.values() if r["tenant_id"] == tenant and r["status"] == "open")
    limit = cap if cap is not None else settings.decision_engine_max_recs_per_tenant
    if open_count >= limit and row.get("id") not in _STORE:
        return row
    rec_id = row.get("id") or str(uuid4())
    row = {**row, "id": rec_id}
    for existing in list(_STORE.values()):
        if (
            existing["tenant_id"] == tenant
            and existing["status"] == "open"
            and existing["recommendation_type"] == row["recommendation_type"]
            and (existing.get("primary_item_id") or "") == (row.get("primary_item_id") or "")
        ):
            existing["status"] = "superseded"
    _STORE[rec_id] = row
    return row


def get(rec_id: str, tenant_id: str) -> dict[str, Any] | None:
    sweep(tenant_id)
    row = _STORE.get(rec_id)
    if not row or row["tenant_id"] != tenant_id:
        return None
    return row


def list_open(tenant_id: str, *, sort: str = "confidence", rec_type: str | None = None) -> list[dict[str, Any]]:
    sweep(tenant_id)
    rows = [
        r
        for r in _STORE.values()
        if r["tenant_id"] == tenant_id
        and r["status"] == "open"
        and float(r.get("confidence_score") or 0) >= settings.confidence_medium_threshold
    ]
    if rec_type:
        rows = [r for r in rows if r["recommendation_type"] == rec_type]
    key = {
        "confidence": lambda r: float(r.get("confidence_score") or 0),
        "impact": lambda r: float(r.get("expected_impact_max") or 0),
        "date": lambda r: str(r.get("created_at") or ""),
    }.get(sort, lambda r: float(r.get("confidence_score") or 0))
    return sorted(rows, key=key, reverse=True)


def list_history(tenant_id: str) -> list[dict[str, Any]]:
    sweep(tenant_id)
    rows = [
        r
        for r in _STORE.values()
        if r["tenant_id"] == tenant_id and r["status"] in {"resolved", "rejected", "expired", "superseded"}
    ]
    return sorted(rows, key=lambda r: str(r.get("created_at") or ""), reverse=True)


def list_outcomes(tenant_id: str) -> list[dict[str, Any]]:
    return [r for r in _STORE.values() if r["tenant_id"] == tenant_id and r.get("outcome_measured")]


def summary(tenant_id: str) -> dict[str, Any]:
    open_rows = list_open(tenant_id)
    accepted = [
        r
        for r in _STORE.values()
        if r["tenant_id"] == tenant_id and r["status"] in {"watching", "resolved"}
    ]
    impact = sum(float((r.get("outcome_measured") or {}).get("actual_impact_inr") or 0) for r in accepted)
    top = open_rows[0] if open_rows else None
    return {
        "open_count": len(open_rows),
        "accepted_this_month": len(accepted),
        "total_impact_measured_inr": impact,
        "highest_confidence": None
        if top is None
        else {
            "id": top["id"],
            "title": top["title"],
            "confidence_score": top["confidence_score"],
            "expected_impact_min": top.get("expected_impact_min"),
            "expected_impact_max": top.get("expected_impact_max"),
            "recommendation_type": top["recommendation_type"],
        },
    }


def accept(rec_id: str, tenant_id: str, notes: str | None) -> dict[str, Any] | None:
    row = get(rec_id, tenant_id)
    if not row:
        return None
    row["status"] = "watching"
    row["owner_response"] = notes
    row["owner_response_at"] = now_utc().isoformat()
    row["outcome_measurement_due"] = (now_utc() + timedelta(days=14)).isoformat()
    return row


def snooze(rec_id: str, tenant_id: str, days: int, reason: str | None) -> dict[str, Any] | None:
    row = get(rec_id, tenant_id)
    if not row:
        return None
    row["status"] = "snoozed"
    row["snooze_reason"] = reason
    row["snooze_until"] = (now_utc() + timedelta(days=days or 7)).isoformat()
    return row


def reject(rec_id: str, tenant_id: str, reason: str) -> dict[str, Any] | None:
    row = get(rec_id, tenant_id)
    if not row:
        return None
    row["status"] = "rejected"
    row["reject_reason"] = reason
    row["owner_response"] = reason
    row["owner_response_at"] = now_utc().isoformat()
    return row


def snapshot() -> list[dict[str, Any]]:
    return [deepcopy(r) for r in _STORE.values()]


def all_watching_due(as_of: datetime | None = None) -> list[dict[str, Any]]:
    stamp = as_of or now_utc()
    due: list[dict[str, Any]] = []
    for row in _STORE.values():
        if row["status"] != "watching" or row.get("outcome_measured"):
            continue
        raw = row.get("outcome_measurement_due")
        if not raw:
            continue
        when = datetime.fromisoformat(raw.replace("Z", "+00:00")) if isinstance(raw, str) else raw
        if when <= stamp:
            due.append(row)
    return due
