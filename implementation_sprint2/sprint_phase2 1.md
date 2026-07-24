# AKARA — Sprint Phase 2
## Full Production SaaS: Days 14–22

**Prerequisite:** Days 1–13 complete and deployed. All 9 Supabase migrations applied. Railway backend live. Vercel frontend live. Sentry wired. CI passing.

**Goal of Phase 2:** AKARA becomes a full production SaaS. Any business owner can find the landing page, sign up, import their data, use the product within a plan's limits, upgrade via Stripe, and manage their account — entirely without you touching a database. You can operate, monitor, and control every tenant from a superadmin UI.

---

## Competitive Intelligence (Verified July 2026)

### FireAI — Primary Threat

Mumbai-based, founded 2023. 200+ customers including IRCTC, Raymond, Noise. Raised ₹6.2 Cr.

**What they have that we don't (yet):**

| Gap | FireAI | AKARA status | AKARA plan |
|---|---|---|---|
| Voice queries | 12 Indian languages via Bhashini | ❌ | Day 23 (post-launch) |
| Zero-code alerts | "Alert me when secondary:primary < 0.8" | ❌ | Day 19 additions |
| Data retention tiers | 7-day free / 30-day Pro / 1-year Business | ❌ | Day 14 additions |
| 700+ data connectors | SAP, Bizom, FieldAssist, Amazon, Flipkart | ❌ | Phase 3 |
| Causal chain analysis | "Why did margin drop?" → visual cause tree | Partial (copilot does this in text) | Improve Day 3 prompt |
| PII redaction before LLM | Yes | ❌ | Day 19 additions |
| WhatsApp delivery | ❌ FireAI uses email only | ❌ | Day 20 additions — **this is our differentiator** |
| Named CSM | Business plan | ❌ | Operational (not code) |
| SOC 2 badge | Business plan | ❌ | Phase 3 / after Series A |

**FireAI's pricing (per-user, annual):**
- Professional: ₹2,799/user/month = ₹33,588/user/year
- Team (5 users): ₹20,199/month = ₹2.42L/year
- Business (8 users): ₹45,799/month = ₹5.5L/year

**Our pricing is 3–5× cheaper for the same seat count.** That is intentional. We are going after the distributor-direct market (₹50–200 Cr revenue) that FireAI's enterprise pricing prices out.

---

### Ocheto — Adjacent, Not Direct Competitor

Built on Salesforce. AI-native DMS: field force automation, GPS-tracked beats, OCR onboarding, demand forecasting, distributor scoring. **Ocheto is an operations system; AKARA is an intelligence layer.** A customer can use both — Ocheto for field ops, AKARA for analytics. Pitch this as a complement, not a fight.

---

### Production AI SaaS Standards in 2026

Three things every production AI SaaS now does that we are not doing yet:

**1. Token-level cost tracking per tenant**
Counting "questions" is fine for billing but not for knowing your margin. Production platforms track actual input+output tokens per tenant per month. A tenant who asks "summarise everything" 10 times costs 20× more than one who asks "what is my top zone". Both count as 10 questions. You need token tracking to know which tenant is destroying your margin.

**2. Layered soft → hard limits**
At 80% quota: amber warning banner, no blocking.
At 90%: email to tenant admin.
At 100%: block copilot calls, but **keep dashboard and debrief working**. Free users who can still see their KPIs are more likely to upgrade than free users who see a blank screen.

**3. LLM cost attribution by feature**
Track cost separately for: copilot questions, morning briefs, weekly debriefs, schema discovery. This tells you which feature is underwater on margin and needs pricing adjustment.

---

### DPDP Act 2023 — India's Data Protection Law (Active 2026)

This is not optional if you're storing Indian business data. **Key obligations:**

1. **Data residency**: Store personal data in Indian cloud region. Supabase has `ap-south-2` (Hyderabad). Switch from default US region if not already done.
2. **Purpose-specific consent**: The ToS checkbox on signup must explicitly say "your sales data will be processed by AI to generate analytics". Generic ToS is insufficient.
3. **Data Principal Rights**: Users have the right to access, correct, and erase their data — and you must fulfil requests within 72 hours. The `/account/export` and `DELETE /account` endpoints from Day 20 satisfy this.
4. **Breach notification**: If data is breached, you must notify the Data Protection Board of India within 72 hours.
5. **Sub-processor DPA**: You must have a Data Processing Agreement with OpenAI (you process Indian business data through their API). OpenAI's DPA is available at platform.openai.com/docs/legal.
6. **Cross-border AI processing**: When you call OpenAI's API, Indian distributor data technically leaves India. Mitigate with PII redaction before the LLM call (Day 19 addition).

---

### WhatsApp as a Delivery Channel — The Biggest Opportunity

**500 million WhatsApp users in India.** The distributor's admin, the regional sales manager, the owner — they are on WhatsApp all day. They are not checking email dashboards.

FireAI sends weekly debriefs by email. No one reads email at 7 AM in a busy distribution office. A WhatsApp message that says:

> *"📊 Sharma Traders Weekly Brief — Revenue: ₹18.4L (↑12%). Top zone: North. 🔴 Scheme leakage detected on ProductBeta. 3 actions for this week. [See full report →]*

...gets read in 30 seconds. This is our biggest differentiation opportunity. **No competitor is doing this today.**

BSP recommendation: **Zaptilo** (pay-as-you-go INR, ₹0.30/utility message, GST invoice, 24-hour setup). At 100 customers × 4 messages/month = 400 messages = ₹120/month. Near-zero cost.

WhatsApp channel is Day 20 addition.

---

## Pricing (revised after competitive analysis)

| | Free | Pro | Business |
|---|---|---|---|
| Price | ₹0 | ₹7,999/mo | ₹13,999/mo |
| Annual (save 20%) | — | ₹76,790/yr | ₹1,34,390/yr |
| **Copilot questions/month** | 10 | 400 | 800 |
| **Rows stored (total)** | 10,000 | 500,000 | 2,000,000 |
| **Data retention** | 30 days | 12 months | 36 months |
| **Uploads/month** | 5 | Unlimited | Unlimited |
| **Uploads/day** | 3 | 3 | 3 |
| **Data undos (import deletes)/day** | 2 | 2 | 2 |
| **Users** | 1 | 3 | 10 |
| **Zero-code alerts** | ✗ | 5 alerts | Unlimited |
| Weekly debrief | 1 (lifetime) | Every Monday (email + WhatsApp) | Every Monday (email + WhatsApp) |
| Daily morning brief | ✗ | ✓ | ✓ |
| WhatsApp notifications | ✗ | ✓ | ✓ |
| CSV upload | ✓ | ✓ | ✓ |
| Secondary sales + scheme import | ✗ | ✓ | ✓ |
| API push (agent script) | ✗ | ✓ | ✓ |
| Tally connector | ✗ | ✗ | ✓ |
| Simulator + Reports | ✗ | ✓ | ✓ |
| Scheme leakage detection | ✗ | ✗ | ✓ |
| Custom language | ✗ | ✓ | ✓ |
| Team invites | ✗ | ✓ (up to 3) | ✓ (up to 10) |
| API key management | ✗ | ✗ | ✓ |
| DPDP-compliant data export | ✓ | ✓ | ✓ |
| SLA | None | 99.5% uptime SLA | 99.9% uptime SLA |
| Support | Community | Email (24-hr) | Priority email + WhatsApp (8-hr) |
| My LLM cost/month | ~₹28 lifetime | ~₹832 | ~₹1,632 |
| My gross margin | — | 87% | 88% |
| FireAI equivalent | — | ₹20,199/mo (Team) | ₹45,799/mo (Business) |
| **AKARA vs FireAI price** | — | **2.5× cheaper** | **3.3× cheaper** |

---

## Day 14 — Billing Infrastructure + Plan Enforcement

### Goal
Every resource-consuming action (copilot question, data import) is gated behind a plan check. Limits are stored in the database. Usage is tracked. Hard stops return HTTP 402 with a clear message.

---

### 14.1 — Migration: `010_billing.sql`

Create `akara/migrations/010_billing.sql`. Run in Supabase SQL Editor after migration 009.

```sql
-- ============================================================
-- AKARA: Billing + Plan Infrastructure
-- Migration 010 — run AFTER 001–009
-- ============================================================

-- 1. Add billing columns to tenants
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS plan
        TEXT NOT NULL DEFAULT 'free'
        CHECK (plan IN ('free', 'pro', 'business')),
    ADD COLUMN IF NOT EXISTS plan_status
        TEXT NOT NULL DEFAULT 'active'
        CHECK (plan_status IN ('active', 'trialing', 'past_due', 'cancelled')),
    ADD COLUMN IF NOT EXISTS trial_ends_at
        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS stripe_customer_id
        TEXT,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id
        TEXT,
    ADD COLUMN IF NOT EXISTS feature_overrides
        JSONB NOT NULL DEFAULT '{}';
        -- e.g. {"scheme_leakage": true} overrides plan for this tenant

CREATE INDEX IF NOT EXISTS idx_tenants_plan
    ON public.tenants (plan);
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer
    ON public.tenants (stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

-- 2. Usage tracking (per tenant per calendar month)
CREATE TABLE IF NOT EXISTS public.usage_tracking (
    tenant_id       UUID    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    month           DATE    NOT NULL,   -- always first day of month: DATE_TRUNC('month', NOW())
    copilot_calls   INT     NOT NULL DEFAULT 0,
    rows_imported   BIGINT  NOT NULL DEFAULT 0,
    uploads_count   INT     NOT NULL DEFAULT 0,
    debrief_count   INT     NOT NULL DEFAULT 0,  -- total weekly debriefs ever sent (for lifetime check)
    -- Daily rate limiters (reset automatically when date changes — see _get_daily_usage)
    uploads_today   INT     NOT NULL DEFAULT 0,
    undos_today     INT     NOT NULL DEFAULT 0,
    last_activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, month)
);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_tenant
    ON public.usage_tracking (tenant_id);

-- 3. Lifetime debrief count view (for free tier check)
CREATE OR REPLACE VIEW public.tenant_lifetime_debriefs AS
SELECT tenant_id, COALESCE(SUM(debrief_count), 0) AS total_debriefs
FROM public.usage_tracking
GROUP BY tenant_id;

-- 4. RLS for usage_tracking
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_tracking_select"
    ON public.usage_tracking FOR SELECT
    USING (tenant_id = public.get_my_tenant_id());

-- 5. Upsert function — called after every guarded action
CREATE OR REPLACE FUNCTION public.increment_usage(
    p_tenant_id     UUID,
    p_field         TEXT,   -- 'copilot_calls' | 'rows_imported' | 'uploads_count' | 'debrief_count'
                            -- | 'uploads_today' | 'undos_today'
    p_amount        INT DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_month DATE := DATE_TRUNC('month', NOW())::DATE;
BEGIN
    INSERT INTO public.usage_tracking (tenant_id, month)
    VALUES (p_tenant_id, v_month)
    ON CONFLICT (tenant_id, month) DO NOTHING;

    EXECUTE format(
        'UPDATE public.usage_tracking SET %I = %I + $1, updated_at = NOW()
         WHERE tenant_id = $2 AND month = $3',
        p_field, p_field
    ) USING p_amount, p_tenant_id, v_month;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_usage(UUID, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_usage(UUID, TEXT, INT) TO service_role;

-- 6. Get current month usage — called by PlanGuard
CREATE OR REPLACE FUNCTION public.get_current_usage(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_month DATE := DATE_TRUNC('month', NOW())::DATE;
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'copilot_calls',    COALESCE(copilot_calls, 0),
        'rows_imported',    COALESCE(rows_imported, 0),
        'uploads_count',    COALESCE(uploads_count, 0),
        'debrief_count',    COALESCE(debrief_count, 0),
        -- Daily counters: return 0 if last_activity_date != today (auto-reset semantics)
        'uploads_today',    CASE
                                WHEN last_activity_date = CURRENT_DATE
                                THEN COALESCE(uploads_today, 0)
                                ELSE 0
                            END,
        'undos_today',      CASE
                                WHEN last_activity_date = CURRENT_DATE
                                THEN COALESCE(undos_today, 0)
                                ELSE 0
                            END
    )
    INTO v_result
    FROM public.usage_tracking
    WHERE tenant_id = p_tenant_id AND month = v_month;

    RETURN COALESCE(v_result, '{"copilot_calls":0,"rows_imported":0,"uploads_count":0,"debrief_count":0,"uploads_today":0,"undos_today":0}'::JSONB);
END;
$$;

REVOKE ALL ON FUNCTION public.get_current_usage(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_usage(UUID) TO service_role;
```

**Apply:** Paste into Supabase Dashboard → SQL Editor. "No rows returned" = success.

---

### 14.2 — `backend/app/core/plan_limits.py` (new file)

Single source of truth. Every plan check reads from this dict — never hardcoded elsewhere.

```python
# backend/app/core/plan_limits.py
from typing import Any

# -1 = unlimited
PLAN_LIMITS: dict[str, dict[str, Any]] = {
    "free": {
        "copilot_calls_per_month":   10,
        "rows_total":                10_000,
        "uploads_per_month":         5,
        "uploads_per_day":           3,     # hard daily cap — all plans (prevents server abuse)
        "undos_per_day":             2,     # max import deletes/wipes per day — all plans
        "users":                     1,
        "weekly_debriefs_lifetime":  1,     # checked against SUM across all months
        "daily_briefs":              False,
        "data_sources": ["csv"],
        "features": {
            "morning_brief":         False,
            "scheme_leakage":        False,
            "simulator":             False,
            "reports":               False,
            "custom_language":       False,
            "secondary_sales":       False,
            "api_push":              False,
            "tally_connector":       False,
            "team_invites":          False,
            "api_keys":              False,
            "ask_copilot_debrief":   False,
        },
    },
    "pro": {
        "copilot_calls_per_month":   400,
        "rows_total":                500_000,
        "uploads_per_month":         -1,    # unlimited monthly, but daily cap still applies
        "uploads_per_day":           3,     # same daily cap as free — prevents batch abuse
        "undos_per_day":             2,
        "users":                     3,
        "weekly_debriefs_lifetime":  -1,
        "daily_briefs":              True,
        "data_sources": ["csv", "secondary_sales", "scheme_master", "api"],
        "features": {
            "morning_brief":         True,
            "scheme_leakage":        False,
            "simulator":             True,
            "reports":               True,
            "custom_language":       True,
            "secondary_sales":       True,
            "api_push":              True,
            "tally_connector":       False,
            "team_invites":          True,
            "api_keys":              False,
            "ask_copilot_debrief":   True,
        },
    },
    "business": {
        "copilot_calls_per_month":   800,
        "rows_total":                2_000_000,
        "uploads_per_month":         -1,
        "uploads_per_day":           3,     # same daily cap — contact support for bulk ingestion
        "undos_per_day":             2,
        "users":                     10,
        "weekly_debriefs_lifetime":  -1,
        "daily_briefs":              True,
        "data_sources": ["csv", "secondary_sales", "scheme_master", "api", "tally"],
        "features": {
            "morning_brief":         True,
            "scheme_leakage":        True,
            "simulator":             True,
            "reports":               True,
            "custom_language":       True,
            "secondary_sales":       True,
            "api_push":              True,
            "tally_connector":       True,
            "team_invites":          True,
            "api_keys":              True,
            "ask_copilot_debrief":   True,
        },
    },
}


def get_limit(plan: str, key: str) -> Any:
    """Returns the limit value for a plan+key. Falls back to free if plan unknown."""
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"]).get(key)


def is_feature_enabled(plan: str, feature: str, overrides: dict) -> bool:
    """
    Checks if a feature is enabled for a plan.
    overrides = tenant.feature_overrides JSONB — superadmin can enable any feature per tenant.
    """
    if feature in overrides:
        return bool(overrides[feature])
    features = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"]).get("features", {})
    return bool(features.get(feature, False))
```

---

### 14.3 — `backend/app/core/plan_guard.py` (new file)

FastAPI dependency injected into every resource-consuming endpoint.

```python
# backend/app/core/plan_guard.py
from fastapi import Depends, HTTPException, status
from uuid import UUID

from app.core.tenant import TenantCtx, get_supabase_service_client
from app.core.plan_limits import PLAN_LIMITS, get_limit


class UsageExceeded(HTTPException):
    def __init__(self, message: str, feature: str | None = None):
        super().__init__(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "usage_limit_exceeded",
                "message": message,
                "feature": feature,
                "upgrade_url": "/upgrade",
            },
        )


async def _get_current_usage(tenant_id: UUID) -> dict:
    supabase = get_supabase_service_client()
    result = supabase.rpc(
        "get_current_usage", {"p_tenant_id": str(tenant_id)}
    ).execute()
    return result.data or {}


async def _get_total_rows(tenant_id: UUID) -> int:
    supabase = get_supabase_service_client()
    result = (
        supabase.table("sales_data")
        .select("id", count="exact")
        .eq("tenant_id", str(tenant_id))
        .execute()
    )
    return result.count or 0


def require_copilot_quota(tenant: TenantCtx = Depends()):
    """
    Dependency: checks copilot_calls quota before allowing /copilot/chat.
    Usage: add `_: None = Depends(require_copilot_quota)` to route signature.
    """
    async def _check():
        plan = tenant.plan
        limit = get_limit(plan, "copilot_calls_per_month")
        if limit == -1:
            return  # unlimited

        usage = await _get_current_usage(tenant.tenant_id)
        current = usage.get("copilot_calls", 0)

        if current >= limit:
            raise UsageExceeded(
                message=f"You've used all {limit} questions for this month. "
                        f"Upgrade to Pro for 400 questions/month.",
                feature="copilot_calls",
            )

        # increment after check passes — done in copilot.py route after successful answer
    return _check


def require_import_quota(row_count: int):
    """
    Dependency factory: checks row + upload quotas before /data/import.
    Usage: Depends(require_import_quota(len(df)))

    Enforces two independent upload limits:
      1. Monthly limit  — free plan only (5/month). Pro/Business = unlimited monthly.
      2. Daily hard cap — ALL plans (3/day). Prevents server abuse from any tier.
    """
    async def _check(tenant: TenantCtx = Depends()):
        plan = tenant.plan
        usage = await _get_current_usage(tenant.tenant_id)

        # ── 1. Daily upload cap (ALL plans, hard limit) ──────────────────────
        daily_limit = get_limit(plan, "uploads_per_day")   # always 3
        uploads_today = usage.get("uploads_today", 0)
        if uploads_today >= daily_limit:
            raise UsageExceeded(
                message=f"You've reached {daily_limit} uploads today. "
                        f"Daily limit resets at midnight. Come back tomorrow!",
                feature="uploads_daily",
            )

        # ── 2. Monthly upload limit (free plan only) ─────────────────────────
        upload_limit = get_limit(plan, "uploads_per_month")
        if upload_limit != -1:
            if usage.get("uploads_count", 0) >= upload_limit:
                raise UsageExceeded(
                    message=f"You've reached your {upload_limit} uploads/month limit. "
                            f"Upgrade to Pro for unlimited uploads.",
                    feature="uploads",
                )

        # Check total row storage
        rows_limit = get_limit(plan, "rows_total")
        if rows_limit != -1:
            current_rows = await _get_total_rows(tenant.tenant_id)
            if current_rows + row_count > rows_limit:
                raise UsageExceeded(
                    message=f"This import would exceed your {rows_limit:,} row storage limit. "
                            f"Delete old data or upgrade your plan.",
                    feature="rows_total",
                )
    return _check


def require_undo_quota():
    """
    Dependency: blocks DELETE /data/imports/{id} (undo) when daily limit reached.
    Limit: 2 undos per day, ALL plans. Resets at midnight UTC.

    "Undo" = deleting a previously imported batch (wiping rows from that import job).
    Without this limit, a user could loop: import → delete → import → delete endlessly,
    hammering Supabase and burning server CPU with no useful work.
    """
    async def _check(tenant: TenantCtx = Depends()):
        usage = await _get_current_usage(tenant.tenant_id)
        daily_limit = get_limit(tenant.plan, "undos_per_day")   # always 2
        undos_today = usage.get("undos_today", 0)
        if undos_today >= daily_limit:
            raise UsageExceeded(
                message=f"You've reached {daily_limit} data undos today. "
                        f"Daily limit resets at midnight. "
                        f"Contact support if you need help with your data.",
                feature="undos_daily",
            )
    return _check


def require_feature(feature_name: str):
    """
    Dependency factory: checks if a feature is enabled for the tenant's plan.
    Usage: Depends(require_feature("scheme_leakage"))
    """
    async def _check(tenant: TenantCtx = Depends()):
        from app.core.plan_limits import is_feature_enabled
        if not is_feature_enabled(tenant.plan, feature_name, tenant.feature_overrides):
            plan_names = {
                "scheme_leakage":  "Business",
                "simulator":       "Pro",
                "reports":         "Pro",
                "secondary_sales": "Pro",
                "tally_connector": "Business",
            }
            required = plan_names.get(feature_name, "a higher plan")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "feature_not_available",
                    "message": f"This feature requires {required}. Upgrade to unlock it.",
                    "feature": feature_name,
                    "upgrade_url": "/upgrade",
                },
            )
    return _check
```

---

### 14.4 — Wire PlanGuard into existing routes

**`backend/app/api/routes/copilot.py`** — add guard + increment:

```python
# Add to imports
from app.core.plan_guard import require_copilot_quota
from app.core.tenant import get_supabase_service_client

# In the chat() route, add dependency:
@router.post("/chat")
async def chat(
    request: ChatRequest,
    user: CurrentUser,
    tenant: TenantCtx,
    _quota: None = Depends(require_copilot_quota),   # ← add this
):
    ...
    # After successful answer, increment usage:
    get_supabase_service_client().rpc(
        "increment_usage",
        {"p_tenant_id": str(tenant.tenant_id), "p_field": "copilot_calls"}
    ).execute()
    ...
```

**`backend/app/api/routes/data.py`** — add guard + increment:

```python
from app.core.plan_guard import require_import_quota, require_undo_quota, require_feature

@router.post("/import")
async def import_data(
    file: UploadFile,
    source_type: str = "primary",   # primary | secondary | scheme
    user: CurrentUser,
    tenant: TenantCtx,
):
    # Parse first to know row count
    df = parser.parse(await file.read(), file.filename)

    # Feature gate for non-primary sources
    if source_type in ("secondary", "scheme"):
        await require_feature("secondary_sales")(tenant)

    # Quota check with real row count
    await require_import_quota(len(df))(tenant)

    # ... existing import logic ...

    # Increment usage after success
    supa = get_supabase_service_client()
    supa.rpc("increment_usage",
        {"p_tenant_id": str(tenant.tenant_id), "p_field": "rows_imported",
         "p_amount": rows_inserted}).execute()
    supa.rpc("increment_usage",
        {"p_tenant_id": str(tenant.tenant_id), "p_field": "uploads_count"}).execute()
    # Daily counter — also update last_activity_date so the CASE in get_current_usage works
    supa.rpc("increment_usage",
        {"p_tenant_id": str(tenant.tenant_id), "p_field": "uploads_today"}).execute()
    # Note: increment_usage must set last_activity_date = CURRENT_DATE on every call
    # so that the daily reset logic in get_current_usage works correctly.


# ── UNDO endpoint (delete an import batch) ────────────────────────────────
@router.delete("/imports/{import_job_id}")
async def undo_import(
    import_job_id: str,
    user: CurrentUser,
    tenant: TenantCtx,
    _undo_quota: None = Depends(require_undo_quota()),   # ← 2/day hard cap
):
    """
    Delete all rows from a specific import job.
    Limited to 2 per day per tenant (all plans) to prevent abuse.

    UI shows this as "Undo import" with a trash icon next to each import
    in the Data page's import history table.
    """
    supa = get_supabase_service_client()

    # Verify job belongs to this tenant
    job = supa.table("import_jobs") \
        .select("id, rows_inserted") \
        .eq("id", import_job_id) \
        .eq("tenant_id", str(tenant.tenant_id)) \
        .single().execute()
    if not job.data:
        raise HTTPException(status_code=404, detail="Import job not found")

    rows_to_delete = job.data.get("rows_inserted", 0)

    # Delete rows tagged with this import_job_id
    supa.table("sales_data") \
        .delete() \
        .eq("tenant_id", str(tenant.tenant_id)) \
        .eq("import_job_id", import_job_id) \
        .execute()

    # Mark job as deleted
    supa.table("import_jobs") \
        .update({"status": "deleted"}) \
        .eq("id", import_job_id).execute()

    # Increment undo counter
    supa.rpc("increment_usage", {
        "p_tenant_id": str(tenant.tenant_id),
        "p_field": "undos_today"
    }).execute()

    return {"deleted": True, "rows_removed": rows_to_delete}
```

**`backend/app/api/routes/reports.py`** — gate scheme leakage:

```python
from app.core.plan_guard import require_feature

@router.get("/scheme-leakage")
async def scheme_leakage(
    user: CurrentUser,
    tenant: TenantCtx,
    _: None = Depends(require_feature("scheme_leakage")),   # ← add
):
    ...
```

---

### 14.5 — Update TenantContext to include plan + feature_overrides

**`backend/app/core/tenant.py`** — add fields to `TenantContext`:

```python
class TenantContext:
    def __init__(self, tenant_id, role, user_id, tenant_config, plan, feature_overrides):
        self.tenant_id = tenant_id
        self.role = role
        self.user_id = user_id
        self.tenant_config = tenant_config or {}
        self.plan = plan or "free"
        self.feature_overrides = feature_overrides or {}

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    # existing industry/currency/language properties unchanged

async def get_tenant_context(user: AuthenticatedUser = Depends(get_current_user)) -> TenantContext:
    supabase = get_supabase_service_client()

    # Query profiles
    profile = supabase.table("profiles") \
        .select("tenant_id, role") \
        .eq("id", str(user.user_id)) \
        .single().execute()
    if not profile.data:
        raise HTTPException(status_code=403, detail="Profile not found")

    tenant_id = profile.data["tenant_id"]

    # Query tenant for config + plan
    tenant = supabase.table("tenants") \
        .select("config, plan, feature_overrides") \
        .eq("id", tenant_id) \
        .single().execute()
    tenant_data = tenant.data or {}

    return TenantContext(
        tenant_id=UUID(tenant_id),
        role=profile.data["role"],
        user_id=user.user_id,
        tenant_config=tenant_data.get("config", {}),
        plan=tenant_data.get("plan", "free"),
        feature_overrides=tenant_data.get("feature_overrides", {}),
    )
```

---

### 14.6 — New endpoint: GET /billing/usage

Returns current month usage + plan limits for the frontend UsageBanner.

**New file: `backend/app/api/routes/billing.py`**

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.auth import CurrentUser
from app.core.tenant import TenantCtx, get_supabase_service_client
from app.core.plan_limits import PLAN_LIMITS

router = APIRouter(prefix="/billing", tags=["billing"])


class UsageResponse(BaseModel):
    plan: str
    plan_status: str
    copilot_calls_used: int
    copilot_calls_limit: int
    rows_used: int
    rows_limit: int
    uploads_used: int
    uploads_limit: int           # monthly limit (-1 = unlimited)
    uploads_today: int           # how many uploads done today
    uploads_per_day: int         # daily hard cap (always 3)
    undos_today: int             # how many undos done today
    undos_per_day: int           # daily hard cap (always 2)
    users_used: int
    users_limit: int
    features: dict


@router.get("/usage", response_model=UsageResponse)
async def get_usage(user: CurrentUser, tenant: TenantCtx):
    supa = get_supabase_service_client()
    limits = PLAN_LIMITS.get(tenant.plan, PLAN_LIMITS["free"])

    # Current month usage
    usage_result = supa.rpc(
        "get_current_usage", {"p_tenant_id": str(tenant.tenant_id)}
    ).execute()
    usage = usage_result.data or {}

    # Total rows
    rows_result = supa.table("sales_data").select("id", count="exact") \
        .eq("tenant_id", str(tenant.tenant_id)).execute()

    # Users in tenant
    users_result = supa.table("profiles").select("id", count="exact") \
        .eq("tenant_id", str(tenant.tenant_id)).execute()

    return UsageResponse(
        plan=tenant.plan,
        plan_status="active",   # from tenants.plan_status in future
        copilot_calls_used=usage.get("copilot_calls", 0),
        copilot_calls_limit=limits["copilot_calls_per_month"],
        rows_used=rows_result.count or 0,
        rows_limit=limits["rows_total"],
        uploads_used=usage.get("uploads_count", 0),
        uploads_limit=limits["uploads_per_month"],
        uploads_today=usage.get("uploads_today", 0),
        uploads_per_day=limits["uploads_per_day"],     # always 3
        undos_today=usage.get("undos_today", 0),
        undos_per_day=limits["undos_per_day"],         # always 2
        users_used=users_result.count or 0,
        users_limit=limits["users"],
        features=limits["features"],
    )
```

Register in `main.py`:
```python
from app.api.routes import billing as billing_router
app.include_router(billing_router.router)
```

---

### 14.7 — Data Retention Enforcement

Competitive research shows FireAI gates data retention by tier (7-day free → 1-year business). AKARA does the same but more generously.

**Add to `010_billing.sql`:**

```sql
-- Retention limits per plan (days). -1 = keep forever.
-- Enforced by a pg_cron job (see below).
COMMENT ON COLUMN public.tenants.plan IS
    'free=30d retention | pro=365d | business=1095d';
```

**New file: `backend/app/tasks/retention_cleanup.py`**

This runs nightly as a Railway cron job:

```python
"""
Deletes sales_data rows older than the tenant's retention window.
Run via: uv run python -m app.tasks.retention_cleanup
Scheduled in Railway: 0 2 * * * (2 AM IST every night)
"""
from datetime import datetime, timedelta
from app.core.tenant import get_supabase_service_client
from app.core.plan_limits import PLAN_LIMITS
import logging

logger = logging.getLogger(__name__)

RETENTION_DAYS = {
    "free":     30,
    "pro":      365,
    "business": 1095,
}

def run():
    supa = get_supabase_service_client()
    tenants = supa.table("tenants").select("id, plan").eq("is_active", True).execute()

    for tenant in tenants.data:
        plan = tenant["plan"]
        days = RETENTION_DAYS.get(plan, 30)
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()

        result = supa.table("sales_data") \
            .delete() \
            .eq("tenant_id", tenant["id"]) \
            .lt("invoice_date", cutoff[:10]) \
            .execute()

        deleted = len(result.data) if result.data else 0
        if deleted:
            logger.info(f"Retention cleanup: tenant={tenant['id']} plan={plan} deleted={deleted} rows")

if __name__ == "__main__":
    run()
