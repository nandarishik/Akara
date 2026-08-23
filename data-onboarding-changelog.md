# Data Onboarding — Implementation Changelog

Branch: `shrey-dev`. Tracks the assisted (superadmin-first) CSV onboarding work:
**preview → confirm mapping → commit → remember mapping**, on top of the existing
canonical-DTO import path.

## Decisions locked (2026-08-23)

- **Assisted onboarding first, not self-serve.** Preview + mapping override live in the
  **superadmin** surface (per-tenant), reusing `/tenants/{tenant_id}/data/...`. Customer-facing
  self-serve is deferred; the domain logic is written to be reused by a v1 route later.
- **Stateful-minimal preview.** Preview parses the file, stashes the bytes in the existing
  imports storage bucket, and creates an `import_jobs` row with `status='preview'`. Commit
  loads the stashed file by `job_id`, re-parses with any user overrides, imports, and finalizes
  the job. Reuses existing infra (storage bucket + `import_jobs`), no new tables.
- **Founder quota bypass.** Superadmin-initiated imports do NOT enforce the per-tenant
  upload-count caps (`require_import_quota`) — the founder is onboarding a customer's historical
  data. The preview still *reports* estimated rows + current row count so impact is visible.
- **Mapping precedence:** tenant mapping-memory > parser alias dict > unmapped (→ `raw_data`).
  This is a 2-layer preview of the eventual ProfileResolver chain.

## Deferred (per plan)

TenantDataProfile YAML templates, SemanticSchemaProvider, DataStore adapter, companion-pipeline
unify, Tally EXE. Precise per-reason dropped-row counts (v1 reports total dropped + reason list).

---

## Log

### 2026-08-23 — Session start
- Traced current import path (parser → canonical DTO → batched insert); confirmed MappingMemory
  and `SemanticRole` exist but are unused, and the parser discards the source→canonical trace.
- Set decisions above with Shrey. Created task list. Beginning implementation.

<!-- Append one entry per completed step below. -->

### 2026-08-23 — Migration 029 (import preview + mapping)
- Added `supabase/migrations/029_import_preview_mapping.sql`:
  - Extended `import_jobs` status CHECK to include `'preview'` (parsed-but-not-committed
    upload with bytes stashed in the imports bucket) and `'cancelled'`.
  - **Latent-bug fix:** `POST /data/import/jobs/{id}/cancel` already wrote `status='cancelled'`,
    but the 014 CHECK constraint forbade it — the write would have violated the constraint on a
    real DB. Now allowed.
  - Added nullable `import_mapping JSONB` to persist the confirmed source→canonical mapping
    between preview and commit (also an audit trail).
  - Partial index `idx_import_jobs_preview` for open previews per tenant.
- Registered 028 + 029 in `MIGRATION_MANIFEST.md` (table previously stopped at 027).

### 2026-08-23 — Parser: mapping report + override support
- `backend/app/domain/data_import/parser.py`:
  - `_merge_aliases(aliases, overrides)` — merges overrides onto the built-in alias dict
    (precedence override > alias > unmapped); a falsy override force-*unmaps* a column so it
    falls through to `raw_data`.
  - `_normalize_columns(df, aliases, overrides=None)` — threads overrides into the rename.
  - `_read_source_frame(...)` — single source of truth for sheet selection (preview + import agree).
  - `analyze_columns(headers, source_type, overrides=None)` — header-only mapping report
    (mapped / unmapped / missing_required / canonical_fields / **resolved_mapping**), with the
    primary net→total amount fallback reflected so derivable required fields aren't flagged missing.
  - Threaded `overrides` through `SalesDataParser`, `SecondarySalesParser`, `SchemeDataParser`.
  - **Trace preserved:** the source→canonical mapping is now inspectable/overridable, not silently
    discarded. Precedence realises changelog decision: tenant memory > alias > unmapped.
- Note: most of this landed via a fork agent that had drifted from its (frontend-recon) mandate into
  editing the parser; I stopped it to keep a single writer, then adopted + completed its work.
- Tests: added 5 `analyze_columns` cases; full parser suite 11/11 green. Existing `.parse()` and
  service signatures unchanged (overrides default None), so no regressions.

