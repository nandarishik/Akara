# Day 9 Implementation Handoff

## Reproduction Instructions

### Expected state before applying Day 9 changes

Days 1–8 must already be fully implemented as documented in:

- `docs/day1_implementation.md` — monorepo scaffold, Supabase schema, RLS, frontend scaffold
- `docs/day2_implementation.md` — FastAPI core, Pydantic settings, auth middleware, tenant context
- `docs/day3_implementation.md` — LLM manager, SQL guard + executor, Copilot pipeline
- `docs/day4_implementation.md` — KPI service + route, data export route
- `docs/day5_implementation.md` — Railway deploy config, admin tenants route
- `docs/day6_implementation.md` — Vite/React frontend on Vercel, auth context, login page, app shell
- `docs/day7_implementation.md` — Dashboard page (KPIs + charts), admin users route
- `docs/day8_implementation.md` — Copilot chat UI, conversation management, admin logs route

The repository state before Day 9:
- `frontend/src/App.tsx` has placeholder inline components for `/data` (`Data`) and `/settings` (`SettingsPage`) with "coming Day 9" text
- `frontend/src/components/ui/progress.tsx` does NOT exist
- `frontend/src/pages/DataPage.tsx` does NOT exist
- `frontend/src/pages/SettingsPage.tsx` does NOT exist
- `backend/app/services/insights/` directory does NOT exist
- `backend/app/services/email/` directory does NOT exist
- `backend/app/api/routes/admin/reports.py` does NOT exist
- `backend/app/core/config.py` has `gmail_user` and `gmail_app_password` fields (no SendGrid)
- `backend/app/api/routes/admin/users.py` has no preferences endpoint
- `backend/app/main.py` does NOT import or register `admin_reports_router`
- `backend/.env` has `GMAIL_USER` / `GMAIL_APP_PASSWORD` (no SendGrid vars)
- `supabase/functions/daily-morning-brief/` directory does NOT exist

### Overview of Day 9 work

Day 9 implemented two tracks simultaneously:

**Track 1 — Customer-facing pages (2 new pages + 1 UI component):**
- `/data` page with 3 file upload panels for primary sales, secondary sales, and scheme master
- `/settings` page with profile editing, notification preferences, and account details
- `Progress` UI component for upload progress display

**Track 2 — Production-grade morning brief system (6 new files + 3 modified):**
- `InsightsEngine` — computes 3 data-driven actions from actual sales data
- `MorningBriefService` — SendGrid delivery with Jinja2 HTML templates and 3-retry backoff
- HTML email template with AKARA branding, KPI cards, Top 3 actions, CTA
- Admin reports API with dual auth (service key + superadmin JWT)
- Supabase Edge Function for automated daily cron at 7:00 AM IST
- User preferences endpoint for opt-in/opt-out management

### Application order

Apply changes in this exact order:

1. **Backend packages** — `uv add sendgrid jinja2` in `backend/`
2. **`backend/app/core/config.py`** (modify — replace Gmail fields with SendGrid + service key fields)
3. **`backend/.env`** (modify — replace Gmail vars with SendGrid vars)
4. **`backend/app/services/insights/__init__.py`** (create — empty package marker)
5. **`backend/app/services/insights/engine.py`** (create — InsightsEngine)
6. **`backend/app/services/email/__init__.py`** (create — empty package marker)
7. **`backend/app/services/email/templates/morning_brief.html`** (create — HTML email template)
8. **`backend/app/services/email/morning_brief.py`** (create — MorningBriefService)
9. **`backend/app/api/routes/admin/reports.py`** (create — admin reports API)
10. **`backend/app/api/routes/admin/users.py`** (modify — add preferences endpoint)
11. **`backend/app/main.py`** (modify — register admin_reports_router)
12. **`supabase/functions/daily-morning-brief/index.ts`** (create — Edge Function)
13. **`frontend/src/components/ui/progress.tsx`** (create — Progress component)
14. **`frontend/src/pages/DataPage.tsx`** (create — data upload page)
15. **`frontend/src/pages/SettingsPage.tsx`** (create — settings page)
16. **`frontend/src/App.tsx`** (modify — replace placeholder routes)

### Commands after copying the code

**Backend — install new packages:**
```bash
cd akara/backend
uv add sendgrid jinja2
```

**Backend quality gate:**
```bash
cd akara/backend
uv run ruff check .
uv run pytest
# Expected: All checks passed! / 2 passed
```

**Frontend type check:**
```bash
cd akara/frontend
npx tsc --noEmit
# Expected: no output (zero errors)
```

**Apply database migration:**
```sql
-- Run in Supabase SQL editor:
-- akara/migrations/008_user_preferences.sql
```

**Deploy Edge Function:**
```bash
cd akara
supabase functions deploy daily-morning-brief
```

**Schedule cron in Supabase dashboard:**
- Navigate to Edge Functions → daily-morning-brief → Schedule
- Cron: `0 1 * * *` (7:00 AM IST = 01:00 UTC+5:30 = 01:30 UTC)

### Verification steps

1. Open `http://localhost:5173/data` — see 3 upload panels
2. Select a CSV file — progress bar animates during upload, result shows rows imported
3. Open `http://localhost:5173/settings` — see profile card, notification toggle, account details
4. Change display name, click Save — success message appears, Supabase `profiles` row updated
5. Test morning brief trigger:
   ```bash
   curl -X POST http://localhost:8000/admin/reports/morning-brief \
     -H "X-Service-Key: $BACKEND_SERVICE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"tenant_id": "your-uuid", "recipient_email": "test@example.com"}'
   ```

---

## Package Changes

### `backend/pyproject.toml`

**Status:** Modified (packages added by `uv add`)

Two packages were added to `dependencies` on Day 9:

| Package | Version added | Why |
|---|---|---|
| `sendgrid` | `^6.12.5` (resolved at install time) | SendGrid Python SDK for email delivery via REST API |
| `jinja2` | `^3.1.6` (resolved at install time) | HTML template rendering for morning brief emails |

**Install command:**
```bash
cd akara/backend
uv add sendgrid jinja2
```

Additional transitive packages installed automatically:
- `markupsafe==3.0.3` (Jinja2 HTML escaping dependency)
- `python-http-client==3.3.7` (SendGrid HTTP client dependency)
- `werkzeug==3.1.8` (SendGrid internal dependency)

---

## Environment Variables

### `backend/.env`

**Status:** Modified

**Original block replaced:**
```bash
# Email (morning brief)
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

**Replacement block:**
```bash
# SendGrid (production email delivery — morning brief)
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=insights@akara.ai
SENDGRID_FROM_NAME=AKARA Insights

# Service key for Supabase Edge Function → backend auth
# Generate with: openssl rand -hex 32
BACKEND_SERVICE_KEY=
```

**Reason:** Replaced Gmail SMTP credentials (removed from config.py) with production SendGrid API credentials and a service key for authenticating the Edge Function.

### New environment variables introduced on Day 9:

| Variable | Purpose | Required | Default | Used in |
|---|---|---|---|---|
| `SENDGRID_API_KEY` | SendGrid REST API authentication | Optional (falls back gracefully if empty) | `""` | `backend/app/services/email/morning_brief.py` |
| `SENDGRID_FROM_EMAIL` | Sender email address | Optional | `"insights@akara.ai"` | `backend/app/services/email/morning_brief.py` |
| `SENDGRID_FROM_NAME` | Sender display name | Optional | `"AKARA Insights"` | `backend/app/services/email/morning_brief.py` |
| `BACKEND_SERVICE_KEY` | Shared secret for Edge Function → backend auth bypass | Optional | `""` | `backend/app/api/routes/admin/reports.py` |

### Supabase Edge Function secrets (set in dashboard):

| Variable | Purpose |
|---|---|
| `BACKEND_API_URL` | Railway backend URL (e.g. `https://akara-backend.railway.app`) |
| `BACKEND_SERVICE_KEY` | Must match `BACKEND_SERVICE_KEY` in backend `.env` |
| `SUPABASE_URL` | Auto-injected by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected by Supabase |

### Removed environment variables:

| Variable | Reason |
|---|---|
| `GMAIL_USER` | Replaced by SendGrid — Gmail SMTP removed from config |
| `GMAIL_APP_PASSWORD` | Replaced by SendGrid — Gmail SMTP removed from config |

---

## Backend Configuration Changes

# File: `backend/app/core/config.py`

**Status:** Modified

## Purpose

Replace Gmail SMTP credentials (insecure, unreliable at scale) with SendGrid API credentials for production email delivery. Add `backend_service_key` for authenticating the Supabase Edge Function when it calls the backend API.

## Dependencies

**No new imports.** This is a pure configuration change.

## Implementation

### Change: Replace Gmail fields with SendGrid fields

**Original code (lines 24–26):**
```python
    # Email (optional during development)
    gmail_user: str = ""
    gmail_app_password: str = ""
```

**Replacement code:**
```python
    # SendGrid (production email delivery)
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "insights@akara.ai"
    sendgrid_from_name: str = "AKARA Insights"

    # Service key for Edge Function → backend auth bypass
    backend_service_key: str = ""
```

**Reason:** Gmail SMTP requires app passwords, has rate limits, and poor deliverability. SendGrid provides 100 free emails/day with proper deliverability, tracking, and an API. The `backend_service_key` allows the Supabase Edge Function to call the backend without a user JWT.

## Placement

Modify `backend/app/core/config.py`. The change is inside the `Settings` class body. Replace the two Gmail fields (around lines 24–26) with the four new fields shown above. All other fields remain unchanged.

## Explanation

All four new fields have default values (`""`) making them optional. If `SENDGRID_API_KEY` is empty, `MorningBriefService.send_brief()` returns early with a warning rather than raising an exception. This prevents the backend from crashing in development environments where SendGrid is not configured.

## Related Changes

