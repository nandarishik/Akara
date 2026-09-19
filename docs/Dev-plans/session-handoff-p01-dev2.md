# Session handoff — Phase 1 DEV2

**Developer:** DEV2  
**Work branch:** `phase/01-dev-2-truth-baseline` (tip before integrate: `318d824`)  
**Integration branch:** `phase/01-truth-baseline` @ `c7dad6d`  
**Base main:** `caac39f`  
**DEV1 SHA merged:** `5ce6c10` only (not tip `74aa8eb`)  
**Date:** 2026-09-19  
**PR to main:** not opened (wait for operator ask)

## Deliverables

| ID | Status |
|---|---|
| D2-P01-001 cost regression file | Complete (`test_cost_logger_regression.py`; xfail removed after DEV1 merge) |
| D2-P01-002 stream guardrails | Complete (DEV1 already had post-stream `run_all_guardrails`; DEV2 test `test_answer_stream_guardrail.py` green) |
| D2-P01-003 `compute_copilot_date_range` | Complete (also present on DEV1; tests added) |
| D2-P01-004 SQLTool isolation | Complete (`TestSQLToolTenantIsolation`, no token skipif) |
| D2-P01-005 invoice invert | **NOT IMPLEMENTED HERE — owned by DEV1 (P01-R019)** |
| D2-P01-006 day-one scans + gate | Complete |
| D2-P01-007 suite on integration | Unit `229 passed`; full `tests/` see below |
| BUG-11 runbook warning | Complete — exact warning string |

## Isolation

- SQLTool CI class: Tenant B UUID never appears in bound SQL for Tenant A tool.
- SQLGuard missing `tenant_id` predicate: documented Phase 2 candidate; `guard.py` not edited.
- Live HTTP isolation: skipped without tokens (expected).

## Security

- Artefacts: `docs/Phases/security-scan-day1-{bandit,pip-audit,keyhog,semgrep}.*`
- Gate: `docs/Dev-plans/security-gate-p01.md`
- Per-PR: **0 new Critical/High** vs day-one
- KeyHog / Betterleaks / Skylos / OpenTaint / Trivy / tenant-guard: **Unverified** (not installed)
- SEC-P01-002 ACCEPTED (service role)
- JWT/RLS swap: still **blocked** (Partial)
- Cloudflare: guidance at start; full audit `quick` — no OS sandbox → runtime candidates `needs_validation`; summaries in gate / Living log. Run dir note: `C:\Users\Admin\security-audit-skill\akara\p01-run-1\` (documented; no exploit harnesses run)

## Extra unblocker (JOINT PC-03)

- Lazy imports in `renderer.py` / `whatsapp.py` to break Day 11 circular imports so pytest collects. Not a DEV2 exclusive path; required for suite.

## Suite

```
cd backend; uv run pytest tests/unit/ -q   # 229 passed, 16 skipped (integration branch)
cd frontend; npx tsc -b ; node node_modules/vite/bin/vite.js build  # PC-04 via vite (pnpm approve-builds blocks pnpm build wrapper)
```

- `pytest-cov` not installed → agent.py ≥90% coverage not measured; stream guardrail test covers `answer_stream` failure path.
- `ruff check .` reports many pre-existing findings on DEV1 tree (day11 compact style); not introduced as new product AC for DEV2 exclusive files beyond existing day11 style.

## Constitutional audit (DEV2-relevant)

- P01-R004 Changed — Option D is DEV1
- P01-R007 Complete — base `caac39f`
- P01-R018 / P01-R106 Partial — isolation tests shipped; JWT swap blocked
- P01-R019 Missing on DEV2 branch — invoice invert DEV1
- P01-R029 / P01-R107 Changed — helper end = today
- P01-R047 Partial — Guard unchanged
- D2-P01-005 / BUG-07 / BUG-09 — not here

## Ops tooling (already on disk, not committed unless asked)

BRANCHING / SECURITY / HANDOVER / FRONTEND / `.cursor` skills. ECC at `C:\Users\Admin\Desktop\ECC` (installed into ECC/.cursor only; akara `.cursor` preserved). Catalog updates only after operator ask.

## Next

Operator: review `phase/01-truth-baseline`, then ask for push/PR to `main`. Do not declare Phase 1 programme-complete until JOINT merge.