### 2026-08-23 — Domain: ImportPreviewService (build + commit + estimate)
- Added `backend/app/domain/data_import/preview.py` — the reusable core of assisted onboarding
  (superadmin-first now; a future v1 self-serve route can call the same service).
  - `build_preview(...)` — parse WITHOUT committing: read frame, fingerprint headers, look up
    tenant mapping-memory, merge `effective = {**remembered, **overrides}` (**explicit override
    wins over remembered**, remembered seeds it), run `analyze_columns` for the report, trial
    `parse_dataframe` for real importable/dropped counts + up-to-10 JSON-safe sample rows, stash
    the raw bytes in the imports bucket, and record an `import_jobs` row with `status='preview'`
    and `import_mapping=resolved_mapping`. Returns job_id, counts, `can_commit`, mapping report,
    samples, `remembered_mapping_applied`. Never writes to sales tables — safe to call repeatedly.
  - `commit_preview(...)` — reload stashed bytes by job_id, re-parse with confirmed overrides
    (`final = overrides if overrides is not None else job.import_mapping`), import via
    `DataImportService.import_file(..., import_job_id=job_id, overrides=final)` so **undo works**,
    finalize the job (`completed`/`failed`, rows, `completed_at`, `error_message`), and on success
    save MappingMemory for this tenant + header shape.
  - `estimate_commit(...)` — commit dry-run: reload + re-parse for impact counts under the
    *supplied* overrides WITHOUT importing, remembering, or creating a job.
  - **Founder quota bypass** implemented precisely: on a successful commit, increments only
    `rows_imported` usage (dashboard accuracy) via the `increment_usage` RPC — never
    `uploads_count` / `uploads_today`, so per-tenant upload caps are not consumed.
  - `_get_preview_job(job_id, tenant_id)` filters by **both** id and tenant_id → cross-tenant
    isolation (404), and rejects non-`preview` jobs (409).
  - `_json_safe_records(...)` coerces numpy scalars / dates / NaN-inf so preview samples serialize.
  - **Mapping round-trip is correct:** we persist `resolved_mapping` (normalized keys) and re-apply
    it as `overrides`; `_merge_aliases`/`analyze_columns` `_norm()` override keys and `_norm` is
    idempotent, so normalized-keyed remembered mappings re-map cleanly.

### 2026-08-23 — Superadmin API: preview + commit routes
- `backend/app/api/superadmin/data.py`:
  - `POST /tenants/{tenant_id}/data/import/preview` — **multipart** (`SudoCtx` + `require_csrf`);
    `file` + `source_type` + optional `sheet_name` + `overrides` (JSON string) Form fields.
    Validates source_type against `{primary,secondary,scheme}`, parses overrides
    (`_parse_overrides_form`, 400 on bad JSON), rejects empty uploads, calls `build_preview`.
    Multipart ⇒ cannot use the JSON `SuperadminMutation` body, so no `reason` is required here
    (preview is non-destructive; commit carries the audited reason).
  - `POST /tenants/{tenant_id}/data/import/commit` — **JSON** `ImportCommitBody(SuperadminMutation)`
    (`job_id`, optional `overrides`, `reason` min-10, `dry_run`, `operation_id`) + `SudoCtx` +
    `require_csrf`. `dry_run=true` → `estimate_commit` + `dry_run_response` (no side effects);
    real commit → `commit_preview` + `record_operation` audit; returns the result envelope + audit.
  - `_raise_preview_http(...)` maps `ImportPreviewError` (400/404/409) onto the shared
    `AkaraHTTPException` envelope.

### 2026-08-23 — Opportunistic fix: sync-import job status lifecycle
- `backend/app/api/v1/data.py` (`POST /data/import`, the existing synchronous customer path):
  - Now tags `service.import_file(..., import_job_id=import_job_id)` so **undo works for sync
    imports** (previously the job id was never threaded through → silently un-undoable rows).
  - Replaced the row-count-only update with a proper finalize: `status` = `failed` if
    `result.errors` else `completed`, plus `completed_at` and truncated `error_message`; the job
    row starts at `processing` instead of being written straight to `completed`.

### 2026-08-23 — Tests
- `backend/tests/unit/domain/test_import_preview.py` (11 tests, all green) — a purpose-built fake
  Supabase (storage upload/download, `import_jobs` insert/select/update with tenant filtering,
  `mapping_memory`, sales inserts, RPC recording) exercises `build_preview` / `commit_preview` /
  `estimate_commit` end-to-end against **real parsing**: happy paths, remembered-mapping applied,
  missing-required ⇒ `can_commit=False`, override forces (un)mapping, **founder bypass asserted**
  (`rows_imported` incremented, `uploads_count`/`uploads_today` NOT), non-preview ⇒ 409,
  missing ⇒ 404, cross-tenant ⇒ 404, dry-run imports nothing.
- `backend/tests/superadmin/test_superadmin_import.py` (13 tests, all green) — route wiring with
  `ImportPreviewService` stubbed: sudo + CSRF gating, multipart parse, source_type / overrides /
  empty-file validation, dry-run branch uses estimator (not importer), audit recorded on commit,
  short `reason` ⇒ 422, `ImportPreviewError` → HTTP status mapping.