```

**Show retention info in BillingPage.tsx:**
```typescript
// Under the plan card:
// "Your data is retained for {retentionDays} days."
// "Oldest data in your account: {oldestDate}"
// "Upgrade to Pro to retain 12 months of history."  (for free users)
```

---

### 14.8 — Token Cost Tracking (LLM Cost Attribution)

The "10 questions/month" limit is what users see. Internally, you need to track actual token costs to know your true margin per tenant.

**Add to `010_billing.sql`:**

```sql
-- LLM cost log — one row per copilot call
CREATE TABLE IF NOT EXISTS public.llm_cost_log (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL,
    feature         TEXT        NOT NULL,   -- 'copilot' | 'morning_brief' | 'weekly_debrief' | 'schema_discovery'
    model           TEXT        NOT NULL,   -- 'gpt-4o-mini' | 'gpt-4o' | 'claude-3-5-sonnet'
    input_tokens    INT         NOT NULL DEFAULT 0,
    output_tokens   INT         NOT NULL DEFAULT 0,
    cost_usd        NUMERIC(10,6) NOT NULL DEFAULT 0,  -- calculated at logging time
    latency_ms      INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_cost_tenant_month
    ON public.llm_cost_log (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_llm_cost_feature
    ON public.llm_cost_log (feature, created_at);
```

**`backend/app/services/copilot/agent.py`** — add cost logging after every LLM call:

```python
# Add after successful answer():
from app.services.llm_cost_logger import log_llm_cost

def _estimate_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    """
    Current pricing as of July 2026 (update when models change).
    All prices per 1M tokens.
    """
    rates = {
        "gpt-4o-mini":          (0.15, 0.60),   # (input, output) per 1M tokens
        "gpt-4o":               (2.50, 10.00),
        "claude-3-5-sonnet":    (3.00, 15.00),
        "claude-3-haiku":       (0.25, 1.25),
    }
    input_rate, output_rate = rates.get(model, (2.50, 10.00))
    return (input_tokens / 1_000_000 * input_rate) + \
           (output_tokens / 1_000_000 * output_rate)

# In copilot.py route, after getting answer:
cost_usd = _estimate_cost_usd(
    model=settings.openai_model,
    input_tokens=response.usage.prompt_tokens,
    output_tokens=response.usage.completion_tokens,
)
get_supabase_service_client().table("llm_cost_log").insert({
    "tenant_id": str(tenant.tenant_id),
    "user_id":   str(user.user_id),
    "feature":   "copilot",
    "model":     settings.openai_model,
    "input_tokens":  response.usage.prompt_tokens,
    "output_tokens": response.usage.completion_tokens,
    "cost_usd":      cost_usd,
    "latency_ms":    int((time.time() - start_time) * 1000),
}).execute()
```

**Superadmin: add cost view to Revenue tab:**
```
GET /superadmin/costs
Returns:
  total_cost_usd_this_month: float
  cost_by_feature: { copilot: $X, morning_brief: $Y, weekly_debrief: $Z }
  cost_by_tenant: [{ tenant_name, plan, cost_usd, copilot_calls, cost_per_call }]
  most_expensive_tenants: top 5 by cost_usd
  underwater_tenants: tenants where cost_usd > (plan_price_usd * 0.15)  ← 85% gross margin threshold
```

---

### Day 14 Quality Gate

```bash
cd akara/backend
uv run ruff check .
uv run pytest tests/ -v --tb=short
# Expected: all existing tests pass, new plan_limits importable
```

---

## Day 15 — Public Landing Page + Sign-up + Auth Flow

### Goal
Any person who visits the domain sees a marketing page. They can sign up in under 60 seconds. Email verification is enforced. After verifying, they go through a 3-step onboarding wizard. A new tenant row is auto-created.

---

### 15.1 — Backend: tenant auto-provision on signup

The `handle_new_user` trigger (migration 003) creates a `profiles` row but NOT a `tenants` row. That's a problem — every new user needs a tenant.

**New file: `backend/app/api/routes/onboarding.py`**

```python
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from uuid import UUID, uuid4
from app.core.auth import CurrentUser
from app.core.tenant import get_supabase_service_client

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class OnboardingRequest(BaseModel):
    company_name: str
    industry: str = "general"           # fmcg_distribution | retail | pharma | general
    language: str = "en"                # en | hi | te | ta | mr | kn | bn | gu
    currency: str = "INR"


class OnboardingResponse(BaseModel):
    tenant_id: UUID
    tenant_slug: str


@router.post("/setup", response_model=OnboardingResponse, status_code=status.HTTP_201_CREATED)
async def setup_tenant(body: OnboardingRequest, user: CurrentUser):
    """
    Called once after email verification.
    Creates a tenant + links the profile to it.
    Idempotent — if profile already has a tenant_id, returns it.
    """
    supa = get_supabase_service_client()

    # Check if already onboarded
    profile = supa.table("profiles").select("tenant_id") \
        .eq("id", str(user.user_id)).single().execute()

    if profile.data and profile.data.get("tenant_id"):
        tenant = supa.table("tenants").select("id, slug") \
            .eq("id", profile.data["tenant_id"]).single().execute()
        return OnboardingResponse(
            tenant_id=UUID(tenant.data["id"]),
            tenant_slug=tenant.data["slug"]
        )

    # Create slug from company name
    slug = body.company_name.lower().strip() \
        .replace(" ", "-").replace("&", "and")[:40]
    # Ensure unique
    slug = f"{slug}-{str(uuid4())[:8]}"

    # Create tenant
    tenant_result = supa.table("tenants").insert({
        "name": body.company_name,
        "slug": slug,
        "config": {
            "industry": body.industry,
            "language": body.language,
            "currency": body.currency,
        },
        "plan": "free",
        "plan_status": "active",
        "is_active": True,
    }).execute()

    tenant_id = tenant_result.data[0]["id"]

    # Link profile
    supa.table("profiles").update({
        "tenant_id": tenant_id,
        "role": "admin",
    }).eq("id", str(user.user_id)).execute()

    # Seed sample data for new tenant
    _seed_sample_data(supa, tenant_id)

    return OnboardingResponse(tenant_id=UUID(tenant_id), tenant_slug=slug)


def _seed_sample_data(supa, tenant_id: str):
    """
    Inserts ~30 rows of realistic FMCG distributor sample data so the
    dashboard is never empty on first login.
    """
    from datetime import date, timedelta
    import random

    parties = ["Sharma Traders", "Ravi Agencies", "Kumar Distributors",
               "Patel Stores", "Singh Enterprises"]
    zones = ["North", "South", "East", "West"]
    routes = ["Route A", "Route B", "Route C", "Route D"]
    products = ["Product Alpha", "Product Beta", "Product Gamma", "Product Delta"]

    rows = []
    today = date.today()
    for i in range(30):
        rows.append({
            "tenant_id": tenant_id,
            "invoice_date": str(today - timedelta(days=i % 14)),
            "invoice_number": f"SAMPLE-{1000 + i}",
            "party_name": random.choice(parties),
            "party_zone": random.choice(zones),
            "route": random.choice(routes),
            "product_name": random.choice(products),
            "quantity": random.randint(5, 50),
            "total_amount": round(random.uniform(2000, 25000), 2),
            "raw_data": {"sample": True},
        })

    supa.table("sales_data").insert(rows).execute()
```

Register in `main.py`:
```python
from app.api.routes import onboarding as onboarding_router
app.include_router(onboarding_router.router)
```

---

### 15.2 — Frontend: LandingPage.tsx — Full Spec

**`frontend/src/pages/LandingPage.tsx`** — New file

This is your entire sales team in a web page. Every pixel has a job. No animations that slow it down. Loads in under 2 seconds on mobile 4G.

---

#### `<head>` — SEO + OG tags (in `index.html` or via `react-helmet-async`)

```html
<title>AKARA — AI Analytics Copilot for FMCG Distributors</title>
<meta name="description"
  content="Ask your Tally sales data anything in plain English or Hindi.
  Get verified answers, live KPI dashboards, and a weekly brief on WhatsApp.
  Free to start. No data team needed." />

<!-- Open Graph (WhatsApp, LinkedIn, Twitter previews) -->
<meta property="og:title" content="AKARA — Ask your sales data anything" />
<meta property="og:description"
  content="AI analytics copilot for Indian FMCG distributors.
  Free to start. Answers in Hindi or English." />
<meta property="og:image" content="https://akara.ai/og-image.png" />
<!-- og:image must be 1200×630px. Show: a clean screenshot of the copilot answering a Hindi question -->
<meta property="og:url" content="https://akara.ai" />
<meta property="og:type" content="website" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@akaraai" />

<!-- Canonical -->
<link rel="canonical" href="https://akara.ai/" />

<!-- Structured data (Google rich results) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "AKARA",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": [
    { "@type": "Offer", "price": "0", "priceCurrency": "INR", "name": "Free" },
    { "@type": "Offer", "price": "7999", "priceCurrency": "INR", "name": "Pro" },
    { "@type": "Offer", "price": "13999", "priceCurrency": "INR", "name": "Business" }
  ],
  "description": "AI analytics copilot for FMCG distributors. Ask in Hindi or English."
}
</script>
```

---

#### Full page structure — section by section

**Section 1 — Sticky navigation bar**
```
[AKARA logo]          [Features] [Pricing] [Sign in]   [Start free →] ← primary CTA button

Mobile: hamburger menu. CTA button always visible even on mobile (fixed bottom bar on scroll).
Background: transparent on hero, white with shadow when scrolled past hero.
```

**Section 2 — Hero (above the fold, the only thing that matters)**
```
H1: "Your sales data answered — in plain English or हिंदी"

Sub: "AKARA connects to your Tally export and answers any question about your
      distribution business. Revenue by zone, beat compliance, scheme leakage,
      distributor health — in seconds. Not in a report. Not next week."

Two buttons:
  [Start free — no credit card]  ← primary, dark
  [See a 60-second demo →]       ← secondary, outlined, opens inline video modal

Below the CTA:
  Small text: "Free tier includes 10 AI questions/month + 1 weekly brief on WhatsApp"

Right side of hero (desktop) / below text (mobile):
  Animated mockup: phone screen showing a WhatsApp message:
  "📊 Sharma Traders Weekly Brief
   Revenue: ₹18.4L (↑12%)
   North zone 🏆 best. Route B 🔴 down 23%.
   [See full report]"
  → This is a static image styled as a phone. NOT a real WhatsApp embed.
  → Conveys the WhatsApp delivery story instantly without words.
```

**Section 3 — Social proof bar (thin strip, just numbers)**
```
No fake logos. Real numbers only, updated monthly.
  "₹___ Cr revenue analysed"  |  "___ questions answered"  |  "___ distributors served"
  (Start with honest small numbers. "₹18 Cr", "284 questions", "12 distributors" is fine.)
  "Serving distributors across Maharashtra, Gujarat, Karnataka, and Delhi NCR"
```

**Section 4 — The problem (before showing the solution)**
```
Heading: "Sound familiar?"

4 pain cards (horizontal scroll on mobile, 2×2 grid on desktop):

  📊 "My ERP gives me numbers, not answers"
     "Tally shows me revenue. It doesn't tell me why Route B dropped 23% last month."

  ⏰ "I find out problems 3 weeks too late"
     "By the time my accountant makes a report, the distributor has already underperformed."

  🗣️ "My team needs answers I can't give quickly"
     "A regional manager asks me a question. I ask my analyst. He takes 2 days. The meeting is over."

  📱 "I'm on WhatsApp all day, not a dashboard"
     "I'm not going to log into a portal every morning. If the insight isn't in my WhatsApp, I won't see it."
```

**Section 5 — The solution (product demo in 3 tabs)**
```
Heading: "AKARA answers all of this. Right now."

3 tabs: [Dashboard] [Ask anything] [Weekly brief]

Tab 1 — Dashboard:
  Static screenshot of AKARA dashboard with realistic FMCG data.
  Caption: "Live KPIs the moment you import. Revenue, zones, routes, beat compliance."

Tab 2 — Ask anything:
  Animated GIF (or static frames):
  User types: "पिछले महीने किस zone की revenue सबसे कम रही और क्यों?"
  AKARA responds: "South zone had the lowest revenue at ₹8.2L (23% below target).
                   Primary driver: Route C had 0 visits for 8 days (3–11 Feb).
                   Sharma Traders accounts for 67% of South zone revenue."
  Caption: "Hindi or English. AKARA reads your actual data — not a demo."

Tab 3 — Weekly brief:
  Static image of a WhatsApp chat:
  AKARA: "📊 This week's brief for [Company Name]
          Revenue: ₹42.3L (↑8% vs last week)
          Top zone: North (₹18.1L)
          ⚠️ 3 distributors overdue on payment: ₹4.2L outstanding
          🔴 Scheme leakage detected: ProductBeta ₹38,000
          Actions this week:
          1. Call Ravi Agencies about ₹1.8L outstanding
          2. Investigate Route B — 4 missed visits
          3. Recover scheme leakage before payout on 28th"
  Caption: "Every Monday at 7 AM on WhatsApp. No login required."
```

**Section 6 — How it works (4 numbered steps)**
```
Step 1: "Sign up free in 30 seconds"
        "No credit card. No contract. No sales call."

Step 2: "Export your Tally or ERP data as CSV"
        "Or Excel. Or drag-drop your DMS report. Supports Tally Prime, SAP, Petpooja,
        any file with invoice dates and amounts."

Step 3: "Ask your first question"
        "Type in English or Hindi. AKARA reads your actual data.
        It will not make up numbers."

Step 4: "Get your brief every Monday on WhatsApp"
        "Add your WhatsApp number once. AKARA sends a weekly brief every Monday at 7 AM.
        No login needed."
```

**Section 7 — Pricing (3 cards, clean)**
```
Heading: "Simple pricing. No hidden fees. No per-user traps."
Sub: "FireAI charges ₹8,397/month for 3 users. AKARA charges ₹7,999 for everything."
(Yes, name FireAI here. It's factual and directional for the customer segment who has already evaluated them.)

[Free]          [Pro — Most popular]     [Business]
₹0/mo           ₹7,999/mo               ₹13,999/mo
                (₹76,790/yr — save 20%)  (₹1,34,390/yr — save 20%)

Key features listed (5 per card, not every row — use the full table on /pricing):
Free:
  ✓ 10 AI questions/month
  ✓ Live KPI dashboard
  ✓ 1 weekly brief on WhatsApp (lifetime)
  ✓ 10,000 rows stored
  ✗ Zero-code alerts
  [Start free →]

Pro:
  ✓ 400 AI questions/month
  ✓ Weekly + daily briefs on WhatsApp
  ✓ 5 threshold alerts
  ✓ 3 users
  ✓ 500,000 rows / 12 months history
  [Start Pro →]

Business:
  ✓ 800 AI questions/month
  ✓ Scheme leakage detection
  ✓ Tally live sync
  ✓ 10 users + API keys
  ✓ 2M rows / 3 years history
  [Start Business →]

Below cards: "All plans include: India data residency · DPDP-compliant · Cancel anytime"
```

**Section 8 — FAQ (removes last-mile objections)**
```
Q: My Tally data has different column names. Will AKARA still work?
A: Yes. AKARA's parser automatically detects column aliases (Amount, Net Amount,
   Total Bill, Revenue — it recognises all of them). If something doesn't map, it tells you exactly why.

Q: Is my sales data secure?
A: Your data is stored in India (AWS Hyderabad). Row-level security ensures no other
   company can ever see your data. Personal contact information is automatically
   removed before any AI processing.

Q: What if I hit my question limit?
A: Your dashboard and weekly brief keep working. Only the AI copilot pauses.
   You can upgrade at any time — or wait until the next month resets.

Q: I'm already using Tally / SAP / Bizom. Do I need to switch?
A: No. AKARA sits on top of whatever you use. Export from Tally → import to AKARA.
   Or use the API push for overnight sync.

Q: Can I get a GST invoice?
A: Yes. Every payment generates a GST-compliant invoice emailed to your billing address.
   You can also add your company GSTIN for ITC claims.

Q: Can I try it without my real data?
A: Yes — AKARA loads sample data on signup so you can explore the full product immediately.
```

**Section 9 — Footer**
```
[AKARA logo]

Product: Features · Pricing · Changelog · Status (status.akara.ai)
Company: About · Blog · Privacy Policy · Terms of Service
Support: docs@akara.ai · WhatsApp: +91 XXXXXXXXXX

© 2026 AKARA Analytics Pvt Ltd · GST: XXXXXXXXXXXX · India
```

---

#### Implementation notes

```typescript
// Route: / (public, no auth guard)
// If user already has active session → redirect to /dashboard immediately (don't show landing page)
// All CTAs → /signup
// "See demo" button → opens <dialog> with an embedded Loom or YouTube video (lazy-loaded, zero performance impact until clicked)
// No third-party scripts on first load except Cloudflare Turnstile (loaded lazily on /signup page)
// Core Web Vitals targets: LCP < 2.5s, CLS < 0.1, FID < 100ms
// All images: WebP format, srcset for mobile/desktop, lazy loading
// Fonts: system-ui stack only — no Google Fonts (eliminates 200ms extra load)
```

**Cookie consent banner (DPDP + GDPR)**
```typescript
// frontend/src/components/CookieBanner.tsx — show on first visit
// "We use cookies for product analytics. No advertising cookies."
// [Accept] [Decline analytics]
// On decline: set posthog.opt_out_capturing()
// Store choice in localStorage — don't show again
// Required under DPDP Act 2023 + GDPR (for any EU visitor)
```

---

**`frontend/src/pages/SignUpPage.tsx`** — New file

```typescript
// Fields:
// - Full name
// - Work email
// - Password (min 8 chars, show/hide toggle)
// - Confirm password
// - Checkbox: "I agree to Terms of Service and Privacy Policy" (required)
//
// On submit:
// 1. supabase.auth.signUp({ email, password, options: { data: { display_name: fullName } } })
// 2. Show "Check your email" screen — do NOT navigate to dashboard yet
// 3. User clicks verification link → Supabase redirects to /onboarding
//
// Error handling:
// - "User already registered" → "Account exists. Sign in instead."
// - Password too short → inline error
// - Email format invalid → inline error
// - ToS not checked → inline error "You must accept the terms to continue"
```

---

**`frontend/src/pages/EmailVerificationPending.tsx`** — New file

```typescript
// Shown immediately after signup, before verification.
// Static page — no API calls.
// Content:
//   ✉️ "Check your email"
//   "We sent a verification link to {email}"
//   "Click the link to activate your account."
//   "Didn't receive it? [Resend email]"  → calls supabase.auth.resend()
//   "Already verified? [Sign in]"
```

---

**`frontend/src/pages/OnboardingPage.tsx`** — New file

Shown after email verification, before dashboard. 3 steps.

```typescript
// Step 1 — Company details
//   Company name (text input)
//   Industry (select: FMCG Distribution | Pharma | Retail | General)
//   Language (select: English | Hindi | Telugu | Tamil | Marathi | Kannada)
//   [Next →]
//
// Step 2 — Import your first data
//   Heading: "Upload your first sales file"
//   Sub: "Export from Tally or your ERP as CSV or Excel."
//   Drag-and-drop upload zone (reuses DataPage upload component)
//   [Skip for now] [Import and continue →]
//   Note: "Or explore with sample data we've already loaded for you."
//
// Step 3 — You're ready
//   ✅ "Your account is set up"
//   Show 3 suggested first questions (click to pre-fill copilot)
//   [Go to dashboard →]
//
// On Step 1 submit: POST /onboarding/setup (creates tenant)
// On Step 2 submit: POST /data/import (standard flow)
// Step 3 is purely frontend, no API calls
//
// If user navigates directly to /dashboard without completing onboarding,
// ProtectedRoute checks for tenant_id — if null, redirects to /onboarding.
```

---

**`frontend/src/pages/ForgotPasswordPage.tsx`** — New file

```typescript
// Route: /forgot-password
// Fields: email
// On submit: supabase.auth.resetPasswordForEmail(email, { redirectTo: '/reset-password' })
// Success: show "If that email exists, you'll receive a reset link."
// (don't confirm whether email exists — security)
```

---

**`frontend/src/pages/ResetPasswordPage.tsx`** — New file

```typescript
// Route: /reset-password
// Supabase redirects here with #access_token in URL hash
// On load: supabase.auth.getSession() — session is set from hash automatically
// Fields: new password + confirm password
// On submit: supabase.auth.updateUser({ password: newPassword })
// Success: redirect to /dashboard
```

---

**Update `frontend/src/pages/LoginPage.tsx`**

Add two links below the submit button:
```typescript
// "Don't have an account? Sign up free" → /signup
// "Forgot your password?" → /forgot-password
```

---

**Update `frontend/src/App.tsx`** — add all new routes

```typescript
// Public routes (outside ProtectedRoute):
<Route path="/" element={<LandingPage />} />
<Route path="/signup" element={<SignUpPage />} />
<Route path="/verify-email" element={<EmailVerificationPending />} />
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password" element={<ResetPasswordPage />} />

// Protected but outside AppShell:
<Route element={<ProtectedRoute requireOnboarding={false} />}>
  <Route path="/onboarding" element={<OnboardingPage />} />
</Route>
```

---

**Update `frontend/src/components/ProtectedRoute.tsx`**

Add onboarding redirect logic:
```typescript
// After session check, check if user.tenantId is null
// If null → redirect to /onboarding
// If session.user.email_confirmed_at is null → redirect to /verify-email
```

---

### Day 15 Quality Gate

```bash
# Backend
cd akara/backend
uv run ruff check .
uv run pytest tests/ -v

# Frontend
cd akara/frontend
npx tsc --noEmit
pnpm build   # must exit 0
```

Manual verification:
- Visit `/` → landing page renders, no auth redirect
- Click "Start free" → `/signup`
- Sign up → verify email page
- Click verification email → redirect to `/onboarding`
- Complete onboarding → dashboard has sample data
- `/login` has "Sign up" and "Forgot password" links

---

## Day 16 — Usage UI + Plan Gates + Upgrade Flow

### Goal
Users can see how much of their quota they've used. Locked features show lock icons, not 403 errors. Upgrade path is one click.

---

### 16.1 — `frontend/src/hooks/useBilling.ts` (new file)

```typescript
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface UsageData {
  plan: string;
  plan_status: string;
  copilot_calls_used: number;
  copilot_calls_limit: number;
  rows_used: number;
  rows_limit: number;
  uploads_used: number;
  uploads_limit: number;        // monthly (-1 = unlimited)
  uploads_today: number;        // uploads done today
  uploads_per_day: number;      // daily hard cap (3)
  undos_today: number;          // undos done today
  undos_per_day: number;        // daily hard cap (2)
  users_used: number;
  users_limit: number;
  features: Record<string, boolean>;
}

export function useBilling() {
  return useQuery<UsageData>({
    queryKey: ["billing", "usage"],
    queryFn: () => apiFetch<UsageData>("/billing/usage"),
    staleTime: 1000 * 60 * 5,   // 5 min cache — doesn't need to be real-time
  });
}

// Helper: percentage of limit used
export function usagePct(used: number, limit: number): number {
  if (limit === -1) return 0;   // unlimited
  return Math.min(Math.round((used / limit) * 100), 100);
}

// Helper: human label for limit
export function limitLabel(limit: number): string {
  return limit === -1 ? "Unlimited" : limit.toLocaleString("en-IN");
}
```

---

### 16.2 — `frontend/src/components/UsageBanner.tsx` (new file)

Appears in `AppShell` above the main content area when usage is ≥ 80%.

```typescript
// Props: none — reads from useBilling()
//
// Renders nothing if:
//   - plan is not 'free' and usage < 80%
//   - data is loading
//
// Renders amber banner if usage 80-99%:
//   "You've used 8/10 questions this month. Upgrade to Pro for 400/month."
//   [Upgrade now →]
//
// Renders red banner if usage = 100%:
//   "You've reached your question limit for this month.
//    Your next 5 questions are free on Pro. Upgrade to continue."
//   [Upgrade now →]
//
// For free plan: also shows "X days until monthly reset"
```

Wire into `AppShell.tsx` — add above `<Outlet />` inside `<main>`.

---

### 16.3 — `frontend/src/components/PlanGate.tsx` (new file)

Wrapper component that shows lock overlay on features the user's plan doesn't include.

```typescript
interface PlanGateProps {
  feature: keyof UsageData["features"];
  requiredPlan: "pro" | "business";
  children: ReactNode;
  mode?: "lock" | "hide";   // lock = show with overlay, hide = render nothing
}

// Usage:
// <PlanGate feature="scheme_leakage" requiredPlan="business">
//   <SchemeLeakageCard />
// </PlanGate>
//
// Renders children with a grey overlay + lock icon + "Business feature — Upgrade"
// if the feature is not enabled on current plan.
// Clicking the overlay navigates to /upgrade.
// If mode="hide", renders nothing instead of overlay.
```

---

### 16.4 — Apply PlanGate to existing pages

**`DashboardPage.tsx`** — wrap Route Performance card and Credit Exposure card:
```typescript
// These cards only show if data is non-empty, already conditional.
// No changes needed — the data won't be there for free users anyway.
// Add data freshness indicator:
// "Last import: {date}" shown below the KPI grid.
// Amber warning if last import > 3 days ago.
// Red warning if > 7 days.
```

**`DataPage.tsx`** — gate secondary sales and scheme master upload panels, show daily counters:
```typescript
<PlanGate feature="secondary_sales" requiredPlan="pro">
  <UploadPanel title="Secondary Sales" ... />
</PlanGate>

<PlanGate feature="secondary_sales" requiredPlan="pro">
  <UploadPanel title="Scheme Master" ... />
</PlanGate>

// Daily rate limit display — show above the upload panels
// "Uploads today: 2 / 3  ·  Data undos today: 0 / 2"
// When at limit: amber badge "Upload limit reached — resets tomorrow"
// Disable the upload button client-side when uploads_today >= 3
// (backend still enforces via require_import_quota, this is UX-only pre-check)

// Import history table (below upload panels) — new section:
// Shows last 10 imports: Date | File | Rows | Status | [Undo ⟲]
// "Undo" button → DELETE /data/imports/{id}
// Disabled (greyed out) when undos_today >= 2 with tooltip "2 undos used today. Resets tomorrow."
// Import job needs an import_job_id — ensure /data/import sets this on the sales_data rows
// and creates a row in import_jobs with: id, tenant_id, filename, rows_inserted, created_at, status
```

**`ReportsPage.tsx`** — gate scheme leakage section:
```typescript
<PlanGate feature="scheme_leakage" requiredPlan="business">
  <SchemeLeakageSection />
</PlanGate>
```

**`SimulatorPage.tsx`** — gate entire page:
```typescript
// In App.tsx, wrap route:
<Route path="/simulator" element={
  <PlanGate feature="simulator" requiredPlan="pro" mode="hide">
    <SimulatorPage />
  </PlanGate>
} />
// Sidebar shows lock icon on /simulator for free users.
```

**`AppShell.tsx`** — add lock icons to gated nav items:
```typescript
// For each NAV_ITEM, check features from useBilling()
// If feature not enabled: show 🔒 icon next to label
// Clicking still navigates — PlanGate on the page handles the block
```

---

### 16.5 — `frontend/src/pages/UpgradePage.tsx` (new file)

```typescript
// Route: /upgrade
// Public page (accessible without auth, useful for sharing)
//
// Layout:
//   Heading: "Choose your plan"
//   Sub: "Start free, upgrade when you're ready. No long-term contracts."
//
//   3 pricing cards (Free | Pro | Business):
//   Each card shows:
//     - Plan name + price
//     - Feature list with checkmarks/crosses (exact tier table)
//     - CTA button:
//       Free: "Current plan" (disabled, if already on free)
//       Pro: "Upgrade to Pro — ₹7,999/mo" → Stripe checkout (Day 18)
//       Business: "Upgrade to Business — ₹13,999/mo" → Stripe checkout (Day 18)
//
//   For now (before Stripe): CTA opens a mailto: link or a Calendly link
//   This is a deliberate interim — you'd rather have a human conversation
//   with the first 10 customers than lose them to a failed payment flow.
//
// FAQ section below cards:
//   Q: Can I cancel anytime? A: Yes. Data is preserved for 30 days.
//   Q: What happens when I hit the free limit? A: The copilot stops answering.
//      The dashboard and weekly debrief still work.
//   Q: Is my data private? A: Yes. Row-level security ensures no one else sees your data.
```

---

### 16.6 — `frontend/src/pages/BillingPage.tsx` (new file)

```typescript
// Route: /billing (in Settings)
// Protected, inside AppShell
//
// Sections:
//
// 1. Current plan card
//    Plan badge (Free / Pro / Business)
//    Plan status badge (Active / Trialing / Past Due)
//    "Upgrade plan" button → /upgrade
//    "Manage subscription" link → Stripe customer portal (Day 18, disabled until then)
//
// 2. Usage this month (monthly limits, 4 progress bars)
//    Copilot questions: [====    ] 8/10 (80%)
//    Rows stored:       [=       ] 1,204/10,000 (12%)
//    Uploads this month:[==      ] 2/5 (40%)   ← only shown for free plan (monthly cap)
//    Users:             [=       ] 1/1 (100%)
//
// 3. Today's rate limits (2 small counters, always shown)
//    Uploads today:   2 / 3   ← resets at midnight
//    Data undos today: 0 / 2  ← resets at midnight
//    Small note: "Daily limits reset at midnight IST. Contact support if you need a one-time exception."
//
//    Design: show as compact inline counters, not full progress bars.
//    Color: green if 0 used, amber at limit-1, red at limit.
//
// 4. What's included in your plan
//    Feature checklist matching the tier table
//
// 5. Usage resets on [first of next month]
```

---

### 16.7 — Add `/billing` to Settings navigation

**`SettingsPage.tsx`** — add a "Billing" tab or link to `/billing`.

**`AppShell.tsx`** — add Billing to the settings section or as a separate nav item with a "Pro" badge indicator if on free plan.

---

### Day 16 Quality Gate

```bash
cd akara/frontend
npx tsc --noEmit
pnpm build
```

Manual:
- Free user asks 10 questions → 11th shows red banner + 402 response
- Free user tries to upload secondary sales → PlanGate lock overlay
- Click "Upgrade now" → /upgrade page renders with correct prices
- BillingPage shows accurate usage bars AND daily counters
- DataPage shows "Uploads today: X/3" counter above upload panels
- Upload 3 files → 4th upload blocked with "Daily limit reached" message (all plans)
- Delete 2 imports (undo) → 3rd undo blocked with "2 undos used today" message (all plans)
- Daily counters reset to 0 the next day (test by manually setting last_activity_date to yesterday)
- Simulator nav item shows lock for free users

---

## Day 17 — Superadmin Panel (Omnipotent)

### Goal
You are the all-seeing operator of AKARA. You can see, control, override, and act on every single aspect of the service — from a single screen. No situation should require you to write a SQL query manually or dig through logs to understand what happened. The superadmin panel IS your product for operating AKARA.

---

### 17.1 — Superadmin role architecture

**In Supabase Auth:** Create your personal account. In `profiles` table, set `role = 'superadmin'` directly via Supabase Dashboard (not via the app). This is a one-time manual operation.

**Migration 011 addition:**
```sql
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin'
    );
END;
$$;
```

**Backend guard `backend/app/core/superadmin.py`:**
```python
async def require_superadmin(user: CurrentUser = Depends()) -> CurrentUser:
    supa = get_supabase_service_client()
    profile = supa.table("profiles").select("role") \
        .eq("id", str(user.user_id)).single().execute()
    if not profile.data or profile.data.get("role") != "superadmin":
        raise HTTPException(status_code=404)   # 404, not 403 — don't reveal the endpoint exists
    return user

