# Phase 11 DEV2 session handoff

| Field | Value |
|---|---|
| **Branch** | `phase/11-dev-2-decision-engine` |
| **PHASE10_SHA** | `8cbb542` (`origin/main`; code land `0cb97a5`; Living `61a4d7b`) |
| **LAST_N** | `061` → migrations **`062`–`066`** (DEV1) |
| **API_PREFIX** | `""` (compat `/actions`) |
| **MENU_TABLE** | `CREATE_NEW` |
| **FORECASTS_OK / ANOMALIES_OK / WORKER_RUNS_OK** | true (Phase 10 `059`/`060`) |
| **CRON_INTEL** | present (`backend/app/workers/combined/cron_intelligence_worker.py`) |
| **LANGFUSE_PRESENT** | false — do not add |
| **LLM_COMPLETE_SIG** | live `LLMManager.complete(prompt, system="") -> str` |
| **CANONICAL_SHAPE** | header_plus_items |
| **CHART_KIT / UI** | impeccable + emil-design-eng; zero new frontend deps |

## Canonical column map (live, do not invent)

- `canonical_orders`: `order_time`, `total_amount`, `channel`, `location_id` (no `item_id` / `order_date` / `revenue` / `food_cost`)
- `canonical_order_items`: `item_name`, `quantity`, `unit_price`, `line_total`, `category` (no `item_id` / `cost_price` / `selling_price`)
- Map: `order_date = (order_time AT TIME ZONE 'Asia/Kolkata')::date`; item grain = `item_name`; item revenue = `line_total`

## Commission

Prefer `canonical_channels.commission_rate`; else env Swiggy 25% / Zomato 22%. No new settings page.

## Changed vs constitution

- Customer paths unversioned (`API_PREFIX=""`), not `/api/v1`.
- `/actions` wins over futureplan `/decisions`.
- 74aa8eb P11 is shells — DEV1 split + complete on `phase/11-dev-1`; DEV2 writes zero backend/SQL.
- Migration filenames `062`–`066`, never `032`–`036`.
- No 5th Railway service; cron jobs on existing intelligence worker.

## PC at kickoff

- Max migration `061`; no `062+` on base.
- `appNav` has 8 primary items; no `/actions`.
- Dashboard mounts DataQualityWidget then AlertHistoryWidget.
- Absent: actions feature folder, action queue, pending-actions widget.

## OQ defaults

Any authenticated member reads `/actions`; accept/snooze/reject requires `tenant.is_admin`; snooze default 7 days; outcome = 14d pre vs 14d post (not YoY).

## Ops

Phase 11 rows → `ops-deferred-after-p12.md` (D2-P11-OPS-001..006). Dual §28 S-P11-001–005 **not** claimed Complete.

## DEV2 coding

- Route `/actions`; nav after `/alerts`; no PlanGate.
- Frozen card/modals/evidence/history/outcomes/widget/badge.
- `git diff 8cbb542...HEAD --name-only` must have zero `backend/` and zero `supabase/migrations/` on this branch.
