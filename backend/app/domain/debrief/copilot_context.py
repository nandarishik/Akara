"""Load authorized weekly debrief context for Copilot."""

from __future__ import annotations

import json
from uuid import UUID

from fastapi import HTTPException, status

from app.core.tenant import get_supabase_service_client


def load_debrief_context_addendum(tenant_id: UUID, report_id: UUID) -> str:
    """Return planner/synthesizer addendum from tenant-owned debrief metadata."""
    supa = get_supabase_service_client()
    result = (
        supa.table("generated_reports")
        .select("metadata, title")
        .eq("id", str(report_id))
        .eq("tenant_id", str(tenant_id))
        .eq("report_type", "weekly_debrief")
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Weekly debrief report not found",
        )

    meta = result.data.get("metadata") or {}
    summary = {
        "report_title": result.data.get("title"),
        "week_start": meta.get("week_start"),
        "week_end": meta.get("week_end"),
        "headline": meta.get("headline"),
        "went_right": meta.get("went_right", [])[:3],
        "went_wrong": meta.get("went_wrong", [])[:3],
        "actions": meta.get("actions", [])[:3],
        "momentum": meta.get("momentum", {}),
        "limited_mode": meta.get("limited_mode", False),
    }
    return (
        "\n\n--- AUTHORIZED WEEKLY DEBRIEF CONTEXT (use only these facts) ---\n"
        + json.dumps(summary, indent=2)
        + "\n--- END DEBRIEF CONTEXT ---\n"
        "Answer questions about this week's debrief using only the context above. "
        "Do not invent numbers or party names not listed."
    )