- `backend/app/services/email/morning_brief.py` (reads `settings.sendgrid_api_key`, `settings.sendgrid_from_email`, `settings.sendgrid_from_name`)
- `backend/app/api/routes/admin/reports.py` (reads `settings.backend_service_key`)

---

## Backend Service Layer

# File: `backend/app/services/insights/__init__.py`

**Status:** Created

## Purpose

Empty package marker for the `insights` service module.

## Implementation

```python
```

## Placement

Create as empty file at `backend/app/services/insights/__init__.py`.

---

# File: `backend/app/services/insights/engine.py`

**Status:** Created

## Purpose

Compute Top 3 actionable business insights from live sales data in Supabase. Each insight is quantified with a ₹ revenue impact so the morning brief email can rank them. The engine uses real query logic against `sales_data` and falls back to generic insights when data is unavailable.

## Dependencies

**Internal (already exist from Days 1–4):**
- `app.core.tenant.get_supabase_service_client` (not imported here — client passed in constructor)
- `supabase.Client` (Supabase Python client)
- `sales_data` table (created Day 1)
- `get_outstanding_parties` RPC function (created Day 4)

**External (standard library only — no new installs):**
- `logging`, `dataclasses`, `datetime`, `decimal`, `uuid`

## Implementation

```python
"""InsightsEngine — Compute Top 3 actionable insights from real sales data.

Each insight includes:
- title:          Short headline
- description:    Specific data-driven detail (party names, products, ₹ amounts)
- revenue_impact: Estimated ₹ opportunity/risk (integer, paise-free)
- priority:       "high" | "medium" | "low"
- category:       "collections" | "routes" | "products"

Three insight types computed in order:
1. Inactive routes   — zones with routes having zero orders in the last 3 days
2. Outstanding recovery — parties outstanding > 30 days, ranked by amount
3. Product demand drops — products with >15% WoW revenue decline
"""

import logging
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from supabase import Client

logger = logging.getLogger(__name__)


@dataclass
class Insight:
    title: str
    description: str
    revenue_impact: int  # in rupees (integer)
    priority: str  # "high" | "medium" | "low"
    category: str  # "collections" | "routes" | "products"
    data_points: list[str] = field(default_factory=list)  # bullet-list items for email


def _fmt_inr(amount: int) -> str:
    """Format rupees in Indian lakh/crore notation."""
    if amount >= 10_000_000:
        return f"₹{amount / 10_000_000:.2f} Cr"
    if amount >= 100_000:
        return f"₹{amount / 100_000:.1f}L"
    if amount >= 1_000:
        return f"₹{amount / 1_000:.1f}K"
    return f"₹{amount:,}"


class InsightsEngine:
    """Computes Top 3 actionable insights from live sales data.

    Usage:
        engine = InsightsEngine(supabase_client)
        insights = engine.compute_insights(tenant_id)
    """

    def __init__(self, supabase: Client) -> None:
        self._sb = supabase

    def compute_insights(self, tenant_id: UUID) -> list[Insight]:
        """Return up to 3 insights, ordered by revenue_impact desc."""
        today = date.today()
        insights: list[Insight] = []

        try:
            insight = self._inactive_routes_insight(tenant_id, today)
            if insight:
                insights.append(insight)
        except Exception:
            logger.exception("Failed to compute inactive routes insight")

        try:
            insight = self._outstanding_recovery_insight(tenant_id)
            if insight:
                insights.append(insight)
        except Exception:
            logger.exception("Failed to compute outstanding recovery insight")

        try:
            insight = self._product_demand_drop_insight(tenant_id, today)
            if insight:
                insights.append(insight)
        except Exception:
            logger.exception("Failed to compute product demand drop insight")

        # Sort by revenue impact descending, cap at 3
        insights.sort(key=lambda x: x.revenue_impact, reverse=True)

        # If we have fewer than 3 insights (no data or errors), pad with generic ones
        if len(insights) < 3:
            insights.extend(_generic_insights()[len(insights):3])

        return insights[:3]

    # ------------------------------------------------------------------ #
    #  Insight 1 — Inactive routes                                          #
    # ------------------------------------------------------------------ #

    def _inactive_routes_insight(
        self, tenant_id: UUID, today: date
    ) -> Insight | None:
        """Routes that had zero orders in the past 3 days but were active
        in the prior 7 days. Revenue impact = 3 days × route avg/day."""
        three_days_ago = today - timedelta(days=3)
        ten_days_ago = today - timedelta(days=10)

        # Routes with orders in the past 10 days (baseline active set)
        active_res = (
            self._sb.table("sales_data")
            .select("route, total_amount")
            .eq("tenant_id", str(tenant_id))
            .gte("invoice_date", ten_days_ago.isoformat())
            .lte("invoice_date", (three_days_ago - timedelta(days=1)).isoformat())
            .not_.is_("route", "null")
            .execute()
        )
        active_rows = active_res.data or []
        if not active_rows:
            return None

        # Aggregate revenue per route in baseline period
        route_revenue: dict[str, Decimal] = {}
        for row in active_rows:
            route = row.get("route") or ""
            rev = Decimal(str(row.get("total_amount") or 0))
            route_revenue[route] = route_revenue.get(route, Decimal("0")) + rev

        # Routes with orders in the past 3 days
        recent_res = (
            self._sb.table("sales_data")
            .select("route")
            .eq("tenant_id", str(tenant_id))
            .gte("invoice_date", three_days_ago.isoformat())
            .not_.is_("route", "null")
            .execute()
        )
        recent_routes = {row.get("route") for row in (recent_res.data or [])}

        inactive = {
            r: rev
            for r, rev in route_revenue.items()
            if r not in recent_routes and r
        }

        if not inactive:
            return None

        # Top 5 by revenue for display
        top_inactive = sorted(inactive.items(), key=lambda x: x[1], reverse=True)[:5]
        total_risk = sum(v for _, v in top_inactive)

        # Estimate: 3 missed days × avg daily revenue for these routes
        # baseline_days = 7 (ten_days_ago to three_days_ago)
        baseline_days = 7
        daily_avg = total_risk / baseline_days if baseline_days else total_risk
        revenue_impact = int(daily_avg * 3)

        data_points = [
            f"{route} — {_fmt_inr(int(rev))} in past 7 days, 0 orders last 3 days"
            for route, rev in top_inactive[:3]
        ]

        return Insight(
            title=f"{len(inactive)} route{'s' if len(inactive) != 1 else ''} went silent in the last 3 days",
            description=(
                f"{len(inactive)} route(s) that were active last week have zero orders "
                f"in the past 3 days. Estimated revenue at risk: "
                f"{_fmt_inr(revenue_impact)}."
            ),
            revenue_impact=revenue_impact,
            priority="high" if revenue_impact >= 100_000 else "medium",
            category="routes",
            data_points=data_points,
        )

    # ------------------------------------------------------------------ #
    #  Insight 2 — Outstanding recovery                                     #
    # ------------------------------------------------------------------ #

    def _outstanding_recovery_insight(self, tenant_id: UUID) -> Insight | None:
        """Parties with outstanding > 30 days, sorted by outstanding amount."""
        try:
            result = self._sb.rpc(
                "get_outstanding_parties",
                {"p_tenant_id": str(tenant_id)},
            ).execute()
            rows = result.data or []
            if not isinstance(rows, list):
                rows = []
        except Exception:
            # Fallback: query directly
            result = (
                self._sb.table("sales_data")
                .select("party_name, outstanding_amount, party_zone")
                .eq("tenant_id", str(tenant_id))
                .gt("outstanding_amount", 0)
                .order("outstanding_amount", desc=True)
                .limit(20)
                .execute()
            )
            rows = result.data or []

        if not rows:
            return None

        # Aggregate by party
        party_outstanding: dict[str, Decimal] = {}
        for row in rows:
            party = row.get("party_name") or "Unknown"
            amt = Decimal(str(row.get("outstanding_amount") or 0))
            if amt > 0:
                party_outstanding[party] = (
                    party_outstanding.get(party, Decimal("0")) + amt
                )

        if not party_outstanding:
            return None

        top_parties = sorted(
            party_outstanding.items(), key=lambda x: x[1], reverse=True
        )[:5]
        total_outstanding = sum(v for _, v in top_parties)

        data_points = [
            f"{party} — {_fmt_inr(int(amt))} outstanding"
            for party, amt in top_parties[:3]
        ]

        return Insight(
            title=f"{_fmt_inr(int(total_outstanding))} recoverable today",
            description=(
                f"{len(top_parties)} parties have outstanding amounts totalling "
                f"{_fmt_inr(int(total_outstanding))}. "
                f"Highest: {top_parties[0][0]} at {_fmt_inr(int(top_parties[0][1]))}."
            ),
            revenue_impact=int(total_outstanding),
            priority="high" if total_outstanding >= 200_000 else "medium",
            category="collections",
            data_points=data_points,
        )

    # ------------------------------------------------------------------ #
    #  Insight 3 — Product demand drop                                      #
    # ------------------------------------------------------------------ #

    def _product_demand_drop_insight(
        self, tenant_id: UUID, today: date
    ) -> Insight | None:
        """Products with >15% week-over-week revenue decline."""
        this_week_start = today - timedelta(days=7)
        last_week_start = today - timedelta(days=14)
        last_week_end = today - timedelta(days=8)

        def _week_revenue(start: date, end: date) -> dict[str, Decimal]:
            res = (
                self._sb.table("sales_data")
                .select("product_name, total_amount")
                .eq("tenant_id", str(tenant_id))
                .gte("invoice_date", start.isoformat())
                .lte("invoice_date", end.isoformat())
                .not_.is_("product_name", "null")
                .execute()
            )
            agg: dict[str, Decimal] = {}
            for row in (res.data or []):
                prod = row.get("product_name") or ""
                rev = Decimal(str(row.get("total_amount") or 0))
                agg[prod] = agg.get(prod, Decimal("0")) + rev
            return agg

        this_week = _week_revenue(this_week_start, today)
        last_week = _week_revenue(last_week_start, last_week_end)

        if not last_week:
            return None

        drops: list[tuple[str, Decimal, float]] = []
        for prod, last_rev in last_week.items():
            if last_rev <= 0:
                continue
            this_rev = this_week.get(prod, Decimal("0"))
            pct_change = float((this_rev - last_rev) / last_rev * 100)
            if pct_change < -15:
                drops.append((prod, last_rev, pct_change))

        if not drops:
            return None

        drops.sort(key=lambda x: x[1], reverse=True)
        top_drops = drops[:5]

        # Revenue impact = sum of revenue lost (last week - this week)
        total_impact = sum(
            int(last_rev) - int(this_week.get(prod, Decimal("0")))
            for prod, last_rev, _ in top_drops
        )

        data_points = [
            f"{prod} — {abs(pct):.0f}% drop ({_fmt_inr(int(last_rev))} → {_fmt_inr(int(this_week.get(prod, Decimal('0'))))})"
            for prod, last_rev, pct in top_drops[:3]
        ]

        return Insight(
            title=f"{len(drops)} product{'s' if len(drops) != 1 else ''} dropped >15% this week",
            description=(
                f"{len(drops)} product(s) declined more than 15% week-over-week. "
                f"Largest drop: {top_drops[0][0]} ({abs(top_drops[0][2]):.0f}% decline). "
                f"Total impact: {_fmt_inr(total_impact)}."
            ),
            revenue_impact=max(0, total_impact),
            priority="medium" if total_impact >= 50_000 else "low",
            category="products",
            data_points=data_points,
        )


def _generic_insights() -> list[Insight]:
    """Fallback insights when real data is unavailable."""
    return [
        Insight(
            title="Review your top zone for inactive routes",
            description=(
                "Check if any routes in your highest-revenue zone had zero "
                "orders in the last 3 days. Each missed route day costs "
                "an estimated ₹5K–₹20K in delayed revenue."
            ),
            revenue_impact=15_000,
            priority="medium",
            category="routes",
            data_points=["No live data — connect your sales data to see real insights"],
        ),
        Insight(
            title="Review outstanding collections",
            description=(
                "Check parties with outstanding invoices older than 30 days. "
                "Outstanding balances tied up represent recoverable cash flow."
            ),
            revenue_impact=10_000,
            priority="medium",
            category="collections",
            data_points=["No outstanding data available yet"],
        ),
        Insight(
            title="Ask AKARA about week-over-week product drops",
            description=(
                "Use AKARA Copilot: 'Which products had a drop last week vs "
                "the week before?' to catch demand shifts early."
            ),
            revenue_impact=5_000,
            priority="low",
            category="products",
            data_points=["Use Copilot to generate data-driven insights"],
        ),
    ]
```