- Full backend suite: **397 passed, 23 skipped**. The single failure
  (`test_superadmin_qa_matrix … billing/webhooks/status`) is **pre-existing and unrelated**:
  `test_admin_rate_limits.py` exhausts the shared slowapi limiter without resetting it, so a later
  rate-limited read returns 429. Reproduces identically with my new test file removed; the
  qa_matrix file passes 69/69 in isolation. (Test-isolation bug in the limiter fixture, not this
  feature — left for a separate fix.)

### 2026-08-23 — Frontend: superadmin assisted-import UI
- `frontend/src/lib/api/superadmin.ts`:
  - `superadminUpload<T>(path, formData)` — multipart POST helper. Reuses the bearer token + the
    double-submit CSRF header (`X-CSRF-Token` from the `akara_csrf` cookie) and `credentials:"include"`,
    but **omits `Content-Type`** so the browser sets the multipart boundary. (`superadminFetch` forces
    `application/json` on non-GET, which would corrupt a multipart body — hence the separate helper.)
  - Types mirroring the backend contract: `ImportSourceType`, `ImportMappingReport`,
    `ImportPreviewResponse`, `ImportCommitResponse`, `ImportCommitEstimate`.
  - `sa.importPreview(id, {file, source_type?, sheet_name?, overrides?})` (FormData; only appends
    `overrides` when non-empty) and `sa.importCommit(id, {job_id, reason, dry_run?, overrides?})` (JSON).
- `frontend/src/features/superadmin/components/AssistedImportPanel.tsx` (new) — the operator surface:
  dropzone + source-type `<select>` → **Preview** → mapping-review table (per-column canonical
  `<select>`, missing-required + dropped-row warnings, remembered-mapping badge, parsed sample rows) →
  **Commit** via `ConfirmDialog` (type-to-confirm "IMPORT", non-destructive styling) whose impact box is
  populated from a commit **dry-run**.
  - **Mapping-memory-safe commit.** Overrides are keyed by the *normalized* header (the same key-space
    as the tenant's remembered mapping) and are sent **only to preview**, where the server merges
    `{**remembered, **overrides}`. Commit/estimate never send a partial delta: `commit_preview`
    *replaces* (does not re-merge) the mapping with any overrides it receives and then **remembers the
    result**, so a partial delta would drop non-alias remembered columns and corrupt mapping memory.
    Instead the operator must fold edits into the job mapping via a re-scan — enforced by a
    `mappingDirty` guard that disables **Commit** until re-scanned — and commit/estimate then run purely
    off the stored `job.import_mapping` (overrides omitted). Verified against `preview.py:202` + `:244`
    (`final = overrides if overrides is not None else job.import_mapping`).
- `frontend/src/features/superadmin/components/TenantDrawer.tsx` — added an **"Import"** tab (extended
  the `Tab` union + tabs array) rendering `<AssistedImportPanel>` wired to the drawer's shared
  `reason` / `reasonOk` / `setStatus` / `invalidate`, mirroring the `PlanAssignmentSection` precedent.
- Verification: `tsc -b` (the build's typecheck step) is **clean** — 0 errors — after installing the
  frontend deps (which required `--legacy-peer-deps`: `react-helmet-async@2.0.5` peers React ≤18 vs the
  project's React 19; there is no `.npmrc`, so this is a manual install flag). `tsc -b` also confirmed the
  `TenantDrawer` wiring (tab union + `tenantId` non-null narrowing at the render site).
- **Test tooling could not run in this dev box** (environment, not code): `oxlint` and `vitest` both need
  native bindings (`@oxlint/binding-win32-x64-msvc`, `rolldown-binding.win32-x64-msvc.node`) that the
  legacy-peer-deps install skipped (npm optional-deps bug #4828). After manually adding the bindings,
  `vitest` starts but the **pre-existing** `DataPage.test.tsx` fails with `ReferenceError: React is not
  defined` — a JSX-runtime/config mismatch surfacing here because Node 20.18.0 is below Vite 8's required
  ≥20.19.0. Since the repo's *existing* frontend tests can't go green in this box, a new
  `AssistedImportPanel` test would hit the same transform failure and couldn't be honestly verified — so
  none was shipped (unverified test code would imply a green run that didn't happen). **Recommended
  follow-up in a correct env (Node ≥20.19):** a component test locking the mapping-memory-safe invariant —
  commit/estimate never send `overrides`, and `mappingDirty` disables **Commit** until a re-scan. The
  lockfile was left untouched (install churn reverted) so CI resolves the intended dependency tree.


