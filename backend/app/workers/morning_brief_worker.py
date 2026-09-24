"""Daily morning brief worker (07:00 IST / 01:30 UTC)."""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

from app.core.tenant import get_supabase_service_client
from app.domain.intelligence.morning_brief import (
    SYSTEM_PROMPT,
    build_morning_brief_context,
)
from app.domain.intelligence.weather_service import enrich_with_weather
from app.domain.intelligence.worker_runs import finish_run, start_run
from app.infra.email.morning_brief import MorningBriefService

logger = logging.getLogger("akara.workers.morning_brief")


def assemble_preview(tenant_id: str, *, brief_date: date | None = None) -> dict[str, Any]:
    day = brief_date or datetime.now(UTC).date()
    supa = get_supabase_service_client()
    weather = None
    try:
        profile = (
            supa.table("tenant_profiles")
            .select("city_slug, latitude, longitude")
            .eq("tenant_id", tenant_id)
            .maybe_single()
            .execute()
            .data
        )
        if profile and profile.get("latitude") is not None:
            def cache_get(slug: str, cache_date: date) -> dict[str, Any] | None:
                return (
                    supa.table("weather_cache")
                    .select("*")
                    .eq("city_slug", slug)
                    .eq("cache_date", cache_date.isoformat())
                    .maybe_single()
                    .execute()
                    .data
                )

            def cache_put(slug: str, cache_date: date, row: dict[str, Any]) -> None:
                # Typed columns only — raw_response stored as JSONB, never concatenated into SQL.
                supa.table("weather_cache").upsert(
                    {
                        "city_slug": slug,
                        "cache_date": cache_date.isoformat(),
                        "temp_max_c": row["temp_max_c"],
                        "precipitation_mm": row["precipitation_mm"],
                        "weather_code": row["weather_code"],
                        "raw_response": row.get("raw_response") or {},
                    }
                ).execute()

            weather = enrich_with_weather(
                city_slug=profile.get("city_slug") or "unknown",
                cache_date=day,
                latitude=float(profile["latitude"]),
                longitude=float(profile["longitude"]),
                cache_get=cache_get,
                cache_put=cache_put,
            )
    except Exception:
        logger.warning("weather omitted tenant=%s", tenant_id)

    ctx = build_morning_brief_context(
        brief_date=day.isoformat(),
        revenue_yesterday=0.0,
        revenue_same_day_lw=0.0,
        food_cost_ratio=None,
        top_items=[],
        forecast_tomorrow=None,
        weather=weather,
    )
    ctx["system_prompt"] = SYSTEM_PROMPT
    return ctx


def run_morning_brief_worker() -> dict[str, Any]:
    run = start_run("morning_brief_worker")
    logger.info("worker_start worker=morning_brief_worker")
    supa = get_supabase_service_client()
    profiles = (
        supa.table("profiles")
        .select("tenant_id, id")
        .eq("role", "admin")
        .execute()
        .data
        or []
    )
    service = MorningBriefService(supabase=supa)
    sent = 0
    for profile in profiles:
        tid = profile.get("tenant_id")
        if not tid:
            continue
        try:
            assemble_preview(str(tid))
            # Per-recipient send stays on existing MorningBriefService
            user = None
            try:
                user = supa.auth.admin.get_user_by_id(profile["id"])
            except Exception:
                user = None
            email = user.user.email if user and user.user else None
            if email:
                service.send_brief(
                    tenant_id=UUID(str(tid)),
                    recipient_email=email,
                    recipient_name="",
                    tenant_name="AKARA Tenant",
                )
                sent += 1
            run["success_count"] += 1
        except Exception:
            logger.exception("morning_brief tenant failed tenant=%s", tid)
            run["errors_count"] += 1
        run["tenants_processed"] += 1
    finish_run(run, status="success", briefs_sent_email=sent, briefs_sent_whatsapp=0)
    try:
        supa.table("worker_runs").insert(run).execute()
    except Exception:
        logger.warning("worker_runs insert skipped")
    logger.info("worker_complete worker=morning_brief_worker sent=%s", sent)
    return run