## Placement

New file. Create at `backend/app/services/insights/engine.py`.

## Explanation

**`Insight` dataclass:** The return type from all insight computations. `data_points` is a list of human-readable bullet points included verbatim in the email.

**`_fmt_inr(amount)`:** Module-level utility function for Indian number formatting. Used by the engine and imported by `morning_brief.py` for template rendering.

**`InsightsEngine.compute_insights(tenant_id)`:** Entry point. Calls all three private insight methods in a try-except each, sorts by `revenue_impact` descending, pads to 3 with `_generic_insights()` if needed, returns `list[Insight]` of length ≤ 3.

**Insight 1 — `_inactive_routes_insight`:** Finds routes that had orders 3–10 days ago but zero orders in the last 3 days. Revenue impact = 3 × (7-day revenue / 7). Returns `None` if no baseline data.

**Insight 2 — `_outstanding_recovery_insight`:** Calls `get_outstanding_parties` RPC first, falls back to direct `sales_data` query if RPC fails. Returns `None` if no outstanding amounts found.

**Insight 3 — `_product_demand_drop_insight`:** Compares this-week vs last-week revenue per product. Flags products with >15% decline. Revenue impact = sum of lost revenue. Returns `None` if no last-week data.

**`_generic_insights()`:** Module-level fallback function. Returns 3 templated insights with low revenue impact values. Used when real data computation fails or returns no results.

## Related Changes

- `backend/app/services/email/morning_brief.py` (imports `InsightsEngine`, `_fmt_inr`)
- `backend/app/services/insights/__init__.py` (package marker for this module)

---

# File: `backend/app/services/email/__init__.py`

**Status:** Created

## Purpose

Empty package marker for the `email` service module.

## Implementation

```python
```

## Placement

Create as empty file at `backend/app/services/email/__init__.py`.

---

# File: `backend/app/services/email/templates/morning_brief.html`

**Status:** Created

## Purpose

Jinja2 HTML email template for the daily morning brief. Renders a professional, branded email with KPI cards, Top 3 computed actions, a CTA button, and a footer with an unsubscribe link.

## Dependencies

**Template variables (passed by `MorningBriefService`):**
- `brief_date` — formatted date string, e.g. "21 Jul 2026"
- `recipient_name` — display name or email prefix
- `tenant_name` — name of the tenant organization
- `summary` — `BriefSummary` dataclass with `.total_revenue_fmt`, `.total_orders`, `.unique_parties`, `.avg_order_fmt`
- `insights` — list of `InsightContext` dataclasses with `.title`, `.description`, `.revenue_impact_fmt`, `.priority`, `.data_points`
- `dashboard_url` — CTA link target
- `unsubscribe_url` — unsubscribe link URL

**Runtime:**
- `Jinja2` package (installed Day 9)
- Loaded by `MorningBriefService` via `Environment(loader=FileSystemLoader(...))`

## Implementation

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AKARA Daily Brief — {{ brief_date }}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">

  <!-- Preheader (hidden preview text) -->
  <span style="display:none;font-size:1px;color:#f8fafc;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    {{ summary.total_revenue_fmt }} revenue · {{ summary.total_orders }} orders · Top action: {{ insights[0].title if insights else 'Check AKARA dashboard' }}
  </span>

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;padding:24px 0;">
    <tr>
      <td align="center">
        <!-- Email card -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header bar -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#6366f1 100%);padding:28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">AKARA</span>
                    <span style="font-size:13px;color:#c7d2fe;margin-left:8px;font-weight:400;">Daily Brief</span>
                  </td>
                  <td align="right">
                    <span style="font-size:12px;color:#c7d2fe;">{{ brief_date }}</span>
                  </td>
                </tr>
              </table>
              <p style="margin:8px 0 0;font-size:14px;color:#e0e7ff;">
                Good morning, {{ recipient_name }}! Here's your sales snapshot for yesterday.
              </p>
            </td>
          </tr>

          <!-- KPI summary grid -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Revenue -->
                  <td width="25%" style="padding:0 6px 0 0;">
                    <div style="background:#f0f9ff;border-radius:8px;padding:14px 12px;text-align:center;border:1px solid #bae6fd;">
                      <div style="font-size:18px;font-weight:700;color:#0369a1;">{{ summary.total_revenue_fmt }}</div>
                      <div style="font-size:10px;color:#64748b;margin-top:2px;text-transform:uppercase;letter-spacing:0.5px;">Revenue</div>
                    </div>
                  </td>
                  <!-- Orders -->
                  <td width="25%" style="padding:0 6px;">
                    <div style="background:#f0fdf4;border-radius:8px;padding:14px 12px;text-align:center;border:1px solid #bbf7d0;">
                      <div style="font-size:18px;font-weight:700;color:#15803d;">{{ summary.total_orders }}</div>
                      <div style="font-size:10px;color:#64748b;margin-top:2px;text-transform:uppercase;letter-spacing:0.5px;">Orders</div>
                    </div>
                  </td>
                  <!-- Parties -->
                  <td width="25%" style="padding:0 6px;">
                    <div style="background:#fdf4ff;border-radius:8px;padding:14px 12px;text-align:center;border:1px solid #e9d5ff;">
                      <div style="font-size:18px;font-weight:700;color:#7c3aed;">{{ summary.unique_parties }}</div>
                      <div style="font-size:10px;color:#64748b;margin-top:2px;text-transform:uppercase;letter-spacing:0.5px;">Parties</div>
                    </div>
                  </td>
                  <!-- Avg Order -->
                  <td width="25%" style="padding:0 0 0 6px;">
                    <div style="background:#fff7ed;border-radius:8px;padding:14px 12px;text-align:center;border:1px solid #fed7aa;">
                      <div style="font-size:18px;font-weight:700;color:#c2410c;">{{ summary.avg_order_fmt }}</div>
                      <div style="font-size:10px;color:#64748b;margin-top:2px;text-transform:uppercase;letter-spacing:0.5px;">Avg Order</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:20px 32px 0;">
              <div style="border-top:1px solid #e2e8f0;"></div>
            </td>
          </tr>

          <!-- Top 3 Actions section -->
          <tr>
            <td style="padding:20px 32px 0;">
              <h2 style="margin:0 0 4px;font-size:14px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;">
                Today's Top 3 Actions
              </h2>
              <p style="margin:0 0 16px;font-size:12px;color:#94a3b8;">Ranked by ₹ impact — act on these today</p>
            </td>
          </tr>

          {% for insight in insights %}
          <tr>
            <td style="padding:0 32px {{ '16px' if not loop.last else '0' }};">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
                <tr>
                  <!-- Priority indicator bar -->
                  <td width="4" style="background:{{ '#ef4444' if insight.priority == 'high' else ('#f59e0b' if insight.priority == 'medium' else '#22c55e') }};padding:0;">
                    &nbsp;
                  </td>
                  <td style="padding:14px 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td>
                          <!-- Priority badge + rank -->
                          <span style="display:inline-block;font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:{{ '#fef2f2' if insight.priority == 'high' else ('#fffbeb' if insight.priority == 'medium' else '#f0fdf4') }};color:{{ '#dc2626' if insight.priority == 'high' else ('#d97706' if insight.priority == 'medium' else '#16a34a') }};border:1px solid {{ '#fecaca' if insight.priority == 'high' else ('#fde68a' if insight.priority == 'medium' else '#bbf7d0') }};text-transform:uppercase;letter-spacing:0.5px;">
                            {{ '🔴' if insight.priority == 'high' else ('🟡' if insight.priority == 'medium' else '🟢') }} {{ insight.priority }}
                          </span>
                          <span style="font-size:10px;color:#94a3b8;margin-left:8px;">Action {{ loop.index }}</span>
                        </td>
                        <td align="right">
                          <span style="font-size:11px;font-weight:600;color:#4f46e5;">{{ insight.revenue_impact_fmt }}</span>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding-top:6px;">
                          <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#0f172a;">{{ insight.title }}</p>
                          <p style="margin:0;font-size:13px;color:#475569;line-height:1.5;">{{ insight.description }}</p>
                        </td>
                      </tr>
                      {% if insight.data_points %}
                      <tr>
                        <td colspan="2" style="padding-top:8px;">
                          {% for point in insight.data_points %}
                          <div style="font-size:11px;color:#64748b;padding:2px 0;padding-left:12px;position:relative;">
                            <span style="position:absolute;left:0;color:#94a3b8;">›</span>
                            {{ point }}
                          </div>
                          {% endfor %}
                        </td>
                      </tr>
                      {% endif %}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          {% endfor %}

          <!-- CTA Button -->
          <tr>
            <td style="padding:24px 32px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#4f46e5;border-radius:8px;">
                    <a href="{{ dashboard_url }}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
                      Open AKARA Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:12px 0 0;font-size:11px;color:#94a3b8;">
                Or ask the Copilot directly from your dashboard for deeper analysis.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <div style="border-top:1px solid #e2e8f0;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
                      You're receiving this because you're an admin of <strong style="color:#64748b;">{{ tenant_name }}</strong> on AKARA.<br/>
                      Data is for yesterday ({{ brief_date }}) · Generated at 7:00 AM IST
                    </p>
                  </td>
                  <td align="right">
                    <a href="{{ unsubscribe_url }}" style="font-size:11px;color:#94a3b8;text-decoration:none;">
                      Unsubscribe
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- End email card -->

        <!-- Sub-footer -->
        <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;text-align:center;">
          AKARA · AI-powered analytics for FMCG distributors
        </p>

      </td>
    </tr>
  </table>