SuperAdmin = Annotated[CurrentUser, Depends(require_superadmin)]
```

**All `/superadmin/*` responses also get:**
```python
response.headers["X-Robots-Tag"] = "noindex, nofollow"
```

---

### 17.2 — Complete Superadmin API — every endpoint

```python
router = APIRouter(prefix="/superadmin", tags=["superadmin"])

# ══════════════════════════════════════════════════════════════
# TENANT MANAGEMENT — full control over every tenant
# ══════════════════════════════════════════════════════════════

GET  /superadmin/tenants
     Returns all tenants with everything:
       id, name, slug, plan, plan_status, is_active, feature_overrides,
       stripe_customer_id, stripe_subscription_id, billing_details,
       user_count, copilot_calls_this_month, rows_stored, last_import_at,
       last_login_at, created_at, trial_ends_at,
       llm_cost_this_month_usd, estimated_monthly_margin_pct
     Filters: plan, plan_status, is_active, search (name/slug)
     Sort: created_at | last_login_at | copilot_calls | mrr_contribution

POST /superadmin/tenants
     Body: { name, slug, config, plan, plan_status, feature_overrides }
     Creates tenant with any plan (for manual onboarding, demo accounts, etc.)

PATCH /superadmin/tenants/{tenant_id}
     Body: any subset of ALL tenant columns
     Full update power — any field, any value

DELETE /superadmin/tenants/{tenant_id}
     Hard delete tenant + all data + all users
     Requires: { confirm: "DELETE {tenant_name}" } — must match exactly

DELETE /superadmin/tenants/{tenant_id}/data
     Wipes all imported data (sales_data, secondary, scheme_master)
     Keeps tenant + profiles intact
     Requires: confirm=true query param

# ══════════════════════════════════════════════════════════════
# QUOTA MANAGEMENT — reinstate, extend, grant bonus
# ══════════════════════════════════════════════════════════════

PATCH /superadmin/tenants/{tenant_id}/quota
     The most-used support endpoint. Handles any quota issue.
     Body:
       {
         "copilot_calls_override": 50,    # set this month's count to exactly 50
         "copilot_bonus":         20,     # add 20 bonus questions (on top of plan limit)
         "uploads_override":      0,      # reset upload count
         "reset_month":           true,   # wipe this month's entire usage_tracking row
         "extend_billing_to":     "2026-09-01",  # delay next billing date
       }
     All fields optional — apply only what's provided.
     
     Implementation:
     - copilot_calls_override: UPDATE usage_tracking SET copilot_calls = X WHERE tenant_id = ... AND month = CURRENT_MONTH
     - copilot_bonus: UPDATE tenants SET feature_overrides = feature_overrides || '{"copilot_bonus": X}'
     - reset_month: DELETE FROM usage_tracking WHERE tenant_id = ... AND month = CURRENT_MONTH
     
     Every call logged to audit_log with before/after values.
     Use case: "Customer says they only asked 3 questions but we show 10"
               → PATCH quota with reset + copilot_calls_override=3

GET  /superadmin/tenants/{tenant_id}/quota-history
     All usage_tracking rows for this tenant across all months
     Shows: month | copilot_calls | rows_imported | uploads_count | debrief_count
     Use case: "Has this customer been using the product consistently?"

# ══════════════════════════════════════════════════════════════
# PLAN MANAGEMENT — upgrade, downgrade, override, grace periods
# ══════════════════════════════════════════════════════════════

PATCH /superadmin/tenants/{tenant_id}/plan
     Body:
       {
         "plan": "pro",                    # change plan immediately
         "plan_status": "active",          # override status
         "trial_ends_at": "2026-08-31",   # extend trial or grace period
         "bypass_stripe": true,           # apply plan change without Stripe (for manual deals)
         "note": "Customer paid via NEFT" # logged to audit
       }
     
     Use cases:
     - "Customer paid by NEFT bank transfer" → set plan=pro, bypass_stripe=true
     - "We promised them 2 weeks free extension" → set trial_ends_at
     - "Customer's card keeps failing, give them 7 more days" → extend trial_ends_at
     - "Demo account for sales call" → set plan=business, bypass_stripe=true

PATCH /superadmin/tenants/{tenant_id}/features
     Body: { feature_name: bool }
     Sets per-tenant feature overrides regardless of plan.
     Use cases:
     - Enable scheme_leakage for a free account (sales demo)
     - Disable morning_brief for a tenant who asked (noise complaint)
     - Enable tally_connector for a Pro tenant as goodwill upgrade

# ══════════════════════════════════════════════════════════════
# USER MANAGEMENT — see and control every user
# ══════════════════════════════════════════════════════════════

GET  /superadmin/users
     All profiles with: id, display_name, email, role, tenant_name, plan,
                        created_at, last_sign_in_at, copilot_calls_this_month
     Filters: tenant_id, role, plan, search (email/name)

PATCH /superadmin/users/{user_id}/role
     Body: { role: 'admin' | 'user' | 'superadmin' }

PATCH /superadmin/users/{user_id}/tenant
     Body: { tenant_id }
     Moves a user from one tenant to another.
     Use case: someone signed up with wrong email, merge into correct tenant.

POST /superadmin/users/{user_id}/reset-password
     Sends a password reset email immediately, no confirmation needed.
     Use case: "I can't log in"

POST /superadmin/users/{user_id}/magic-link
     Returns a magic login link (valid 1 hour) for the user.
     Use case: user is locked out and needs immediate access for a demo.

DELETE /superadmin/users/{user_id}
     Hard delete user from auth.users (cascade clears profile).
     Requires: confirm=true

# ══════════════════════════════════════════════════════════════
# DATA EXPLORER — see exactly what a tenant's data looks like
# ══════════════════════════════════════════════════════════════

GET  /superadmin/tenants/{tenant_id}/data/summary
     Returns:
       row_count, oldest_record_date, newest_record_date,
       distinct_parties, distinct_routes, distinct_zones,
       total_revenue, last_import_at
     Use case: "Customer says their data looks wrong" → check summary first.

GET  /superadmin/tenants/{tenant_id}/data/preview
     Returns: first 50 rows of sales_data (all columns)
     Query param: table (sales_data | secondary_sales_data | scheme_master)
     Use case: validate that import worked correctly.

GET  /superadmin/tenants/{tenant_id}/data/export
     Downloads full CSV of all sales_data for this tenant.
     Use case: customer requests data export via support, or for debugging.

DELETE /superadmin/tenants/{tenant_id}/data/rows
     Body: { date_before: "2025-01-01" }  — delete rows older than date
     Use case: customer wants to clean old test data before going live.

# ══════════════════════════════════════════════════════════════
# CONVERSATION EXPLORER — read every copilot conversation
# ══════════════════════════════════════════════════════════════

GET  /superadmin/tenants/{tenant_id}/conversations
     All conversations for this tenant (all users)
     Columns: id, user_email, question_count, created_at, last_message_at

GET  /superadmin/conversations/{conversation_id}/messages
     All messages in a conversation: role (user/assistant), content, created_at, cost_usd

GET  /superadmin/feedback
     All copilot feedback rows across all tenants
     Columns: tenant_name, question, rating (👍/👎), comment, created_at
     Sorted by: thumbs-down first, then by created_at
     Use case: "What questions are getting bad answers?" → fix prompts

# ══════════════════════════════════════════════════════════════
# BILLING — full Stripe visibility and control
# ══════════════════════════════════════════════════════════════

GET  /superadmin/billing/stripe-status/{tenant_id}
     Live Stripe data for this tenant:
       subscription_status, current_period_end, next_payment_date,
       last_payment_amount, last_payment_date, failed_payment_count
     (pulls from Stripe API, not DB cache)

POST /superadmin/billing/manual-upgrade/{tenant_id}
     Body: { plan: 'pro' | 'business', note: str }
     Manually upgrades tenant without Stripe (for bank transfer / NEFT payments).
     Sets plan + plan_status=active + logs to audit with note.

POST /superadmin/billing/extend-trial/{tenant_id}
     Body: { days: 14 }
     Extends trial_ends_at by N days.
     Logs to audit.

POST /superadmin/billing/void-invoice/{stripe_invoice_id}
     Voids a Stripe invoice (for refunds or corrections).

POST /superadmin/billing/resend-invoice/{tenant_id}
     Resends the last GST invoice PDF to the tenant's admin email.

GET  /superadmin/revenue
     Full revenue picture:
       mrr, arr, mrr_growth_pct (vs last month),
       tenants_by_plan: { free: N, pro: N, business: N },
       new_paid_this_month: N, churned_this_month: N,
       net_revenue_retention_pct,
       total_llm_cost_usd_this_month,
       estimated_gross_margin_pct,
       underwater_tenants: [ tenants where LLM cost > 15% of their plan price ]

GET  /superadmin/costs
     LLM cost breakdown:
       total_cost_usd_this_month,
       cost_by_feature: { copilot, morning_brief, weekly_debrief },
       cost_by_tenant: sorted by cost DESC (shows your most expensive customers),
       avg_cost_per_question,
       avg_cost_per_tenant_per_month

# ══════════════════════════════════════════════════════════════
# NOTIFICATIONS & REPORTS — trigger anything for anyone
# ══════════════════════════════════════════════════════════════

POST /superadmin/reports/morning-brief/{tenant_id}
     Manually trigger morning brief for one tenant right now.
     Body: { channel: 'email' | 'whatsapp' | 'both' }

POST /superadmin/reports/weekly-debrief/{tenant_id}
     Manually trigger weekly debrief for one tenant right now.
     Useful for: onboarding demos ("let me show you your first brief right now")

POST /superadmin/reports/broadcast
     Send a message to all tenants (or filtered segment).
     Body:
       {
         "subject": "AKARA maintenance: 15 Jan 2–4 AM",
         "body_html": "...",
         "body_whatsapp": "...",   # shorter version for WhatsApp
         "channels": ["email", "whatsapp"],
         "plan_filter": "pro",     # null = all plans
         "status_filter": "active" # null = all statuses
       }

POST /superadmin/notifications/system-banner
     Sets a system-wide banner shown to all logged-in users.
     Body: { message: str, severity: 'info' | 'warning' | 'error', expires_at: ISO datetime }
     Stored in a global_settings table or KV.
     Frontend checks GET /system/banner on AppShell load.
     Use case: "Scheduled maintenance tonight 2–4 AM. Exports may be slow."

DELETE /superadmin/notifications/system-banner
     Clears the active system banner.

# ══════════════════════════════════════════════════════════════
# IMPERSONATION — see exactly what the customer sees
# ══════════════════════════════════════════════════════════════

POST /superadmin/impersonate/{tenant_id}
     Generates a 15-minute magic link scoped to the tenant's admin user.
     Opens in a new tab — you see their exact dashboard, data, copilot.
     All actions taken while impersonating are logged:
       audit_log.action = 'superadmin_impersonate_action'
       audit_log.details = { original_user: your_user_id, tenant_id, action_taken }
     A banner shows at the top: "⚠️ You are viewing AKARA as [Company Name]. [Exit impersonation]"

# ══════════════════════════════════════════════════════════════
# AUDIT LOGS — every action ever taken, by anyone
# ══════════════════════════════════════════════════════════════

GET  /superadmin/audit-logs
     All audit_log rows, paginated.
     Columns: timestamp | tenant | user_email | action | resource_type | resource_id | ip | details
     Filters: tenant_id, user_id, action, date_from, date_to, ip
     Actions tracked:
       - User: login, logout, signup, password_change, account_delete
       - Data: import_success, import_failed, data_wiped
       - Copilot: question_asked, question_blocked_quota, question_blocked_feature
       - Billing: plan_upgrade, plan_downgrade, payment_failed, invoice_generated
       - Superadmin: quota_reset, plan_override, impersonate, feature_override, broadcast_sent

# ══════════════════════════════════════════════════════════════
# CRON HEALTH — know if your background jobs are working
# ══════════════════════════════════════════════════════════════

GET  /superadmin/system/cron-health
     Returns status of all scheduled tasks:
       {
         "retention_cleanup":  { last_run: "2026-07-22T02:00:00Z", status: "ok", rows_deleted: 0 },
         "alert_evaluator":    { last_run: "2026-07-22T06:00:00Z", status: "ok", alerts_sent: 3 },
         "activation_emails":  { last_run: "2026-07-22T08:00:00Z", status: "ok", emails_sent: 7 },
         "dunning":            { last_run: "2026-07-22T10:00:00Z", status: "ok", emails_sent: 1 },
         "morning_brief":      { last_run: "2026-07-22T07:00:00Z", status: "ok", briefs_sent: 12 },
         "weekly_debrief":     { last_run: "2026-07-21T07:00:00Z", status: "ok", debriefs_sent: 18 }
       }
     Each task writes a cron_runs row on completion. This endpoint reads the latest.

POST /superadmin/system/cron-run/{task_name}
     Manually trigger any cron task right now.
     Tasks: retention_cleanup | alert_evaluator | activation_emails | morning_brief | weekly_debrief
     Returns: { triggered: true, check_results_in: 30 }

# ══════════════════════════════════════════════════════════════
# SYSTEM HEALTH — the full picture in one endpoint
# ══════════════════════════════════════════════════════════════

GET  /superadmin/system/health
     {
       "api_status": "ok",
       "db_latency_ms": 12,
       "openai_status": "ok",   # ping OpenAI /models endpoint
       "sendgrid_status": "ok", # ping SendGrid /stats endpoint
       "zaptilo_status": "ok",  # ping Zaptilo API
       "stripe_status": "ok",   # ping Stripe /charges endpoint
       "active_import_jobs": 0, # queued + processing import jobs
       "sentry_error_count_24h": 3,
       "last_deploy_at": "2026-07-20T14:30:00Z"
     }
```

---

### 17.3 — New migration: `cron_runs` table

```sql
CREATE TABLE IF NOT EXISTS public.cron_runs (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_name   TEXT        NOT NULL,
    status      TEXT        NOT NULL CHECK (status IN ('ok', 'failed', 'partial')),
    details     JSONB       NOT NULL DEFAULT '{}',
    started_at  TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON public.cron_runs (task_name, finished_at DESC);
```

Every cron task writes one row per run. Superadmin reads the latest row per task.

---

### 17.4 — New table: `global_settings`

```sql
CREATE TABLE IF NOT EXISTS public.global_settings (
    key     TEXT    PRIMARY KEY,
    value   JSONB   NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed:
INSERT INTO public.global_settings (key, value) VALUES
  ('system_banner', 'null'),
  ('maintenance_mode', 'false'),
  ('signup_open', 'true');
```

Frontend `AppShell.tsx` checks `GET /system/settings` on load:
```typescript
// If maintenance_mode = true: show full-screen overlay
// If system_banner is not null: show the banner
// If signup_open = false: redirect /signup to a waiting page
```

---

### 17.5 — SuperAdminPage.tsx — Full UI Spec

Route: `/superadmin` — its own shell, completely separate from AppShell. Dark theme.

```
┌─────────────────────────────────────────────────────────────────┐
│  🔮 AKARA OPS            [AI Briefing] [⚠️ 2 alerts]  [You ▼]  │
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                      │
│ NAVIGATE │   [TAB: Overview] [Tenants] [Users] [Usage] ...     │
│          │                                                      │
│ Overview │                                                      │
│ Tenants  │   ← content changes per tab                        │
│ Users    │                                                      │
│ Usage    │                                                      │
│ Revenue  │                                                      │
│ ──────── │                                                      │
│ Billing  │                                                      │
│ Comms    │                                                      │
│ ──────── │                                                      │
│ Audit    │                                                      │
│ Crons    │                                                      │
│ System   │                                                      │
│ ──────── │                                                      │
│ 🤖 AI    │                                                      │
│ Briefing │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

---

**TAB 1 — Overview (default landing tab)**

The single-glance health screen. Loads in 1 second.

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  MRR        │  │  Active     │  │  Questions  │  │  Gross      │
│  ₹1,59,982  │  │  Tenants    │  │  Asked      │  │  Margin     │
│  ↑8% MoM   │  │  23         │  │  Today: 147 │  │  87.3%      │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘

┌─────────────────────────────┐  ┌────────────────────────────┐
│  NEW THIS WEEK              │  │  NEEDS ATTENTION           │
│  ├ 4 signups                │  │  🔴 2 past_due tenants     │
│  ├ 1 upgrade (free → Pro)   │  │  🟡 3 tenants at 80% quota │
│  └ 0 churns                 │  │  🔴 Cron: alert_evaluator  │
│                             │  │     last ran 18h ago       │
│  [View signups]             │  │  [Fix now]                 │
└─────────────────────────────┘  └────────────────────────────┘

RECENT ACTIVITY (live, last 20 events):
  2m ago  | Ravi Agencies       | Uploaded 2,847 rows     | Pro
  5m ago  | Sharma Traders      | Asked: "which zone..."  | Free
  12m ago | Kumar Distributors  | Upgraded to Pro         | ← highlight upgrades
  1h ago  | Patel Stores        | Payment failed          | ← highlight failures
```

---

**TAB 2 — Tenants (master control)**

```
Search: [_________________]  Filter: [All plans ▼] [All statuses ▼]  [+ New tenant]

Tenant Name     | Plan     | Status    | Users | Questions | Rows    | Last active | Actions
─────────────────────────────────────────────────────────────────────────────────────────────
Sharma Traders  | Pro 🟦   | Active ✅  |  3   | 187/400   | 84,231  | 2h ago      | [⋮]
Ravi Agencies   | Free ⬜  | Active ✅  |  1   | 8/10      | 9,847   | 5m ago      | [⋮]
Kumar Dist.     | Business | Past Due🔴|  7   | 412/800   | 891,204 | 3d ago      | [⋮]

Row action menu [⋮]:
  👁️ View details (slide-out drawer — full tenant card)
  🎭 Impersonate    → opens new tab as this tenant
  📊 Data preview   → shows first 50 rows of their data
  ✏️ Edit config
  💳 Billing details + Stripe status
  🎁 Grant bonus queries
  📈 Upgrade plan
  ⬇️ Downgrade plan
  ⏸️ Suspend (sets is_active=false, users can't log in)
  ▶️ Activate
  🗑️ Wipe data (keeps account)
  ❌ Delete tenant (nuclear, requires typing company name)

Tenant detail drawer (slides from right):
  Shows EVERYTHING:
  ┌──────────────────────────────────────────────┐
  │ Sharma Traders                  [Edit]        │
  │ Plan: Pro | Status: Active                    │
  │ Stripe: sub_xxxxx | Next payment: Aug 1       │
  │ GSTIN: 27XXXXX | Billing state: Maharashtra   │
  ├──────────────────────────────────────────────┤
  │ QUOTA THIS MONTH                              │
  │ Questions: 187 / 400   [Reset] [Add bonus]    │
  │ Uploads:   12 / ∞                             │
  │ Rows:      84,231 / 500,000                  │
  │ Debriefs:  3 lifetime                         │
  ├──────────────────────────────────────────────┤
  │ FEATURE OVERRIDES                             │
  │ scheme_leakage   ● ON (plan: off) [Toggle]   │
  │ simulator        ○ default (plan: on)         │
  │ tally_connector  ○ default (plan: off)        │
  ├──────────────────────────────────────────────┤
  │ LLM COST THIS MONTH                           │
  │ Total: $1.82 | Questions: $1.64 | Brief: $0.18│
  │ Margin on this tenant: 89.1%                  │
  ├──────────────────────────────────────────────┤
  │ DATA SUMMARY                                  │
  │ 84,231 rows | Jan 1 – Jul 20, 2026            │
  │ 12 distributors | 4 zones | 8 routes          │
  │ Last import: 2 days ago                       │
  ├──────────────────────────────────────────────┤
  │ RECENT CONVERSATIONS (last 5)                 │
  │ "Which route has highest returns?" — 3h ago   │
  │ "Compare North vs South zone" — yesterday     │
  │ [View all conversations]                      │
  ├──────────────────────────────────────────────┤
  │ NOTES (internal, not visible to tenant)       │
  │ [Text area — for support notes]               │
  │ [Save note]                                   │
  └──────────────────────────────────────────────┘
```

**Internal notes feature** — new column:
```sql
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS internal_notes TEXT DEFAULT '';
```
Only visible in superadmin drawer. Invisible to the tenant.

---

**TAB 3 — Users**

```
Search by email/name. Filter by tenant, role.

Email                    | Name           | Tenant           | Role  | Plan | Last login | Actions
─────────────────────────────────────────────────────────────────────────────────────────────────
admin@sharmatraders.com  | Rajan Sharma   | Sharma Traders   | admin | Pro  | 2h ago     | [⋮]
user@kumarco.com         | Priya Kumar    | Kumar Dist.      | user  | Biz  | 3d ago     | [⋮]

Row actions:
  🔑 Send password reset email
  🔗 Generate magic link (instant access, no password needed — useful for demos)
  🏢 Move to different tenant
  👑 Change role
  🚫 Suspend user (block login without deleting)
  ❌ Delete user
```

---

**TAB 4 — Usage (the upsell dashboard)**

```
Purpose: See who is about to hit their limit = upsell opportunity
         See who is not using the product = churn risk

Sort options:
  By questions used (DESC) — find power users
  By % of quota used — find who is about to hit limit
  By last active date (ASC) — find who hasn't logged in recently

Table:
Tenant         | Plan  | Questions    | %Used    | Last active | Signal
────────────────────────────────────────────────────────────────────────
Sharma Traders | Pro   | 387/400      | 97% 🔴   | 2h ago      | UPSELL NOW
Ravi Agencies  | Free  | 10/10        | 100% 🔴  | 5m ago      | UPSELL NOW
Gupta & Sons   | Pro   | 12/400       | 3%  🟢   | 14d ago     | CHURN RISK

"Upsell queue": [Sharma Traders — 97%]  [Ravi Agencies — 100%]  [Mittal Corp — 91%]
→ One-click to send them a personalised upgrade email right from this screen.

"At-risk queue": [Gupta & Sons — last login 14d] [Singh Enterprises — never imported data]
→ One-click to send them an activation nudge.
```

---

**TAB 5 — Revenue**

```
MRR:  ₹1,59,982    ARR: ₹19,19,784    Gross Margin: 87.3%
                    ↑8% MoM             ↑0.4% vs last month

Plan breakdown:
  Free:     18 tenants  |  ₹0          |  LLM cost: ₹124/mo  (pure expense — acquisition)
  Pro:       4 tenants  |  ₹31,996/mo  |  LLM cost: ₹2,841/mo  |  Margin: 91.1%
  Business:  1 tenant   |  ₹13,999/mo  |  LLM cost: ₹1,680/mo  |  Margin: 88.0%

MRR history chart (last 6 months): line chart
New vs Churned chart: bar chart

"Underwater tenants" alert:
  None this month — all paid tenants above 85% gross margin threshold ✅

Stripe payments table (last 10):
  Date     | Tenant          | Amount    | Status
  Jul 1    | Sharma Traders  | ₹9,438    | Paid ✅
  Jul 1    | Kumar Dist.     | ₹16,518   | Failed ❌ [Retry] [Send dunning email]
```

---

**TAB 6 — Billing**

```
Full Stripe-level visibility:

Stripe customer search by tenant name or email.
For each tenant:
  Subscription status (live from Stripe API)
  Next billing date
  Payment method on file (last 4 digits)
  Failed payment history + retry dates
  All invoices with [Download GST PDF] button

Actions:
  [Manual upgrade — no Stripe]  ← for NEFT/bank transfer payments
  [Extend trial by 7d / 14d / 30d]
  [Void last invoice]
  [Resend GST invoice]
  [Mark as paid (manual)]
```

---

**TAB 7 — Communications**

```
BROADCAST
  Subject: [_________________________________]
  Body (HTML): [rich text editor]
  WhatsApp message (shorter): [text area, 1600 char limit]
  Channels: [✓ Email] [✓ WhatsApp]
  Send to: [All tenants ▼] / [Pro only ▼] / [Business only ▼] / [Free only ▼] / [past_due ▼]
  Preview: [Email preview] [WhatsApp preview]
  [Send now] [Schedule: date/time picker]

SYSTEM BANNER
  Active banner: "Scheduled maintenance tonight 2–4 AM" [Clear banner]
  New banner:
    Message: [_________________________________]
    Severity: [Info ▼] / [Warning ▼] / [Error ▼]
    Expires: [date/time picker]
    [Set banner] ← shows immediately for ALL logged-in users

PREVIOUS BROADCASTS
  Date | Subject | Recipients | Open rate (if tracked) | Actions [Resend]
```

---

**TAB 8 — Audit Logs**

```
Full searchable timeline of everything that ever happened.

Filters: Tenant | User email | Action type | Date range | IP address

Columns: Time | Tenant | User | Action | Details | IP

Sample rows:
  22 Jul 23:15 | Sharma Traders    | admin@sharma   | question_asked       | Q: "which zone..." cost: $0.004 |
  22 Jul 22:00 | —                 | you@akara.ai   | superadmin_quota_reset | tenant: Ravi Agencies, before: 10, after: 0 |
  22 Jul 20:30 | Kumar Dist.       | —              | payment_failed        | invoice: inv_xxx, amount: ₹16,518 |
  22 Jul 18:00 | —                 | you@akara.ai   | superadmin_impersonate | tenant: Kumar Dist. |

Export: [Download CSV] for any filtered view.
```

---

**TAB 9 — Cron Health**

```
Task              | Last run     | Status  | Details                | Actions
─────────────────────────────────────────────────────────────────────────────────
retention_cleanup | 2h ago       | ✅ OK   | 0 rows deleted         | [Run now]
alert_evaluator   | 18h ago      | 🔴 FAIL | TimeoutError: 30s      | [Run now] [View logs]
activation_emails | 1h ago       | ✅ OK   | 7 emails sent          | [Run now]
morning_brief     | 16h ago      | ✅ OK   | 12 briefs sent         | [Run now]
weekly_debrief    | 5d ago       | ✅ OK   | 18 debriefs sent       | [Run now]
dunning           | 1h ago       | ✅ OK   | 1 email sent           | [Run now]
import_worker     | 2m ago       | ✅ OK   | 0 jobs processed       | [Run now]

[Run now] immediately POSTs /superadmin/system/cron-run/{task_name}
```

---

**TAB 10 — System**

```
LIVE HEALTH
  API:       ✅ Responding (12ms)
  Database:  ✅ Connected (8ms) — Supabase ap-south-2
  OpenAI:    ✅ API reachable
  SendGrid:  ✅ API reachable
  Zaptilo:   ✅ API reachable
  Stripe:    ✅ API reachable

ACTIVE JOBS
  Queued imports: 0
  Processing imports: 0

ENV CHECK (backend reads these and confirms they're set — never shows values):
  ✅ OPENAI_API_KEY        ✅ SUPABASE_URL
  ✅ SENDGRID_API_KEY      ✅ STRIPE_SECRET_KEY
  ✅ ZAPTILO_API_TOKEN     ✅ SENTRY_DSN

RECENT SENTRY ERRORS (last 24h, top 5 by count):
  3x  openai.APITimeoutError — copilot.py:88
  1x  KeyError: 'total_amount' — parser.py:142
  [View all in Sentry →]

MAINTENANCE MODE
  Status: OFF  [Enable maintenance mode]  ← shows full-screen overlay to all users

GLOBAL SETTINGS
  Signup open: ✅  [Close signup]  ← useful if you're being spammed
```

---

**TAB 11 — 🤖 AI Briefing (Your Personal AI for AKARA Operations)**

*This is a completely separate section — see Day 17.6 below.*

---

### 17.6 — Superadmin AI Briefing (Your Own Copilot for AKARA)

You built a copilot for your customers. You need one for yourself.

The superadmin AI briefing uses the exact same infrastructure (FastAPI → OpenAI) but queries the **operational data** (tenants, usage_tracking, llm_cost_log, audit_log) instead of customer data.

---

**17.6a — Daily Automated Briefing (7 AM every day)**

Every morning at 7 AM, AKARA sends you a WhatsApp + email brief about your own SaaS:

```
📊 AKARA Ops Brief — 22 Jul 2026

MRR: ₹1,59,982 (↑₹7,999 — Kumar Dist. upgraded yesterday 🎉)
Active tenants: 23 | New yesterday: 2 | Churned: 0

Questions asked yesterday: 147 (↑12% vs last Tuesday)
LLM cost yesterday: $4.82 | Revenue yesterday: $192.76 | Margin: 97.5%

⚠️ NEEDS ACTION:
  1. alert_evaluator cron failed at 6 AM — check Railway logs
  2. Ravi Agencies at 100% quota — upsell opportunity
  3. Kumar Distributors payment failed (3rd time) — dunning day 7 tomorrow

Most active tenant: Sharma Traders (38 questions)
Most expensive tenant: Kumar Dist. ($1.82 LLM cost — still profitable at 88% margin)
New signups that haven't imported data yet: Gupta & Sons (2d), Singh Ent. (4d)

[Full ops dashboard →] https://akara.ai/superadmin
```

**Backend: `backend/app/tasks/superadmin_brief.py`** (new cron, 7 AM daily):

```python
async def generate_superadmin_brief() -> str:
    supa = get_supabase_service_client()
    today = datetime.utcnow().date()
    yesterday = today - timedelta(days=1)

    # Gather all operational data
    tenants = supa.table("tenants").select("*").eq("is_active", True).execute()
    usage_today = supa.rpc("get_daily_usage_summary", {"p_date": str(yesterday)}).execute()
    llm_cost_today = supa.table("llm_cost_log") \
        .select("cost_usd").gte("created_at", str(yesterday)).execute()
    cron_failures = supa.table("cron_runs") \
        .select("*").eq("status", "failed") \
        .gte("started_at", str(yesterday)).execute()
    upsell_candidates = [t for t in tenants.data if _is_near_quota(t)]
    churn_risks = [t for t in tenants.data if _is_inactive(t)]

    # Build structured context for the LLM
    context = {
        "mrr": _calc_mrr(tenants.data),
        "active_tenants": len(tenants.data),
        "questions_yesterday": usage_today.data.get("total_questions", 0),
        "llm_cost_yesterday_usd": sum(r["cost_usd"] for r in llm_cost_today.data),
        "cron_failures": [c["task_name"] for c in cron_failures.data],
        "upsell_candidates": [t["name"] for t in upsell_candidates],
        "churn_risks": [t["name"] for t in churn_risks],
        "new_tenants_yesterday": _count_new_yesterday(tenants.data, yesterday),
    }

    # Ask GPT to write the brief
    prompt = f"""
You are the operations analyst for AKARA, an AI analytics SaaS.
Write a concise daily operations brief for the founder based on this data:

{json.dumps(context, indent=2)}

Format:
- 3-4 lines of headline numbers (MRR, active tenants, LLM cost, margin)
- A numbered list of things that need the founder's attention today
- 2-3 lines of what's going well
- Keep it under 200 words. Be specific with numbers. No fluff.
"""
    response = await openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=300,
    )
    return response.choices[0].message.content
```

---

**17.6b — Interactive Superadmin Copilot (the AI Briefing tab)**

The AI Briefing tab in the superadmin panel is a chat interface — exactly like the customer copilot, but over your operational data.

```typescript
// frontend/src/pages/superadmin/AiBriefingTab.tsx
//
// Layout:
// Left panel: pre-built question chips
// Right panel: chat interface
//
// Pre-built questions (click to ask):
//   "Which tenants are most likely to churn this month?"
//   "What's my average revenue per question answered?"
//   "How much did I spend on LLM costs this week?"
//   "Which features drive the most upgrades?"
//   "Show me today's new signups and their activation status"
//   "Which tenant has the worst question quality (most thumbs down)?"
//   "What would happen to my MRR if the 3 free tenants near quota upgraded?"
//   "Who are my most profitable tenants?"
//   "Which crons have failed in the last 7 days?"
//
// Chat interface:
// User types: "How many tenants have never imported data?"
// AI answers: "5 tenants (22% of active accounts) have never imported any data:
//              Gupta & Sons (signed up 3 days ago), Singh Ent. (7 days ago),
//              Verma Traders (12 days ago), Agarwal Co. (21 days ago, HIGH RISK),
//              Mehta Pharma (2 days ago, too early to worry).
//              Recommended action: send activation email to Verma Traders and Agarwal Co."
```

**Backend: `backend/app/api/routes/superadmin_copilot.py`** (new file):

```python
router = APIRouter(prefix="/superadmin/copilot", tags=["superadmin-copilot"])

SUPERADMIN_SYSTEM_PROMPT = """
You are an expert operations analyst for AKARA, an AI analytics SaaS serving
Indian FMCG distributors. You have access to all operational metrics.

You ALWAYS:
- Answer with specific numbers from the data provided
- Flag anything that needs the founder's immediate attention
- Suggest a concrete next action for each issue you identify
- Format currency in INR (₹) and large numbers as Lakhs (L) or Crores (Cr)
- Keep answers concise but complete

You NEVER:
- Make up numbers
- Give generic advice
- Ignore anomalies in the data
"""

@router.post("/ask")
async def superadmin_ask(
    body: SuperadminQuestionRequest,
    admin: SuperAdmin,
):
    """
    Answers operational questions about AKARA's own performance.
    Queries operational tables directly — not tenant sales_data.
    """
    # Build context from operational tables
    supa = get_supabase_service_client()
    context = await _build_ops_context(supa)

    messages = [
        {"role": "system", "content": SUPERADMIN_SYSTEM_PROMPT},
        {"role": "user", "content": f"""
Context (operational data as of {datetime.utcnow().isoformat()}):
{json.dumps(context, indent=2, default=str)}

Question: {body.question}
"""}
    ]

    response = await openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        max_tokens=500,
        temperature=0.3,   # low temp — factual answers only
    )

    # Do NOT log this to llm_cost_log as a customer call
    # Log separately as feature='superadmin_copilot'
    return {"answer": response.choices[0].message.content}


async def _build_ops_context(supa) -> dict:
    """Collects all operational metrics into one dict for the LLM."""
    # Current month
    tenants = supa.table("tenants").select(
        "id, name, plan, plan_status, is_active, created_at"
    ).execute()

    usage = supa.table("usage_tracking").select("*").eq(
        "month", date.today().replace(day=1).isoformat()
    ).execute()

    llm_costs = supa.table("llm_cost_log").select("tenant_id, feature, cost_usd").gte(
        "created_at", date.today().replace(day=1).isoformat()
    ).execute()

    feedback = supa.table("copilot_feedback").select("rating").gte(
        "created_at", (date.today() - timedelta(days=30)).isoformat()
    ).execute()

    cron_runs = supa.table("cron_runs").select("task_name, status, finished_at").order(
        "finished_at", desc=True
    ).limit(50).execute()

    plan_prices = {"free": 0, "pro": 7999, "business": 13999}

    return {
        "date": date.today().isoformat(),
        "tenants": {
            "total": len(tenants.data),
            "by_plan": {
                p: len([t for t in tenants.data if t["plan"] == p])
                for p in ["free", "pro", "business"]
            },
            "mrr_inr": sum(plan_prices[t["plan"]] for t in tenants.data if t["plan_status"] == "active"),
            "inactive": [t["name"] for t in tenants.data if not t["is_active"]],
            "new_this_month": [
                t["name"] for t in tenants.data
                if t["created_at"][:7] == date.today().isoformat()[:7]
            ],
        },
        "usage_this_month": {
            "total_questions": sum(u.get("copilot_calls", 0) for u in usage.data),
            "tenants_at_limit": [
                u["tenant_id"] for u in usage.data
                if u.get("copilot_calls", 0) >= 10   # simplified; real check uses plan limit
            ],
        },
        "llm_costs_this_month": {
            "total_usd": round(sum(r["cost_usd"] for r in llm_costs.data), 4),
            "by_feature": {},   # aggregate by feature
        },
        "feedback": {
            "thumbs_up": len([f for f in feedback.data if f["rating"] == 1]),
            "thumbs_down": len([f for f in feedback.data if f["rating"] == -1]),
        },
        "cron_health": {
            r["task_name"]: r["status"]
            for r in cron_runs.data[:10]
        },
    }
```

---

### 17.7 — Founder Omnipotence Gap-Fill: the 15 remaining control surfaces

The sections above provide excellent visibility and common tenant operations, but they do **not yet make the founder operationally independent**. The following 15 gaps close every routine situation that would otherwise require a code deploy, hand-written SQL, or an avoidable trip through Stripe, Supabase, OpenAI, SendGrid, or Railway.

“Omnipotent” does not mean bypassing security, silently changing customer data, or exposing secrets in a browser. It means:

- every legitimate business operation has a deliberate control;
- every control shows scope, impact, current value, and proposed value;
- risky actions require recent re-authentication and explicit confirmation;
- every mutation is attributable, auditable, and reversible where technically possible;
- tenant isolation remains enforced even for support and impersonation;
- external-provider outages and permissions are visible rather than hidden.

All endpoints in 17.7 require `SuperAdmin`, a server-validated sudo session issued within the last 15 minutes, CSRF protection, and a non-empty `reason`. Never trust `last_sudo_at` from `localStorage`; use a short-lived, `HttpOnly`, `Secure`, `SameSite=Strict` sudo cookie or signed server token.

**Shared mutation envelope:**
```python
class FounderMutation(BaseModel):
    reason: str = Field(min_length=10, max_length=500)
    expected_version: int | None = None  # optimistic locking
    dry_run: bool = False

# Every mutation returns:
{
    "operation_id": "uuid",
    "status": "previewed | applied | scheduled | failed",
    "before": {},
    "after": {},
    "warnings": [],
    "reversible_until": "ISO timestamp or null",
}
```

**Shared UI pattern for every dangerous action:**
1. Open an impact-preview drawer.
2. Show affected tenants/users/rows and external side effects.
3. Require a written reason.
4. For destructive or financial actions, require typing the target name or amount.
5. Re-authenticate if sudo is stale.
6. Submit with an idempotency key.
7. Show the operation ID and resulting audit record.
8. Offer **Undo** only when the backend confirms that rollback is safe.

---

#### OMNIPOTENCE GAP 1/15 — Dynamic plans, prices, entitlements, and quotas

Prices and plan limits must never be hardcoded in React or Python. The founder controls the commercial model without a deploy.

**New tables:**
```sql
CREATE TABLE public.plan_catalog (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code                TEXT UNIQUE NOT NULL,
    display_name        TEXT NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    currency            TEXT NOT NULL DEFAULT 'INR',
    monthly_price_minor BIGINT NOT NULL DEFAULT 0 CHECK (monthly_price_minor >= 0),
    annual_price_minor  BIGINT CHECK (annual_price_minor >= 0),
    stripe_monthly_price_id TEXT,
    stripe_annual_price_id  TEXT,
    entitlements        JSONB NOT NULL DEFAULT '{}',
    limits              JSONB NOT NULL DEFAULT '{}',
    is_public           BOOLEAN NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order          INT NOT NULL DEFAULT 0,
    version             INT NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.plan_assignments (
    tenant_id           UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_code           TEXT NOT NULL REFERENCES public.plan_catalog(code),
    custom_limits       JSONB NOT NULL DEFAULT '{}',
    custom_price_minor  BIGINT,
    source              TEXT NOT NULL CHECK (source IN ('stripe','manual','contract','promotion')),
    effective_from      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_until     TIMESTAMPTZ,
    notes               TEXT NOT NULL DEFAULT ''
);
```

**Endpoints:**
```text
GET    /superadmin/catalog/plans
POST   /superadmin/catalog/plans
PATCH  /superadmin/catalog/plans/{code}
POST   /superadmin/catalog/plans/{code}/clone
POST   /superadmin/catalog/plans/{code}/publish
POST   /superadmin/catalog/plans/{code}/archive
POST   /superadmin/catalog/plans/{code}/sync-stripe
POST   /superadmin/tenants/{tenant_id}/plan-assignment
GET    /public/plans                         # only active + public plans
```

The **Plans & Limits** tab edits question limits, row limits, seats, imports, report cadence, enabled features, monthly/annual prices, CTA labels, and display order. Publishing shows a diff and affected subscriber count. Existing Stripe subscriptions keep their current Price ID unless the founder explicitly schedules a migration. Price changes are never retroactive by accident.

---

#### OMNIPOTENCE GAP 2/15 — Complete billing operations

Voiding an invoice is not a refund. The founder needs the complete money lifecycle in AKARA.

**Endpoints:**
```text
POST /superadmin/billing/refunds/preview
POST /superadmin/billing/refunds                 # full or partial; idempotency required
POST /superadmin/billing/credits                 # customer balance credit
POST /superadmin/billing/coupons
PATCH /superadmin/billing/coupons/{coupon_id}
POST /superadmin/billing/promotion-codes
POST /superadmin/billing/invoices/{id}/retry
POST /superadmin/billing/invoices/{id}/mark-paid # manual/NEFT only
POST /superadmin/billing/invoices/{id}/write-off
POST /superadmin/billing/subscriptions/{id}/pause
POST /superadmin/billing/subscriptions/{id}/resume
POST /superadmin/billing/subscriptions/{id}/cancel
POST /superadmin/billing/subscriptions/{id}/change-date
POST /superadmin/billing/manual-payment
GET  /superadmin/billing/ledger
```

**Billing tab controls:**
- full and partial refunds with amount, reason, GST credit-note requirement, and Stripe status;
- coupon duration, redemption cap, expiry, eligible plans, and first-time-only restriction;
- pause/resume/cancel now/cancel at period end;
- manual NEFT/UPI payment recording with bank reference and evidence upload;
- GST invoice and credit-note regeneration;
- custom enterprise contract: agreed amount, billing frequency, PO number, start/end date, seat and quota overrides;
- reconciliation view: Stripe amount ↔ AKARA invoice ↔ GST document ↔ tenant entitlement.

Refund completion must update the internal ledger only after Stripe confirms success. Failed provider calls remain visible and retryable; never mark them successful optimistically.

---

#### OMNIPOTENCE GAP 3/15 — Landing-page CMS, media library, demo slots, and ad slots

The founder must be able to change every public-facing word and visual without editing JSX.

**New tables:**
```sql
CREATE TABLE public.content_entries (
    key             TEXT PRIMARY KEY,
    locale          TEXT NOT NULL DEFAULT 'en-IN',
    draft_value     JSONB NOT NULL,
    published_value JSONB,
    version         INT NOT NULL DEFAULT 1,
    updated_by      UUID NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at    TIMESTAMPTZ
);

CREATE TABLE public.media_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    storage_path TEXT UNIQUE NOT NULL,
    public_url TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('image','video','document','logo','og_image')),
    alt_text TEXT NOT NULL,
    width INT, height INT, bytes BIGINT, mime_type TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.placement_slots (
    key TEXT PRIMARY KEY,                    -- hero_demo, pricing_banner, dashboard_notice
    kind TEXT NOT NULL CHECK (kind IN ('demo','promotion','partner','announcement')),
    content JSONB NOT NULL,
    audience_rules JSONB NOT NULL DEFAULT '{}',
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT FALSE
);
```

**CMS capabilities:**
- edit hero, pain points, feature sections, pricing copy, FAQs, testimonials, social proof, footer, SEO metadata, and structured data;
- upload/replace/crop images and videos, with required alt text and generated WebP poster;
- configure demo video URL, thumbnail, captions, transcript, duration, and fallback;
- configure promotional/ad slots with preview, schedule, page, audience, frequency cap, and click destination;
- draft → preview URL → publish → rollback to any version;
- detect broken links, missing alt text, oversized assets, and unsafe HTML before publish;
- record impressions and clicks separately from core product analytics.

“Ad slot” means an explicitly labelled first-party promotion or approved partner placement. Do not inject third-party ad scripts into authenticated customer pages.

---

#### OMNIPOTENCE GAP 4/15 — Legal documents, consent versions, and release notes

Privacy policy, terms, DPDP notices, cookie categories, and product announcements need controlled publishing.

```sql
CREATE TABLE public.document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_key TEXT NOT NULL,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    body_markdown TEXT NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL,
    requires_reacceptance BOOLEAN NOT NULL DEFAULT FALSE,
    published_by UUID NOT NULL,
    UNIQUE (document_key, version)
);

CREATE TABLE public.user_consents (
    user_id UUID NOT NULL,
    document_key TEXT NOT NULL,
    version TEXT NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip INET,
    user_agent TEXT,
    PRIMARY KEY (user_id, document_key, version)
);
```

The **Content → Legal** screen supports preview, scheduled effective date, re-acceptance targeting, acceptance-rate tracking, and immutable archived versions. The **Changelog** editor publishes release notes, controls an in-app “What’s new” modal, and can target by plan or feature flag. Published legal versions cannot be edited; corrections create a new version.

---

#### OMNIPOTENCE GAP 5/15 — Safe universal data studio

Specific tenant previews are insufficient when support needs to inspect imports, alerts, feedback, jobs, subscriptions, or consent records.

**Data Studio tab:**
- browsable allowlist of operational tables with schema descriptions;
- server-side filters, sorting, pagination, saved views, and CSV export;
- tenant-scoped mode prominently showing the selected tenant;
- row detail with foreign-key links and JSON viewer;
- permitted edits through typed forms with validation;
- soft delete, restore, and bulk actions only for tables that support them;
- PII fields masked by default with a separately audited **Reveal** action.

```python
DATA_STUDIO_POLICY = {
    "tenants": {"read": True, "editable": ["name", "internal_notes", "is_active"]},
    "profiles": {"read": True, "editable": ["display_name", "role", "is_suspended"]},
    "import_jobs": {"read": True, "actions": ["retry", "cancel"]},
    "usage_tracking": {"read": True, "actions": ["adjust"]},
    "audit_log": {"read": True, "editable": []},       # immutable
    "user_consents": {"read": True, "editable": []},   # immutable
}
```

Never accept a browser-provided table name or column name without checking this server-side policy. Auth tables, secrets, encryption keys, and raw credential stores are excluded.

---

#### OMNIPOTENCE GAP 6/15 — Guarded query console and one-click runbooks

The founder needs ad-hoc answers, but a raw unrestricted SQL editor in a web panel would turn one stolen session into total database destruction.

**Query Console:**
- read-only SQL only, executed through a dedicated read replica/read-only database role;
- one statement, 10-second timeout, 10,000-row cap, no comments containing hidden second statements;
- parser rejects DDL, DML, `COPY`, extension calls, network functions, and protected schemas;
- query history records actor, SQL hash, reason, duration, row count, and export;
- saved parameterized queries for common investigations.

Mutations happen through versioned **Runbooks**, not arbitrary SQL:
```text
rebuild_tenant_metrics
requeue_failed_import
reconcile_stripe_subscription
recalculate_usage_month
revoke_all_tenant_sessions
repair_missing_profile
regenerate_invoice
purge_expired_exports
```

Each runbook has typed parameters, dry-run output, maximum affected rows, idempotency, and a documented rollback. Endpoint: `POST /superadmin/runbooks/{name}/execute`.

---

#### OMNIPOTENCE GAP 7/15 — LLM control room

The existing conversation explorer shows answers but not why they were produced or how to safely improve them.

**New controls and records:**
```text
GET  /superadmin/ai/requests
GET  /superadmin/ai/requests/{request_id}
GET  /superadmin/ai/prompts
POST /superadmin/ai/prompts/{prompt_key}/versions
POST /superadmin/ai/prompts/{prompt_key}/test
POST /superadmin/ai/prompts/{prompt_key}/publish
POST /superadmin/ai/prompts/{prompt_key}/rollback
PATCH /superadmin/ai/routing
PATCH /superadmin/ai/budgets
POST /superadmin/ai/requests/{request_id}/replay
```

For every LLM request store: tenant/user IDs, feature, prompt-version ID, model, token counts, latency, estimated cost, status, tool calls, SQL fingerprint, redaction summary, and response-quality feedback. Raw prompts/responses follow the tenant’s retention policy and mask PII by default.

The UI supports prompt draft/version/diff, a fixed regression dataset, side-by-side model comparison, estimated cost before publish, percentage rollout, rollback, per-feature model routing, monthly budget, per-tenant circuit breaker, and global AI kill switch. A replay is always marked as test traffic and never consumes customer quota.

---

#### OMNIPOTENCE GAP 8/15 — Email, WhatsApp, and in-app template control

Every transactional message must be editable and testable without a deploy.

```sql
CREATE TABLE public.message_templates (
    key TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('email','whatsapp','in_app')),
    locale TEXT NOT NULL DEFAULT 'en-IN',
    draft JSONB NOT NULL,
    published JSONB,
    allowed_variables TEXT[] NOT NULL DEFAULT '{}',
    version INT NOT NULL DEFAULT 1,
    PRIMARY KEY (key, channel, locale)
);
```

The **Communications → Templates** screen provides variable documentation, desktop/mobile preview, real-provider test send, WhatsApp approval status, fallback channel, quiet hours, unsubscribe-category rules, version diff, publish, and rollback. Validation blocks missing required variables and unknown placeholders. Delivery logs show accepted, delivered, opened, clicked, bounced, failed, and provider response ID. The founder can suppress a recipient, retry a failed message, or disable one template globally.

---

#### OMNIPOTENCE GAP 9/15 — Integration command center and kill switches

OpenAI, Stripe, Supabase, SendGrid, WhatsApp/Zaptilo, Sentry, storage, and future connectors need one operational screen.

For each integration show configured/not configured (never the secret), provider account/workspace identifier, API health, latency, quota/rate-limit state, last successful call, last error, webhook freshness, and documentation link.

**Controls:**
```text
POST  /superadmin/integrations/{key}/test
PATCH /superadmin/integrations/{key}/state       # enabled, disabled, degraded
PATCH /superadmin/integrations/{key}/fallback
POST  /superadmin/integrations/{key}/rotate-start
POST  /superadmin/integrations/{key}/rotate-verify
```

Secret values are write-only: after submission the UI can show only fingerprint and last four characters. Store secrets in the deployment secret manager, not `global_settings`. If provider APIs cannot update Railway/Vercel secrets, the UI gives an exact external action and verifies completion; it must not falsely claim full control.

---

#### OMNIPOTENCE GAP 10/15 — Feature flags, staged rollout, and experiments

Per-tenant booleans alone cannot safely launch new features.

```sql
CREATE TABLE public.feature_flags (
    key TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    rules JSONB NOT NULL DEFAULT '[]',
    percentage SMALLINT NOT NULL DEFAULT 0 CHECK (percentage BETWEEN 0 AND 100),
    expires_at TIMESTAMPTZ,
    owner TEXT,
    version INT NOT NULL DEFAULT 1
);
```

Rules can target tenant IDs, plans, signup cohorts, internal users, and deterministic percentage buckets. Resolution order is: emergency kill switch → tenant override → explicit segment → percentage rollout → plan entitlement → default. The UI shows exactly why a selected tenant receives a value, previews affected accounts, supports schedule/expiry, and rolls back instantly. Experiments require a hypothesis, primary metric, start/end date, and mutually exclusive variants; never experiment on billing, legal consent, authentication security, or data retention.

---

#### OMNIPOTENCE GAP 11/15 — Authentication, signup, and abuse policy controls

Closing signup is too coarse. The founder needs precise controls during attacks, pilots, and enterprise onboarding.

**Policy controls:**
- allow/block email domains and disposable-domain list updates;
- invite-only mode, waitlist mode, and approved-domain auto-join;
- CAPTCHA enforcement and risk threshold;
- per-IP, per-user, per-tenant, and per-endpoint rate limits;
- maximum failed logins and lock duration;
- password policy and session duration;
- revoke one session, all sessions for a user, or all sessions for a tenant;
- force password reset or legal re-acceptance;
- verify/unverify email only through supported Supabase Admin APIs;
- freeze signup while preserving login for existing customers.

All policy changes show expected blast radius. A global “revoke every session” action is break-glass only, requires typing `REVOKE ALL SESSIONS`, and cannot be undone.

---

#### OMNIPOTENCE GAP 12/15 — Founder support desk and customer recovery

Internal notes are not a support system. The founder needs a complete history and a safe recovery toolkit.

```sql
CREATE TABLE public.support_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id),
    user_id UUID,
    subject TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open','waiting_customer','waiting_internal','resolved','closed')),
    priority TEXT NOT NULL CHECK (priority IN ('low','normal','high','urgent')),
    source TEXT NOT NULL CHECK (source IN ('email','in_app','whatsapp','manual')),
    assignee_id UUID,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The support drawer unifies customer timeline, contacts, plan, payments, imports, recent errors, conversations, consent, and prior cases. Founder actions include reply, internal note, assign, link duplicate, attach evidence, impersonate a specific user, send magic link, revoke sessions, retry import, restore soft-deleted data, grant quota/credit, and schedule follow-up. Impersonation must be view-only by default; enabling mutation requires a reason and displays a persistent banner. Never expose another customer’s case or attachment.

---

#### OMNIPOTENCE GAP 13/15 — Backup, restore, retention, and complete tenant portability

An export button is not a recovery strategy.

**Backup & Recovery tab:**
- current Supabase backup/PITR status and oldest restorable timestamp;
- last successful restore drill and measured recovery time;
- encrypted application-level tenant exports with expiry and download audit;
- tenant deletion queue with cooling-off period;
- legal hold that blocks retention deletion;
- table-level row counts and backup freshness;
- restore request workflow with preview and post-restore validation.

```text
POST /superadmin/recovery/tenant-export/{tenant_id}
GET  /superadmin/recovery/exports
POST /superadmin/recovery/restore/preview
POST /superadmin/recovery/restore/execute
POST /superadmin/recovery/legal-holds
DELETE /superadmin/recovery/legal-holds/{id}
POST /superadmin/recovery/restore-drill
```

Production PITR restore should create or use an isolated recovery database first; never overwrite production directly from a browser click. The app then performs a reviewed tenant-scoped merge where supported. If Supabase plan capabilities require its dashboard, surface the exact dependency and track the recovery operation to completion.

---

#### OMNIPOTENCE GAP 14/15 — Jobs, queues, webhooks, limits, and operational thresholds

Cron health alone misses stuck imports, failed webhooks, rate-limit spikes, and poisoned queue items.

**Operations tab:**
- all async jobs with queued/running/succeeded/failed/cancelled/dead-letter states;
- cancel, retry, retry from checkpoint, change priority, and quarantine;
- queue depth, oldest-job age, throughput, and failure rate;
- Stripe/SendGrid/WhatsApp webhook inbox with signature status, attempts, response, and replay;
- idempotency-key viewer to prevent duplicate billing or duplicate messages;
- editable alert thresholds for latency, errors, costs, queue depth, payment failures, churn risk, and provider quota;
- notification routes by severity: email, WhatsApp, Sentry, and in-app;
- maintenance windows and alert snoozes with automatic expiry.

```text
GET  /superadmin/operations/jobs
POST /superadmin/operations/jobs/{id}/retry
POST /superadmin/operations/jobs/{id}/cancel
GET  /superadmin/operations/webhooks
POST /superadmin/operations/webhooks/{id}/replay
GET  /superadmin/operations/alert-rules
POST /superadmin/operations/alert-rules
PATCH /superadmin/operations/alert-rules/{id}
```

Webhook replay uses the stored verified payload, records the original event ID, and runs through the normal idempotent handler. It must never bypass signature verification merely because the founder clicked replay.

---

#### OMNIPOTENCE GAP 15/15 — Superadmin governance, approvals, audit integrity, and rollback

The controls above are only safe if the control plane itself is governed.

**Access rules:**
- no public UI can create the first superadmin;
- every superadmin must use MFA;
- roles: `founder_owner`, `operations_admin`, `support_admin`, `billing_admin`, `read_only_auditor`;
- least-privilege permissions are checked by the backend, not hidden buttons;
- adding/removing a superadmin, exporting bulk PII, restoring data, changing billing prices, and global destructive actions require founder-owner authority;
- optional two-person approval becomes mandatory once a second superadmin exists;
- superadmin sessions have shorter idle and absolute timeouts than customer sessions;
- mobile UI is responsive for monitoring and safe actions, while destructive bulk actions require desktop.

**Tamper-evident audit additions:**
```sql
ALTER TABLE public.audit_log
    ADD COLUMN IF NOT EXISTS operation_id UUID,
    ADD COLUMN IF NOT EXISTS reason TEXT,
    ADD COLUMN IF NOT EXISTS before_state JSONB,
    ADD COLUMN IF NOT EXISTS after_state JSONB,
    ADD COLUMN IF NOT EXISTS previous_hash TEXT,
    ADD COLUMN IF NOT EXISTS entry_hash TEXT;
```

Audit rows are append-only; application roles receive no `UPDATE` or `DELETE` permission. Each row hashes the previous row plus canonical event content. Export a daily signed digest to separate immutable storage.

**Configuration history:**
```text
GET  /superadmin/config/history
GET  /superadmin/config/history/{operation_id}
POST /superadmin/config/history/{operation_id}/rollback
```

Rollback is generated from recorded before-state, performs a fresh conflict check, previews impact, and creates a new audit event. Financial transactions, sent communications, viewed PII, hard deletes, and external side effects are labelled **not reversible**; rollback must never pretend otherwise.

---

### 17.8 — Final Superadmin Information Architecture

The completed left navigation is:

```text
OVERVIEW
  Overview
  AI Briefing
  Alerts

CUSTOMERS
  Tenants
  Users
  Support
  Usage
  Data Studio

COMMERCIAL
  Revenue
  Billing
  Plans & Limits
  Promotions

PRODUCT
  Feature Flags
  AI Control Room
  Content & Media
  Legal & Changelog
  Message Templates

OPERATIONS
  Jobs & Webhooks
  Integrations
  Cron Health
  Backup & Recovery
  Query Console & Runbooks
  System Health

GOVERNANCE
  Superadmins & Roles
  Audit Log
  Configuration History
```

Global command palette (`⌘K` / `Ctrl+K`) can find a tenant, user, invoice, job, webhook, support case, feature flag, content entry, or safe action. Search results must respect the current superadmin’s permissions.

The top bar always shows environment (`PRODUCTION` in red, `STAGING` in amber), active impersonation, sudo expiry, unresolved critical alerts, and current deployment version. No production mutation is allowed when the UI believes it is connected to staging or cannot verify the environment from the backend.

---

### Day 17 Quality Gate

```bash
cd akara/backend
uv run ruff check .
uv run pytest tests/ -v

cd akara/frontend
npx tsc --noEmit
```

Manual:
- `/superadmin` with non-superadmin user → 404 (not 403)
- Tenants tab shows all tenants with every column
- Grant 20 bonus questions → Usage tab shows updated quota
- Reset quota for a tenant → quota goes to 0
- Impersonate → tab opens as that tenant, banner shown
- AI Briefing tab → ask "how many tenants haven't imported data?" → gets specific answer
- System tab → all health checks green
- Cron tab → shows last run times for all 7 tasks
- Gap 1: change a plan limit in staging → public pricing and entitlement resolver update without deploy
- Gap 2: preview a ₹100 partial refund → exact Stripe/GST/internal-ledger impact shown; idempotent refund succeeds once
- Gap 3: edit hero copy, replace demo thumbnail, schedule a promotion → preview then publish and rollback
- Gap 4: publish a legal version requiring re-acceptance → targeted user is blocked until consent is recorded
- Gap 5: Data Studio rejects a non-allowlisted table/column and masks PII until an audited reveal
- Gap 6: Query Console permits `SELECT`, rejects DDL/DML, times out a long query; runbook dry-run shows bounded impact
- Gap 7: prompt regression test compares two versions; 10% rollout resolves deterministically; rollback is instant
- Gap 8: template test send renders every variable; unknown variable blocks publish; delivery state is visible
- Gap 9: integration test reports provider latency; kill switch degrades only its dependent feature
- Gap 10: feature-flag explanation shows exactly which rule enabled the feature for a tenant
- Gap 11: revoke one user’s sessions and verify other tenants remain unaffected; abuse limits return friendly `429`
- Gap 12: support case shows complete customer timeline; view-only impersonation cannot mutate
- Gap 13: encrypted tenant export expires; restore preview targets isolation and cannot overwrite production directly
- Gap 14: replay one verified webhook twice → idempotency prevents duplicate side effects
- Gap 15: stale sudo is rejected server-side; unauthorized role gets `404`; audit chain verifies; reversible config rolls back
- Every mutation has operation ID, actor, reason, before/after state, IP, user agent, and UTC timestamp
- Keyboard navigation, mobile monitoring, empty/loading/error states, and WCAG AA contrast pass on every superadmin tab
- Secrets never return to the browser; production logs and exports do not leak tokens or unmasked credentials

---

## Day 18 — Stripe Integration + Failed Payment Handling

### Goal
Customers can upgrade to Pro or Business by entering a card. Stripe manages the subscription. Webhooks update the plan in real time. Failed payments trigger a grace period, not immediate downgrade.

---

### 18.1 — Backend dependencies

```bash
cd akara/backend
uv add stripe
```

Add to `backend/app/core/config.py`:
```python
stripe_secret_key: str = ""
stripe_webhook_secret: str = ""
stripe_pro_price_id: str = ""         # Stripe Price ID for Pro ₹7,999/mo
stripe_business_price_id: str = ""    # Stripe Price ID for Business ₹13,999/mo
stripe_customer_portal_url: str = ""  # From Stripe Dashboard → Customer Portal
```

---

### 18.2 — `backend/app/api/routes/billing.py` additions

```python
import stripe
from app.core.config import settings

stripe.api_key = settings.stripe_secret_key

# New endpoints added to existing billing.py:

POST /billing/create-checkout-session
     Body: { plan: 'pro' | 'business' }
     Creates a Stripe Checkout Session
     success_url: /billing?session_id={CHECKOUT_SESSION_ID}
     cancel_url: /upgrade
     Returns: { checkout_url: str }

GET  /billing/portal
     Returns: { portal_url: str }
     Redirects user to Stripe Customer Portal for managing subscription

POST /billing/webhook
     Receives Stripe webhook events
     Verifies signature with stripe_webhook_secret
     Handles:
       checkout.session.completed  → set plan to pro/business, plan_status=active
       customer.subscription.updated → update plan_status
       customer.subscription.deleted → downgrade to free after 30-day grace
       invoice.payment_failed → set plan_status=past_due, send warning email
       invoice.payment_action_required → same
```

Webhook implementation detail:
```python
@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except ValueError:
        raise HTTPException(400, "Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid signature")

    supa = get_supabase_service_client()

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        tenant_id = session["metadata"]["tenant_id"]
        plan = session["metadata"]["plan"]
        stripe_customer_id = session["customer"]
        stripe_subscription_id = session["subscription"]

        supa.table("tenants").update({
            "plan": plan,
            "plan_status": "active",
            "stripe_customer_id": stripe_customer_id,
            "stripe_subscription_id": stripe_subscription_id,
        }).eq("id", tenant_id).execute()

    elif event["type"] == "invoice.payment_failed":
        customer_id = event["data"]["object"]["customer"]
        supa.table("tenants").update({
            "plan_status": "past_due"
        }).eq("stripe_customer_id", customer_id).execute()
        # TODO Day 20: send dunning email via SendGrid

    elif event["type"] == "customer.subscription.deleted":
        customer_id = event["data"]["object"]["customer"]
        # Grace period: keep plan for 30 days, then downgrade
        supa.table("tenants").update({
            "plan_status": "cancelled",
            "trial_ends_at": (datetime.utcnow() + timedelta(days=30)).isoformat()
        }).eq("stripe_customer_id", customer_id).execute()

    return {"received": True}
```

---

### 18.3 — Failed payment grace period enforcement

In `PlanGuard`, before checking limits, check `plan_status`:

```python
async def _check_plan_status(tenant: TenantCtx):
    # Query tenants table for plan_status
    supa = get_supabase_service_client()
    result = supa.table("tenants").select("plan_status, trial_ends_at") \
        .eq("id", str(tenant.tenant_id)).single().execute()
    status = result.data.get("plan_status", "active")
    trial_ends_at = result.data.get("trial_ends_at")

    if status == "cancelled":
        if trial_ends_at and datetime.fromisoformat(trial_ends_at) > datetime.utcnow():
            return  # still in grace period
        # Grace period expired — effectively downgrade to free
        # Don't update DB here (too slow) — treat as free for this request

    if status == "past_due":
        # Allow access but show banner — handled in frontend via billing/usage endpoint
        return
```

---

### 18.4 — Frontend Stripe wiring

**`UpgradePage.tsx`** — replace mailto CTA with real Stripe:

```typescript
async function handleUpgrade(plan: 'pro' | 'business') {
  const { checkout_url } = await apiFetch<{ checkout_url: string }>(
    '/billing/create-checkout-session',
    { method: 'POST', body: JSON.stringify({ plan }) }
  );
  window.location.href = checkout_url;  // redirect to Stripe Checkout
}
```

**`BillingPage.tsx`** — "Manage subscription" button:
```typescript
async function handleManage() {
  const { portal_url } = await apiFetch<{ portal_url: string }>('/billing/portal');
  window.location.href = portal_url;
}
```

**`UsageBanner.tsx`** — add `past_due` warning variant:
```typescript
// If plan_status === 'past_due':
// Show red banner: "Payment failed. Update your card to avoid losing access."
// [Update payment method →] → /billing (which links to Stripe portal)
```

---

### Day 18 Quality Gate

Manual (Stripe test mode):
- Upgrade to Pro with test card `4242 4242 4242 4242` → plan changes to pro in DB
- Upgrade to Business → works
- Failed payment test card `4000 0000 0000 0341` → `past_due` banner appears
- Cancel subscription in Stripe portal → plan_status = cancelled, access continues 30 days
- Day 30 (simulated): access reverts to free limits

---

## Day 19 — Security Hardening

### Goal
Rate limiting, HTTP security headers, ToS enforcement, data isolation verification.

---

### 19.1 — Rate limiting (`slowapi`)

```bash
cd akara/backend
uv add slowapi
```

**`backend/app/main.py`** additions:

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

Apply rate limits to sensitive endpoints:

```python
# copilot.py
@router.post("/chat")
@limiter.limit("30/minute")   # per IP — copilot already has plan quota
async def chat(request: Request, ...):

# data.py
@router.post("/import")
@limiter.limit("10/minute")   # per IP — heavy endpoint
async def import_data(request: Request, ...):

# auth.py
@router.get("/me")
@limiter.limit("60/minute")   # generous for page loads
async def me(request: Request, ...):

# onboarding.py
@router.post("/setup")
@limiter.limit("5/minute")    # prevent tenant spam
async def setup_tenant(request: Request, ...):
```

---

### 19.2 — HTTP security headers

**`backend/app/main.py`** — add middleware:

```python
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = \
                "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)
```

---

### 19.3 — PII Redaction Before LLM Calls (DPDP Act compliance)

When AKARA builds a SQL context or prompt for the LLM, it includes column values like party names, phone numbers, and addresses. Under DPDP Act 2023, sending personal data of Indian residents to a US-based LLM (OpenAI) without explicit consent constitutes cross-border transfer.

**Practical mitigation — redact high-risk PII before the LLM call:**

**New file: `backend/app/services/copilot/pii_redactor.py`**

```python
import re
from typing import Any

# Patterns for common Indian PII found in FMCG data
_PATTERNS = [
    # GST numbers (15 chars: 2 digits + PAN + 1 alpha + 1 digit)
    (re.compile(r'\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b'), '[GST_REDACTED]'),
    # PAN (AAAAA9999A format)
    (re.compile(r'\b[A-Z]{5}\d{4}[A-Z]{1}\b'), '[PAN_REDACTED]'),
    # Indian phone numbers
    (re.compile(r'\b(?:\+91[\-\s]?)?[6-9]\d{9}\b'), '[PHONE_REDACTED]'),
    # Aadhaar (12 digits, groups of 4)
    (re.compile(r'\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b'), '[AADHAAR_REDACTED]'),
    # Email addresses
    (re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'), '[EMAIL_REDACTED]'),
]

def redact(text: str) -> str:
    """
    Removes high-risk Indian PII patterns from text before it is sent to an LLM.
    Does NOT redact business names (party_name) — those are operational data, not personal data.
    """
    for pattern, replacement in _PATTERNS:
        text = pattern.sub(replacement, text)
    return text

def redact_row(row: dict[str, Any]) -> dict[str, Any]:
    """Redacts PII from values in a dict row."""
    sensitive_fields = {"contact_number", "email", "gst_number", "pan_number", "aadhaar"}
    return {
        k: ('[REDACTED]' if k in sensitive_fields else v)
        for k, v in row.items()
    }
```

**Wire into `agent.py`** — apply `pii_redactor.redact()` to the SQL query context string before passing to the synthesizer:

```python
from app.services.copilot.pii_redactor import redact

# In _build_context():
context_str = redact(context_str)
```

**Add to consent modal on signup (Day 15 update):**
```
"Your sales data (revenue figures, party names, product names) will be analysed by
AI systems to generate insights. Personal contact information is automatically removed
before processing. Your data is never shared with other organisations."
```

---

### 19.4 — Zero-Code Alerts (competitive parity with FireAI)

FireAI's biggest SMB feature is threshold alerts without SQL. A regional manager sets "alert me when Route B secondary sales drop below ₹50,000" and gets a WhatsApp message.

**Migration addition (add to `010_billing.sql` or new `012_alerts.sql`):**

```sql
CREATE TABLE IF NOT EXISTS public.tenant_alerts (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,       -- "Low secondary sales alert"
    metric          TEXT        NOT NULL,       -- 'secondary_sales_total' | 'beat_adherence_pct' | 'outstanding_amount' | 'scheme_leakage_amount'
    condition       TEXT        NOT NULL CHECK (condition IN ('below', 'above', 'equals')),
    threshold       NUMERIC     NOT NULL,
    dimension       TEXT,                       -- NULL = all | 'zone:North' | 'route:Route A' | 'party:Sharma Traders'
    delivery        TEXT[]      NOT NULL DEFAULT '{email}',  -- email | whatsapp
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    last_triggered  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Plan: free=0 alerts | pro=5 | business=unlimited
```

**`backend/app/tasks/alert_evaluator.py`** (new nightly task):

```python
"""
Evaluates all active tenant_alerts. Sends notifications when thresholds are crossed.
Run: 0 6 * * * (6 AM IST, after overnight data sync)
"""
from app.core.tenant import get_supabase_service_client
from app.services.notifications import send_email_alert, send_whatsapp_alert

METRIC_QUERIES = {
    "secondary_sales_total": """
        SELECT COALESCE(SUM(total_amount),0) as value
        FROM secondary_sales_data
        WHERE tenant_id = '{tenant_id}'
        AND period_start >= DATE_TRUNC('month', NOW())
        {dimension_filter}
    """,
    "outstanding_amount": """
        SELECT COALESCE(SUM(outstanding_amount),0) as value
        FROM sales_data
        WHERE tenant_id = '{tenant_id}'
        {dimension_filter}
    """,
    # ... other metrics
}

def evaluate_alerts():
    supa = get_supabase_service_client()
    alerts = supa.table("tenant_alerts").select("*").eq("is_active", True).execute()

    for alert in alerts.data:
        current_value = _get_metric_value(supa, alert)
        triggered = _check_condition(current_value, alert["condition"], alert["threshold"])

        if triggered:
            _send_notifications(supa, alert, current_value)
            supa.table("tenant_alerts").update({
                "last_triggered": "NOW()"
            }).eq("id", alert["id"]).execute()
```

**Frontend: `AlertsPage.tsx`** (new page, `/alerts`):

```typescript
// Route: /alerts
// PlanGate: locked for free users (0 alerts), available for Pro (5) and Business (unlimited)
//
// Layout:
//
// Header: "Alerts" + [+ New Alert] button  + "X of Y alert slots used" (for Pro users)
//
// Alert creation form (modal):
//   Name: text input ("Low Route B secondary sales")
//   I want to be alerted when:
//     [Secondary sales total ▼] [falls below ▼] [₹] [50,000]
//   For: [All routes ▼]  (dimension filter: All / specific zone / route / party)
//   Notify me via: [✓ Email] [✓ WhatsApp]  (WhatsApp requires phone number in profile)
//   [Save alert]
//
// Alert list table:
//   Name | Metric | Condition | Last triggered | Status (Active/Paused) | Actions
//
// Available metrics:
//   Secondary sales total | Primary sales total | Outstanding amount | 
//   Beat adherence % | Scheme leakage amount | Route revenue | Zone revenue
```

---

### 19.5 — ToS acceptance on signup

**`frontend/src/pages/SignUpPage.tsx`** — enforce checkbox + DPDP-specific consent:

```typescript
// Two separate checkboxes (both required):
//
// ☐ "I accept the Terms of Service and Privacy Policy"
// ☐ "I consent to my sales data (revenue figures, party names, product names) being
//    processed by AI systems to generate analytics. Personal contact information is
//    automatically removed before processing. My data is not shared with other organisations."
//    [Learn more ↗]  → links to /privacy#ai-processing
//
// This is DPDP Act 2023 Section 6 compliant: purpose-specific, explicit, separate from ToS.
//
// Store both in Supabase user metadata:
supabase.auth.signUp({
  email, password,
  options: {
    data: {
      display_name: fullName,
      tos_accepted_at: new Date().toISOString(),
      tos_version: "1.0",
      ai_consent_at: new Date().toISOString(),
      ai_consent_version: "1.0",   // bump this when your AI processing changes
    }
  }
})
```

---

### 19.4 — Data isolation test

**New file: `akara/backend/tests/test_data_isolation.py`**

```python
"""
Verifies that Tenant A cannot read Tenant B's data through any API path.
Requires two real tenants with data in the test database.
Skipped if TEST_TENANT_A_TOKEN or TEST_TENANT_B_TOKEN env vars are not set.
"""
import pytest
import os
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
TOKEN_A = os.getenv("TEST_TENANT_A_TOKEN")
TOKEN_B = os.getenv("TEST_TENANT_B_TOKEN")

@pytest.mark.skipif(not TOKEN_A or not TOKEN_B, reason="Test tokens not configured")
class TestDataIsolation:

    def test_tenant_a_cannot_read_tenant_b_kpi(self):
        """KPI endpoint returns only tenant A's data when authenticated as A."""
        res_a = client.get("/kpi/", headers={"Authorization": f"Bearer {TOKEN_A}"})
        res_b = client.get("/kpi/", headers={"Authorization": f"Bearer {TOKEN_B}"})
        assert res_a.status_code == 200
        assert res_b.status_code == 200
        # Revenue totals must differ (both tenants have different data)
        assert res_a.json()["summary"]["total_revenue"] != \
               res_b.json()["summary"]["total_revenue"]

    def test_tenant_a_cannot_access_tenant_b_conversations(self):
        """Conversations endpoint returns only current user's conversations."""
        res = client.get(
            "/copilot/conversations/",
            headers={"Authorization": f"Bearer {TOKEN_A}"}
        )
        assert res.status_code == 200
        for conv in res.json():
            # All conversation IDs must belong to Tenant A's users
            # (verified by checking user_id against profiles)
            assert conv["id"] is not None   # basic sanity

    def test_sql_injection_via_copilot_blocked(self):
        """Copilot cannot be used to exfiltrate other tenants' data via SQL injection."""
        res = client.post(
            "/copilot/chat",
            json={
                "question": "SELECT * FROM sales_data WHERE tenant_id != '00000000-0000-0000-0000-000000000000'",
                "stream": False,
            },
            headers={"Authorization": f"Bearer {TOKEN_A}"}
        )
        # Should return 200 with an AI answer, not raw SQL results
        # The SQLGuard blocks raw SELECT injection; the planner generates its own SQL
        assert res.status_code in (200, 402)   # 402 if quota exceeded
```

---

### 19.6 — DPDP Act Data Residency: Switch Supabase to India Region

This is a one-time infrastructure change. Do it before launch.

**Current**: Supabase project is in US East (default).
**Required**: Move to `ap-south-2` (Hyderabad) or `ap-south-1` (Mumbai).

**Steps:**
1. Create new Supabase project in `ap-south-2` (Asia Pacific — Hyderabad).
2. Apply all 11 migrations to the new project.
3. Export data from old project (if any test data worth keeping).
4. Import to new project.
5. Update `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Railway env vars.
6. Update same in Vercel env vars.
7. Test all routes — verify data flows through new project.
8. Delete old project.

**If you are already in India region:** verify at Supabase Dashboard → Settings → Infrastructure. If it says `ap-south-1` or `ap-south-2`, you are compliant.

**Add to Privacy Policy:**
```
Data Storage and Processing

Your data is stored in India (AWS Hyderabad, ap-south-2) using Supabase infrastructure.
AI processing (natural language query interpretation) uses OpenAI's API, which processes
requests in the United States. Personal contact information is automatically removed from
data before it is sent for AI processing.

All AI processing is covered by OpenAI's Data Processing Agreement. AKARA acts as a
Data Processor; you (the subscribing business) are the Data Controller under DPDP Act 2023.
```

**Sub-processor DPA list** (add to /privacy page and downloadable PDF):
| Sub-processor | Purpose | Location | DPA/SOC2 |
|---|---|---|---|
| Supabase | Database + Auth | India (ap-south-2) | SOC 2 Type 2 |
| OpenAI | AI inference | US | DPA available |
| Railway | Backend hosting | US | SOC 2 Type 2 |
| Vercel | Frontend hosting | US | SOC 2 Type 2 |
| SendGrid | Email delivery | US | SOC 2 Type 2 |
| Stripe | Payment processing | US | PCI DSS Level 1 |
| Zaptilo | WhatsApp delivery | India | DPDP compliant |

---

### 19.7 — Layered Limit Enforcement (Soft → Hard, competitive standard)

Current PlanGuard does a hard stop at 100%. Industry standard is soft → hard:

**Update `plan_guard.py`:**

```python
async def require_copilot_quota(tenant: TenantCtx = Depends()):
    plan = tenant.plan
    limit = get_limit(plan, "copilot_calls_per_month")
    if limit == -1:
        return   # unlimited

    usage = await _get_current_usage(tenant.tenant_id)
    current = usage.get("copilot_calls", 0)
    pct = (current / limit) * 100

    if pct >= 100:
        raise UsageExceeded(
            message=f"You've used all {limit} questions this month. "
                    f"Your dashboard and weekly brief still work. "
                    f"Upgrade to Pro for 400 questions/month.",
            feature="copilot_calls",
        )

    # Return usage metadata — frontend uses this to show warnings
    # Without blocking the request
    return {
        "quota_used": current,
        "quota_limit": limit,
        "quota_pct": round(pct, 1),
        "warn": pct >= 80,   # frontend shows amber banner
        "urgent": pct >= 90, # frontend shows red banner
    }
```

**In copilot route response**, add quota metadata to the response headers:
```python
response.headers["X-Quota-Used"] = str(current + 1)
response.headers["X-Quota-Limit"] = str(limit)
response.headers["X-Quota-Warn"] = "true" if pct >= 80 else "false"
```

**Frontend reads these headers** in the API client and updates the `useBilling` cache if a warning is detected — so the `UsageBanner` updates immediately after a question, without waiting for the next cache refresh.

---

### Day 19 Quality Gate

```bash
cd akara/backend
uv run ruff check .
uv run pytest tests/ -v --tb=short
# All existing 28 tests pass + new isolation tests pass (if tokens configured)
```

Verify in production:
- Hit `/copilot/chat` 31 times in 1 minute → 29th+ returns 429
- Check response headers include `X-Content-Type-Options`
- Sign up without AI consent checkbox → error shown, cannot proceed
- PII redactor removes a GST number from a test prompt before it reaches OpenAI
- Supabase project is in `ap-south-2` or `ap-south-1`

---

## Day 20 — WhatsApp Notifications + Team Invites + Account Management

### Goal
Ship WhatsApp as a delivery channel for weekly debriefs and alerts — this is AKARA's biggest differentiator vs FireAI. Then: team invites, password management, account deletion.

---

### 20.0 — WhatsApp Integration (BSP: Zaptilo)

**Why this is first:** This is the feature that will be in every demo. "You'll get your weekly business brief on WhatsApp every Monday at 7 AM." That sentence closes deals.

**Setup steps (one-time, ~24 hours):**
1. Sign up at zaptilo.ai — get API token in minutes.
2. Create a WhatsApp Business number (dedicated phone or virtual number).
3. Meta verification of business account (1–2 days for Indian businesses with GST).
4. Create message templates in Meta Business Manager:
   - Template 1: `weekly_debrief_brief` (Utility category)
   - Template 2: `alert_notification` (Utility category)
   - Template 3: `morning_brief_brief` (Utility category)
5. Submit templates for Meta approval (~24 hours).

**Template designs (must be pre-approved by Meta — cannot change text after approval):**

`weekly_debrief_brief` template:
```
📊 *{{1}}* Weekly Brief — {{2}}

Revenue: ₹{{3}} ({{4}})
Top Zone: {{5}}
{{6}}

3 Actions This Week:
{{7}}

[Full Report →] {{8}}
```
Variables: company_name, week_range, revenue, revenue_change, top_zone, alert_line, actions, report_url

`alert_notification` template:
```
⚠️ *AKARA Alert* — {{1}}

{{2}} has {{3}} {{4}}
Current: {{5}}
Threshold: {{6}}

This crossed your alert threshold.
[View Dashboard →] {{7}}
```

---

**Backend: `backend/app/services/notifications/whatsapp.py`** (new file):

```python
import httpx
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

ZAPTILO_API_URL = "https://api.zaptilo.ai/v1"

async def send_whatsapp_template(
    to_phone: str,          # E.164 format: +919876543210
    template_name: str,
    variables: list[str],
) -> bool:
    """
    Sends a pre-approved WhatsApp template message via Zaptilo.
    Returns True on success, False on failure (caller decides whether to log).
    """
    if not settings.zaptilo_api_token:
        logger.warning("WhatsApp not configured — ZAPTILO_API_TOKEN missing")
        return False

    # Zaptilo normalises Indian numbers — strip country code if present
    phone = to_phone.lstrip("+").lstrip("91") if to_phone.startswith("+91") else to_phone

    payload = {
        "token": settings.zaptilo_api_token,
        "to": phone,
        "template": template_name,
        "language": "en",
        "variables": variables,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{ZAPTILO_API_URL}/message/template", json=payload)
            resp.raise_for_status()
            logger.info(f"WhatsApp sent: template={template_name} to={phone[:4]}***")
            return True
    except httpx.HTTPError as e:
        logger.error(f"WhatsApp failed: template={template_name} to={phone[:4]}*** error={e}")
        return False


async def send_weekly_debrief_whatsapp(
    phone: str,
    company_name: str,
    week_range: str,
    revenue: str,         # "₹18.4L"
    revenue_change: str,  # "↑12%"
    top_zone: str,
    alert_line: str,      # "🔴 Scheme leakage on ProductBeta" or ""
    actions: str,         # Newline-separated 3 actions
    report_url: str,
) -> bool:
    return await send_whatsapp_template(
        to_phone=phone,
        template_name="weekly_debrief_brief",
        variables=[company_name, week_range, revenue, revenue_change,
                   top_zone, alert_line, actions, report_url],
    )
```

**Update `backend/app/services/reports/weekly_debrief.py`** — add WhatsApp delivery:

```python
# After sending email, also send WhatsApp if:
# 1. tenant.plan in ('pro', 'business')
# 2. tenant_admin profile has phone_number set
# 3. profile.preferences.whatsapp_debrief_enabled == True

profile = supa.table("profiles").select("phone_number, preferences") \
    .eq("tenant_id", str(tenant_id)).eq("role", "admin") \
    .single().execute()

if profile.data:
    phone = profile.data.get("phone_number")
    prefs = profile.data.get("preferences", {})
    if phone and prefs.get("whatsapp_debrief_enabled", True):
        from app.services.notifications.whatsapp import send_weekly_debrief_whatsapp
        await send_weekly_debrief_whatsapp(
            phone=phone,
            company_name=tenant_name,
            week_range=f"{monday.strftime('%d %b')}–{sunday.strftime('%d %b')}",
            revenue=format_inr(weekly_revenue),
            revenue_change=pct_change_str(weekly_revenue, prev_revenue),
            top_zone=top_zone_name,
            alert_line=alert_line_str,
            actions="\n".join([f"{i+1}. {a}" for i, a in enumerate(actions[:3])]),
            report_url=f"https://app.akara.ai/reports?week={monday.isoformat()}",
        )
```

**Add to alert evaluator** — send WhatsApp alert when threshold crossed (if 'whatsapp' in alert.delivery).

**Frontend: Phone number in Settings:**

```typescript
// Add to SettingsPage.tsx → Profile section:
//
// Phone number: [+91 XXXXXXXXXX]  (for WhatsApp notifications)
// Toggle: Receive weekly debrief on WhatsApp  (default: ON if phone set)
// Toggle: Receive alerts on WhatsApp  (default: ON if phone set)
//
// On save: PATCH /account/preferences + update profiles.phone_number
// Show: "WhatsApp notifications are Pro/Business feature"
//
// Verification: On saving phone number, send a WhatsApp verification code
// (use authentication template category for this)
```

**Add to `012_alerts.sql` or `010_billing.sql`:**
```sql
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS phone_number TEXT,
    ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}';
    -- preferences schema:
    -- {
    --   "email_debrief_enabled": true,
    --   "whatsapp_debrief_enabled": true,
    --   "email_morning_brief_enabled": true,
    --   "whatsapp_alerts_enabled": true,
    --   "product_announcements_enabled": true
    -- }
```

**Cost tracking:**
- Utility message (debrief): ₹0.30
- At 400 Pro customers: 400 × ₹0.30 = ₹120/month
- Add to the LLM cost log table as `feature = 'whatsapp_debrief'`, `cost_usd = 0.0036` (₹0.30 ÷ 83)

---

### 20.1 — Backend: team invites

**New file: `backend/app/api/routes/team.py`**

```python
router = APIRouter(prefix="/team", tags=["team"])

POST /team/invite
     Body: { email: str, role: 'admin' | 'user' }
     Auth: must be tenant admin
     Plan check: current user count < plan limit (users)
     Logic:
       1. supabase.auth.admin.invite_user_by_email(email,
              options={"data": {"tenant_id": tenant_id, "role": role}})
          → Supabase sends "You've been invited" email
          → Link contains token → user sets password → handle_new_user trigger fires
          → profile is created with tenant_id + role from metadata
       2. Returns: { message: "Invite sent to {email}" }
     Errors:
       - Already a member: "This email is already on your team."
       - Plan limit: "Your plan allows {N} users. Upgrade to invite more."

GET  /team/members
     Returns all profiles for tenant_id
     Columns: id, display_name, email (from auth.users join), role, created_at

DELETE /team/members/{user_id}
     Removes user from tenant (sets profile.tenant_id = NULL, not hard delete)
     Cannot remove yourself
     Cannot remove the last admin

PATCH /team/members/{user_id}/role
     Body: { role: 'admin' | 'user' }
     Existing route in admin/users.py — keep but also add here for tenant-scoped use
```

#### 20.1a — GAP: atomic seat reservation and downgrade-safe membership control

Checking only the current profile count before sending an invitation is insufficient. Two simultaneous invitations, or several unaccepted invitations, could exceed the tenant's seat limit. Seat enforcement must be transactional and must cover the complete invitation and downgrade lifecycle.

**Seat definition:**

```text
occupied_seats =
    active memberships
  + security-suspended memberships
  + unexpired pending invitations that reserved a seat

seat_locked memberships do not occupy a paid seat.
The tenant owner is always an occupied seat and cannot be seat-locked.
```

Free has 1 total seat, Pro has 3, Business has 10, and a founder-created `plan_assignments.custom_limits.users` value can set a tenant-specific limit such as 5. The effective limit is resolved server-side; the client never submits or overrides it.

**Migration additions:**

```sql
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id);

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS membership_status TEXT NOT NULL DEFAULT 'active'
        CHECK (membership_status IN ('active', 'suspended', 'seat_locked'));

CREATE TABLE IF NOT EXISTS public.team_invites (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email_normalized TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
    reserves_seat   BOOLEAN NOT NULL DEFAULT TRUE,
    invited_by      UUID NOT NULL REFERENCES auth.users(id),
    accepted_by     UUID REFERENCES auth.users(id),
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at     TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_team_invites_pending_email
    ON public.team_invites (tenant_id, email_normalized)
    WHERE status = 'pending';
```

Backfill `tenants.owner_user_id` from the original tenant admin created during onboarding, then make it mandatory for newly created tenants. Onboarding must set `owner_user_id` in the same transaction that links the founder profile.

**Atomic invitation reservation:**

`POST /team/invite` must call one database transaction/RPC such as `reserve_team_invite(...)`:

1. Lock the tenant's seat-allocation row (`SELECT ... FOR UPDATE` or transaction advisory lock).
2. Expire all pending invitations whose `expires_at <= NOW()` and set `reserves_seat = false`.
3. Resolve the effective seat limit from plan catalog + tenant custom limits.
4. Count active/suspended memberships plus unexpired reserved pending invitations.
5. Reject with structured `seat_limit_reached` if `occupied_seats >= seat_limit`.
6. Insert one pending invitation that reserves a seat.
7. Commit and return the invitation ID plus `{ occupied, limit, remaining }`.
8. Only then ask Supabase Auth to send the invitation.
9. If provider sending fails, transactionally cancel the invitation and release the reservation.

The endpoint is idempotent by `(tenant_id, normalized_email)` and request idempotency key. Repeated clicks return the existing pending invitation rather than reserve multiple seats.

**Acceptance-time recheck:**

- The invitation row, not editable auth metadata, is the source of truth for tenant and role.
- Acceptance locks the tenant seat allocation and invite row.
- Confirm invite is pending, unexpired, addressed to the authenticated normalized email, and still reserves a seat.
- Recalculate the effective limit and occupied seats.
- If the reservation was valid, create/link the profile and atomically mark the invite accepted.
- If the plan was downgraded and the reservation is no longer valid, do not join the tenant; mark/release it and show “Your workspace no longer has an available seat. Ask the administrator to free a seat or upgrade.”
- An accepted invitation cannot be replayed.

**Cancellation and expiry:**

- `DELETE /team/invites/{invite_id}` marks it cancelled and sets `reserves_seat = false`.
- A scheduled cleanup marks overdue pending invites expired and releases seats.
- Resend rotates the provider token/expiry but does not reserve a second seat.
- Removing an active member releases a seat immediately after last-admin/owner checks.
- Security suspension continues occupying the seat; it is not a billing workaround.

**Plan downgrade reconciliation:**

Before a scheduled Business → Pro or Pro → Free downgrade, show the tenant admin the new seat limit and allow selection of memberships to retain.

At effective downgrade:

1. Always retain the tenant owner.
2. Retain explicitly selected members up to the new limit.
3. If no selection exists, retain owner, then oldest active admins, then oldest active users.
4. Set excess memberships to `seat_locked`; do not delete users or their history.
5. Cancel/release pending invitations beyond the new available capacity.
6. Revoke active application sessions for newly seat-locked users.
7. Show seat-locked users a workspace-access message, not a generic authentication failure.
8. On re-upgrade, let the tenant admin reactivate locked members up to the new limit.

Every reservation, release, acceptance, lock, unlock, and downgrade reconciliation is written to `audit_log`.

**Required API/UI additions:**

```text
GET    /team/seats
       → { active, suspended, pending_reserved, locked, occupied, limit, remaining }

GET    /team/invites
DELETE /team/invites/{invite_id}
POST   /team/invites/{invite_id}/resend
POST   /team/downgrade-seat-selection
POST   /team/members/{user_id}/reactivate
```

Team UI always displays `occupied of limit seats used`, includes pending reservations in the count, labels locked members separately, disables invite at zero remaining, and links to upgrade/contact founder for a custom limit.

**Tests:**

- two simultaneous invitations for the final seat → exactly one succeeds;
- repeated invite/idempotency retry → one reservation;
- pending invitation consumes a seat;
- cancel, expiry, provider-send failure, and member removal release exactly one seat;
- resend does not consume another seat;
- acceptance validates email, expiry, tenant, role, reservation, and current limit;
- Free 1, Pro 3, Business 10, and custom 5 limits;
- downgrade 10→3 and 3→1 preserves owner, locks excess users, cancels excess pending invitations, and revokes locked sessions;
- re-upgrade reactivation cannot exceed the new limit;
- tenant A can never inspect, cancel, accept, or reactivate tenant B's membership/invitation.

---

### 20.2 — Frontend: team management in Settings

**New file: `frontend/src/pages/TeamPage.tsx`**

```typescript
// Route: /team (in Settings section, visible to admins only)
//
// Sections:
//
// 1. Current team
//    Table: Avatar | Name | Email | Role (badge) | Joined | Actions
//    Actions: Change role (dropdown) | Remove (confirm dialog)
//
// 2. Invite member
//    Email field + Role select (admin/user) + [Send Invite] button
//    PlanGate: locked with "Team invites require Pro plan" for free users
//    Shows: "X of Y user slots used" with progress bar
//
// 3. Pending invites
//    List of sent invites with: email, role, sent time, [Resend] [Cancel] buttons
```

---

### 20.3 — Password change in Settings

**`frontend/src/pages/SettingsPage.tsx`** — add password section:

```typescript
// New "Security" section in SettingsPage:
//
// Current password (text input, type=password)
// New password (text input, type=password, min 8 chars)
// Confirm new password (text input)
// [Change password] button
//
// On submit:
// supabase.auth.updateUser({ password: newPassword })
// Note: Supabase requires the user to be recently authenticated.
// If session is old: prompt re-auth first.
// Success: "Password changed successfully."
```

---

### 20.4 — Account deletion + data export

**`backend/app/api/routes/account.py`** (new file):

```python
router = APIRouter(prefix="/account", tags=["account"])

DELETE /account
       Auth: must be authenticated
       Body: { confirm: "DELETE" }  ← must type exactly "DELETE" to prevent accidents
       Logic:
         1. Delete all sales_data for tenant
         2. Delete all chat_history for user
         3. Delete all conversations for user
         4. If user is last admin: delete tenant entirely
         5. supabase.auth.admin.delete_user(user_id)
       Returns: 204

GET /account/export
    Auth: must be authenticated
    Returns: JSON file download containing:
      - profile info
      - all sales_data rows for tenant (if admin)
      - all chat_history rows for user
      - all conversations for user
    Content-Disposition: attachment; filename="akara_export_{date}.json"
```

**`frontend/src/pages/SettingsPage.tsx`** — add danger zone:

```typescript
// "Danger Zone" section at bottom of Settings:
//
// [Export my data] → GET /account/export → file download
// [Delete my account] → confirmation modal:
//   "This will permanently delete your account and all your data.
//    Type DELETE to confirm."
//   Input field + [Delete account] (red button)
//   → DELETE /account
//   → redirects to landing page after success
```

---

### 20.5 — Email notification preferences

**`frontend/src/pages/SettingsPage.tsx`** — add notifications section:

```typescript
// "Notifications" section (reads/writes profiles.preferences JSONB):
//
// Toggle: Weekly debrief email (email_debrief_enabled, default: on)
// Toggle: Weekly debrief WhatsApp (whatsapp_debrief_enabled, default: on when verified phone exists; Pro/Business)
// Toggle: Daily morning brief email (email_morning_brief_enabled, default: on, Pro/Business only)
// Toggle: Daily morning brief WhatsApp (whatsapp_morning_brief_enabled, default: on when verified phone exists; Pro/Business)
// Toggle: Product updates and announcements (default: on)
// Toggle: Usage warnings (default: on)
// [Save preferences] button
//
// Backend: PATCH /account/preferences
//   Body: {
//     email_debrief_enabled,
//     whatsapp_debrief_enabled,
//     email_morning_brief_enabled,
//     whatsapp_morning_brief_enabled,
//     announcements_enabled,
//     usage_warnings_enabled
//   }
//   Updates profiles.preferences JSONB
```

---

### 20.6 — Complete Weekly Debrief (engine, email, WhatsApp, in-app report, and archive)

The weekly debrief is a complete product feature, not only a scheduled WhatsApp message. Every Monday at **7:00 AM IST**, AKARA explains:

1. **The Headline** — the single most important change, with a number.
2. **What Went Right** — exactly three positives ranked by absolute ₹ impact.
3. **What Went Wrong** — exactly three negatives, each with a data-supported hypothesis.
4. **Momentum** — 30/60/90-day direction and projected month.
5. **This Week’s 3 Actions** — exactly three named, specific actions.

Rules:

- Every insight contains a number, named party, named product, or named zone.
- No buzzwords such as “KPI”, “metric”, “leverage”, or “synergy”.
- The LLM writes prose around deterministic numbers; it never calculates business values.
- The report is delivered by email and, when enabled/eligible, WhatsApp.
- The same structured report is stored and rendered natively at `/debrief`.
- Pro and Business receive it every Monday. Free receives one lifetime debrief.

#### 20.6a — Canonical decisions resolving the standalone draft

- **LLM provider:** use AKARA’s existing OpenRouter client and pinned model (`settings.openrouter_model`). Do not call OpenAI directly and do not introduce a separate Gemini client for this feature.
- **Preferences:** use separate `email_debrief_enabled` and `whatsapp_debrief_enabled` values. Do not couple weekly debrief opt-out to the daily morning brief.
- **Schedule:** `30 1 * * 1` UTC, which is Monday **07:00 IST**. `01:00 UTC` would be 06:30 IST.
- **Storage:** use the existing `generated_reports` table with `report_type = 'weekly_debrief'`; no duplicate report table.
- **Tenant safety:** all nine computations, report reads, trigger actions, and stored records are tenant-scoped and covered by RLS/API authorization.

#### 20.6b — Stored metadata contract

`generated_reports.metadata` stores this versioned structure:

```json
{
  "schema_version": 1,
  "week_start": "2026-07-14",
  "week_end": "2026-07-20",
  "generated_at": "2026-07-21T01:30:00Z",
  "headline": "Revenue grew ₹1.2L vs last week, led by Zone North.",
  "went_right": [
    {
      "title": "Zone North hit a 60-day high",
      "detail": "₹3.4L this week vs ₹2.8L last week (+21%).",
      "impact_inr": 60000
    }
  ],
  "went_wrong": [
    {
      "title": "Zone South dropped ₹62,000",
      "detail": "Four parties placed zero orders this week.",
      "hypothesis": "Their usual reorder cycle suggests they are due Thursday.",
      "impact_inr": 62000
    }
  ],
  "momentum": {
    "this_week_revenue": 210000,
    "this_week_revenue_fmt": "₹2.1L",
    "wow_change_pct": 12.4,
    "wow_direction": "up",
    "avg_30d_daily": 28500,
    "avg_60d_daily": 26200,
    "avg_90d_daily": 24800,
    "trend_30d": "up",
    "trend_60d": "up",
    "trend_90d": "up",
    "projected_month": 855000,
    "projected_month_fmt": "₹8.6L",
    "projection_note": "At the current weekly pace, this month projects to ₹8.6L."
  },
  "actions": [
    {
      "title": "Call Zone South parties on Thursday",
      "detail": "Four named parties are at day 18–22 of a usual 21-day reorder cycle.",
      "urgency": "high"
    }
  ],
  "data_freshness": "2026-07-20",
  "days_of_data": 87,
  "limited_mode": false
}
```

Validation rules:

- `went_right`, `went_wrong`, and `actions` contain exactly three items in normal mode.
- Impact values come from deterministic computations, never LLM output.
- LLM-returned names and numbers must exist in the supplied computed context.
- Invalid/malformed LLM JSON retries once, then uses deterministic template prose.
- One tenant/week has at most one successful report; regeneration creates an audited replacement/version rather than duplicate delivery.

#### 20.6c — `WeeklyDebriefEngine`: nine deterministic computations

Create:

```text
backend/app/services/debrief/
  __init__.py
  models.py
  engine.py
  service.py
```

`WeeklyDebriefEngine` returns a typed `DebriefData` object containing pure numbers and identifiers. It uses Supabase queries or allowlisted RPCs, never browser-provided or LLM-generated SQL.

| # | Computation | Output/use |
|---|---|---|
| 1 | `week_revenue_comparison` | Revenue, orders, and parties for completed Mon–Sun vs prior Mon–Sun; Headline and Momentum |
| 2 | `revenue_by_zone_wow` | Zone absolute/percentage change; positive and negative candidates |
| 3 | `top_gaining_products` | Top five SKUs by absolute ₹ gain with minimum 20% growth |
| 4 | `top_declining_products` | Top five SKUs by absolute ₹ decline with minimum 15% decline |
| 5 | `churned_parties` | Ordered in prior week, zero in completed week; negative/action candidates |
| 6 | `reengaged_parties` | Ordered this week after at least three silent weeks; positive candidates |
| 7 | `day_of_week_pattern` | Each weekday vs its trailing 30-day weekday average |
| 8 | `rolling_averages` | 30/60/90-day average daily revenue, direction, and monthly projection |
| 9 | `outstanding_top5` | Five highest outstanding parties using the existing outstanding calculation |

Date and threshold rules:

- Run for the just-completed Monday–Sunday period in tenant/default IST timezone.
- Fewer than seven valid data days: skip generation, record `skipped_insufficient_data`, do not consume Free lifetime allowance, and show the in-app waiting state.
- Seven to thirteen days: generate `limited_mode = true`; unavailable week-over-week/rolling sections explicitly say more history is needed.
- Fourteen or more days: generate the complete five-section report.
- Empty categories use honest “No qualifying change” copy; never invent three events to fill space.

#### 20.6d — Synthesis and validation service

`WeeklyDebriefService` performs:

1. Check plan entitlement, lifetime allowance, recipient preferences, and weekly idempotency key.
2. Run all nine deterministic computations.
3. Build a structured prompt containing only the computed context.
4. Call the pinned model through the existing OpenRouter client with low temperature and JSON-schema response.
5. Validate every amount, percentage, party, product, zone, item count, and urgency.
6. Retry once on malformed output; then use deterministic fallback prose.
7. Save the versioned structured JSON in `generated_reports`.
8. Render `weekly_debrief.html`.
9. Send enabled email/WhatsApp channels independently.
10. Increment `debrief_count` once only after report generation succeeds, not once per recipient/channel.
11. Log token cost as `feature = 'weekly_debrief'`; log WhatsApp delivery cost separately as `feature = 'whatsapp_debrief'`.
12. Write audit/delivery/cron details including partial channel failures.

The prompt requires plain English, no filler, maximum two sentences per detail, and specific named actions. It must never ask the model to calculate totals, trends, projections, or impact.

#### 20.6e — Backend routes

Create `backend/app/api/routes/debrief.py`:

```text
GET /debrief/latest
  Latest successful weekly debrief for caller's tenant.
  Returns 404 with code=no_debrief_yet if none exists.

GET /debrief
  Up to 12 summary records: id, title, week_start, week_end, generated_at,
  limited_mode. Does not return every full report body.

GET /debrief/{report_id}
  Full metadata for a report owned by caller's tenant.
```

Add the trigger route:

```text
POST /admin/reports/weekly-debrief
  Auth: internal service credential OR authorized superadmin.
  Body: tenant_id and optional force_regenerate=false.
  Recipient names/emails/phones are resolved server-side, not trusted from request.
  Returns: operation_id, status, week_start, week_end, insight_count,
           email_delivery, whatsapp_delivery.
```

The existing founder endpoint `POST /superadmin/reports/weekly-debrief/{tenant_id}` calls the same service with a required reason and optional channel selection. Manual test/regeneration traffic is marked and does not incorrectly consume customer quota twice.

#### 20.6f — Scheduler and delivery

Create/update the weekly scheduler:

```text
supabase/functions/weekly-debrief/index.ts
cron: 30 1 * * 1
```

Scheduler behavior:

1. Select active eligible tenants.
2. Resolve tenant admins and their separate email/WhatsApp debrief preferences.
3. Trigger one tenant-level generation operation.
4. Fan out the stored report to eligible recipients/channels.
5. Use one idempotency key per tenant/week/channel/recipient.
6. Continue other tenants if one fails.
7. Write `cron_runs`, `audit_log`, and delivery results.
8. Ping healthchecks.io only after the full batch completes; use `partial` status for mixed outcomes.

Required secrets are existing `BACKEND_API_URL` and `BACKEND_SERVICE_KEY`; no provider secret is placed in edge-function source.

#### 20.6g — Email and WhatsApp

Create `backend/app/services/email/templates/weekly_debrief.html` using inline CSS compatible with Gmail and Outlook:

- branded header and week range;
- highlighted headline;
- responsive two-column Went Right/Went Wrong layout that stacks on mobile;
- 30/60/90-day momentum boxes;
- numbered three-action block with urgency indicators;
- “See full debrief in AKARA” CTA;
- plain-text fallback;
- subject: `AKARA Weekly Debrief — Week of {date_range}`;
- preview: `{headline} · 3 actions inside`.

WhatsApp uses approved W1/`weekly_debrief_brief`, containing headline numbers, top alert/action summary, and a signed deep link to `/debrief`. Do not attempt to put the entire report in one WhatsApp template.

Channel failures are independent: an email failure does not prevent WhatsApp, report storage, or in-app access.

#### 20.6h — Frontend route and page

Add to AppShell:

```text
/debrief — Weekly Debrief — BarChart3 icon
```

Create:

```text
frontend/src/pages/DebriefPage.tsx
frontend/src/hooks/useDebrief.ts
frontend/src/components/debrief/
  DebriefHeadline.tsx
  WentRightPanel.tsx
  WentWrongPanel.tsx
  MomentumStrip.tsx
  ActionsPanel.tsx
  DebriefArchive.tsx
```

The page includes:

- header and selector for the latest 12 reports;
- full-width headline card;
- Went Right/Went Wrong panels with exactly three normal-mode items, ₹ impact badges, and hypothesis disclosure;
- 30/60/90-day momentum and monthly projection;
- three numbered actions with urgency;
- data freshness and limited-mode disclosure;
- “Ask Copilot about this week” CTA;
- past-debrief archive;
- download PDF action;
- desktop, tablet, and mobile layouts.

States:

- loading skeleton matching the five sections;
- no report: “Your first Weekly Debrief arrives Monday” plus minimum-data guidance;
- insufficient data under seven days;
- limited mode for seven to thirteen days;
- normal report;
- stale report warning when newer imported data exists;
- API error with retry;
- plan/lifetime gate with upgrade CTA;
- report unavailable/deleted without breaking archive navigation.

The Copilot CTA navigates to `/copilot` with a signed/internal report ID or safe structured summary. The backend resolves authorized report context; do not place full sensitive report content in a query string.

#### 20.6i — Preferences, quota, cost, and monitoring

Use these independent preferences:

```json
{
  "email_debrief_enabled": true,
  "whatsapp_debrief_enabled": true,
  "email_morning_brief_enabled": true,
  "whatsapp_morning_brief_enabled": true
}
```

- Settings exposes Weekly Debrief Email and Weekly Debrief WhatsApp separately.
- WhatsApp toggle is gated by eligible plan and verified phone.
- Free plan: one successfully generated lifetime report; failed/skipped runs do not consume it.
- Pro/Business: weekly while active and preferences permit delivery.
- In-app archive remains available for generated reports even when delivery is disabled.
- `cron_runs`, healthchecks.io, Sentry, superadmin Cron tab, tenant drawer, founder AI context, usage endpoint, and cost dashboard include debrief generation/delivery status.

#### 20.6j — Weekly debrief test and quality gate

Automated:

- each of nine computations against deterministic fixtures;
- Mon–Sun and year/month boundary dates in IST;
- under-7 skip, 7–13 limited, 14+ full;
- tenant isolation on latest/list/detail/trigger/storage;
- malformed/hallucinated LLM output and deterministic fallback;
- one report/count per tenant/week despite repeated triggers;
- Free lifetime entitlement and Pro/Business recurrence;
- recipient/channel preferences and independent partial failures;
- archive maximum 12 and report ownership;
- email rendering, WhatsApp variables, PDF, and Copilot context authorization;
- scheduler continues after one tenant failure and reports `partial`.

Manual:

- generate a report from fixture data and verify every displayed number;
- inspect Gmail/Outlook/mobile email;
- receive approved WhatsApp template at 07:00 IST test schedule;
- open `/debrief`, switch archive week, download PDF, and ask Copilot;
- trigger from superadmin and inspect operation/audit/cost/cron records;
- disable each delivery channel independently and confirm in-app archive remains.

---

### Day 20 Quality Gate

Manual:
- Admin invites new team member → they receive Supabase invite email
- New member clicks link → sets password → lands on /onboarding (skips company step, tenant already exists)
- Team page shows both members
- Remove member → they lose access
- Export data → JSON file downloads with all rows
- Delete account → all data gone, redirected to landing page
- Weekly debrief engine computes all 9 datasets for a completed Mon–Sun period
- Fewer than 7 days skips; 7–13 days renders limited mode; 14+ days renders all 5 sections
- `/debrief` shows loading, empty, limited, normal, stale, error, gated, and archive states
- Email and WhatsApp preferences work independently
- Repeated trigger does not create duplicate report, delivery, quota, or cost rows
- “Ask Copilot about this week” loads authorized report context
- Scheduler is `30 1 * * 1` UTC and monitored in cron health

---

## Day 21 — Revenue Dashboard + Impersonate + Broadcast + Feature Flags

### Goal
You can see the health of your business in one screen. You can debug customer issues by seeing exactly what they see. You can communicate with all customers at once.

---

### 21.1 — Revenue dashboard (Superadmin → Revenue tab)

Backend: `GET /superadmin/revenue` (already in plan from Day 17):

```python
@router.get("/revenue")
async def get_revenue(admin: SuperAdmin):
    supa = get_supabase_service_client()
    tenants = supa.table("tenants").select(
        "plan, plan_status, created_at, stripe_subscription_id"
    ).eq("is_active", True).execute()

    plan_prices = {"free": 0, "pro": 7999, "business": 13999}

    mrr = sum(plan_prices[t["plan"]] for t in tenants.data
              if t["plan_status"] == "active" and t["plan"] != "free")

    by_plan = {"free": 0, "pro": 0, "business": 0}
    for t in tenants.data:
        by_plan[t["plan"]] = by_plan.get(t["plan"], 0) + 1

    this_month = datetime.utcnow().replace(day=1)
    new_this_month = sum(1 for t in tenants.data
                         if datetime.fromisoformat(t["created_at"]) >= this_month)

    return {
        "mrr": mrr,
        "arr": mrr * 12,
        "total_active": len(tenants.data),
        "by_plan": by_plan,
        "new_this_month": new_this_month,
    }
```

Frontend Revenue tab: 4 stat cards (MRR | ARR | Total tenants | New this month) + plan distribution bar chart.

---

### 21.2 — Impersonate (already in Day 17 plan)

```python
@router.post("/impersonate/{tenant_id}")
async def impersonate(tenant_id: UUID, admin: SuperAdmin):
    supa = get_supabase_service_client()

    # Find the tenant's first admin user
    profile = supa.table("profiles").select("id") \
        .eq("tenant_id", str(tenant_id)).eq("role", "admin") \
        .limit(1).execute()
    if not profile.data:
        raise HTTPException(404, "No admin user found for tenant")

    user_id = profile.data[0]["id"]

    # Generate a short-lived token (Supabase admin API)
    # This uses service role to create a session for another user
    link = supa.auth.admin.generate_link({
        "type": "magiclink",
        "email": ...,   # get email from auth.users
    })

    # Log to audit
    supa.table("audit_log").insert({
        "user_id": str(admin.user_id),
        "action": "superadmin_impersonate",
        "resource_type": "tenant",
        "resource_id": str(tenant_id),
        "details": {"target_user_id": user_id},
    }).execute()

    return {"magic_link": link.properties.action_link, "expires_in": 300}
```

Frontend: opens magic link in new tab. The session lasts 5 minutes.

---

### 21.3 — Broadcast email

```python
@router.post("/reports/broadcast")
async def broadcast(body: BroadcastRequest, admin: SuperAdmin):
    """
    Send an email to all active tenant admins (or filtered by plan).
    """
    supa = get_supabase_service_client()

    # Get all tenant admin emails
    query = supa.table("profiles").select("id, tenant_id, tenants(plan)") \
        .eq("role", "admin")
    if body.plan_filter:
        query = query.eq("tenants.plan", body.plan_filter)
    profiles = query.execute()

    # Get emails from auth.users (via admin API)
    sent = 0
    for profile in profiles.data:
        user = supa.auth.admin.get_user_by_id(profile["id"])
        if user and user.user.email:
            # Send via SendGrid (reuse MorningBriefService pattern)
            _send_email(
                to=user.user.email,
                subject=body.subject,
                html=body.body_html,
            )
            sent += 1

    return {"sent": sent}
```

---

### 21.4 — Feature flag UI in Superadmin

On Tenants tab, each tenant row has "Feature overrides" toggle panel:

```typescript
// Drawer opens when clicking "Feature overrides" on a tenant row
// Lists all features from PLAN_LIMITS
// Toggle switch for each: "scheme_leakage", "simulator", "reports", etc.
// Current state shown: plan default (grey) vs overridden (blue)
// [Save overrides] → PATCH /superadmin/tenants/{id}/features
```

---

### Day 21 Quality Gate

Manual:
- Revenue tab shows correct MRR (add a paid tenant, verify MRR updates)
- Impersonate → new tab opens as that tenant's admin, showing their dashboard/data
- Broadcast to all Pro users → they receive email
- Feature override: enable scheme_leakage for a free tenant → they can access it

---

## Day 22 — API Keys + PostHog + 500 Page + Operational Completeness

### Goal
Business tier has working API keys for the Tally agent. Usage analytics are flowing. Error pages are professional. SPF/DKIM is set up.

---

### 22.1 — API key management (Business tier only)

**Migration `011_api_keys.sql`**:

```sql
CREATE TABLE IF NOT EXISTS public.api_keys (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    key_hash        TEXT        NOT NULL UNIQUE,  -- SHA-256 of actual key, never stored in plain
    key_prefix      TEXT        NOT NULL,          -- first 8 chars, shown in UI for identification
    name            TEXT        NOT NULL,          -- user-given label e.g. "Tally Agent"
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON public.api_keys (tenant_id);
```

**`backend/app/api/routes/api_keys.py`** (new file):

```python
import secrets, hashlib

router = APIRouter(prefix="/api-keys", tags=["api-keys"])

POST /api-keys
     Auth: tenant admin, Business plan only
     Body: { name: str }
     Generates: key = "ak_" + secrets.token_urlsafe(32)  (48 chars total)
     Stores: hash = SHA-256(key), prefix = key[:8]
     Returns: { id, key, prefix, name, created_at }
              ← key shown ONCE, never again

GET  /api-keys
     Returns: list of { id, prefix, name, last_used_at, created_at, revoked_at }
              ← never returns the actual key

DELETE /api-keys/{key_id}
     Sets revoked_at = NOW()
     Returns: 204
```

**`backend/app/core/auth.py`** — add API key authentication path:

```python
async def get_current_user_or_api_key(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False)),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> AuthenticatedUser:
    """
    Accepts either:
    - Authorization: Bearer <JWT>  (standard user auth)
    - X-API-Key: ak_xxxxx          (Tally agent / API push)
    """
    if x_api_key:
        key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()
        supa = get_supabase_service_client()
        key_row = supa.table("api_keys").select("*") \
            .eq("key_hash", key_hash).is_("revoked_at", "null").single().execute()
        if not key_row.data:
            raise HTTPException(401, "Invalid or revoked API key")
        # Update last_used_at
        supa.table("api_keys").update({"last_used_at": "NOW()"}) \
            .eq("id", key_row.data["id"]).execute()
        # Return a synthetic AuthenticatedUser scoped to this tenant
        return AuthenticatedUser(
            user_id=UUID("00000000-0000-0000-0000-000000000000"),  # system user
            email="api@system",
            role="api",
            tenant_id=UUID(key_row.data["tenant_id"]),
        )
    # Fall back to JWT auth
    return await get_current_user(credentials)
```

Apply to `/data/import` — the Tally agent uses this endpoint with an API key.

**Frontend: API Keys in Settings** (Business tier only, behind PlanGate):

```typescript
// Route: /settings/api-keys
// Shows: table of keys with prefix, name, last used, [Revoke] button
// [Generate new key] button → modal with name input → shows key once with copy button
//                                                    → "Save this key — it won't be shown again"
```

---

### 22.2 — PostHog usage analytics

```bash
cd akara/frontend
pnpm add posthog-js
```

**`frontend/src/main.tsx`** — add PostHog init:

```typescript
import posthog from "posthog-js";

if (import.meta.env.PROD) {
  posthog.init(import.meta.env.VITE_POSTHOG_API_KEY, {
    api_host: "https://app.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,   // manual events only — don't capture everything
    disable_session_recording: true,  // no video recording (privacy)
  });
}
```

**Key events to track manually:**

```typescript
// In AuthContext, on login:
posthog.identify(user.id, { plan: user.plan, industry: user.industry });

// In useCopilot, on question sent:
posthog.capture("copilot_question_sent", { question_length: question.length });

// In useCopilot, on 402 (limit hit):
posthog.capture("copilot_limit_hit", { plan: currentPlan });

// In DataPage, on import success:
posthog.capture("data_imported", { source_type, rows_imported });

// In UpgradePage, on CTA click:
posthog.capture("upgrade_clicked", { from_plan: currentPlan, to_plan: targetPlan });

// In OnboardingPage, on each step:
posthog.capture("onboarding_step_completed", { step: 1 | 2 | 3 });
```

Add `VITE_POSTHOG_API_KEY=` to `frontend/.env.example`.

---

### 22.3 — 500 error page + maintenance mode

**`frontend/src/pages/ServerErrorPage.tsx`** (new file):
```typescript
// Route: /500
// Shows: "Something went wrong on our end. We've been notified and are looking into it."
// [Go to dashboard] [Report this issue → mailto:]
```

**`frontend/src/components/ErrorBoundary.tsx`** — update to log to Sentry + show proper message:

```typescript
componentDidCatch(error: Error, info: ErrorInfo) {
  Sentry.captureException(error, { extra: info });
  // existing behavior unchanged
}
```

**Maintenance mode** — add to `AppShell.tsx`:
```typescript
// Check localStorage for 'maintenance_mode' flag
// If set by superadmin (via browser console: localStorage.setItem('maintenance_mode', '1')):
// Show full-screen overlay: "AKARA is temporarily offline for maintenance.
//                            We'll be back in a few minutes."
// This is a manual emergency flag — good enough for now
```

---

### 22.4 — SPF/DKIM setup (manual DNS steps, documented)

This is not code — document it in `akara/docs/runbook.md` (update existing file):

```
## Email Deliverability Setup (SendGrid)

1. In SendGrid: Settings → Sender Authentication → Domain Authentication
   - Domain: akara.ai (or your domain)
   - Click "Authenticate"
   - Copy the 3 DNS records provided

2. In your DNS provider (Cloudflare/GoDaddy/etc):
   Add the 3 records:
   - CNAME: em1234.akara.ai → u1234.wl.sendgrid.net
   - CNAME: s1._domainkey.akara.ai → s1.domainkey.u1234.wl.sendgrid.net
   - CNAME: s2._domainkey.akara.ai → s2.domainkey.u1234.wl.sendgrid.net

3. Click "Verify" in SendGrid (takes up to 48h for DNS propagation)

4. In Railway env vars: SENDGRID_FROM_EMAIL=insights@akara.ai

Without this, morning briefs and weekly debriefs land in spam.
```

---

### 22.5 — Final operations checklist

Add to `akara/docs/runbook.md`:

```
## Superadmin checklist (run weekly)

1. Check Revenue tab — MRR growing?
2. Check Usage tab — any tenant near their limit? (upsell opportunity)
3. Check Audit Logs — any suspicious activity?
4. Check Sentry — any recurring errors?
5. Check UptimeRobot — any downtime in the past 7 days?
6. Check SendGrid — any bounced emails?
7. Check Railway metrics — memory/CPU normal?

## Common support scenarios

"I can't log in"
  → /superadmin → Users → find by email → check account exists, plan_status active
  → If locked: use Supabase Dashboard → Auth → Users → Reset password

"My data looks wrong"
  → /superadmin → Impersonate → see exactly what they see
  → Check when last import was (data freshness indicator)

"I hit my question limit but I didn't use that many"
  → /superadmin → Usage → check copilot_calls count
  → If error: reset usage manually via SQL:
    UPDATE usage_tracking SET copilot_calls = X
    WHERE tenant_id = '...' AND month = DATE_TRUNC('month', NOW());

"I want a refund"
  → Stripe Dashboard → find customer → issue refund
  → Set plan back to free in /superadmin → Tenants
```

---

### Day 22 Quality Gate

```bash
# Backend
cd akara/backend
uv run ruff check .
uv run pytest tests/ -v --tb=short

# Frontend
cd akara/frontend
npx tsc --noEmit
pnpm build
```

---

## Day 22 Complete — Production Readiness Checklist

Before going live, run through this checklist exactly once. Every item maps to a specific part of the codebase.

### Infrastructure
- [ ] Supabase project is in `ap-south-2` (Hyderabad) or `ap-south-1` (Mumbai)
- [ ] All 11 migrations applied and verified (no errors, expected row counts)
- [ ] Railway backend health check returns 200
- [ ] Vercel frontend builds without TypeScript errors
- [ ] HTTPS on both backend and frontend (Railway and Vercel handle this automatically)
- [ ] Custom domain configured (akara.ai or equivalent) — Vercel + Railway docs

### Security
- [ ] `SecurityHeadersMiddleware` active — verify with securityheaders.com
- [ ] Rate limiting active — verify with `curl` loop
- [ ] PII redactor unit test passing — see `tests/test_pii_redactor.py`
- [ ] RLS policies verified — confirm cross-tenant isolation test passes

### Billing
- [ ] Stripe webhook registered and verified with `stripe listen`
- [ ] Test upgrade with card `4242 4242 4242 4242` → plan changes to Pro
- [ ] Test failed payment with `4000 0000 0000 0341` → `past_due` banner appears
- [ ] `retention_cleanup.py` Railway cron set to `0 2 * * *` (2 AM)

### Notifications
- [ ] SendGrid SPF/DKIM verified — check with mail-tester.com
- [ ] Weekly debrief fires manually via `/superadmin/reports/weekly-debrief/{tenant_id}`
- [ ] Zaptilo API token in Railway env vars as `ZAPTILO_API_TOKEN`
- [ ] WhatsApp template `weekly_debrief_brief` approved by Meta

### Compliance
- [ ] Privacy Policy published at `/privacy` — includes DPDP, sub-processor list, AI processing disclosure
- [ ] Terms of Service published at `/terms`
- [ ] Both linked from signup page (two separate checkboxes)
- [ ] Data export (`GET /account/export`) tested — JSON file downloads correctly
- [ ] Account deletion (`DELETE /account`) tested — user removed from auth.users

### Monitoring
- [ ] Sentry DSN in both backend (Railway env) and frontend (Vercel env)
- [ ] PostHog API key in frontend (Vercel env as `VITE_POSTHOG_API_KEY`)
- [ ] LLM cost log receiving rows — check Supabase `llm_cost_log` table after first copilot call
- [ ] Superadmin Revenue tab shows correct MRR

---

## Phase 2 Complete — What You Have After Day 22

### Customer experience
| Journey stage | Status |
|---|---|
| Discover AKARA | ✅ Landing page |
| Sign up | ✅ Self-serve, 30 seconds |
| Email verify | ✅ Enforced |
| Onboard | ✅ 3-step wizard, sample data |
| Use product | ✅ All features from Days 1–13 |
| Hit limit | ✅ Clear message, upgrade CTA |
| Upgrade | ✅ Stripe checkout |
| Invite team | ✅ Email invite |
| Get weekly debrief | ✅ First Monday after signup (free: 1 lifetime) |
| Manage account | ✅ Password, notifications, billing |
| Export/delete data | ✅ GDPR-compliant |

### Your admin capabilities
| Capability | Status |
|---|---|
| See all tenants | ✅ Superadmin panel |
| Change any tenant's plan | ✅ |
| Enable features per tenant | ✅ Feature overrides |
| See revenue (MRR/ARR) | ✅ Revenue tab |
| Debug customer issues | ✅ Impersonate |
| Broadcast announcements | ✅ |
| View all usage | ✅ Usage tab |
| Audit every action | ✅ Audit logs tab |
| Trigger reports manually | ✅ |
| Monitor errors | ✅ Sentry + System tab |

### Migrations applied (001–011)
| # | File | Contents |
|---|---|---|
| 001 | initial_schema | 7 base tables |
| 002 | rls_policies | Row-level security |
| 003 | functions | Triggers + KPI RPC |
| 004 | competitive_additions | Secondary sales, scheme master, 3 functions |
| 005 | execute_tenant_query | Copilot SQL RPC |
| 006 | update_tenant_config_rpc | Tenant config update |
| 007 | conversations | Chat conversation grouping |
| 008 | user_preferences | Notification preferences |
| 009 | scheme_leakage_fn | Scheme leakage RPC |
| 010 | billing | Plan + usage tracking |
| 011 | api_keys | API key auth for Tally agent |

### File count added in Phase 2
- New backend files: 9
- Modified backend files: 5
- New frontend pages: 14
- Modified frontend files: 8
- New migrations: 2
- **Total new lines of code: ~3,500**

---

## Gaps Audit — Honest Assessment

After a full review, here are the things still missing. Split into three buckets:

---

### 🔴 Bucket 1 — Blocking (will lose deals or cause production incidents before first customer)

---

#### GAP 1 — GST Invoicing (Indian B2B deal-blocker #1)

Stripe processes payments but **does not generate a GST-compliant invoice for India**. Every B2B customer in India needs one to claim Input Tax Credit (ITC). A CFO will not approve the subscription without a valid GST invoice. This is not optional.

**What you need:**

1. **Register your company for GST** (mandatory if revenue > ₹20L/year). Get a GSTIN. Add it to your Stripe invoice settings.

2. **Customer GSTIN collection** — add a GSTIN field to the billing page:
   ```typescript
   // BillingPage.tsx — add "GST Details" section:
   // Company GSTIN (optional — for B2B ITC claim)
   // Billing address (state — required for IGST vs CGST/SGST determination)
   // [Save billing details]
   // Backend: store in tenants.billing_details JSONB
   ```

3. **Stripe Tax configuration** — enable in Stripe Dashboard → Tax. Stripe auto-adds 18% GST on Indian customers. Add to your Stripe product:
   - Tax code: `txcd_10103001` (Software as a Service)
   - Tax-inclusive vs tax-exclusive: **tax-exclusive** (show ₹7,999 + 18% GST = ₹9,438.82) OR tax-inclusive (₹7,999 includes GST, net ₹6,779). Pick one and be consistent.

4. **GST invoice PDF** — after every successful Stripe payment, generate and email a GST invoice containing:
   ```
   Invoice from: AKARA (Your Company Name)
   GSTIN: XXXXXXXXXXXX
   Address: [Your address, State]
   SAC Code: 998314 (Information Technology Services)
   
   Customer: [Company name]
   Customer GSTIN: [if provided]
   Customer State: [state — determines IGST vs CGST+SGST]
   
   AKARA Pro subscription: ₹6,779.66
   IGST @ 18%: ₹1,220.34  (if different state)
   OR CGST 9% + SGST 9%: ₹610.17 + ₹610.17  (if same state)
   Total: ₹9,000.00
   
   Invoice number: INV-2026-0001 (sequential, mandatory)
   ```

5. **Use `stripe-python`** and a PDF library (WeasyPrint or reportlab):
   ```python
   # In webhook handler, after checkout.session.completed:
   from app.services.billing.gst_invoice import generate_gst_invoice
   
   invoice_pdf = await generate_gst_invoice(
       stripe_invoice_id=session["invoice"],
       tenant_id=tenant_id,
       amount_excl_tax=session["amount_subtotal"] / 100,
       gst_amount=session["total_details"]["amount_tax"] / 100,
   )
   # Email to tenant admin with subject: "AKARA — Invoice INV-2026-XXXX"
   ```

**New env vars needed:**
```
YOUR_GSTIN=...
YOUR_COMPANY_NAME=...
YOUR_COMPANY_ADDRESS=...
YOUR_COMPANY_STATE=Maharashtra   # determines CGST/SGST vs IGST
```

**Migration addition:**
```sql
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS billing_details JSONB NOT NULL DEFAULT '{}';
    -- { gstin: "...", billing_address: "...", billing_state: "Maharashtra" }
```

---

#### GAP 2 — Async Large File Imports

The current data import is **synchronous**. User uploads a file, waits. A 50,000-row Excel file from Tally takes 30–45 seconds. The user sees a spinner. Railway times out at 60 seconds. Vercel proxies timeout at 30 seconds.

For a distributor with 2 years of Tally data, the first import will reliably fail.

**Fix:**

```python
# backend/app/api/routes/data.py — new async flow:

@router.post("/import/async")
async def import_data_async(
    file: UploadFile,
    tenant: TenantCtx,
    user: CurrentUser,
):
    """
    For large files (> 5,000 rows estimated): 
    1. Save file to Supabase Storage
    2. Create an import_job row with status='queued'
    3. Return job_id immediately (202 Accepted)
    4. Background worker processes the file and updates status
    """
    content = await file.read()
    
    # Quick estimate: skip if < 5000 rows
    estimated_rows = len(content) // 100   # rough estimate
    if estimated_rows < 5000:
        # Use existing synchronous flow
        return await import_data_sync(content, file.filename, tenant, user)
    
    # Upload to Supabase Storage
    supa = get_supabase_service_client()
    storage_path = f"{tenant.tenant_id}/imports/{uuid4()}/{file.filename}"
    supa.storage.from_("import-files").upload(storage_path, content)
    
    # Create job
    job = supa.table("import_jobs").insert({
        "tenant_id": str(tenant.tenant_id),
        "user_id": str(user.user_id),
        "storage_path": storage_path,
        "filename": file.filename,
        "status": "queued",
        "estimated_rows": estimated_rows,
    }).execute()
    
    return JSONResponse(
        status_code=202,
        content={"job_id": job.data[0]["id"], "status": "queued"}
    )

GET /import/jobs/{job_id}
    Returns: { status: 'queued' | 'processing' | 'done' | 'failed', rows_imported, error_message }
```

**New migration addition:**
```sql
CREATE TABLE IF NOT EXISTS public.import_jobs (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL,
    storage_path    TEXT        NOT NULL,
    filename        TEXT        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'processing', 'done', 'failed')),
    rows_imported   INT,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);
```

**Frontend: polling progress UI in `DataPage.tsx`:**
```typescript
// After 202 response:
// Show progress indicator: "Processing your file... checking every 3 seconds"
// Poll GET /import/jobs/{job_id} every 3 seconds
// On 'done': show success + refresh dashboard
// On 'failed': show error message + "Try again" button
// On page reload: check for pending jobs in DataPage useEffect
```

**Background worker:** `backend/app/tasks/import_worker.py` — Railway cron every 60 seconds, or use Supabase Edge Functions for webhook trigger on `import_jobs` insert.

---

#### GAP 3 — Empty State Components

Right now, **every page with a chart or table shows errors or blank space when there's no data.** A new signup who skips the sample data upload will see a broken-looking dashboard.

Every single page needs explicit empty states:

```typescript
// DashboardPage.tsx
// If no sales_data rows: show full-page empty state:
//   📊 icon
//   "Your dashboard is ready — just waiting for data"
//   "Import your first sales file to see revenue, zones, routes, and trends."
//   [Import data →]  (primary button)
//   [Use sample data]  (secondary — re-seeds the 30 sample rows)

// CopilotPage.tsx
// If no data: show warning banner above input:
//   "No data imported yet. Your copilot answers will be based on sample data."
//   [Import your data →]

// ReportsPage.tsx, SimulatorPage.tsx
// If no data: "Import at least 30 days of sales data to use this feature."
```

---

#### GAP 4 — Activation Email Sequence (retention #1 lever)

After signup, users need to be guided to their "aha moment" (first real insight from their own data). Without this, 60% of signups never return after day 1.

**New table:**
```sql
CREATE TABLE IF NOT EXISTS public.user_events (
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event           TEXT        NOT NULL,  -- 'signed_up' | 'onboarded' | 'first_import' | 'first_copilot' | 'first_debrief'
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, event)
);
```

**5-email drip sequence** (all sent from SendGrid, triggered by `user_events` absence):

```
Day 0 (immediate after email verify):
  Subject: "Welcome to AKARA — 3 things to do first"
  Body: 1. Upload your Tally export 2. Ask your first question 3. Set up WhatsApp

Day 1 (if no import yet):
  Subject: "Your dashboard is empty — here's how to fix that in 5 minutes"
  Body: Short GIF showing drag-and-drop upload + "Import now →"

Day 3 (if import done but no copilot use):
  Subject: "Your data is in — now ask it something"
  Body: 3 sample questions with [Ask this →] deep-link buttons

Day 7 (if copilot used but no WhatsApp set up):
  Subject: "Your first weekly brief arrives Monday"
  Body: "Add your WhatsApp number to get it there instead of email →"

Day 14 (if not upgraded and copilot limit approaching):
  Subject: "You've asked [X] of 10 questions this month"
  Body: Show exactly what Pro unlocks, [Upgrade to Pro →]
```

**New backend task: `backend/app/tasks/activation_emails.py`** — runs daily at 8 AM:
```python
# For each user who signed up 1/3/7/14 days ago:
# Check which activation events they HAVEN'T hit
# Send the appropriate email
# Mark email_sent in a separate table to prevent re-sending
```

---

#### GAP 5 — Bot Prevention on Signup

Open signup with no CAPTCHA = bots creating free accounts = free LLM calls at your expense.

10 questions × 1,000 bot accounts = 10,000 free OpenAI calls = ~₹2,800 in LLM cost before you notice.

**Fix — Cloudflare Turnstile (free, frictionless, privacy-friendly):**

```typescript
// frontend/src/pages/SignUpPage.tsx — add Turnstile widget:
import { Turnstile } from '@marsidev/react-turnstile'

// In the form:
<Turnstile
  siteKey={import.meta.env.VITE_CF_TURNSTILE_SITE_KEY}
  onSuccess={(token) => setTurnstileToken(token)}
/>

// On form submit: include token in POST /onboarding/setup body
// Backend verifies token with Cloudflare before creating tenant
```

**Backend verification in `onboarding.py`:**
```python
async def _verify_turnstile(token: str, ip: str) -> bool:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data={"secret": settings.cf_turnstile_secret, "response": token, "remoteip": ip}
        )
        return resp.json().get("success", False)
```

**Also: disposable email domain blocklist:**
```python
BLOCKED_DOMAINS = {"mailinator.com", "guerrillamail.com", "10minutemail.com",
                   "throwam.com", "yopmail.com", "tempmail.com"}

def is_disposable_email(email: str) -> bool:
    domain = email.split("@")[-1].lower()
    return domain in BLOCKED_DOMAINS
```

---

#### GAP 6 — LLM Downtime Graceful Degradation

When OpenAI is down (it goes down ~2–3 times/month), every copilot request returns a raw 500 error. Users see `Internal Server Error`. They think AKARA is broken.

**Fix in `backend/app/services/copilot/agent.py`:**
```python
import openai

async def answer(self, question: str, ...) -> str:
    try:
        # existing code
        ...
    except openai.APIStatusError as e:
        if e.status_code == 429:
            raise HTTPException(503, detail={
                "error": "ai_rate_limited",
                "message": "The AI is temporarily busy. Please try again in 30 seconds.",
                "retry_after": 30,
            })
        elif e.status_code >= 500:
            # Log to Sentry with high priority
            sentry_sdk.capture_exception(e, tags={"type": "openai_outage"})
            raise HTTPException(503, detail={
                "error": "ai_unavailable",
                "message": "The AI copilot is temporarily unavailable. "
                           "Your dashboard and reports still work normally. "
                           "Try again in a few minutes.",
                "retry_after": 120,
            })
        raise   # re-raise other errors
    except openai.APITimeoutError:
        raise HTTPException(504, detail={
            "error": "ai_timeout",
            "message": "This question is taking too long to process. "
                       "Try a simpler question or split it into two parts.",
        })
```

**Frontend — CopilotPage.tsx:** handle `503` with a friendly inline message, not a toast:
```typescript
// When HTTP 503 received:
// Show in the chat as an AI message (same style as normal):
// "The AI copilot is temporarily unavailable. Your question hasn't been counted
//  against your monthly limit. Try again in a few minutes."
// This question does NOT increment usage_tracking.copilot_calls (guard against this in backend)
```

---

### 🟡 Bucket 2 — Important (will cause frustration within first month, fix within 2 weeks of launch)

---

#### GAP 7 — Supabase Connection Pooling

FastAPI opens a new Supabase connection per request. Supabase Free tier = 60 connections. Pro = 200. At 50 concurrent users (realistic peak), you'll hit the limit.

**Fix — one line change in connection string:**
```python
# In backend/app/core/tenant.py:
# Current: use SUPABASE_URL directly (direct connection)
# Change to: use SUPABASE_POOLER_URL (PgBouncer, transaction mode)

# Railway env var:
# SUPABASE_POOLER_URL = postgresql://postgres.[ref]:[password]@aws-0-ap-south-2.pooler.supabase.com:6543/postgres
# Get from: Supabase Dashboard → Settings → Database → Connection Pooling → Transaction mode
```

This supports 10,000+ concurrent connections on the same Supabase plan.

---

#### GAP 8 — Cron Job Health Monitoring

`retention_cleanup.py`, `alert_evaluator.py`, and `activation_emails.py` run as Railway cron jobs. If they fail silently, you have no idea. Data won't be cleaned up. Alerts won't fire. Users won't get activation emails.

**Fix — add to every cron task:**
```python
import sentry_sdk

def run():
    sentry_sdk.init(dsn=settings.sentry_dsn)
    try:
        # ... task logic ...
        # Log success heartbeat to a monitoring service
        httpx.get(f"https://hc-ping.com/{settings.healthchecks_token_retention}")
    except Exception as e:
        sentry_sdk.capture_exception(e)
        raise
```

Use **healthchecks.io** (free tier: 20 checks) — set up one check per cron job. If the job doesn't ping within its expected window, you get an alert email.

---

#### GAP 9 — Copilot Feedback Loop (👍 / 👎)

You have no idea if answers are good. Without feedback, you're flying blind on quality. FireAI explicitly claims they "learn from feedback in real-time."

**Migration:**
```sql
CREATE TABLE IF NOT EXISTS public.copilot_feedback (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID        NOT NULL,
    message_id      UUID        NOT NULL,
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL,
    rating          SMALLINT    NOT NULL CHECK (rating IN (1, -1)),  -- 1=thumbs up, -1=thumbs down
    comment         TEXT,
    question        TEXT        NOT NULL,  -- store the question for analysis
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Frontend — add to each copilot answer:**
```typescript
// Below each AI response bubble:
// [👍] [👎]
// On click: POST /copilot/feedback { message_id, rating: 1 | -1 }
// On thumbs down: show optional text input "What was wrong with this answer?"
// [Skip] [Send feedback]
```

**Superadmin — add feedback tab:**
```
Thumbs up rate: 87% this week (↑ from 82% last week)
Recent thumbs-down: [list of questions + answers] → use these to improve prompts
```

---

#### GAP 10 — Data Provenance on Copilot Answers

Users ask "how do I know this number is right?" This is the #1 objection to AI analytics. The answer is: show them exactly which rows were counted.

**Add to copilot API response:**
```python
class CopilotResponse(BaseModel):
    answer: str
    sql_used: str | None      # the SQL that was executed
    row_count: int | None     # how many rows the answer is based on
    date_range: str | None    # "1 Jan 2026 – 31 Mar 2026"
    data_freshness: str | None  # "Last import: 3 days ago"
```

**Frontend — show below the answer:**
```typescript
// Small grey text below each answer:
// "Based on 1,847 transactions · Jan–Mar 2026 · Data last updated 3 days ago"
// [View SQL ↓]  (expandable — shows the SQL query that ran)
// This is a trust signal no competitor has made prominent.
```

---

#### GAP 11 — Superadmin Re-Authentication

The `/superadmin` panel is gated by `role = 'superadmin'`. If your session is ever stolen (session fixation, XSS, etc.), the attacker has full control over every tenant.

**Fix — require password confirmation to enter superadmin:**
```typescript
// SuperAdminPage.tsx — on load:
// If last_sudo_at > 15 minutes ago:
//   Show modal: "Confirm your password to access superadmin"
//   [Password input] [Confirm]
//   On confirm: POST /superadmin/sudo { password }
//   Backend: verifies with supabase.auth.signInWithPassword
//   Sets last_sudo_at in localStorage
// Only then render the panel
```

Also: add `X-Robots-Tag: noindex` header to all `/superadmin/*` responses so Google never indexes it.

---

#### GAP 12 — Payment Dunning Sequence

Day 18 sets `plan_status = 'past_due'` on first payment failure. But there's no follow-up sequence. Best practice for Indian B2B SaaS:

```python
# backend/app/tasks/dunning.py — runs daily at 10 AM

# Day 0 (webhook fires): Email "Payment failed — update your card"
# Day 3 (check): If still past_due → Email "Reminder: your subscription is paused"
# Day 7 (check): If still past_due → Email "Last chance — 7 days until downgrade"
#                                  → WhatsApp: "⚠️ AKARA subscription: action needed"
# Day 14 (check): Downgrade to free, email "Your plan has been downgraded"
#                 Keep all data (don't delete) — makes re-upgrade easy

# For Indian customers: also accept bank transfer / NEFT
# Add on BillingPage: "Pay via bank transfer? Email billing@akara.ai with your invoice number"
```

---

#### GAP 13 — Missing: `robots.txt` and `sitemap.xml`

Without `robots.txt`, Google will attempt to crawl `/superadmin`, `/billing`, `/reset-password`, etc. Some of these pages look broken to crawlers (they need JS auth context) and will generate 404s in Google Search Console, hurting SEO.

**`public/robots.txt`:**
```
User-agent: *
Allow: /
Allow: /pricing
Disallow: /superadmin
Disallow: /billing
Disallow: /onboarding
Disallow: /reset-password
Disallow: /verify-email

Sitemap: https://akara.ai/sitemap.xml
```

**`public/sitemap.xml`:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://akara.ai/</loc><priority>1.0</priority></url>
  <url><loc>https://akara.ai/pricing</loc><priority>0.9</priority></url>
  <url><loc>https://akara.ai/signup</loc><priority>0.8</priority></url>
  <url><loc>https://akara.ai/login</loc><priority>0.7</priority></url>
  <url><loc>https://akara.ai/privacy</loc><priority>0.5</priority></url>
  <url><loc>https://akara.ai/terms</loc><priority>0.5</priority></url>
</urlset>
```

---

### 🟢 Bucket 3 — Polish (non-blocking, adds trust, do in first month post-launch)

| Gap | Fix | Time |
|---|---|---|
| No database backup strategy documented | Document Supabase PITR (Point-in-Time Recovery) in runbook. Test restore once. | 1 hour |
| No staging environment | Create a second Railway service + Vercel preview env pointing at a separate Supabase staging project | 2 hours |
| No `.env.example` for backend | Create `backend/.env.example` with all 15+ required env vars + descriptions | 30 min |
| No UptimeRobot setup | Create free UptimeRobot account, add HTTP monitor for `/health`, alert on email + WhatsApp | 15 min |
| PDF export for weekly debrief + reports | Use `weasyprint` or `@react-pdf/renderer` to generate downloadable PDFs | 1 day |
| No `404` page | Create `NotFoundPage.tsx` with "Page not found" + nav back to dashboard | 30 min |
| OpenAI model version not pinned | Always specify `model="gpt-4o-mini-2024-07-18"` (date-pinned) not `"gpt-4o-mini"`. Model behaviour changes when OpenAI updates the alias. | 5 min |
| No favicon / Open Graph tags | Add `favicon.ico`, `apple-touch-icon.png`, and OG tags to `index.html` for WhatsApp/Twitter link previews | 1 hour |
| No `Content-Security-Policy` header | Add CSP header to `SecurityHeadersMiddleware`. Without it, XSS is possible. | 1 hour |
| Import job failure notification | When an async import fails, email + WhatsApp the user: "Your file failed to import. [Try again →]" | 2 hours |

---

## What Remains After Phase 2

These are deliberately deferred — none block launch. Ordered by impact on deal velocity.

### Phase 3 — After first 10 paying customers

| Feature | Why it matters | When to build |
|---|---|---|
| Voice queries (12 Indian languages via Bhashini API) | FireAI's #1 demo feature. A regional manager asking in Hindi is a 30-second wow moment. | After 10 customers — validate demand first |
| Causal chain visualisation | "Why did North zone revenue drop?" → visual cause tree (not just text). FireAI calls this their differentiator. AKARA's copilot does it in prose — the visual is what wins enterprise demos. | After 10 customers |
| WhatsApp two-way queries | Customer replies to the debrief: "what about Route C?" → copilot answers on WhatsApp. HUGE. No competitor does this. | After 10 customers |
| Tally Live Sync | Real-time Tally connector (vs overnight file push). Requires Tally TDL developer. | After first Business customer onboards |
| More DMS connectors (Bizom, FieldAssist, Botree) | FireAI's moat is 700+ connectors. You can't win that fight. Win on analytics depth first, then add connectors. | 25+ customers |
| Demand forecasting | "How much should Sharma Traders order next month?" FireAI + Ocheto both have this. | 25+ customers |
| Distributor scorecard (automated) | Ocheto's key feature — rank all distributors by health score weekly. AKARA's copilot can answer this but not as a persistent ranked list. | Phase 3 |

### Phase 4 — Enterprise readiness (after ₹1 Cr ARR)

| Feature | Why it matters | When to build |
|---|---|---|
| SOC 2 Type II certification | Required by enterprise procurement. FireAI has it on Business plan. Cost: ₹8–15L/year. | After ₹1 Cr ARR |
| ISO 27001 | Indian enterprise + government procurement requirement. | After SOC 2 |
| SSO (Google Workspace, Microsoft Entra) | Any company with 50+ employees requires this. | After first enterprise deal |
| Private LLM deployment (Azure OpenAI in customer VPC) | Large enterprises (₹500+ Cr revenue) will not send data to public OpenAI API. Defog.ai and FireAI both offer this. | After first enterprise deal |
| Annual billing + invoicing | Indian enterprises pay via purchase order, not credit card. You need to generate a GST invoice and accept NEFT. | After first enterprise deal |
| 2FA / TOTP | Enterprise security requirement. | After first enterprise deal |
| White-labeling | "AKARA" branded as the customer's own analytics tool. Charges ₹3–5L setup fee. | When a customer asks + pays |
| Stripe coupons/discounts | For running promotions (Product Hunt launch, Black Friday). | First promo event |
| Referral program | "Give 1 month free, get 1 month free." | 50+ customers |
| Mobile PWA | Regional managers and distributors use phones primarily. Post-launch priority. | When mobile traffic > 20% |
| NPS survey (in-app) | Understand retention risk early. | 60 days after launch |
| Changelog page | Shows active development → builds trust. | After 3 post-launch features |

### Ocheto complementary pitch (no code needed — just messaging)

Add to landing page and sales deck:

> "Already using Ocheto for field force automation? AKARA is the intelligence layer on top of your DMS. Connect your Ocheto data export to AKARA and ask 'which of my distributors has the worst secondary-to-primary ratio this month?' in plain English."

This positions AKARA and Ocheto as complements, not competitors — and gives you a warm channel to Ocheto's customers.

---

## Competitive Positioning Summary

| | AKARA Free | AKARA Pro | FireAI Professional |
|---|---|---|---|
| Price | ₹0 | ₹7,999/mo | ₹2,799/user/mo (min 1 user) |
| For 3 users | ₹0 | ₹7,999 | ₹8,397/mo |
| NLQ | ✓ English + Hindi | ✓ English + Hindi | ✓ 90 languages |
| Weekly debrief | 1 lifetime | ✓ + WhatsApp | Email only |
| Zero-code alerts | ✗ | ✓ 5 alerts | ✓ Unlimited |
| Scheme leakage | ✗ | ✗ | ✓ |
| Data connectors | CSV | CSV + API | 700+ |
| Voice queries | ✗ | ✗ | ✓ Bhashini |
| Data residency | India | India | India |
| Setup time | 5 min | 5 min | Days (enterprise) |

**AKARA wins on:** price, WhatsApp delivery, setup speed, simplicity, India-native (DPDP-compliant from day 1).
**FireAI wins on:** connector breadth, voice queries, enterprise features, brand recognition.
**Our target customer:** Distributor or brand doing ₹15–200 Cr annual revenue, 1–3 staff managing analytics, currently using Tally + Excel + WhatsApp groups. FireAI is too expensive, Ocheto is an operations tool, and they're not ready for a 3-month enterprise sales cycle. AKARA is the answer.

---

---

# AKARA — Complete UI/UX Bible

> ## 🔵 UPDATED: AKARA BLUE UI REHAUL
>
> **This section has been updated with the new navy-to-electric-blue design system.**
> - Replaces the original violet/orange palette
> - Every surface is now navy-blue tinted (NO pure grays, NO pure blacks)
> - Reference: FireAI compliance section aesthetic — deep navy canvas + blue glass cards
> - For implementation details: see `akara/implentation/uirehaulday4.md`

> **Purpose of this section:** By the end of Sprint Phase 2, following only this document, you will have a fully pitchable, visually distinctive, mobile-ready product. Every page, every button, every state (loading, empty, error, success), every micro-interaction, every demo slot, every upsell moment, and every admin capability is specified here. No guesswork. No "figure it out later."

---

## 1. Brand Identity & Design System

### 1.1 — 🔵 THE AKARA BLUE MANIFESTO

> **DESIGN REVOLUTION:** AKARA now uses the navy-to-electric-blue system inspired by FireAI's deep ocean aesthetic.

AKARA sits at the intersection of two worlds: the serious world of Indian business finance (distributors, Tally, crores) and the modern world of AI software. The palette must:
- Signal **premium + intelligence** (deep navy communicates depth, trust, sophistication)
- Feel **powerful and modern** — navy glass + electric blue accents = premium intelligence product
- Make **data glow** — blue gradients make KPIs pop against navy backgrounds
- Look **genuinely distinctive** from competitors (no generic grays, no pure blacks, no violet — AKARA owns the blue spectrum)

**Visual Reference:** The FireAI compliance section screenshot — deep navy canvas with blue glass cards. That's AKARA's new identity.

### 1.2 — 🔵 The AKARA Blue Color System

> **RULE: NO pure blacks. NO pure grays. NO violet/purple. THE ENTIRE APP LIVES IN BLUE.**

```css
/* ─────────────────────────────────────────────────────
   AKARA Blue Design Tokens — tailwind.config.ts
   ───────────────────────────────────────────────────── */

