"""Daily founder operational brief — 7 AM IST target."""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from app.core.config import settings
from app.core.tenant import get_supabase_service_client
from app.domain.billing.email import _send
from app.domain.superadmin.ops_context import build_ops_context

logger = logging.getLogger(__name__)


def generate_founder_brief_text() -> str:
    ctx = build_ops_context()
    hotspots = ctx.get("quota_hotspots") or []
    hotspot_lines = [
        f"- Tenant {h['tenant_id'][:8]}… ({h['plan']}): {h['pct']}% copilot quota"
        for h in hotspots[:5]
    ]
    failures = ctx.get("cron_failures") or []
    failure_lines = [
        f"- {f.get('job_name')}: {f.get('error_message', 'failed')[:80]}"
        for f in failures[:3]
    ]
    fb = ctx.get("copilot_feedback") or {}
    return (
        f"AKARA Founder Brief — {datetime.now(UTC).strftime('%Y-%m-%d')}\n\n"
        f"MRR: ₹{ctx['mrr_inr']:,} | ARR: ₹{ctx['arr_inr']:,} | "
        f"Margin est: {ctx['estimated_gross_margin_pct']}%\n"
        f"Tenants: {ctx['total_tenants']} (free {ctx['tenants_by_plan']['free']}, "
        f"pro {ctx['tenants_by_plan']['pro']}, business {ctx['tenants_by_plan']['business']})\n"
        f"Churned this month: {ctx['churned_this_month']}\n"
        f"LLM cost (USD): ${ctx['llm_cost_usd_this_month']}\n"
        f"Copilot feedback: +{fb.get('positive', 0)} / -{fb.get('negative', 0)}\n\n"
        f"Quota hotspots:\n" + ("\n".join(hotspot_lines) or "- None") + "\n\n"
        f"Cron failures:\n" + ("\n".join(failure_lines) or "- None") + "\n"
    )


def run_founder_brief() -> dict:
    text = generate_founder_brief_text()
    supa = get_supabase_service_client()
    now = datetime.now(UTC).isoformat()

    row = {
        "brief_text": text,
        "generated_at": now,
        "delivery_status": "generated",
    }
    try:
        supa.table("founder_brief_runs").insert(row).execute()
    except Exception as exc:
        logger.warning("Could not persist founder brief run: %s", exc)

    email = settings.founder_brief_email if hasattr(settings, "founder_brief_email") else None
    if not email:
        email = getattr(settings, "FOUNDER_BRIEF_EMAIL", None)

    sent = False
    if email:
        html = f"<pre style='font-family:monospace;font-size:13px;'>{text}</pre>"
        sent = _send(email, "AKARA Founder Daily Brief", html)
        if sent:
            row["delivery_status"] = "emailed"

    return {"ok": True, "text": text, "emailed": sent, "generated_at": now}


def main() -> None:
    from app.core.cron_ping import ping_cron_health

    logging.basicConfig(level=logging.INFO)
    try:
        result = run_founder_brief()
        ping_cron_health("founder_brief", details=result)
    except Exception:
        logger.exception("Founder brief failed")
        ping_cron_health("founder_brief", status="failed")
        raise


if __name__ == "__main__":
    main()
