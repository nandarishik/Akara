# Phase 7 DEV2 session handoff

Branch (DEV2): `phase/07-dev-2-connector-sync-platform` @ `1d9c028`  
Date: 2026-09-20

## Kickoff

| Field | Value |
|---|---|
| `PHASE6_SHA` / base | `2546a2f` (`origin/main` after Phase 6 land + Living log; merge tip `8540e44`) |
| `LAST_N` | `047` → migrations **`048`–`051`** from DEV1 path-split |
| `CONNECTORS_API_PREFIX` | `/api/v1/connectors` (frozen; not unprefixed `/data` style) |
| DEV1 | path-split from `74aa8eb` onto `phase/07-dev-1-connector-sync-platform` (**never** merge tip) |
| Merge order | **DEV1 first**, then DEV2 |
| Integration | `phase/07-connector-sync-platform` |

## Preconditions (PASS at kickoff)

| Check | Result |
|---|---|
| Max migration | `047_import_jobs_cafe_columns.sql` |
| `canonical_orders` / café package | present |
| `features/connectors/` | absent → now CREATE on DEV2 |
| `tally_reader.py` | `NotImplementedError` replaced |

## Recorded mismatches / conflicts

1. **Futureplan §19.3** lists Petpooja/UrbanPiper under Phase 4 — execute Phase 7 constitution.
2. **Railway 4-vs-5:** Phase 3 capped four services; Phase 7 CREATE `railway.connector_sync.json` (5th). Record only.

## Deliverables

| ID | Status |
|---|---|
| D2-P07-001–016 | Complete on live paths on DEV2 branch |
| Vitest connectors | **8 passed** |
| Agent HMAC pytest | **2 passed** |
| `tsc --noEmit` | **0 errors** |

## Ownership check

Zero intentional `backend/app` / `supabase/migrations` edits on DEV2 commits.

## Deferred ops

All D2-P07-OPS-001…007 → `ops-deferred-after-p12.md`.

## PR

Do not PR to main until operator asks. Integration + end security pending.