</body>
</html>
```

## Placement

New file. Create at `backend/app/services/email/templates/morning_brief.html`. The `templates/` subdirectory must also be created.

## Explanation

- **Preheader span:** Hidden text that appears in email client preview/snippet. Shows revenue + top action headline.
- **Header bar:** Indigo gradient with AKARA branding, date, and personalized greeting.
- **KPI grid:** 4 cards side-by-side — Revenue (blue), Orders (green), Parties (purple), Avg Order (orange). All use inline CSS for email client compatibility.
- **Top 3 actions loop:** `{% for insight in insights %}` iterates `InsightContext` objects. Each card has a 4px left border color-coded by priority (red/amber/green), a priority badge, revenue impact, title, description, and data points.
- **CTA button:** Table-based layout (not CSS `display:block` button) for Outlook compatibility.
- **Footer:** Tenant attribution, unsubscribe link. Unsubscribe URL is `{dashboard_url}/settings?unsubscribe=morning-brief`.

## Related Changes

- `backend/app/services/email/morning_brief.py` (loads and renders this template via `Jinja2`)

---

# File: `backend/app/services/email/morning_brief.py`

**Status:** Created

## Purpose

Production-grade email service for the daily morning brief. Orchestrates: KPI data fetching → insights computation → HTML rendering → SendGrid delivery with 3-retry exponential backoff. All failures are gracefully handled and logged to Sentry.

## Dependencies

**Internal (Day 9):**
- `app.services.insights.engine.InsightsEngine` (compute insights)
- `app.services.insights.engine._fmt_inr` (format ₹ amounts)
- `app.services.email.templates/morning_brief.html` (Jinja2 template)

**Internal (already exist from Days 1–4):**
- `app.core.config.settings` (SendGrid credentials)
- `app.services.kpi.service.KPIService` (fetch KPI summary)

**External (installed Day 9):**
- `sendgrid.SendGridAPIClient` (send email)
- `sendgrid.helpers.mail.Mail`, `Content`, `From`, `Subject`, `To` (email construction)
- `jinja2.Environment`, `FileSystemLoader`, `select_autoescape` (template rendering)

**External (already installed):**
- `sentry_sdk` (exception capture)

## Implementation

```python
"""Production-grade Morning Brief email service.

Sends a daily HTML email to opted-in admin users with:
- Yesterday's KPI summary (revenue, orders, parties, avg order)
- Top 3 data-driven actions ranked by ₹ impact
- HTML template rendered with Jinja2
- Delivery via SendGrid with 3-retry exponential backoff
- Failures logged to Sentry and structured logs
"""

import logging
import time
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from uuid import UUID

import sentry_sdk
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import (
    Content,
    From,
    Mail,
    Subject,
    To,
)
from supabase import Client

from app.core.config import settings
from app.services.insights.engine import InsightsEngine, _fmt_inr
from app.services.kpi.service import KPIService

logger = logging.getLogger(__name__)

_TEMPLATE_DIR = Path(__file__).parent / "templates"
_DASHBOARD_URL = "https://app.akara.ai"
_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 1.5  # seconds


@dataclass
class BriefSummary:
    """KPI snapshot formatted for email template rendering."""

    total_revenue_fmt: str
    total_orders: int
    unique_parties: int
    avg_order_fmt: str


@dataclass
class InsightContext:
    """Insight formatted for Jinja2 template rendering."""

    title: str
    description: str
    revenue_impact_fmt: str
    priority: str
    data_points: list[str]


@dataclass
class BriefResult:
    success: bool
    message: str
    insights_count: int = 0
    recipient_email: str = ""


class MorningBriefService:
    """Send a production-grade daily brief email via SendGrid.

    Usage:
        service = MorningBriefService(supabase_client)
        result = service.send_brief(tenant_id, "user@example.com")
    """

    def __init__(self, supabase: Client) -> None:
        self._sb = supabase
        self._jinja = Environment(
            loader=FileSystemLoader(str(_TEMPLATE_DIR)),
            autoescape=select_autoescape(["html"]),
        )

    def send_brief(
        self,
        tenant_id: UUID,
        recipient_email: str,
        recipient_name: str = "",
        tenant_name: str = "Your Tenant",
    ) -> BriefResult:
        """Compute insights, render HTML, and send via SendGrid.

        Retries up to 3 times with exponential backoff.
        Returns BriefResult indicating success or failure.
        """
        if not settings.sendgrid_api_key:
            logger.warning("SENDGRID_API_KEY not configured — skipping email send")
            return BriefResult(
                success=False,
                message="SendGrid API key not configured",
                recipient_email=recipient_email,
            )

        # ---- 1. Fetch KPI summary for yesterday ----
        today = date.today()
        yesterday = today - timedelta(days=1)

        try:
            kpi_service = KPIService(supabase=self._sb)
            summary_raw = kpi_service.get_summary(
                tenant_id=tenant_id,
                start_date=yesterday.isoformat(),
                end_date=yesterday.isoformat(),
            )
            summary = BriefSummary(
                total_revenue_fmt=_fmt_inr(int(summary_raw.total_revenue)),
                total_orders=summary_raw.total_orders,
                unique_parties=summary_raw.unique_parties,
                avg_order_fmt=_fmt_inr(int(summary_raw.avg_order_value)),
            )
        except Exception as exc:
            logger.exception("Failed to fetch KPI summary for brief")
            sentry_sdk.capture_exception(exc)
            summary = BriefSummary(
                total_revenue_fmt="₹—",
                total_orders=0,
                unique_parties=0,
                avg_order_fmt="₹—",
            )

        # ---- 2. Compute insights ----
        try:
            engine = InsightsEngine(supabase=self._sb)
            raw_insights = engine.compute_insights(tenant_id)
        except Exception as exc:
            logger.exception("Failed to compute insights for brief")
            sentry_sdk.capture_exception(exc)
            raw_insights = []

        insight_contexts = [
            InsightContext(
                title=ins.title,
                description=ins.description,
                revenue_impact_fmt=_fmt_inr(ins.revenue_impact),
                priority=ins.priority,
                data_points=ins.data_points,
            )
            for ins in raw_insights
        ]

        # ---- 3. Render HTML template ----
        try:
            template = self._jinja.get_template("morning_brief.html")
            html_body = template.render(
                brief_date=yesterday.strftime("%-d %b %Y"),
                recipient_name=recipient_name or recipient_email.split("@")[0].title(),
                tenant_name=tenant_name,
                summary=summary,
                insights=insight_contexts,
                dashboard_url=_DASHBOARD_URL,
                unsubscribe_url=f"{_DASHBOARD_URL}/settings?unsubscribe=morning-brief",
            )
        except Exception as exc:
            logger.exception("Failed to render morning brief template")
            sentry_sdk.capture_exception(exc)
            return BriefResult(
                success=False,
                message=f"Template render failed: {exc}",
                recipient_email=recipient_email,
            )

        # ---- 4. Build SendGrid message ----
        subject_str = f"AKARA Daily Brief — {yesterday.strftime('%-d %b %Y')}"

        mail = Mail()
        mail.from_email = From(
            email=settings.sendgrid_from_email,
            name=settings.sendgrid_from_name,
        )
        mail.to = To(email=recipient_email)
        mail.subject = Subject(subject_str)
        mail.content = [Content("text/html", html_body)]
        mail.tracking_settings = {
            "click_tracking": {"enable": True},
            "open_tracking": {"enable": True},
        }

        # ---- 5. Send with retry ----
        last_error: Exception | None = None
        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                sg = SendGridAPIClient(settings.sendgrid_api_key)
                response = sg.send(mail)
                status_code = response.status_code

                if 200 <= status_code < 300:
                    logger.info(
                        "Morning brief sent to %s (tenant=%s, status=%d)",
                        recipient_email,
                        tenant_id,
                        status_code,
                    )
                    return BriefResult(
                        success=True,
                        message=f"Sent (HTTP {status_code})",
                        insights_count=len(raw_insights),
                        recipient_email=recipient_email,
                    )
                if status_code == 429:
                    # Rate limited — back off longer
                    delay = _RETRY_BASE_DELAY * (3**attempt)
                    logger.warning(
                        "SendGrid rate limit (429) on attempt %d, waiting %.1fs",
                        attempt,
                        delay,
                    )
                    time.sleep(delay)
                else:
                    logger.error(
                        "SendGrid returned %d on attempt %d",
                        status_code,
                        attempt,
                    )
                    last_error = Exception(f"SendGrid HTTP {status_code}")

            except Exception as exc:
                last_error = exc
                if attempt < _MAX_RETRIES:
                    delay = _RETRY_BASE_DELAY * (2 ** (attempt - 1))
                    logger.warning(
                        "SendGrid attempt %d failed: %s — retrying in %.1fs",
                        attempt,
                        exc,
                        delay,
                    )
                    time.sleep(delay)
                else:
                    logger.exception(
                        "All %d SendGrid attempts failed for %s",
                        _MAX_RETRIES,
                        recipient_email,
                    )
                    sentry_sdk.capture_exception(exc)

        return BriefResult(
            success=False,
            message=f"Failed after {_MAX_RETRIES} attempts: {last_error}",
            insights_count=len(raw_insights),
            recipient_email=recipient_email,
        )