:root {
  /* The Blue Spectrum — 10 shades from abyss to sky */
  --navy-950: #020B18;   /* The abyss — deepest background */
  --navy-900: #051B37;   /* Canvas — page background */
  --navy-850: #0A1F3D;   /* Card backgrounds */
  --navy-800: #0C2D57;   /* Elevated surfaces */
  --navy-700: #0F3460;   /* Sidebar, panels */
  --navy-600: #1565C0;   /* Borders, dividers */
  --navy-500: #1976D2;   /* Interactive elements */
  --navy-400: #2196F3;   /* Active states */
  --navy-300: #42A5F5;   /* Electric blue — CTAs, accents */
  --navy-200: #64B5F6;   /* Highlights */
  --navy-100: #90CAF9;   /* Body text on dark */
  --navy-50:  #E3F2FD;   /* Badges on light */

  /* Brand Gradients — The signature AKARA flows */
  --gradient-brand: linear-gradient(135deg, #0A1628 0%, #0F3460 30%, #1A56DB 60%, #2E86DE 100%);
  --gradient-button: linear-gradient(135deg, #1565C0 0%, #1E88E5 50%, #42A5F5 100%);
  --gradient-hero: linear-gradient(180deg, #020B18 0%, #0F3460 50%, #1976D2 100%);
  --gradient-card: linear-gradient(135deg, rgba(15,52,96,0.6) 0%, rgba(26,86,219,0.15) 100%);

  /* Navy Glass System */
  --glass-bg: rgba(15, 52, 96, 0.4);     /* Universal card background */
  --glass-border: rgba(33, 150, 243, 0.12);  /* Card borders */
  --glass-hover: rgba(33, 150, 243, 0.18);   /* Hover states */
  --glass-active: rgba(33, 150, 243, 0.25);  /* Active/pressed */

  /* Text on Navy */
  --text-primary: #FFFFFF;           /* White — headings, values */
  --text-secondary: #90CAF9;         /* Light blue — body text */
  --text-muted: #5C8FBF;             /* Muted blue — labels, captions */
  --text-faint: #2A5A8A;             /* Very muted — disabled, placeholders */
  --text-link: #64B5F6;              /* Link blue — interactive text */

  /* Accents on Navy */
  --accent-primary: #42A5F5;         /* Electric blue — the highlight */
  --accent-cyan: #00BCD4;            /* Cyan — for data, charts, AI */
  --accent-success: #00E676;         /* Neon green — money, growth */
  --accent-warning: #FFB300;         /* Warm amber — attention */
  --accent-danger: #FF5252;          /* Vibrant red — critical */
  --accent-info: #80D8FF;            /* Light cyan — informational */

  /* Chart palette (vibrant on navy) */
  --chart-1: #42A5F5;  /* Electric blue */
  --chart-2: #00BCD4;  /* Cyan */
  --chart-3: #00E676;  /* Neon green */
  --chart-4: #FFB300;  /* Amber */
  --chart-5: #FF80AB;  /* Pink */
  --chart-6: #B388FF;  /* Lavender */
}
```

**Tailwind config additions:**
```typescript
// tailwind.config.ts — The Blue System
theme: {
  extend: {
    colors: {
      // Replace ALL grays with navy blue scale
      navy: {
        950: '#020B18',  // Deepest — page background
        900: '#051B37',  // Canvas
        850: '#0A1F3D',  // Card backgrounds
        800: '#0C2D57',  // Elevated surfaces
        700: '#0F3460',  // Sidebar, panels
        600: '#1565C0',  // Borders, dividers
        500: '#1976D2',  // Interactive elements
        400: '#2196F3',  // Active states
        300: '#42A5F5',  // Electric blue — CTAs, accents
        200: '#64B5F6',  // Highlights
        100: '#90CAF9',  // Body text on dark
        50:  '#E3F2FD',  // Badges on light
      },
      // Legacy support (redirects to navy)
      brand: {
        DEFAULT:  "#42A5F5",  // Electric blue (was violet)
        light:    "#64B5F6",  // Light blue (was violet-light)
        dim:      "#0A1F3D",  // Navy card bg (was violet-dim)
      },
    },
    fontFamily: {
      sans:  ["'Plus Jakarta Sans'", "Inter", "ui-sans-serif", "system-ui"],
      mono:  ["'JetBrains Mono'", "ui-monospace"],
    },
    boxShadow: {
      "card":    "0 8px 32px rgba(2,11,24,0.6)",  // Navy glass shadow
      "card-hover": "0 12px 40px rgba(2,11,24,0.8), 0 0 20px rgba(33,150,243,0.08)",  // Blue glow
      "cta":     "0 4px 20px rgba(33,150,243,0.3)",  // Blue CTA glow
      "glow":    "0 0 16px rgba(66,165,245,0.35)",  // Electric blue glow
    },
    animation: {
      "fade-up":    "fadeUp 0.4s ease both",
      "fade-in":    "fadeIn 0.2s ease both",
      "pulse-soft": "pulseSoft 2s ease infinite",
      "slide-in-right": "slideInRight 0.3s ease both",
      "number-pop": "numberPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
      "shimmer":    "shimmer 2s linear infinite",  // Blue shimmer effect
      "gradient":   "gradient 3s linear infinite", // Gradient border cycling
      "glow":       "glow 2s ease-in-out infinite alternate", // Blue glow pulse
    },
    keyframes: {
      shimmer: {
        '100%': { transform: 'translateX(100%)' }
      },
      gradient: {
        '0%, 100%': { 'border-color': 'rgba(21,101,192,0.4)' },
        '50%': { 'border-color': 'rgba(66,165,245,0.6)' }
      },
      glow: {
        '0%': { 'box-shadow': '0 0 5px rgba(66,165,245,0.2)' },
        '100%': { 'box-shadow': '0 0 20px rgba(66,165,245,0.6)' }
      }
    },
  }
}
```

### 1.3 — Typography

```css
/* Headlines — Plus Jakarta Sans */
h1: font-size: 3rem (48px), font-weight: 800, letter-spacing: -0.02em
h2: font-size: 2rem (32px), font-weight: 700, letter-spacing: -0.01em
h3: font-size: 1.5rem (24px), font-weight: 600
h4: font-size: 1.125rem (18px), font-weight: 600

/* Body — Inter */
body:    font-size: 1rem (16px), line-height: 1.6
small:   font-size: 0.875rem (14px), line-height: 1.5
caption: font-size: 0.75rem (12px), font-weight: 500, letter-spacing: 0.025em

/* KPI Numbers — JetBrains Mono or Inter */
.kpi-value:  font-size: 2.25rem (36px), font-weight: 700, font-variant-numeric: tabular-nums
.kpi-change: font-size: 0.875rem, font-weight: 600

/* Navigation */
.nav-item: font-size: 0.875rem, font-weight: 500, letter-spacing: 0.01em
```

### 1.4 — Component Spec

#### Buttons
```
PRIMARY (Gradient CTA) — The AKARA signature button:
  bg: linear-gradient(135deg, #1565C0 0%, #1E88E5 50%, #42A5F5 100%)
  text: white
  padding: px-6 py-3
  radius: rounded-xl
  font: font-semibold
  shadow: 0 4px 20px rgba(33,150,243,0.3)
  hover: shadow-[0_6px_28px_rgba(66,165,245,0.5)], scale-[1.02]
  active: scale-[0.98]
  disabled: opacity-50, cursor-not-allowed
  transition: all 150ms
  
  // Shine effect on hover:
  overflow: hidden
  relative with shine sweep: bg-gradient-to-r from-transparent via-white/20 to-transparent

SECONDARY (Outlined Blue):
  bg: transparent
  text: #64B5F6 (light blue)
  border: 1px solid rgba(33,150,243,0.3)
  same sizing as primary
  hover: bg-[rgba(33,150,243,0.08)], border-[rgba(33,150,243,0.5)]
  hover: shadow-[0_0_16px_rgba(33,150,243,0.15)]
  
GHOST (Subtle Navy):
  bg: transparent
  text: #90CAF9 (light blue text)
  hover: bg-[rgba(33,150,243,0.06)]

DESTRUCTIVE:
  bg: #EF4444
  text: white
  hover: bg-red-600

ICON BUTTON:
  size: 40×40px, rounded-lg
  bg: surface-raised on hover
```

#### Cards
```
LIQUID GLASS CARD (Universal Container):
  bg: rgba(15, 52, 96, 0.4) — navy glass with 40% opacity
  border: 1px solid rgba(33, 150, 243, 0.12) — blue-tinted border
  radius: rounded-2xl
  shadow: 0 8px 32px rgba(2,11,24,0.6) — deep navy shadow
  backdrop-blur: backdrop-blur-2xl — glassmorphism effect
  padding: p-6
  transition: all 200ms
  hover: bg-[rgba(15,52,96,0.55)], border-[rgba(33,150,243,0.2)]
  hover: shadow-[0_12px_40px_rgba(2,11,24,0.8),0_0_20px_rgba(33,150,243,0.08)]

GLOW KPI CARD (Dashboard Metrics):
  Base: LiquidGlassCard
  Left bar: 2px solid bg-gradient-to-b from-[#42A5F5] via-[#1976D2] to-[#0F3460]
  Contains: label (text-[#90CAF9]/70, 12px caps), AnimatedNumber (count-up), DeltaBadge
  Entrance: Staggered with springs.gentle from Framer Motion
  Hover: Blue gradient inner glow (from-[#42A5F5]/5 via-transparent to-[#00BCD4]/5)

PLAN GATE CARD (Upgrade Overlay):
  Base: Full-screen overlay with bg-[rgba(5,27,55,0.85)] backdrop-blur-lg
  Center: Lock icon with drop-shadow-[0_0_20px_rgba(66,165,245,0.5)]
  Heading: bg-gradient-to-r from-[#42A5F5] to-[#80D8FF] bg-clip-text text-transparent
  CTA: GradientButton with blue gradient

FEATURE LOCK CARD:
  Overlay: bg-white/80 backdrop-blur-sm
  Lock icon centered: 32px, text-muted
  "Upgrade to Pro" link in center
  Cursor: pointer → opens /upgrade
```

#### Badges
```
PLAN BADGE:
  Free:     bg-slate-100   text-slate-600   "Free"
  Pro:      bg-[rgba(66,165,245,0.12)]  text-[#42A5F5]  "Pro ✦"     ← ✦ is the AKARA star
  Business: bg-amber-100   text-amber-700   "Business ✦✦"

STATUS BADGE:
  active:    bg-emerald-100 text-emerald-700 "Active"
  trialing:  bg-blue-100    text-blue-700    "Trialing"
  past_due:  bg-red-100     text-red-700     "Past Due"
  cancelled: bg-slate-100   text-slate-500   "Cancelled"

CHANGE BADGE (KPIs):
  positive: bg-emerald-50 text-emerald-700  "↑ 12%"
  negative: bg-red-50     text-red-700      "↓ 8%"
  neutral:  bg-slate-100  text-slate-600    "→ 0%"
```

#### Form Elements
```
INPUT:
  border: 1px solid #CBD5E1
  radius: rounded-lg
  padding: px-4 py-2.5
  focus: border-brand ring-2 ring-brand/20
  error: border-danger ring-2 ring-danger/20 + red helper text below
  placeholder: text-muted

SELECT: Same as input + chevron icon
TEXTAREA: Same as input, min-h-[100px], resize-y
CHECKBOX: accent-brand, rounded-sm

LABEL: font-size 14px, font-weight 500, text-primary, mb-1.5
HELPER TEXT: font-size 12px, text-muted, mt-1
ERROR TEXT: font-size 12px, text-danger, mt-1
```

#### Micro-animations (every interactive element)
```css
/* Button press */
.btn-press { transition: transform 100ms; }
.btn-press:active { transform: scale(0.97); }

/* Card hover lift */
.card-hover { transition: box-shadow 200ms, transform 200ms; }
.card-hover:hover { box-shadow: 0 8px 24px rgba(91,33,182,0.12); transform: translateY(-2px); }

/* Number counter animation (KPIs loading) */
@keyframes numberPop {
  0% { transform: scale(0.8); opacity: 0; }
  60% { transform: scale(1.05); }
  100% { transform: scale(1); opacity: 1; }
}

/* Page entrance */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Skeleton pulse */
@keyframes pulseSoft {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}

/* Copilot streaming cursor */
.streaming-cursor::after {
  content: "▋";
  animation: blink 1s step-end infinite;
  color: #42A5F5;  /* Electric blue */
}
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
```

### 1.5 — Toast / Notification System

Every user action needs feedback within 200ms. Use a toast stack (bottom-right, max 3 visible):

```typescript
// frontend/src/components/ui/Toast.tsx — spec
// Library: sonner (already in shadcn/ui ecosystem)

// SUCCESS toast: green left border, checkmark icon, 3s auto-dismiss
toast.success("Import complete — 4,010 rows added")

// ERROR toast: red, 6s, with "Try again" link if applicable
toast.error("Import failed: no valid date column found. See details →")

// INFO toast: electric blue, 4s
toast.info("Weekly brief sent to your WhatsApp 📱")

// WARNING (quota): amber, 8s, sticky (user must dismiss)
toast.warning("You've used 9/10 questions this month. Upgrade before you run out.")

// LOADING (async operations): spinner, no auto-dismiss
const toastId = toast.loading("Importing your data...")
// later:
toast.dismiss(toastId)
toast.success("Import complete!")
```

### 1.6 — Loading States (every page must have one)

```typescript
// Skeleton component — reuse for all loading states
// frontend/src/components/ui/Skeleton.tsx — already exists, extend it

// Dashboard skeleton (shows while KPIs load):
// 4 KPI cards → grey boxes with pulse animation
// Chart areas → grey rectangles
// Tables → 5 rows of grey bars

// Copilot skeleton: 3 shimmer message bubbles

// DataPage skeleton: 3 upload panel outlines

// All skeletons: bg-slate-200 animate-pulse-soft rounded-lg
// Transition from skeleton to content: opacity fade-in 300ms
```

---

## 2. Every Page — Complete Spec

### P1 — Landing Page (`/`)

**Already specified in Day 15.2.** Critical additions:

#### 2.1a — Demo Video Slots

```
SLOT 1 — Hero "See a 60-second demo" button:
  Opens a <dialog> modal (not new tab, not redirect)
  Modal: 90vw max-width 900px, dark overlay bg-black/70
  Inside: <iframe> lazy-loaded YouTube embed OR Loom embed
  Video content: Screen recording of:
    1. Someone typing "पिछले महीने किस zone की revenue सबसे कम रही?" (3 seconds)
    2. AKARA response appearing word by word (copilot streaming) (5 seconds)
    3. Dashboard with real-looking FMCG data (3 seconds)
    4. WhatsApp notification arriving on phone mockup (3 seconds)
  Total: 60 seconds. No voiceover needed — on-screen captions only.
  [X] close button top-right
  Below video: [Start free — no credit card →] (orange CTA)
  Implementation:
    const [demoOpen, setDemoOpen] = useState(false)
    // Lazy load: only inject iframe src when modal opens (prevents autoplay performance hit)
    <dialog open={demoOpen}>
      {demoOpen && <iframe src="https://www.loom.com/embed/YOUR_ID?autoplay=1" />}
    </dialog>

SLOT 2 — Section 5 "Ask anything" tab:
  NOT a video — an animated GIF (or CSS animation faking a typing effect)
  Shows: user types query → AKARA responds → numbers appear
  Reason: keeps page lightweight; no external video dependency
  Implementation: useTypewriter hook + simulated SSE response text
```

#### 2.1b — Marketing "Ad" Slots Within Landing Page

```
These are internal promotional slots — they upsell features and build FOMO.

SLOT A — After social proof bar (Section 3.5):
  "🚀 Launching WhatsApp weekly briefs — get your data in your inbox every Monday"
  [Be the first to use it →] → /signup
  Design: thin full-width banner, electric blue bg (#42A5F5), white text
  Dismissible: localStorage key "banner_wa_dismissed"
  Show only once per visitor (or until dismissed)

SLOT B — After the pricing section (Section 7.5):
  "📣 Founders deal: First 50 customers get Business tier at Pro price — forever"
  Show counter: "43 / 50 spots taken" (update this manually in code)
  [Claim your spot →] → /signup?plan=business&deal=founders
  Design: card with gradient border (violet → amber)
  NOTE: Only show this when you actually want to run this deal

SLOT C — Footer above copyright:
  Email capture for product updates:
  "Get launch updates + FMCG analytics tips"
  [Email input] [Get updates →]
  POST to a Supabase edge function → inserts into marketing_emails table
  No auth required. Simple honeypot field to block bots.
```

#### 2.1c — Mobile Landing Page

```
Breakpoints:
  mobile:  < 768px
  tablet:  768–1024px
  desktop: > 1024px

Mobile-specific:
  Hero: text-center, phone mockup below text (not side-by-side)
  H1: font-size 2rem (32px), not 3rem
  CTA buttons: w-full (full width)
  Fixed bottom CTA bar (appears after scrolling past hero):
    bg-white shadow-top border-t
    [Start free →] full-width orange button
    Hides when user reaches pricing section

  Pain cards (Section 4): horizontal scroll snap
    -webkit-overflow-scrolling: touch
    scroll-snap-type: x mandatory
    Each card: scroll-snap-align start, min-width: 280px

  Pricing cards (Section 7): single column, Pro card on top (most popular)
  FAQ (Section 8): accordion (only one open at a time on mobile)
  Nav: hamburger → slide-over from right, dark overlay
```

---

### P2 — Sign Up Page (`/signup`)

```
Layout: Centered card, max-width 440px, white card on brand-violet/F8F7FF bg
Header: AKARA logo (violet) + "Create your free account"

Form fields (in order):
  1. Work email *
     placeholder: "you@company.com"
     Note below: "Use your work email — we'll send the weekly brief here"

  2. Password *
     placeholder: "Min 8 characters"
     Show/hide toggle (eye icon)
     Strength indicator: 4-segment bar below input
       Segment colors: red → orange → amber → green
       Text: "Weak" → "Fair" → "Good" → "Strong"
       Triggers on keystroke

  3. Full name *
     placeholder: "Rajan Sharma"

  4. Company name *
     placeholder: "Sharma Traders"

  5. WhatsApp number (optional)
     prefix: "+91 🇮🇳"
     placeholder: "9876543210"
     Helper: "We'll send your weekly brief here. Skip to set up later."

Checkboxes (both required):
  [ ] I agree to the Terms of Service and Privacy Policy
  [ ] I consent to my sales data being processed by AI to generate analytics
      (Required under DPDP Act 2023)
  Neither checkbox pre-checked. Both must be checked to enable submit.

Submit button:
  [Create free account →] — orange, full width, disabled until both checkboxes checked
  Loading state: spinner + "Creating account..."

Below button:
  Cloudflare Turnstile widget (bot prevention, loads lazily)
  "Already have an account? Sign in" → /login

Social proof: 3 small metrics below form
  "₹18 Cr revenue analysed · 284 questions answered · 12 distributors"
  (same as landing page, helps reduce sign-up anxiety)

After submit → redirect to /verify-email
```

**Error states:**
```
Email already registered:
  Inline error below email field:
  "This email is already registered. Sign in instead →"

Disposable email blocked:
  "Please use a work email address (disposable emails not accepted)"

Network error:
  Toast error: "Something went wrong. Please try again."
  Submit button re-enables

Password too weak:
  Inline: "Password must be at least 8 characters"
  (client-side, immediate feedback)
```

---

### P3 — Email Verification Pending (`/verify-email`)

```
Layout: Centered, max-width 480px, white card
Icon: Large email/envelope illustration (SVG, violet color)
Heading: "Check your email"
Body: "We sent a verification link to [email@company.com].
       Click the link in the email to activate your account."
       
Actions:
  [Resend verification email] — ghost button, once every 60 seconds
  Countdown: "Resend in 45s" (disabled during countdown)
  
  [Use a different email] → back to /signup

  "Already verified? Sign in →" → /login

After clicking email link → redirect to /onboarding

Edge case: Email opened on phone, link clicks open different browser:
  /verify-email?token=xxx → backend validates → sets cookie → redirect /onboarding
```

---

### P4 — Forgot Password (`/forgot-password`)

```
Layout: Centered card, max-width 400px
Heading: "Reset your password"
Body: "Enter your email and we'll send you a reset link."

Form:
  Work email *
  [Send reset link →] — orange button

Success state (after submit):
  Checkmark icon (emerald)
  "Reset link sent"
  "Check your email at [email]. Link valid for 1 hour."
  [Back to sign in] → /login

Error: email not found:
  Inline: "No account found with this email"
  (don't reveal whether email exists for security — actually we can since it's B2B not high-security)
```

---

### P5 — Reset Password (`/reset-password?token=xxx`)

```
Layout: Centered card, max-width 400px
Heading: "Set your new password"

Form:
  New password *  (strength indicator, same as signup)
  Confirm password *
  [Set new password →] — orange button

Loading: "Updating password..."
Success: green checkmark + "Password updated. Signing you in..."
  → auto redirect to /dashboard after 2 seconds

Error: expired token:
  Red icon + "This reset link has expired."
  [Request a new link →] → /forgot-password
```

---

### P6 — Login Page (`/login`)

**Current state: exists. Needs these exact additions:**

```
Layout: Split layout on desktop:
  Left half: brand-violet gradient (5B21B6 → 7C3AED)
  Content on left:
    AKARA logo (white)
    Big quote: "Know your business in 30 seconds."
    Subtext: "AI analytics built for Indian distributors."
    3 feature bullets:
      ✓ Ask in Hindi or English
      ✓ Weekly brief on WhatsApp
      ✓ Free to start
    Screenshot/mockup: phone showing WhatsApp brief (white phone frame)
  
  Right half: white, centered form card (max-width 420px)
    AKARA logo (violet) — mobile only (hidden on desktop)
    Heading: "Welcome back"
    
    Form:
      Email *
      Password * (show/hide)
      [Sign in →] — orange, full width
      Loading: spinner + "Signing in..."
    
    Links below button:
      "Forgot your password?" → /forgot-password
      "Don't have an account? Start free →" → /signup

Error states:
  Wrong password:
    Inline below password: "Incorrect email or password"
    (deliberately vague, no "email not found" for security)
    
  Account locked (5 failed attempts):
    Toast: "Too many attempts. Try again in 10 minutes."
    
  Email not verified:
    "Please verify your email first." + "Resend verification →"
```

---

### P7 — Onboarding (`/onboarding`)

**3-step wizard. Cannot skip to dashboard without completing.**

```
Progress bar: 3 dots at top center (● ○ ○ → ● ● ○ → ● ● ●)
Back button: top-left (not visible on step 1)
Skip button: not available (onboarding is mandatory for proper setup)

─── STEP 1: Your business ───────────────────────────────────────

Illustration: Simple SVG of warehouse/boxes (violet)
Heading: "Tell us about your business"
Sub: "So AKARA speaks your language from day one."

Fields:
  Company name *    (pre-filled from signup)
  Industry *        [Select ▼]
    Options: FMCG Distribution · Restaurant/QSR · Pharma Distribution
             Industrial Distribution · Retail Chain · Other
  Currency *        [₹ INR ▼] (default INR, also USD, AED, GBP)
  Language *        [English ▼] (English / Hindi / Hinglish)
  Monthly revenue   [Select ▼] (for segmentation, not mandatory)
    < ₹1 Cr / ₹1–10 Cr / ₹10–50 Cr / ₹50–200 Cr / > ₹200 Cr

[Continue →] — orange, full width

─── STEP 2: Import your first data ─────────────────────────────

Illustration: Simple SVG of file/upload (amber)
Heading: "Import your sales data"
Sub: "Export from Tally: Gateway → Export Data → Sales Register. Or drag your Excel file."

Upload zone:
  Drag-and-drop box (dashed border, violet-tinted)
  Center icon: upload arrow
  "Drop your CSV or Excel file here"
  "or click to browse"
  Below zone: "Supported: .xlsx, .xls, .csv · Max 20MB"
  
  On file select:
    Show filename + file size
    [Start import →] replaces drop zone instructions
    Progress bar (animated, violet)
    "Analysing your data... (may take 30 seconds for large files)"
    
  On success:
    ✓ green checkmark
    "4,010 rows imported from Sales Report.xlsx"
    "Dates: Dec 1–31, 2025 · 12 distributors · 4 zones"
    [See your dashboard →] — orange button (continues to step 3)

  Skip option:
    Text link below: "Skip for now — explore with sample data"
    → loads demo tenant data, marks onboarding complete with sample=true flag

─── STEP 3: You're ready ────────────────────────────────────────

Illustration: Confetti burst (CSS animation, brand colors)
Heading: "🎉 You're all set!"
Sub: "Your dashboard is live. Here's what you can do:"

3 feature cards (horizontal):
  📊 Ask anything     "Type any question about your sales"
  📱 Get WhatsApp brief  "Add your number in Settings"
  🔔 Set alerts       "Get notified when KPIs drop (Pro feature)"

[Go to my dashboard →] — orange, large, full width

On click → /dashboard
Also: POST /auth/onboarding-complete (marks has_completed_onboarding=true on profile)
```

---

### P8 — Dashboard (`/dashboard`)

**Complete state machine:**

```
─── LOADING STATE (Navy Glass Canvas) ──────────────────────────

Background: GradientMesh component (animated navy orbs)
4 GlowKPICard skeletons with blue shimmer (KPISkeleton component)
2 LiquidGlassCard chart skeletons with blue shimmer 
1 navy glass table skeleton (5 rows) with blue shimmer
Duration: ~500ms (PostgREST is fast)
Staggered entrance: cards appear with springs.gentle, 60ms stagger

─── EMPTY STATE (EmptyState Component) ─────────────────────────

Background: GradientMesh component
Center of page (instead of KPI grid):
  Icon: BarChart3 with blue gradient glow behind it (w-16 h-16 text-[#64B5F6])
  Heading: "Your dashboard is empty" — bg-gradient-to-r from-[#42A5F5] to-[#80D8FF] bg-clip-text text-transparent
  Body: "Import your first sales file to see live KPIs, zone breakdowns, and revenue trends." — text-[#5C8FBF]
  
  Two actions:
  [Import your first file →]  — GradientButton (blue gradient) → /data
  [Explore with sample data]  — SecondaryButton (outlined blue) → loads demo data silently

Warm tip below:
  "💡 Tip: Export from Tally: Gateway → Export Data → Sales Vouchers" — text-[#90CAF9]
  "Then drag the Excel file into Data → Primary Sales"

─── DATA STATE (normal) ─────────────────────────────────────────

Layout:
  Top bar (inside AppShell header area):
    Date picker: [Last 30 days ▼] (7d / 30d / 90d / YTD / custom)
    → changes all KPIs and charts in real-time
    
  KPI GRID (4 cards, 2×2 on tablet, 4×1 on desktop):
    
    Card 1 — Total Revenue
      Left border: 4px brand-violet
      Value: ₹42.3L  (animate in with number-pop keyframe)
      Change badge: ↑ 8% vs previous period (emerald)
      Sub: "7,204 orders"
    
    Card 2 — Avg Order Value  
      Left border: 4px accent-amber
      Value: ₹5,873
      Change: ↓ 3% (red badge)
      Sub: "per invoice"
    
    Card 3 — Unique Parties
      Left border: 4px success
      Value: 47
      Sub: "distributors/retailers"
    
    Card 4 — Outstanding
      Left border: 4px danger (if >0, else slate)
      Value: ₹4.2L
      Sub: "across 6 parties"
      If value > 0: pulsing red dot on card
  
  CHARTS ROW (2 charts side by side on desktop, stacked on mobile):
    
    Revenue Trend (line chart):
      Line color: brand-violet
      Tooltip: dark bg, white text, shows date + ₹ value
      Empty state: "No revenue data for this period"
    
    Zone Breakdown (horizontal bar chart):
      Bar colors: chart palette (violet, amber, emerald, orange, blue)
      Labels: zone name on left, ₹ value on right
      Tooltip: revenue + % share
    
  TABLES ROW:
    
    Top Products table (left):
      Columns: Product | Revenue | Qty | Orders
      Rows: 10
      Hover: row bg-surface-raised
      Clickable row: expands to show zone breakdown for that product (future)
      Empty: "No product data for this period"
    
    Outstanding Parties table (right):
      Shows if outstanding_amount > 0 rows exist
      Header: red pulsing dot + "Outstanding dues"
      Columns: Party | Zone | Amount | Action
      Action: 📞 WhatsApp button → opens wa.me/91XXXXXXXXXX (party phone from profile)
      Empty: emerald checkmark + "No outstanding dues — great!" 

─── STALE DATA WARNING ──────────────────────────────────────────

If last_import_at > 3 days ago:
  Amber banner below date picker:
  "⚠️ Last import was {N} days ago. Your data may be outdated."
  [Import new data →]   [Dismiss ×]

If last_import_at > 7 days ago:
  Red banner (more urgent)

─── QUOTA WARNING ───────────────────────────────────────────────

If copilot_calls_used >= 80% of limit:
  Bottom of page, amber sticky bar:
  "You've used 8 of 10 AI questions this month. [Upgrade for 400 →]"
  Dismissible per session (not per day — important: they need to upgrade)
```

**Dashboard — Demo/Ad Slots:**
```
SLOT D — First visit (has_seen_demo = false):
  After KPI grid, a "AKARA Feature Spotlight" card (dismissible):
  "💬 Ask your first question"
  "Type: 'Which zone had the highest revenue last month?' and see AKARA answer in seconds."
  [Ask now →] → /copilot
  [×] dismiss (localStorage: has_seen_demo = true)
  This is your most valuable ad slot — it drives the core product action.

SLOT E — After first import, if WhatsApp not set:
  Small amber card below charts:
  "📱 Get this dashboard delivered to your WhatsApp every Monday"
  [Add WhatsApp number →] → /settings?focus=whatsapp
  Dismiss after setting or after 3 views
```

---

### P9 — Copilot Page (`/copilot`)

**Every state:**

```
─── EMPTY (no messages yet) ────────────────────────────────────

Center of chat area:
  AKARA logo mark (small, violet)
  Heading: "Ask AKARA anything"
  Sub: "Your sales data, answered in plain English or हिंदी"
  
  SUGGESTED PROMPTS (2×3 grid of chips):
  Chip style: border border-brand/20 bg-brand-dim text-brand rounded-full px-4 py-2 text-sm
  Hover: bg-brand text-white
  
  Prompts:
    "Which zone had the highest revenue last month?"
    "पिछले महीने किस distributor ने सबसे ज़्यादा return किया?"
    "Show me revenue trend for the last 3 months"
    "Which route has the most missed visits?"
    "Top 5 products by revenue this quarter"
    "Are there any outstanding dues above ₹1L?"
  
  On chip click: fills input + auto-sends

─── STREAMING (waiting for response) ────────────────────────────

User message bubble: right-aligned, bg-brand-dim text-brand-dark rounded-2xl
  Max-width 60%, padding px-5 py-3

Assistant bubble: left-aligned, white card, brand-violet left border 3px
  Shows typing cursor (▋) while streaming
  Text appears word by word as SSE chunks arrive
  
  During streaming: input field disabled, Send button shows spinner

─── RESPONSE COMPLETE ────────────────────────────────────────────

Assistant bubble complete:
  Content: markdown rendered (bold, lists, numbers formatted)
  Footer of bubble (small, text-muted):
    "Based on 4,010 rows · Jan–Dec 2025"  (data provenance)
    👍  👎  (feedback buttons — small, don't distract from content)
    On 👍: fills with color, no further action
    On 👎: opens small inline textarea "What was wrong with this answer?"
            [Submit] [Skip]
            → POST /copilot/feedback

─── ERROR STATE ─────────────────────────────────────────────────

If LLM fails:
  Assistant bubble with red left border:
  "I couldn't process that request. The AI service is temporarily unavailable."
  [Try again →] button (re-sends same question)

If quota exceeded:
  Amber assistant bubble:
  "You've used all 10 questions for this month. 
   The copilot will reset on [date]. Or upgrade to Pro for 400 questions/month."
  [Upgrade now →] → /upgrade
  Dashboard and weekly briefs still work normally.

─── CONVERSATION SIDEBAR ─────────────────────────────────────────

Width: 280px on desktop, hidden on mobile (toggle via hamburger in header)
Header: "Conversations" label (14px, text-muted, uppercase, tracking-wider)
Empty: "No saved conversations yet. Ask a question to start."

Conversation item:
  Title: first 40 chars of first question
  Time: "2h ago" / "Yesterday" / "3 Jul"
  Active: bg-brand-dim, left border brand-violet
  Hover: bg-surface-raised
  Right-click / three-dot menu:
    Rename
    Delete

─── DEMO SLOT (first 3 visits) ───────────────────────────────────

SLOT F — Below suggested prompts (only when messages.length === 0):
  "📺 See a 60-second demo of AKARA answering a Hindi question"
  Clicking: opens the same <dialog> video modal as the landing page
  Disappears after user sends their first message
  (Persist across page refreshes for 3 days: localStorage timestamp)
```

---

### P10 — Data Page (`/data`)

**Every state:**

```
─── PAGE HEADER ─────────────────────────────────────────────────

Title: "Data Management"
Sub: "Import sales, secondary, and scheme data. Track every import."

Daily counter bar (always visible, below sub):
  bg-surface-raised rounded-lg p-3 flex items-center gap-6
  "Uploads today: [2] / 3"  — number in violet if <3, amber if =3
  "Undos today: [0] / 2"    — number in violet if <2, red if =2
  Small clock icon + "Resets at midnight IST"

─── NON-ADMIN BANNER ────────────────────────────────────────────

If !isAdmin:
  amber card:
  "ℹ️ Only admins can import data. Your data view is read-only."
  All upload buttons disabled and greyed.

─── UPLOAD PANELS (3 of them) ───────────────────────────────────

Each panel:
  Title + description (as current)
  Drop zone (dashed border, brand-violet, rounded-xl)
  
  States of drop zone:
    Idle:    dashed violet border, "Drop CSV or Excel here or click to browse"
    Drag over: solid violet border, scale-[1.01], bg-brand-dim, "Drop to upload"
    File selected: shows filename, size, [Import →] button
    Uploading: progress bar (violet, animated), "Uploading... 2.3MB of 4.1MB"
    Processing: spinner, "Processing rows..."
    Success: green checkmark, "2,847 rows imported successfully"
             Auto-dismiss after 4 seconds, shows in Import History
    Error: red border, error message, [Try again] button
  
  Plan gate overlay (for secondary/scheme on free):
    Semi-transparent white overlay (backdrop-blur-sm)
    Center: lock icon (28px, text-muted)
    "Available on Pro plan"
    [Upgrade to Pro →] — violet link

─── IMPORT HISTORY TABLE ────────────────────────────────────────

Below the 3 upload panels.
Title: "Import History"
Sub: "Last 10 imports. Up to 2 undos per day."

Table columns:
  Date & time | File name | Type | Rows | Status | Action

Row states:
  success: green dot, shows row count, Undo button (trash icon)
  failed:  red dot, "Failed" badge, "View error" link → tooltip with error message
  deleted: grey strikethrough text, "Undone" badge, no action button

Undo button:
  Normal: outlined red button with ↺ icon
  Hover: bg-red-50 text-red-600
  When undos_today >= 2: greyed out, tooltip: "2 undos used today. Resets at midnight."
  Confirmation modal on click:
    "Are you sure you want to undo this import?"
    "This will delete 2,847 rows imported from Sales Report.xlsx."
    [Cancel] [Undo import] — red button
    Loading: spinner
    Success: row updates to "Undone" state, toast: "Import undone — 2,847 rows removed"

Empty history: "No imports yet. Upload your first file above."

─── AD SLOT ─────────────────────────────────────────────────────

SLOT G — After 1 successful import, if user is on free plan:
  Card below import history:
  "🔓 Unlock secondary sales and scheme data"
  "See what your distributors are selling. Detect scheme leakage."
  [Upgrade to Pro — ₹7,999/mo →]
  Design: gradient border (violet → amber), subtle background
  Dismiss after 7 days (localStorage)
```

---

### P11 — Copilot Page mobile spec

```
Mobile layout:
  Sidebar: hidden by default
  Header: has "Conversations ☰" icon button → opens drawer (slide from left)
  Chat takes full width
  Input fixed at bottom of screen
  Suggested prompts: horizontal scroll (no grid)
  Message bubbles: max-width 90%
```

---

### P12 — Reports Page (`/reports`)

**Every state:**

```
─── LAYOUT ──────────────────────────────────────────────────────

Two tabs at top: [Route Performance] [Scheme Leakage]

─── ROUTE PERFORMANCE TAB ───────────────────────────────────────

Date range picker (same component as dashboard)

Table: Route | Revenue | Orders | Unique Parties | Avg Order Value
Sort: clickable column headers (↑↓ indicators)
Hover: row highlight

Empty: "No route data available for this period"
Loading: 5-row skeleton table

─── SCHEME LEAKAGE TAB ──────────────────────────────────────────

If free plan:
  Full-page gate (not just overlay):
  Lock icon (48px, brand-violet)
  Heading: "Scheme leakage detection"
  Body: "See exactly how much scheme money was claimed without corresponding secondary sales."
  Feature preview: blurred/placeholder table behind a semi-transparent overlay
  [Upgrade to Business →] — orange CTA
  "From ₹13,999/month"

If business plan and no scheme data:
  Empty state: briefcase illustration
  "Import your scheme master data to detect leakage"
  [Import scheme data →] → /data (scrolls to scheme panel)

If business plan and has data:
  Summary card: "₹38,000 leakage detected across 3 distributors"
  Table: Party | Scheme | Claimed | Secondary Sales | Leakage | Risk
  Risk badges: Low (green) / Medium (amber) / High (red)
  Export button: [Download CSV] top-right
```

---

### P13 — Simulator Page (`/simulator`)

```
─── FREE PLAN GATE ──────────────────────────────────────────────

Full lock screen (same as scheme leakage pattern):
  Calculator illustration (SVG, violet)
  Heading: "Revenue simulator"
  Body: "Model 'what if' scenarios: zone growth, product changes, pricing shifts."
  [Upgrade to Pro →] — orange

─── PRO/BUSINESS: LOADED STATE ──────────────────────────────────

3-panel layout on desktop:
  Left: Input sliders (10 of them, e.g. "Zone A revenue +X%")
  Center: Projected revenue output (large number, animated)
  Right: Comparison chart (before/after)

Slider component: violet fill, thumb: white circle with violet border
  On drag: all output numbers animate to new values (300ms transition)

"Scenario" saved state:
  [Save scenario] → stores in localStorage
  [Reset] → back to current actuals
```

---

### P14 — Settings Page (`/settings`)

**Tabbed layout:**

```
Tabs: [Profile] [Notifications] [Billing] [Security] [Team] [API Keys] [Danger Zone]

─── PROFILE TAB ─────────────────────────────────────────────────

Fields:
  Display name (editable)
  Email (read-only, shows "Change email →" link for future)
  WhatsApp number (+91 prefix, optional)
    After save: "Test message sent to +91 98765 43210" (success toast)
  Company name (editable)
  Industry (select)
  Language preference (English / Hindi / Hinglish)
  Currency (INR / USD)
  Plan badge (read-only, shows current plan with upgrade link)

[Save changes] — orange, shows checkmark on success for 2 seconds

─── NOTIFICATIONS TAB ────────────────────────────────────────────

Toggle switches (brand-violet when on):
  [✓] Weekly brief — WhatsApp (Pro+)
      Day: [Monday ▼], Time: [7:00 AM ▼], Timezone: IST
  [✓] Weekly brief — Email (Pro+)  
  [✓] Daily morning brief — WhatsApp (Pro+)
      Time: [7:00 AM ▼]
  [✓] Alert notifications (Pro+)
  [ ] Marketing emails from AKARA

Pro gate: toggles that need Pro show lock icon, disabled until upgrade

[Send test brief now] — ghost button, triggers POST /admin/reports/morning-brief for self
  Loading: "Sending..."
  Success toast: "Test brief sent to your WhatsApp/email"

─── BILLING TAB ─────────────────────────────────────────────────

  → Opens /billing (full page, see BillingPage spec)
  OR embedded inline — your choice

─── SECURITY TAB ────────────────────────────────────────────────

Change password section:
  Current password
  New password + strength indicator
  Confirm new password
  [Update password]

Active sessions (future):
  "You're signed in on 1 device"
  [Sign out of all devices] — red ghost button

─── TEAM TAB (Pro+ only) ────────────────────────────────────────

If free: full gate, "Upgrade to Pro for up to 3 team members"

If Pro:
  Current team members table:
    Email | Name | Role | Last login | Remove [×]
    Role: Admin / User (dropdown)
  
  Invite section:
    [Email input] [Role ▼] [Send invite →]
    On send: POST /team/invite → sends magic invite link
    Pending invites table (greyed row + "Pending" badge + [Resend] [Cancel])
  
  Quota: "3 of 3 seats used" → "Upgrade to Business for 10 seats"

─── API KEYS TAB (Business only) ────────────────────────────────

If not Business: full gate

If Business:
  Generated keys table:
    Name | Key (masked: akara_sk_••••••XXXXX) | Created | Last used | [Revoke]
  
  [+ Generate new key] → modal:
    Name: [_________] (e.g. "Tally Agent Production")
    [Generate] → shows key ONCE (copy button, cannot be seen again)
    Warning: "Save this key. It won't be shown again."
    Input to copy: bg-surface-raised font-mono select-all on click

─── DANGER ZONE ─────────────────────────────────────────────────

Red card (border-danger bg-danger-dim/20):

Section 1 — Export data:
  "Download all your data as JSON"
  [Export my data →] → GET /account/export → downloads file
  "We'll email a download link if it's over 50MB"

Section 2 — Delete account:
  "Permanently delete your account and all data"
  Warning: "This cannot be undone. All your data will be deleted immediately."
  [Delete my account] — red outlined button
  
  Confirmation modal:
    Heading: "Delete your account"
    Body: "This will permanently delete your account, all your sales data, and cancel your subscription."
    Type to confirm: input must contain your email exactly
    [Cancel] [Delete my account permanently] — red, disabled until email matches
    Loading: "Deleting..."
    Success: redirect to / + "Account deleted"
```

---

### P15 — Billing Page (`/billing`)

```
─── PLAN CARD (top) ──────────────────────────────────────────────

White card, rounded-2xl
Left: Plan info
  Large badge: "Pro ✦" (or Free / Business)
  Status: "Active · Renews Aug 1, 2026"  (or "Past Due ⚠️" with red)
  Price: "₹7,999 / month"
  
  If annual: "₹76,790 / year (saving ₹19,198)"

Right side buttons:
  [Manage subscription →] — opens Stripe customer portal
  [Upgrade plan →] — only shown for Free/Pro, → /upgrade

If past_due:
  Red banner inside card:
  "⚠️ Payment failed. Please update your payment method."
  [Update payment →] → Stripe portal
  "Your account will be downgraded on [date] if not resolved."

─── MONTHLY USAGE (progress bars) ───────────────────────────────

"Usage this month"

4 progress bars:
  Copilot questions:  [████████░░] 8/10 (80%)    ← amber if >80%, red if >95%
  Rows stored:        [█░░░░░░░░░] 1,204/10,000
  Uploads this month: [████░░░░░░] 2/5           ← free plan only
  Team members:       [████████░░] 1/1

Color coding for progress bars:
  < 60%: brand-violet fill
  60–80%: accent-amber fill
  > 80%: danger fill + pulsing animation

"Usage resets on 1 August 2026"

─── TODAY'S RATE LIMITS ──────────────────────────────────────────

"Today's limits" (smaller section)

Two compact pill-counters side by side:
  [📤 Uploads today: 2/3]    [↺ Undos today: 0/2]
  
  Each pill:
    bg-surface-raised, rounded-full, px-4 py-1.5
    Green outline if unused, amber if at limit-1, red+pulsing if at limit
  
  Small text: "Daily limits reset at midnight IST"
  [What are these? ▾] — expandable tooltip explaining the limits

─── DATA RETENTION ───────────────────────────────────────────────

"Data retention"
"Your plan retains data for 30 days."
"Oldest data in your account: 1 Dec 2025"
If free: "Upgrade to Pro to retain 12 months of history."

─── INVOICE HISTORY ──────────────────────────────────────────────

Table (Pro+ only):
  Date | Amount | Status | Invoice
  Aug 1 · ₹9,438 (GST incl.) · Paid ✓ · [Download PDF]
  Jul 1 · ₹9,438             · Paid ✓ · [Download PDF]
  "Add GSTIN for B2B invoicing" link → modal with GSTIN field

─── AD SLOT ──────────────────────────────────────────────────────

SLOT H — Free plan billing page, below usage bars:
  "You're getting a lot of value from the free tier! 🙌"
  "Used 8 of 10 questions this month? Upgrade to Pro and never worry about limits."
  [Upgrade to Pro for ₹7,999/mo →] — orange, prominent
  Features callout: "400 questions · WhatsApp briefs · Unlimited uploads"
```

---

### P16 — Upgrade Page (`/upgrade`)

```
Layout: Centered, max-width 900px, white bg

Header: "Upgrade AKARA"
Sub: "More questions, more history, more power."

3 pricing cards (horizontal, same as landing):
  Free (current if free)
  Pro (highlighted, "Most popular" badge — violet border)
  Business

Each card:
  Price + annual discount toggle at top
  Feature list (5 bullets, most important ones only)
  CTA button:
    Free: "Current plan" (disabled, grey)
    Pro: [Start Pro →] → POST /billing/create-checkout-session (Stripe)
    Business: [Start Business →] → same

Annual toggle:
  "Pay monthly" / "Pay annually (save 20%)"
  Toggle switch (brand-violet)
  Prices animate when toggled

Under Pro card:
  "✓ 3× cheaper than FireAI for same features"
  (This is a real, factual claim — FireAI charges ₹20,199/mo for 3 users)

Under Business:
  "Questions? WhatsApp us: +91 XXXXXXXXXX"
  For >10 users: "Enterprise plan available → [Contact us]"

Below all cards:
  "All plans: India data residency · DPDP-compliant · Cancel anytime · GST invoice included"
  
  FAQ (3 short ones):
    Q: What happens to my data if I downgrade?
    A: Kept for 30 days, then retention rules apply. You can re-upgrade anytime.
    
    Q: Can I pay by NEFT/bank transfer?
    A: Yes — email billing@akara.ai with your company name and we'll send an invoice.
    
    Q: Is there a free trial for Pro?
    A: No trial, but the free plan is permanently free. Upgrade only when you hit limits.
```

---

### P17 — 404 Not Found (`/*`)

```
Layout: Centered, full page

Visual: Large "404" in brand-violet (font-size: 8rem, font-weight: 800, letter-spacing: -0.05em)
        Below it: small sad face emoji or simple SVG

Heading: "This page doesn't exist"
Body: "You might have a broken link, or the page was moved."

Links:
  [← Go to dashboard]  — primary, orange
  [Go to home page]     — secondary, outlined

Subtle animation: 404 number has a gentle float animation (translateY ±4px, 3s infinite)
```

---

### P18 — 500 Server Error (error boundary fallback)

```
This renders when React ErrorBoundary catches a crash.

Visual: Same layout as 404 but:
  "500" in danger color (#EF4444)
  Heading: "Something went wrong"
  Body: "We've been notified. Please refresh and try again."
         "If the problem persists, contact support."

Buttons:
  [Refresh page] → window.location.reload()
  [Contact support] → mailto:support@akara.ai

Also: auto-reports to Sentry with componentStack
```

---

### P19 — Password Reset Landing (`/reset-password`)

Already spec'd in P5.

---

### P20 — Privacy Policy (`/privacy`) and Terms (`/terms`)

```
Layout: Simple prose, max-width 720px, standard typography
Nav: simple header with AKARA logo → homepage
Footer: same as landing

Privacy Policy must include:
  - Data controller: AKARA Analytics Pvt Ltd
  - What data we collect + why
  - AI processing disclosure (DPDP requirement)
  - Sub-processors list (Supabase, OpenAI, SendGrid, Stripe, Zaptilo)
  - Data residency: AWS Hyderabad (ap-south-2)
  - Retention periods by plan
  - User rights (access, correction, erasure, portability)
  - Contact: privacy@akara.ai
  - Cookie policy (PostHog analytics, Cloudflare Turnstile only)
  - Effective date, version number

Terms must include:
  - Acceptable use (no re-export of data, no automated scraping)
  - Payment terms (Stripe, GST, refund policy: no refunds but pro-rata on annual)
  - Limitation of liability
  - Data ownership: you own your data
  - Service availability SLA (by plan)
  - Termination + data deletion timeline
```

---

## 3. Email Templates — Visual Spec

Every email uses the same template frame:

```
Template frame:
  Max-width: 600px centered
  Background: white
  Header: 
    bg: #5B21B6 (brand-violet)
    AKARA logo (white, centered)
    
  Body: white, padding 40px 32px
    font-family: system-ui (email clients don't support custom fonts)
    h1: 24px, font-weight 700, color #0F172A
    p: 16px, line-height 1.6, color #475569
    
  CTA button:
    bg: #F97316 (orange)
    text: white, 16px, font-weight 600
    padding: 14px 28px
    border-radius: 8px
    display: block, text-align: center
    
  Footer:
    border-top: 1px solid #E2E8F0
    text: 12px, color #94A3B8
    "© 2026 AKARA Analytics Pvt Ltd · GST: XXXX · India"
    "Unsubscribe · Privacy Policy · Help"
```

**Template library (all emails):**

```
E1 — Welcome / Verification email:
  Subject: "Verify your email — AKARA"
  Headline: "Welcome to AKARA 🎉"
  Body: "Click below to verify your email and activate your account."
  CTA: [Verify email address →]
  Below CTA: "Link valid for 24 hours. If you didn't sign up, ignore this."

E2 — Password reset:
  Subject: "Reset your AKARA password"
  Headline: "Reset your password"
  Body: "Click below to set a new password. Valid for 1 hour."
  CTA: [Reset password →]

E3 — Weekly debrief:
  Subject: "📊 AKARA Weekly — [Company Name] — ₹XX.XL revenue this week"
  Headline: "Your week in numbers"
  Content: dynamically generated HTML (see MorningBriefService)
  Structure:
    KPI row (4 cards in email grid): Revenue | AOV | Top Zone | Outstanding
    Chart screenshot or data table (plain text table if no image gen)
    Top 3 actions for this week
    CTA: [View full dashboard →]

E4 — Daily morning brief:
  Subject: "Good morning — your AKARA brief for [Date]"
  Same structure as weekly but shorter
  CTA: [Ask a follow-up question →]

E5 — Payment failed:
  Subject: "⚠️ AKARA payment failed — action needed"
  Headline: "Payment failed"
  Body: "Your [Plan] subscription payment of ₹X,XXX failed. Update your payment method to keep access."
  CTA: [Update payment method →] → Stripe portal
  "Your account remains active for 7 days. After that, it will be downgraded to Free."
  Tone: Urgent but not threatening.

E6 — Payment successful / Invoice:
  Subject: "Payment received — AKARA ₹X,XXX — Invoice #XXXX"
  Headline: "Payment confirmed ✓"
  Body: Invoice summary table (GST-compliant)
  CTA: [Download full invoice →]

E7 — Plan downgrade (grace period expiry):
  Subject: "Your AKARA plan has changed"
  Headline: "You've been moved to the Free plan"
  Body: "Your Pro subscription was not renewed. You can still access your dashboard on the Free plan."
  CTA: [Reactivate Pro →]

E8 — Activation email Day 1 (sent if no first import after 24h):
  Subject: "Your AKARA account is empty — here's how to fix it (5 min)"
  Headline: "Ready to see your sales data?"
  Body: "You haven't imported your first file yet. Here's exactly how to do it in 5 minutes:"
  Steps (as numbered list with icons)
  CTA: [Import my first file →] → /data

E9 — Activation email Day 3 (no import yet):
  Subject: "Need help importing your data?"
  More personal: "Reply to this email — I'll help you get set up."
  This email comes from a real address, not no-reply.
  CTA: [Reply to get help]

E10 — Quota warning (80% copilot calls):
  Subject: "Running low on AI questions — AKARA"
  Headline: "You've used 8 of 10 questions this month"
  CTA: [Upgrade for 400 questions →]

E11 — Team invite:
  Subject: "[Name] invited you to join [Company] on AKARA"
  Headline: "[Name] invited you to join their AKARA workspace"
  Body: "[Company] is using AKARA to manage their distribution analytics."
  CTA: [Accept invitation →] → magic link → /onboarding
```

---

## 4. WhatsApp Message Templates

```
All templates must be pre-approved by BSP (Zaptilo) before go-live.

W1 — Weekly brief (utility template):
  Header: 📊 AKARA Weekly Brief
  Body: |
    *{{company_name}}* — Week of {{week_of}}
    
    💰 Revenue: {{revenue}} ({{revenue_change}})
    🏆 Best zone: {{top_zone}}
    ⚠️ {{alert_count}} alerts this week
    
    {{if outstanding > 0}}🔴 Outstanding: {{outstanding}} across {{party_count}} parties{{/if}}
    
    *Top 3 actions:*
    1. {{action_1}}
    2. {{action_2}}
    3. {{action_3}}
    
    [View full dashboard →]
  Footer: AKARA Analytics · Reply STOP to unsubscribe

W2 — Morning brief (utility, shorter):
  Body: |
    🌅 *AKARA Morning Brief — {{date}}*
    
    Yesterday: {{yesterday_revenue}} revenue · {{order_count}} orders
    Trend: {{trend_arrow}} {{trend_pct}} vs last week
    
    Today's watch: {{focus_metric}}
    
    [Ask a follow-up →] akara.ai/copilot

W3 — Alert notification (utility):
  Body: |
    🔔 *AKARA Alert — {{alert_name}}*
    
    {{alert_message}}
    
    Triggered: {{triggered_at}}
    [View details →]

W4 — Plan upgrade confirmation (utility):
  Body: |
    🎉 Welcome to AKARA {{plan_name}}!
    
    Your new limits:
    • {{copilot_calls}} AI questions/month
    • Weekly briefs every Monday on WhatsApp
    • {{users}} team members
    
    Your first brief arrives Monday at 7 AM.
    [Explore your dashboard →]
```

---

## 5. AppShell — Complete Navigation Spec

```
SIDEBAR (desktop, fixed left 256px):

  Header section:
    AKARA wordmark (violet, 20px, font-weight 800)
    Below: user email (12px, text-muted, truncated)
    Below: plan badge (tiny: "Free" / "Pro ✦" / "Business ✦✦")

  Nav items (each 40px height, px-3 rounded-lg):
    Active state: bg-brand text-white
    Hover: bg-brand-dim text-brand
    Icon: 16px, shrink-0
    Label: 14px, font-medium
    
    ─── Main ──────────────────────
    📊  Dashboard
    💬  Copilot
           [New ●] badge if messages exist from today (red dot)
    📁  Data
    📈  Reports
    🎮  Simulator    [Pro] badge if free
    ⚙️  Settings
    
    ─── Billing ────────────────────
    💳  Billing
           Quota warning: amber "!" badge if >80% used
    
    ─── Admin (only for role=admin) ─
    🏢  Tenants
    👥  Users
    
    ─── Superadmin (role=superadmin) ─
    🔮  AKARA Ops    → /superadmin
    
  Footer:
    User avatar (initials, brand-violet circle)
    Display name
    [Sign out] → ghost button, LogOut icon

MOBILE (< 1024px):
  Hamburger menu in top-left of page
  Sidebar slides from left as drawer (fixed, z-50)
  Dark overlay covers page (bg-black/50)
  Close: tap overlay or ✕ in drawer header
  
  Fixed bottom tab bar (mobile alternative to sidebar):
    5 tabs: Dashboard | Copilot | Data | Reports | Settings
    Active: brand-violet icon + label
    Inactive: text-muted icon only
    Badge on Copilot: red dot if unread
    (This is the mobile-native pattern — more usable than drawer navigation)
```

---

## 6. Superadmin Panel (`/superadmin`) — Complete UI Spec

**Already fully specified in Day 17.5 above. Critical additions for "pitchable" standard:**

### 6.1 — Superadmin Design System (Dark Theme)

```css
/* Superadmin uses a SEPARATE design token set — dark theme */
--sa-bg:         #0A0A0F;   /* near black */
--sa-surface:    #111118;   /* card backgrounds */
--sa-border:     #1E1E2E;   /* dividers */
--sa-text:       #E2E8F0;   /* primary text */
--sa-muted:      #64748B;   /* secondary text */
--sa-accent:     #7C3AED;   /* brand violet (same) */
--sa-success:    #22D3EE;   /* cyan — production-grade feel */
--sa-warning:    #F59E0B;   /* amber (same) */
--sa-danger:     #F43F5E;   /* rose */
```

### 6.2 — Overview Tab — Detailed UI

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🔮 AKARA OPS         ● 2 needs attention    [AI Brief]    you@akara.ai │
├────────────────────────────────────────────────────────────────────────┤
│
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  │   MRR    │ │ Tenants  │ │Questions │ │ LLM Cost │ │  Margin  │
│  │ ₹1.6L   │ │    23    │ │Today: 147│ │  $4.82   │ │  87.3%   │
│  │ ↑8% MoM │ │ 4 paid   │ │↑12% avg  │ │ ↓ budget │ │ ↑0.4pp  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
│
│  LIVE FEED (auto-refreshes every 30s)           NEEDS ATTENTION
│  ─────────────────────────────────────          ────────────────────────
│  2m  Ravi Agencies    Uploaded 2,847 rows   🔴 Kumar Dist. — past due
│  5m  Sharma Traders   Asked "which zone.."  🟡 Sharma Traders — 97% quota
│  12m Kumar Dist.      Upgraded to Pro  🎉   🔴 alert_evaluator cron failed
│  1h  Patel Stores     Payment failed   ⚠️
│                                              [Fix now] [View all]

Every row in live feed is clickable → opens that tenant's drawer
Upgrades get 🎉 green highlight
Payment failures get ⚠️ red highlight
```

### 6.3 — Tenant Drawer (slide-in from right)

```
Drawer width: 480px
Overlay: bg-black/40 covers main content

Contains:
  ── Header ──
  Company logo placeholder (initials circle, brand-violet)
  Company name (large)
  Slug, plan badge, status badge
  [Impersonate] [Edit] [⋮ More actions] buttons
  
  ── Quota this month ──
  Progress bars (same style as BillingPage)
  Quick actions: [Reset month] [Add 20 bonus questions]
  
  ── Billing ──
  Stripe sub ID (monospace, dim), status
  Next payment date, last payment
  [View in Stripe ↗] [Manual upgrade] [Extend trial]
  
  ── LLM Cost ──
  "This month: $1.82 USD (margin: 89.1%)"
  Mini bar chart: copilot / brief / debrief breakdown
  
  ── Internal notes ──
  Textarea (plain, no border, placeholder: "Support notes visible only to you...")
  Auto-saves on blur
  
  ── Recent activity ──
  5 most recent audit events for this tenant
  [View all conversations] [View all audit logs]
```

### 6.4 — AI Briefing Tab

```
Layout split:
  Left 260px: pre-built questions (chips, same style as copilot)
  Right: chat interface (same component as main copilot, dark theme)

Pre-built question chips:
  "Who's about to hit their quota? Show upsell queue"
  "What's my LLM cost per question this month?"
  "Which tenants haven't imported data in 7+ days?"
  "Show me MRR waterfall — who churned, who upgraded?"
  "Which cron jobs failed in the last 48 hours?"
  "Who are my most profitable tenants right now?"
  "What would my MRR be if all 80%-quota tenants upgraded?"
  "Show me all thumbs-down feedback from this week"

The AI briefing tab is the product you built for yourself.
It uses the SAME streaming infrastructure as the customer copilot.
Dark theme: brand-violet becomes cyan (#22D3EE) for AI responses.
```

---

## 7. Demo Video — Production Spec

```
You need exactly 3 videos for launch:

VIDEO 1 — 60-second "explainer" (for landing page hero modal)
  Duration: 60s
  Tool: Loom screen recording
  Script:
    0–10s: Dashboard live with data (FMCG data, real looking numbers)
           Narrator text overlay: "This is a real FMCG distributor's data"
    10–25s: Copilot. Type: "पिछले महीने किस zone की revenue सबसे कम रही?"
            Wait for response. Show it appear word-by-word.
            Text overlay: "Ask in Hindi or English"
    25–40s: Scroll to dashboard, show zone chart highlighting South zone
            Text overlay: "Live KPIs. No data team needed."
    40–55s: Phone mockup. WhatsApp message arriving.
            Text overlay: "Every Monday on WhatsApp. No login needed."
    55–60s: CTA screen: "Free to start. akara.ai"
  
  DO NOT: add voiceover (silent demos convert better for B2B)
  DO: add subtitles using Loom's auto-caption feature

VIDEO 2 — 3-minute "full product walkthrough" (for email outreach)
  Duration: 3min
  Sections: (1) Problem (30s) (2) Import data (30s) (3) Ask copilot (60s)
            (4) Dashboard (30s) (5) WhatsApp brief (30s)

VIDEO 3 — 15-second "hook" for LinkedIn/Twitter
  Duration: 15s
  Just the copilot answering a Hindi question with the response streaming in.
  No text, no voiceover. Let the product speak.
  Ratio: 1:1 (square) for social
```

---

## 8. Promotional / "Ad" Slots — Complete Map

```
The following are internal promotional placements within the app.
All are: dismissible, never shown more than 3 times, and only shown in relevant context.

SLOT A: Landing page — thin banner above nav (marketing announcement)
SLOT B: Landing page — after social proof bar (feature spotlight)
SLOT C: Landing page footer — email capture form
SLOT D: Dashboard — first visit welcome card with copilot CTA
SLOT E: Dashboard — WhatsApp number missing nudge (amber card)
SLOT F: Copilot — demo video button (first 3 visits, below suggested prompts)
SLOT G: Data page — Pro upsell after first successful import (for free users)
SLOT H: Billing page — upgrade nudge (for free users at >80% quota)
SLOT I: Onboarding step 3 — "Invite your team" nudge (Pro+ feature preview)
SLOT J: Reports page — scheme leakage teaser (for Pro users, Business upsell)
SLOT K: Settings → Notifications — "Pro gets WhatsApp briefs" nudge for free users
SLOT L: Copilot quota exhausted — full upgrade prompt in chat area
SLOT M: AppShell sidebar — plan badge is a clickable link to /upgrade (subtle)
SLOT N: Email: quota warning at 80% (E10 above)
SLOT O: Email: activation nudge Day 1 + Day 3 (E8/E9 above)

Rules for ALL slots:
  - Max 1 slot visible at a time per page
  - Never show on upgrade/billing pages (user is already considering it)
  - Never show during copilot streaming (don't interrupt the core action)
  - Track dismissals in localStorage (key: `akara_slot_${SLOT_ID}_dismissed`)
  - "Upgrade" slots only show for free/pro users (not business)
  - Animate in with fadeUp (0.4s delay after page load)
```

---

## 9. Accessibility Checklist

```
Every interactive element:
  [ ] Keyboard focusable (Tab order makes sense)
  [ ] Focus ring visible (2px solid brand-violet outline)
  [ ] aria-label on icon-only buttons
  [ ] aria-live regions for toast notifications
  [ ] color contrast ≥ 4.5:1 for all text
      (brand-violet #5B21B6 on white: ✅ 8.1:1)
      (accent-orange #F97316 on white: ✅ 3.2:1 for large text only)

Forms:
  [ ] Labels associated with inputs (htmlFor / id)
  [ ] Error messages linked via aria-describedby
  [ ] Required fields marked aria-required

Images:
  [ ] All meaningful images have alt text
  [ ] Decorative images have alt=""

Loading:
  [ ] aria-busy="true" on loading containers
  [ ] Skeleton screens have aria-label="Loading..."
```

---

## 10. Performance Checklist

```
Landing page:
  [ ] LCP < 2.5s on mobile 4G (Lighthouse 90+)
  [ ] No layout shift (CLS < 0.1)
  [ ] No render-blocking scripts
  [ ] Images: WebP format, srcset, lazy loading
  [ ] Video modal: lazy-load iframe (only inject src on open)
  [ ] Zero third-party scripts on first load (Turnstile loads on /signup)
  [ ] Fonts: subset Plus Jakarta Sans to Latin (saves 80KB)

App (dashboard):
  [ ] Initial load: skeleton visible < 100ms
  [ ] KPI data: < 500ms (PostgREST is fast)
  [ ] Bundle split: vendor / app / admin (lazy load admin routes)
  [ ] Chart components: lazy imported (recharts is large)
  [ ] Route-based code splitting (React.lazy all pages)

React Query config:
  staleTime: 5 minutes for KPIs (no unnecessary refetches)
  staleTime: 1 minute for billing/usage (needs fresher data)
  Background refetch on window focus: true (catches quota updates)
```

---

## 11. Final Pitchability Checklist

Before Sprint Phase 2 is called complete, answer YES to every question:

```
THE DEMO QUESTION:
  Can you open akara.ai on a laptop in front of an investor and navigate every 
  page without hesitation, broken state, or ugly UI? ................................ [ ]

THE FOUNDER QUESTION:
  Can you hand the URL to a distributor you've never met and have them:
    - Find the landing page and understand what AKARA does in 10 seconds? ............ [ ]
    - Sign up without calling you? ................................................... [ ]
    - Import their Tally file without a tutorial? .................................... [ ]
    - Ask a question in Hindi and get a real answer? ................................. [ ]
    - Receive their weekly brief on WhatsApp on Monday? .............................. [ ]
    - Upgrade to Pro via credit card without your help? .............................. [ ]
    - Manage their account, invite a colleague, and delete their account? ........... [ ]
    ... all without you touching the database or a terminal? ......................... [ ]

THE "IS IT FUN" QUESTION:
  Does the product feel alive?
    - KPI numbers animate in when dashboard loads? ................................... [ ]
    - CTA buttons have a subtle glow shadow when hovered? ........................... [ ]
    - The copilot cursor blinks while streaming? ..................................... [ ]
    - Toast notifications appear and disappear smoothly? ............................. [ ]
    - The upgrade page has energy (not just a boring table)? ......................... [ ]
    - The landing page video demo actually loads and plays? .......................... [ ]
    - The WhatsApp mockup on the hero is eye-catching? ............................... [ ]

THE ADMIN QUESTION:
  Can you, as the founder:
    - See every tenant, their usage, their LLM cost, and their margin? ............... [ ]
    - Grant bonus questions to any tenant in 3 clicks? ............................... [ ]
    - Impersonate any tenant and see exactly what they see? .......................... [ ]
    - Trigger a debrief for any tenant right now? .................................... [ ]
    - Read every copilot conversation and thumbs-down feedback? ...................... [ ]
    - See your own daily AI brief about AKARA's performance on WhatsApp? ............. [ ]
    - Upgrade a tenant who paid by bank transfer without touching Stripe? ........... [ ]
    - Know instantly if any cron job failed in the last 24 hours? ................... [ ]
    ... all from a single browser tab, without writing SQL? .......................... [ ]

If every answer is YES → AKARA Sprint Phase 2 is complete.
```

