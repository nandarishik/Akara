# Phase 6 DEV2 session handoff

Branch (DEV2): `phase/06-dev-2-canonical-cafe-data`  
Date: 2026-09-20

## Kickoff

| Field | Value |
|---|---|
| `PHASE5_SHA` / base | `55d63e7` (`origin/main` after Phase 5 code land + esbuild hotfix; plan freeze listed `535e3de`) |
| `PREV_P05_SHA` | `55d63e7` |
| `LAST_N` (max migration on base) | `038` → Phase 6 migrations expected `039`–`047` from DEV1 split |
| `API_PREFIX` | `""` (live DataPage uses `VITE_API_BASE_URL` + `/data/...` with no `/v1`) |
| DEV1 | **Not a solo SHA.** Must path-split `74aa8eb` onto `phase/06-dev-1-canonical-cafe-data` (039–047 only). **Never merge `74aa8eb` tip.** |
| Merge order | **DEV1 first**, then DEV2 |
| Integration branch | `phase/06-canonical-cafe-data` |

## PC (kickoff)

| Check | Result |
|---|---|
| Branch cut from `origin/main` | `55d63e7` |
| Present: DataPage, DataUploadPanel, `/data` | Yes |
| Absent: cafeImportApi, UploadWizard, QuarantinePage, outlets tab | Yes |
| FMCG SOURCE_TABS intact | Yes |

## Deliverables (fill as WPs land)

| ID | Status |
|---|---|
| D2-P06-001–012 | In progress |
| Vitest | pending |
| DEV1 split + integrate | pending |

## Deferred ops

All D2-P06-OPS-001…006 → [`ops-deferred-after-p12.md`](ops-deferred-after-p12.md).

## PR

Do not PR to main until operator asks.