```

## Placement

New file. Create at `backend/app/services/email/morning_brief.py`.

## Explanation

**Dataclasses:**
- `BriefSummary`: Pre-formatted KPI strings for template injection (no formatting logic in template)
- `InsightContext`: Template-ready insight (pre-formatted `revenue_impact_fmt`)
- `BriefResult`: Return value from `send_brief()`. Used as FastAPI response model in `reports.py`

**`send_brief()` flow:**
1. Early return if no API key configured
2. Fetch yesterday's KPIs via `KPIService.get_summary()` — falls back to `"₹—"` values on error
3. Compute insights via `InsightsEngine.compute_insights()` — falls back to `[]` on error
4. Render Jinja2 HTML template — returns failure `BriefResult` on template error
5. Build `Mail` object with from/to/subject/HTML content + tracking settings enabled
6. Retry loop: 3 attempts. Rate limits (429) use 3× backoff; network errors use 2× backoff. All final failures captured by Sentry.

**Module constants:**
- `_TEMPLATE_DIR`: Computed as `Path(__file__).parent / "templates"` — resolves correctly after deployment to Railway
- `_DASHBOARD_URL`: `"https://app.akara.ai"` — hardcoded for now, update when domain is live
- `_MAX_RETRIES`: 3
- `_RETRY_BASE_DELAY`: 1.5 seconds

## Related Changes

- `backend/app/api/routes/admin/reports.py` (calls `MorningBriefService.send_brief()`, uses `BriefResult` as response model)
- `backend/app/services/email/templates/morning_brief.html` (loaded by Jinja2 in constructor)
- `backend/app/services/insights/engine.py` (called internally)

---

## Backend API Changes

# File: `backend/app/api/routes/admin/reports.py`

**Status:** Created

## Purpose

REST API endpoint for triggering the morning brief. Accepts requests from either the Supabase Edge Function (via `X-Service-Key` header) or a superadmin (via JWT). Fetches the tenant name if not provided, delegates to `MorningBriefService`, and returns `BriefResult`.

## Dependencies

**Internal (Day 9):**
- `app.services.email.morning_brief.MorningBriefService` (email orchestration)
- `app.services.email.morning_brief.BriefResult` (response model)

**Internal (already exist from Days 2–5):**
- `app.core.config.settings` (reads `backend_service_key`, `jwt_secret`, `jwt_algorithm`)
- `app.core.tenant.get_supabase_service_client` (Supabase admin client)

**External (already installed):**
- `fastapi.APIRouter`, `Header`, `HTTPException`, `Request`, `status`
- `pydantic.BaseModel`
- `jose.jwt` (python-jose, already in pyproject.toml from Day 2)

**Database (Day 1):**
- `tenants` table (reads `name` column)
- `profiles` table (reads `role` column for superadmin check)

## Implementation

```python
"""Admin Reports API — manual trigger for morning brief.

Endpoints:
  POST /admin/reports/morning-brief
    - Accepts X-Service-Key header (for Supabase Edge Function cron), OR
    - Accepts a valid superadmin JWT (Authorization: Bearer ...).
    - Computes insights, renders HTML, sends via SendGrid.
    - Returns BriefResult.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.tenant import get_supabase_service_client
from app.services.email.morning_brief import BriefResult, MorningBriefService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/reports", tags=["admin"])


class BriefRequest(BaseModel):
    tenant_id: UUID
    recipient_email: str
    recipient_name: str = ""
    tenant_name: str = "AKARA Tenant"


def _authorize(x_service_key: str | None, request: Request) -> None:
    """Allow access if service key matches OR if the caller is a superadmin.

    Raises HTTPException 401/403 if neither condition is satisfied.
    """
    # 1. Service key path (used by Supabase Edge Function)
    if (
        settings.backend_service_key
        and x_service_key == settings.backend_service_key
    ):
        return

    # 2. JWT path — verify superadmin role
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Provide X-Service-Key header or Authorization: Bearer <superadmin-jwt>",
        )

    token = auth_header.split(" ", 1)[1]
    supabase = get_supabase_service_client()

    try:
        import jose.jwt as jwt  # python-jose already installed

        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        profile = (
            supabase.table("profiles")
            .select("role")
            .eq("id", user_id)
            .single()
            .execute()
        )
        if not profile.data or profile.data.get("role") != "superadmin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Superadmin role required",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {exc}",
        ) from exc


@router.post("/morning-brief", response_model=BriefResult)
def trigger_morning_brief(
    body: BriefRequest,
    request: Request,
    x_service_key: str | None = Header(default=None),
) -> BriefResult:
    """Trigger a morning brief email for a specific tenant/recipient.

    Authorization (either of):
    - X-Service-Key header (used by Supabase Edge Function cron)
    - Valid superadmin JWT (used for manual admin console testing)
    """
    _authorize(x_service_key, request)

    supabase = get_supabase_service_client()

    # Fetch tenant name if not provided
    tenant_name = body.tenant_name
    if tenant_name == "AKARA Tenant":
        try:
            t_res = (
                supabase.table("tenants")
                .select("name")
                .eq("id", str(body.tenant_id))
                .single()
                .execute()
            )
            if t_res.data:
                tenant_name = t_res.data.get("name", tenant_name)
        except Exception:
            pass

    service = MorningBriefService(supabase=supabase)
    result = service.send_brief(
        tenant_id=body.tenant_id,
        recipient_email=body.recipient_email,
        recipient_name=body.recipient_name,
        tenant_name=tenant_name,
    )

    if not result.success:
        logger.error(
            "Morning brief failed for %s (tenant %s): %s",
            body.recipient_email,
            body.tenant_id,
            result.message,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.message,
        )

    return result
```

## Placement

New file. Create at `backend/app/api/routes/admin/reports.py`.

## Explanation

**`BriefRequest` model:**
- `tenant_id`: UUID of the tenant to generate the brief for
- `recipient_email`: Email address to send to
- `recipient_name`: Optional display name (used in "Good morning, {name}!")
- `tenant_name`: Organization name shown in the footer. Defaults to `"AKARA Tenant"` which triggers an auto-lookup from the `tenants` table.

**`_authorize()` helper:**
- First checks `X-Service-Key` header against `settings.backend_service_key`. This is used by the Supabase Edge Function which cannot carry a user JWT.
- If no service key, falls through to JWT validation. Decodes the bearer token with python-jose, extracts `sub` (user UUID), checks `profiles.role == "superadmin"`.
- Re-raises `HTTPException` directly (not wrapped); all other exceptions become 401.

**`trigger_morning_brief()` endpoint:**
- `Request` parameter gives access to raw headers for the JWT path in `_authorize`.
- `x_service_key` is the parsed `X-Service-Key` header (FastAPI auto-converts header name to snake_case).
- Tenant name lookup is wrapped in try-except — failure uses the default name.
- On `result.success == False`, raises 500 with `result.message` as detail so the caller knows why it failed.

**Important note:** `BriefResult` is a Python `@dataclass`, not a Pydantic model. FastAPI can serialize it as a response model when `response_model=BriefResult` is set, as long as all fields are JSON-serializable primitives.

## Related Changes

- `backend/app/main.py` (registers this router)
- `backend/app/services/email/morning_brief.py` (called by this endpoint)
- `supabase/functions/daily-morning-brief/index.ts` (calls this endpoint via HTTP)

---

# File: `backend/app/api/routes/admin/users.py`

**Status:** Modified

## Purpose

Add a `PATCH /admin/users/{user_id}/preferences` endpoint allowing users to update their own notification preferences (specifically `morning_brief_enabled`). This enables the Settings page toggle to persist opt-in/out to Supabase.

## Dependencies

**All existing imports and dependencies from Day 7 remain unchanged.**

No new imports needed.

## Implementation

### Change 1: Add `UserPreferencesUpdate` Pydantic model

**Location:** After the existing `UserRoleUpdate` class definition (after line 21)

**Code to add:**
```python
class UserPreferencesUpdate(BaseModel):
    morning_brief_enabled: bool | None = None
```

### Change 2: Add `update_user_preferences` endpoint

**Location:** After the existing `update_user_role` function (append to end of file)

**Code to add:**
```python
@router.patch("/{user_id}/preferences", response_model=UserOut)
def update_user_preferences(
    user_id: UUID,
    body: UserPreferencesUpdate,
    user: CurrentUser,
) -> UserOut:
    """Update notification preferences for the authenticated user (self only).

    Only the user themselves can update their own preferences.
    """
    # Users can only update their own preferences
    if str(user.user_id) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own preferences",
        )

    supabase = get_supabase_service_client()

    # Fetch current preferences
    current = (
        supabase.table("profiles")
        .select("preferences")
        .eq("id", str(user_id))
        .single()
        .execute()
    )
    if not current.data:
        raise HTTPException(status_code=404, detail="User not found")

    existing_prefs: dict = current.data.get("preferences") or {}

    # Merge new values
    if body.morning_brief_enabled is not None:
        existing_prefs["morning_brief_enabled"] = body.morning_brief_enabled

    result = (
        supabase.table("profiles")
        .update({"preferences": existing_prefs})
        .eq("id", str(user_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut(**result.data[0])
```

## Placement

Modify `backend/app/api/routes/admin/users.py`.

1. Insert `UserPreferencesUpdate` class after `UserRoleUpdate` (after line 22 in the pre-Day-9 version)
2. Append `update_user_preferences()` function at the end of the file

## Explanation

**`UserPreferencesUpdate`:** Uses `bool | None = None` so the caller can omit a field and it won't be overwritten. Supports future additions (additional preferences can be added here).

**`update_user_preferences()`:**
- Self-only constraint: Checks `user.user_id == user_id` — users cannot modify other users' preferences.
- Merge strategy: Fetches existing `preferences` JSONB, merges only non-None fields from request, then writes back. This is a patch operation (not a replace).
- Returns `UserOut` — same as other endpoints in this file for consistency.
- Note: Does NOT require superadmin — any authenticated user can update their own preferences.

## Related Changes

- `frontend/src/pages/SettingsPage.tsx` (calls `PATCH /admin/users/{user_id}/preferences`)
- `supabase/functions/daily-morning-brief/index.ts` (reads `preferences.morning_brief_enabled` to determine opt-in status)
- `akara/migrations/008_user_preferences.sql` (adds `preferences` column to `profiles` table)

---

# File: `backend/app/main.py`

**Status:** Modified

## Purpose

Register the new `admin_reports_router` so that `POST /admin/reports/morning-brief` is reachable.

## Implementation

### Change 1: Import admin_reports_router

**Original code (lines 13–15):**
```python
from app.api.routes.admin import logs as admin_logs_router
from app.api.routes.admin import tenants as admin_tenants_router
from app.api.routes.admin import users as admin_users_router
```

**Replacement code:**
```python
from app.api.routes.admin import logs as admin_logs_router
from app.api.routes.admin import reports as admin_reports_router
from app.api.routes.admin import tenants as admin_tenants_router
from app.api.routes.admin import users as admin_users_router
```

### Change 2: Register the router

**Original code (lines 50–51):**
```python
app.include_router(admin_users_router.router)
app.include_router(admin_logs_router.router)
```

**Replacement code:**
```python
app.include_router(admin_users_router.router)
app.include_router(admin_logs_router.router)
app.include_router(admin_reports_router.router)
```

## Placement

Modify `backend/app/main.py`.

1. Add one import line (alphabetically, between `logs` and `tenants` imports)
2. Add one `app.include_router()` call at the end of the registration block

## Related Changes

- `backend/app/api/routes/admin/reports.py` (defines `admin_reports_router`)

---

## Supabase Infrastructure

# File: `supabase/functions/daily-morning-brief/index.ts`

**Status:** Created

## Purpose

Supabase Deno Edge Function that runs automatically at 7:00 AM IST every day. Iterates all active tenants, finds opted-in admin users, calls the backend API for each, logs results to `audit_log`. Rate-limited to 90 emails/run to stay within SendGrid free tier (100/day).

## Dependencies

**External (Deno ESM imports):**
- `https://esm.sh/@supabase/supabase-js@2` (Supabase client in Deno environment)

**Environment variables (injected by Supabase or set as secrets):**
- `BACKEND_API_URL` — backend Railway URL
- `BACKEND_SERVICE_KEY` — shared secret for auth bypass
- `SUPABASE_URL` — auto-injected
- `SUPABASE_SERVICE_ROLE_KEY` — auto-injected

**Database tables (Day 1):**
- `tenants` (reads `id`, `name`, `is_active`)
- `profiles` (reads `id`, `tenant_id`, `role`, `display_name`, `preferences`)
- `audit_log` (inserts run summary)
- `auth.users` (reads `email` via `supabase.auth.admin.getUserById`)

**Backend API (Day 9):**
- `POST /admin/reports/morning-brief`

## Implementation

```typescript
/**
 * Supabase Edge Function: daily-morning-brief
 *
 * Schedule: 0 1 * * *  →  7:00 AM IST (01:30 UTC)
 *
 * Logic:
 *   1. Fetch all active tenants
 *   2. For each tenant, fetch admin users opted-in to morning brief
 *   3. Call backend API: POST /admin/reports/morning-brief for each recipient
 *   4. Log success/failure to audit_log
 *
 * Environment variables (set in Supabase dashboard → Edge Functions → Secrets):
 *   BACKEND_API_URL     — https://your-railway-app.railway.app
 *   BACKEND_SERVICE_KEY — strong random key matching backend BACKEND_SERVICE_KEY
 *   SUPABASE_URL        — auto-injected by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BACKEND_API_URL = Deno.env.get("BACKEND_API_URL") ?? "";
const BACKEND_SERVICE_KEY = Deno.env.get("BACKEND_SERVICE_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// SendGrid free tier: 100 emails/day — add safety margin
const MAX_EMAILS_PER_RUN = 90;

interface Tenant {
  id: string;
  name: string;
  is_active: boolean;
}

interface UserProfile {
  id: string;
  tenant_id: string;
  role: string;
  display_name: string | null;
  preferences: Record<string, unknown> | null;
}

interface AuthUser {
  id: string;
  email: string;
}

interface BriefResult {
  success: boolean;
  message: string;
  insights_count?: number;
  recipient_email?: string;
}

Deno.serve(async (_req: Request) => {
  const runStart = new Date();
  const results: Array<{
    tenant_id: string;
    email: string;
    success: boolean;
    message: string;
  }> = [];

  let emailsSent = 0;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ---- 1. Fetch all active tenants ----
    const { data: tenants, error: tenantsError } = await supabase
      .from("tenants")
      .select("id, name, is_active")
      .eq("is_active", true);

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
    }

    console.log(`Processing ${tenants?.length ?? 0} active tenants`);

    for (const tenant of (tenants as Tenant[]) ?? []) {
      if (emailsSent >= MAX_EMAILS_PER_RUN) {
        console.warn(`Email quota reached (${MAX_EMAILS_PER_RUN}), stopping`);
        break;
      }

      // ---- 2. Fetch opted-in admin profiles for this tenant ----
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, tenant_id, role, display_name, preferences")
        .eq("tenant_id", tenant.id)
        .eq("role", "admin");

      if (profilesError) {
        console.error(`Failed to fetch profiles for tenant ${tenant.id}: ${profilesError.message}`);
        continue;
      }

      const adminProfiles = (profiles as UserProfile[]) ?? [];

      for (const profile of adminProfiles) {
        if (emailsSent >= MAX_EMAILS_PER_RUN) break;

        // Check opt-in preference (defaults to true if not set)
        const prefs = profile.preferences ?? {};
        const opted_in = prefs["morning_brief_enabled"] !== false;
        if (!opted_in) {
          console.log(`User ${profile.id} has opted out of morning brief`);
          continue;
        }

        // Get email from Supabase Auth
        const { data: authUser, error: authError } = await supabase.auth.admin
          .getUserById(profile.id);

        if (authError || !authUser?.user?.email) {
          console.error(`Failed to get email for user ${profile.id}`);
          continue;
        }

        const recipientEmail = authUser.user.email;

        // ---- 3. Call backend API ----
        try {
          const response = await fetch(
            `${BACKEND_API_URL}/admin/reports/morning-brief`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Service-Key": BACKEND_SERVICE_KEY,
              },
              body: JSON.stringify({
                tenant_id: tenant.id,
                recipient_email: recipientEmail,
                recipient_name: profile.display_name ?? "",
                tenant_name: tenant.name,
              }),
              signal: AbortSignal.timeout(30_000), // 30s timeout per request
            }
          );

          const result: BriefResult = await response.json();
          emailsSent++;

          results.push({
            tenant_id: tenant.id,
            email: recipientEmail,
            success: result.success,
            message: result.message,
          });

          if (!result.success) {
            console.error(
              `Brief failed for ${recipientEmail} (tenant ${tenant.id}): ${result.message}`
            );
          } else {
            console.log(
              `Brief sent to ${recipientEmail} (tenant ${tenant.id}) — ${result.insights_count} insights`
            );
          }
        } catch (fetchError) {
          const errMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
          console.error(`Backend call failed for ${recipientEmail}: ${errMsg}`);
          results.push({
            tenant_id: tenant.id,
            email: recipientEmail,
            success: false,
            message: errMsg,
          });
        }

        // Small delay between sends to avoid rate-limiting
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    // ---- 4. Log execution to audit_log ----
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    await supabase.from("audit_log").insert({
      action: "morning_brief_run",
      resource_type: "email",
      details: {
        run_at: runStart.toISOString(),
        emails_sent: successCount,
        emails_failed: failCount,
        total_tenants: tenants?.length ?? 0,
        results: results.slice(0, 50), // cap to avoid large payloads
      },
    });

    const summary = {
      run_at: runStart.toISOString(),
      emails_sent: successCount,
      emails_failed: failCount,
      total_tenants: tenants?.length ?? 0,
    };

    console.log("Morning brief run complete:", summary);

    return new Response(JSON.stringify(summary), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Morning brief run failed:", errMsg);

    return new Response(
      JSON.stringify({ error: errMsg, run_at: runStart.toISOString() }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});
```

## Placement

New file. Create at `supabase/functions/daily-morning-brief/index.ts`. The `supabase/functions/daily-morning-brief/` directory must be created.

## Explanation

**Opt-in check:** `prefs["morning_brief_enabled"] !== false` — defaults to opted-in (truthy) if the `preferences` field is null or the key is missing. Only an explicit `false` opts out.

**Email lookup:** Uses `supabase.auth.admin.getUserById(profile.id)` to get the email address from Supabase Auth (not stored in `profiles`).

**30s timeout:** Each backend call uses `AbortSignal.timeout(30_000)` to prevent a single slow request from blocking the run.

**200ms delay:** Added between each backend call to avoid overwhelming the backend and to spread SendGrid API calls.

**Rate limit:** `MAX_EMAILS_PER_RUN = 90` provides a 10-email buffer below SendGrid's 100/day free limit. The outer loop breaks when this is reached.

**`audit_log` entry:** Stores a run summary with counts and per-recipient results (capped at 50 entries). Allows superadmins to verify execution via `GET /admin/logs`.

**Deployment command:**
```bash
supabase functions deploy daily-morning-brief
```

**Cron schedule** (set in Supabase dashboard → Edge Functions → Schedule):
```
0 1 * * *
```
(01:00 UTC = 6:30 AM IST; adjust to `30 1 * * *` for exactly 7:00 AM IST = 01:30 UTC)

## Related Changes

- `backend/app/api/routes/admin/reports.py` (the HTTP endpoint called by this function)

---

## Frontend Changes

# File: `frontend/src/components/ui/progress.tsx`

**Status:** Created

## Purpose

A shadcn/ui-pattern progress bar component used on the Data Management page to show file upload progress. Created manually (no `@radix-ui/react-progress` package needed).

## Dependencies

**Internal (Day 6):**
- `@/lib/utils` — `cn()` utility for className merging

**External (React):**
- `react` — `forwardRef`, `HTMLAttributes`

## Implementation

```typescript
import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-slate-100",
          className
        )}
        {...props}
      >
        <div
          className="h-full w-full flex-1 bg-indigo-600 transition-all duration-300 ease-in-out"
          style={{ transform: `translateX(-${100 - Math.min(100, Math.max(0, value))}%)` }}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
```

## Placement

New file. Create at `frontend/src/components/ui/progress.tsx`.

## Explanation

- Container: `h-2`, full-width, `rounded-full`, light gray background
- Fill bar: Indigo, starts at 0% (fully translated left) and moves to 100%
- Animation: `transition-all duration-300 ease-in-out` for smooth progress updates
- `value` is clamped to `[0, 100]` via `Math.min(100, Math.max(0, value))`
- CSS `translateX(-N%)` technique: The fill bar is always full-width but translated left by `(100 - value)%`
- `forwardRef` support for imperative control

## Related Changes

- `frontend/src/pages/DataPage.tsx` (uses `<Progress value={progress} className="h-2" />`)

---

# File: `frontend/src/pages/DataPage.tsx`

**Status:** Created

## Purpose

The `/data` page allowing admin users to import sales data files into Supabase. Contains 3 independent upload panels (Primary Sales, Secondary Sales, Scheme Master) each with file selection, simulated progress animation, result display, and expected column reference.

## Dependencies

**Internal (Day 6+):**
- `@/contexts/AuthContext` — `useAuth()` for role check
- `@/components/ui/button` — `Button`
- `@/components/ui/card` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
- `@/components/ui/progress` — `Progress` (created Day 9)
- `@/lib/supabase` — auth token retrieval

**External:**
- `react` — `useState`, `useRef`
- `lucide-react` — `Upload`, `CheckCircle`, `AlertCircle`, `FileText`

**Backend API (Day 4):**
- `POST /data/import?source_type=primary|secondary|scheme`

**Environment:**
- `VITE_API_BASE_URL` (already configured from Day 6)

## Implementation

```typescript
import { useState, useRef } from "react";
import { Upload, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";

interface ImportResult {
  rows_inserted: number;
  rows_skipped: number;
  errors: string[];
  warnings: string[];
}

type SourceType = "primary" | "secondary" | "scheme";

const BASE = import.meta.env.VITE_API_BASE_URL as string;

async function uploadFile(
  file: File,
  sourceType: SourceType,
  onProgress: (p: number) => void
): Promise<ImportResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const formData = new FormData();
  formData.append("file", file);

  // Simulate animated progress since fetch doesn't expose upload progress
  let simulatedProgress = 0;
  const progressInterval = setInterval(() => {
    simulatedProgress = Math.min(85, simulatedProgress + Math.random() * 12 + 3);
    onProgress(Math.round(simulatedProgress));
  }, 200);

  try {
    const res = await fetch(`${BASE}/data/import?source_type=${sourceType}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    clearInterval(progressInterval);
    onProgress(100);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Upload failed: ${res.status}`);
    }

    return res.json();
  } catch (err) {
    clearInterval(progressInterval);
    throw err;
  }
}

interface UploadPanelProps {
  title: string;
  description: string;
  columns: string[];
  sourceType: SourceType;
  isAdmin: boolean;
  accentColor?: "slate" | "blue" | "purple";
}

function UploadPanel({
  title,
  description,
  columns,
  sourceType,
  isAdmin,
  accentColor = "slate",
}: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const borderColorClass = {
    slate: "border-slate-200",
    blue: "border-blue-200",
    purple: "border-purple-200",
  }[accentColor];

  const headerBgClass = {
    slate: "",
    blue: "bg-blue-50/40",
    purple: "bg-purple-50/40",
  }[accentColor];

  async function handleUpload() {
    if (!file || !isAdmin) return;
    setUploading(true);
    setProgress(0);
    setResult(null);
    setError(null);
    try {
      const r = await uploadFile(file, sourceType, setProgress);
      setResult(r);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setResult(null);
    setError(null);
    setProgress(0);
  }

  return (
    <Card className={`border ${borderColorClass}`}>
      <CardHeader className={headerBgClass}>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* Drop zone */}
        <div
          onClick={() => isAdmin && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isAdmin
              ? "border-slate-200 cursor-pointer hover:border-slate-400 hover:bg-slate-50"
              : "border-slate-100 cursor-not-allowed opacity-50"
          }`}
        >
          <Upload className="h-7 w-7 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">
            {file ? file.name : "Click to select file"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {file
              ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
              : ".xlsx, .xls, .csv — max 50 MB"}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
            disabled={!isAdmin}
          />
        </div>

        {/* Progress bar */}
        {uploading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Importing...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Action button */}
        <Button
          onClick={handleUpload}
          disabled={!file || uploading || !isAdmin}
          className="w-full"
        >
          {uploading ? "Importing..." : "Import Data"}
        </Button>

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Success state */}
        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
              <p className="text-sm text-green-700">
                <span className="font-medium">{result.rows_inserted}</span> rows imported
                {result.rows_skipped > 0 && (
                  <span className="text-green-600">
                    {" "}
                    · {result.rows_skipped} skipped
                  </span>
                )}
              </p>
            </div>
            {result.errors.length > 0 && (
              <details className="text-xs text-red-600">
                <summary className="cursor-pointer font-medium">
                  {result.errors.length} errors
                </summary>
                <ul className="mt-1 space-y-1 pl-4 list-disc">
                  {result.errors.slice(0, 20).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </details>
            )}
            {result.warnings.length > 0 && (
              <details className="text-xs text-amber-600">
                <summary className="cursor-pointer font-medium">
                  {result.warnings.length} warnings
                </summary>
                <ul className="mt-1 space-y-1 pl-4 list-disc">
                  {result.warnings.slice(0, 20).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* Expected columns (collapsible) */}
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer font-medium flex items-center gap-1 select-none">
            <FileText className="h-3 w-3" /> Expected columns
          </summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {columns.map((col) => (
              <code
                key={col}
                className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-700"
              >
                {col}
              </code>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

export function DataPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Data Management</h1>
        <p className="text-sm text-slate-500 mt-1">
          Import primary sales, secondary DMS data, and scheme master — each to
          the correct table. Supported formats: .xlsx, .xls, .csv
        </p>
      </div>

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <span>
            Only admins can import data. Contact your administrator to upload
            files.
          </span>
        </div>
      )}

      <UploadPanel
        title="Primary Sales (ERP / Tally)"
        description="Dispatch invoices from Tally or your ERP. What you shipped to distributors."
        sourceType="primary"
        isAdmin={isAdmin}
        accentColor="slate"
        columns={[
          "invoice_date",
          "invoice_number",
          "party_name",
          "party_city",
          "party_zone",
          "route",
          "product_name",
          "product_group",
          "quantity",
          "gross_amount",
          "discount_amount",
          "net_amount",
          "tax_amount",
          "total_amount",
          "outstanding_amount (optional)",
        ]}
      />

      <UploadPanel
        title="Secondary Sales (DMS Offtake)"
        description="What distributors actually sold to retailers. Export from Bizom, Botree, FieldAssist, or your DMS."
        sourceType="secondary"
        isAdmin={isAdmin}
        accentColor="blue"
        columns={[
          "invoice_date",
          "party_name",
          "party_zone",
          "route",
          "product_name",
          "product_group",
          "quantity",
          "total_amount",
        ]}
      />

      <UploadPanel
        title="Scheme Master (Distributor Claims)"
        description="Scheme claims filed by distributors. Used to detect leakage vs. actual secondary offtake."
        sourceType="scheme"
        isAdmin={isAdmin}
        accentColor="purple"
        columns={[
          "scheme_name",
          "party_name",
          "product_name",
          "claimed_amount",
          "scheme_start",
          "scheme_end",
          "discount_pct (optional)",
        ]}
      />
    </div>
  );
}
```

## Placement

New file. Create at `frontend/src/pages/DataPage.tsx`.

## Explanation

**`uploadFile()` module function:**
- Gets JWT from `supabase.auth.getSession()`
- Creates `FormData` with `file` field
- Starts a `setInterval` simulating progress from 0 to 85% in random increments every 200ms (fetch API doesn't expose upload progress)
- On success: clears interval, sets progress to 100, returns parsed JSON `ImportResult`
- On failure: clears interval, re-throws error

**`UploadPanel` component:**
- Reused 3 times — one per data source
- `accentColor` controls card border and header background (slate/blue/purple)
- Click on drop zone triggers hidden `<input type="file">` via ref
- After successful upload: clears the file state and input value for re-use
- Errors display inline (no toast, no modal) — stays visible until next upload attempt
- Success: shows rows inserted / skipped; errors/warnings in `<details>` (collapsible)

**`DataPage` component:**
- Reads `user.role` from `useAuth()` — `isAdmin = role === "admin"`
- Shows amber warning banner for non-admins
- Passes `isAdmin` to each `UploadPanel` — non-admins get disabled drop zone + disabled button

## Related Changes

- `frontend/src/App.tsx` (routes `/data` to `<DataPage />`)
- `frontend/src/components/ui/progress.tsx` (dependency)

---

# File: `frontend/src/pages/SettingsPage.tsx`

**Status:** Created

## Purpose

The `/settings` page allowing users to edit their display name, toggle morning brief notifications, and view read-only account details (tenant ID, user ID).

## Dependencies

**Internal (Days 6–9):**
- `@/contexts/AuthContext` — `useAuth()` for `user` and `session`
- `@/lib/supabase` — direct Supabase client for `profiles` update
- `@/components/ui/button` — `Button`
- `@/components/ui/input` — `Input`
- `@/components/ui/label` — `Label`
- `@/components/ui/card` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
- `@/components/ui/badge` — `Badge`

**External:**
- `react` — `useState`
- `lucide-react` — `CheckCircle`, `AlertCircle`

**Backend API (Day 9):**
- `PATCH /admin/users/{user_id}/preferences`

**Database (Day 1):**
- `profiles` table — `UPDATE display_name` via Supabase anon key (RLS enforced)

**Environment:**
- `VITE_API_BASE_URL` (Day 6)

## Implementation

```typescript
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle } from "lucide-react";

const BASE = import.meta.env.VITE_API_BASE_URL as string;

export function SettingsPage() {
  const { user, session } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Morning brief opt-in toggle
  const [briefEnabled, setBriefEnabled] = useState(true);
  const [briefSaving, setBriefSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const { error: supaError } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", user!.id);
      if (supaError) throw supaError;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleBriefToggle(enabled: boolean) {
    if (!session?.access_token) return;
    setBriefSaving(true);
    try {
      await fetch(`${BASE}/admin/users/${user!.id}/preferences`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ morning_brief_enabled: enabled }),
      });
      setBriefEnabled(enabled);
    } catch {
      // silent — not critical
    } finally {
      setBriefSaving(false);
    }
  }

  const roleLabel = user?.role === "admin" ? "Admin" : "Viewer";

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your profile and notification preferences.
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Avatar + identity row */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center text-lg font-bold select-none">
              {user?.email?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="font-medium text-slate-900">{user?.email}</p>
              <Badge variant="outline" className="text-xs mt-0.5">
                {roleLabel}
              </Badge>
            </div>
          </div>

          {/* Display name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="max-w-sm"
            />
          </div>

          {/* Feedback */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Saved successfully!
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-fit"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Notifications Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>
            Control which automated reports you receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-slate-900">
                Daily Morning Brief
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Receive a daily revenue summary at 7:00 AM with actionable
                insights for your business
              </p>
            </div>
            <button
              role="switch"
              aria-checked={briefEnabled}
              onClick={() => !briefSaving && handleBriefToggle(!briefEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                briefEnabled ? "bg-indigo-600" : "bg-slate-200"
              } ${briefSaving ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform ring-0 transition-transform duration-200 ${
                  briefEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Account Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Details</CardTitle>
          <CardDescription>Read-only system identifiers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <div className="flex items-center justify-between gap-4">
            <span className="shrink-0">Tenant ID</span>
            <code className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-700 truncate max-w-[260px]">
              {user?.tenantId}
            </code>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="shrink-0">User ID</span>
            <code className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-700 truncate max-w-[260px]">
              {user?.id}
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Placement

New file. Create at `frontend/src/pages/SettingsPage.tsx`.

## Explanation

**`handleSave()`:** Updates `profiles.display_name` directly via Supabase anon client. RLS on `profiles` ensures users can only update their own row. Success message auto-dismisses after 3 seconds.

**`handleBriefToggle(enabled)`:** Calls `PATCH /admin/users/{user_id}/preferences` with the new toggle value. Uses `session.access_token` from `useAuth()`. Silent fail — preferences are not critical enough to block the UI.

**Toggle UI:** Pure CSS toggle switch using `<button role="switch">`. When `briefEnabled` is true, the track is indigo and the knob is translated right. When false, track is slate and knob is at position 0. During `briefSaving`, opacity is reduced and cursor is not-allowed.

**`displayName` initialization:** `user?.displayName || ""` — uses the `displayName` field from the `User` type in `types/index.ts`. This field is optional and will be empty string if not set.

## Related Changes

- `frontend/src/App.tsx` (routes `/settings` to `<SettingsPage />`)
- `backend/app/api/routes/admin/users.py` (provides preferences endpoint)

---

## Frontend Routing Changes

# File: `frontend/src/App.tsx`

**Status:** Modified

## Purpose

Replace inline placeholder components for `/data` and `/settings` with real page imports. Remove "coming Day 9" placeholder text.

## Implementation

### Change 1: Replace placeholder imports

**Original code (lines 6–30):**
```typescript
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { CopilotPage } from "@/pages/CopilotPage";

// Placeholder pages (built Days 9–10)
const Data = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Data — coming Day 9</h1>
  </div>
);
const Reports = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Reports — coming Day 10</h1>
  </div>
);
const Simulator = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Simulator — coming Day 10</h1>
  </div>
);
const SettingsPage = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Settings — coming Day 9</h1>
  </div>
);
```

**Replacement code:**
```typescript
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { CopilotPage } from "@/pages/CopilotPage";
import { DataPage } from "@/pages/DataPage";
import { SettingsPage } from "@/pages/SettingsPage";

// Placeholder pages (built Day 10)
const Reports = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Reports — coming Day 10</h1>
  </div>
);
const Simulator = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Simulator — coming Day 10</h1>
  </div>
);
```

### Change 2: Replace `/data` route element

**Original:** `<Route path="/data" element={<Data />} />`

**Replacement:** `<Route path="/data" element={<DataPage />} />`

**Note:** The `/settings` route already uses `<SettingsPage />` — only the import changed (was inline arrow function, now imported component with same name).

## Placement

Modify `frontend/src/App.tsx`.

1. Add two import lines after `CopilotPage` import
2. Remove inline `const Data` component definition
3. Remove inline `const SettingsPage` component definition
4. Replace `element={<Data />}` with `element={<DataPage />}` in the routes

The complete final file after changes is shown in the code above.

## Related Changes

- `frontend/src/pages/DataPage.tsx` (newly wired)
- `frontend/src/pages/SettingsPage.tsx` (newly wired; previously was inline placeholder)

---

## Summary of Day 9 Changes

### New Files Created (12)

| File | Type | Purpose |
|------|------|---------|
| `frontend/src/components/ui/progress.tsx` | Frontend component | Progress bar for upload animation |
| `frontend/src/pages/DataPage.tsx` | Frontend page | File upload UI for 3 data sources |
| `frontend/src/pages/SettingsPage.tsx` | Frontend page | Profile + notification settings |
| `backend/app/services/insights/__init__.py` | Python package | Package marker |
| `backend/app/services/insights/engine.py` | Python service | InsightsEngine + 3 insight computations |
| `backend/app/services/email/__init__.py` | Python package | Package marker |
| `backend/app/services/email/templates/morning_brief.html` | Jinja2 template | HTML email template with branding |
| `backend/app/services/email/morning_brief.py` | Python service | MorningBriefService with SendGrid + retry |
| `backend/app/api/routes/admin/reports.py` | Python API route | `POST /admin/reports/morning-brief` |
| `supabase/functions/daily-morning-brief/index.ts` | Deno Edge Function | Automated daily cron execution |
| `akara/migrations/008_user_preferences.sql` | SQL migration | `preferences` JSONB column on `profiles` |

### Modified Files (4)

| File | What Changed |
|------|-------------|
| `frontend/src/App.tsx` | Replaced `Data` + `SettingsPage` placeholders with real page imports |
| `backend/app/core/config.py` | Replaced Gmail fields with `sendgrid_api_key`, `sendgrid_from_email`, `sendgrid_from_name`, `backend_service_key` |
| `backend/app/api/routes/admin/users.py` | Added `UserPreferencesUpdate` model + `update_user_preferences` endpoint |
| `backend/app/main.py` | Registered `admin_reports_router` |

### Modified Configuration Files (1)

| File | What Changed |
|------|-------------|
| `backend/.env` | Replaced `GMAIL_USER`/`GMAIL_APP_PASSWORD` with `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`, `BACKEND_SERVICE_KEY` |

### No New Tests Added

Day 9 did not introduce new pytest tests. The existing 2 tests in `tests/test_health.py` continue to pass.

### Quality Gate Results

```
ruff check . → All checks passed!
pytest        → 2 passed in 1.60s
tsc --noEmit  → (no output — 0 errors)
```
