# Phase 10 DEV2 session handoff

| Field | Value |
|---|---|
| **Branch** | `phase/10-dev-2-intelligence-signals` |
| **PHASE9_SHA** | `45ce4ad` (`origin/main`; code land `909290b`; Living `746a829`) |
| **LAST_N** | `058` → migrations **`059`–`061`** (DEV1) |
| **API_PREFIX** | `""` (compat `/alerts`, `/forecasts`, `/morning-brief/preview`) |
| **THRESHOLD_UI** | `raw` |
| **CRON_INTEL** | present (`backend/app/workers/combined/cron_intelligence_worker.py`) |
| **CHART_KIT / UI** | impeccable + emil-design-eng; zero new frontend deps |

## Canonical column map (live, do not invent)

- `canonical_orders`: `order_time`, `total_amount`, `location_id` (no `order_date` / `revenue` / `food_cost`)
- `canonical_order_items`: `item_name`, `quantity`, `unit_price`, `line_total` (no `item_id` / `net_price` / `cost_price`)
- Map: `order_date = (order_time AT TIME ZONE 'Asia/Kolkata')::date`; item grain = `item_name`; item revenue = `line_total`

## Changed vs constitution

- Customer paths unversioned (`API_PREFIX=""`), not `/api/v1`.
- Live alerts table `tenant_alerts` (DEV1); UI uses frozen `/alerts` + PUT.
- Settings notifications tab kept (`PATCH /account/preferences`); matrix is a separate route.
- 74aa8eb P10 is shells — DEV1 split + complete on `phase/10-dev-1`; DEV2 writes zero backend/SQL.

## PC at kickoff

- Max migration `058`; no `059+` on base.
- `cron_intelligence_worker.py` present (weekly only).
- Absent: intelligence feature folder, café alert settings, prefs matrix, history widget, morning-brief preview, debrief trend/actions cards.

## Ops

Phase 10 rows → `ops-deferred-after-p12.md` (D2-P10-OPS-001..006). Dual §28 S-P10-001–005 **not** claimed Complete.

## DEV2 coding complete

- `tsc --noEmit` 0; intelligence Vitest **8 passed**.
- Playwright e2e smoke: `alerts-settings.spec.ts`, `morning-brief-preview.spec.ts`.
- Playwright MCP localhost QA **Unverified** (Vite not started this session).
- `git diff 45ce4ad...HEAD --name-only` must have zero `backend/` and zero `supabase/migrations/` on this branch.

## Routes

- `/settings/alerts` — café alert rules
- `/alerts` — redirect → `/settings/alerts`
- `/alerts/history` — history
- `/settings/notifications` — Alert channel matrix
- `/settings/morning-brief` — Morning brief preview
