# Phase 7 DEV2 session handoff

Branch (DEV2): `phase/07-dev-2-connector-sync-platform`  
Date: 2026-09-20

## Kickoff

| Field | Value |
|---|---|
| `PHASE6_SHA` / base | `2546a2f` (`origin/main` after Phase 6 land + Living log note; merge tip was `8540e44`) |
| `LAST_N` | `047` → migrations **`048`–`051`** from DEV1 path-split |
| `CONNECTORS_API_PREFIX` | `/api/v1/connectors` (frozen; not unprefixed `/data` style) |
| DEV1 | path-split from `74aa8eb` onto `phase/07-dev-1-connector-sync-platform` (**never** merge tip) |
| Merge order | **DEV1 first**, then DEV2 |
| Integration | `phase/07-connector-sync-platform` |

## Preconditions (PASS)

| Check | Result |
|---|---|
| Max migration | `047_import_jobs_cafe_columns.sql` |
| `canonical_orders` / café package | present |
| `features/connectors/` | absent at kickoff |
| `/connectors` routes | absent at kickoff |
| `tally_reader.py` | still `NotImplementedError` at kickoff |

## Recorded mismatches / conflicts

1. **Futureplan §19.3** lists Petpooja/UrbanPiper under Phase 4 — execute Phase 7 constitution; do not back-port to a Phase 4 branch.
2. **Railway 4-vs-5:** Phase 3 capped four services; Phase 7 CREATE `railway.connector_sync.json` (5th). Record only; do not invent a 6th or fold into `import_worker`.

## Ownership

| Workstream | Owns |
|---|---|
| DEV2 | `frontend/src/features/connectors/**`, additive router/nav/glassIcon, entire `akara-connect/**`, Vitest, handoff, ops-deferred P7, security gate/scans |
| DEV1 | migrations `048`–`051`, `domain/connectors/**`, APIs, worker, CredentialService/HMAC verify |

## Deliverables

| ID | Status |
|---|---|
| D2-P07-001–016 | In progress on DEV2 branch |
| Vitest / agent HMAC | Pending WP-D2-009 |
| Integration | Pending after DEV1 split |

## Deferred ops

All D2-P07-OPS-001…007 → `ops-deferred-after-p12.md`.

## PR

Do not PR to main until operator asks.
