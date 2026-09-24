# Phase 9 DEV2 session handoff

| Field | Value |
|---|---|
| **Branch** | `phase/09-dev-2-copilot-llm-platform` |
| **PHASE8_SHA** | `b1b30f8` |
| **LAST_N** | `055` → migrations **`056`–`058`** (DEV1) |
| **API_PREFIX** | `""` (live `/copilot/...`) |
| **STREAM_GUARDRAILS_PRESENT** | true |
| **SQLGLOT_ALREADY_PRESENT** | false |
| **SEMANTIC_LAYER** | missing on base — DEV1 CREATE stub on split |
| **CHART_KIT / UI** | impeccable + emil-design-eng; zero new frontend deps |

## Changed vs constitution

- Live paths: `/copilot/*` + body `question` (not `/api/v1` + `message`).
- Provider: AD-P09-004 (no Gemini).
- Golden category table over-counts → 50 ids with truncated edge/ambiguous tail (q47–q48 edge_null, q49–q50 ambiguous).
- Promptfoo CI: artifact-only (no git-push from workflow).

## PC at kickoff

- Max migration `055`; no `056+` on base.
- Stream `run_all_guardrails` present.
- Absent: CopilotEvidence, status poll, `benchmark/Makefile`, cafe_brewlab YAML.

## Ops

Phase 9 rows → `ops-deferred-after-p12.md` (D2-P09-OPS-001..007).

## DEV2 coding complete (`4c4c3b0`+)

- `check_gate.py`: fixture 80% exits 0, 60% exits 1.
- `questions.yaml`: exactly 50 ids (`cafe_q01`–`cafe_q50`); tail truncated (2 edge_null + 2 ambiguous).
- Frontend: status poll 30s, outage banner source of truth, evidence footer, stream `phase`/`evidence`, 30s abort, input disabled when `llm_available===false`.
- Tests: `tsc -b` 0; vitest copilot **12 passed**. Flake: CopilotPage test stderr `Expected onClick listener to be a function, instead got object` (MobileNav mock) — test still passes.
- Playwright e2e: smoke specs added (`copilot-evidence`, `copilot-outage`). Playwright MCP localhost QA **not run** this session (Vite not started).
- Promptfoo CI: artifact-only; skips clearly when `TEST_TENANT_JWT` missing.
