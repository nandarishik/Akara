"""Assisted CSV onboarding — stateful-minimal preview + commit.

Superadmin-first flow (see data-onboarding-changelog.md):

    build_preview()  → parse WITHOUT committing, stash the raw bytes in the
                       imports bucket, record an import_jobs row with
                       status='preview', and return a source→canonical mapping
                       report the operator can review and override.

    commit_preview() → reload the stashed bytes, re-parse with the confirmed
                       overrides, import via DataImportService (tagged with the
                       preview job id so undo works), finalise the job, and
                       remember the mapping for this tenant + file shape.

Mapping precedence: tenant mapping-memory  >  user override  >  built-in alias
                    >  unmapped (→ raw_data). The user's explicit override wins
over a remembered value within a single preview; the remembered value seeds it.

Founder quota bypass: superadmin-initiated imports do NOT enforce the per-tenant
upload-count caps. rows_imported usage IS incremented for dashboard accuracy,
but uploads_count / uploads_today are left untouched.
"""

from __future__ import annotations

import logging
import math
import uuid as uuid_lib
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from supabase import Client

from app.core.config import settings
from app.domain.connect.mapping_memory import MappingMemory, fingerprint_headers
from app.domain.data_import.parser import _read_source_frame, analyze_columns
from app.domain.data_import.service import (
    DataImportService,
    SourceType,
    _sanitize_for_json,
)

logger = logging.getLogger(__name__)

_PREVIEW_SAMPLE_ROWS = 10


class ImportPreviewError(Exception):
    """Preview/commit failure that maps to a 4xx (bad file, missing job, etc.)."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _json_safe_records(records: list[dict]) -> list[dict[str, Any]]:
    """Coerce parsed rows (numpy scalars, dates, NaN) into JSON-serialisable dicts."""
    out: list[dict[str, Any]] = []
    for rec in records:
        clean: dict[str, Any] = {}
        for key, value in rec.items():
            value = _sanitize_for_json(value)          # date/datetime → str, nan-float → None
            if hasattr(value, "item"):                 # numpy scalar → native python
                try:
                    value = value.item()
                except Exception:
                    value = str(value)
            if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
                value = None
            clean[str(key)] = value
        out.append(clean)
    return out


class ImportPreviewService:
    def __init__(self, supabase: Client) -> None:
        self._supabase = supabase
        self._importer = DataImportService(supabase=supabase)
        self._memory = MappingMemory(supabase=supabase)

    @property
    def _bucket(self) -> str:
        return settings.supabase_imports_bucket

    # ── preview ──────────────────────────────────────────────────────────────
    def build_preview(
        self,
        *,
        file_content: bytes,
        filename: str,
        tenant_id: UUID,
        user_id: UUID | str | None = None,
        source_type: SourceType = "primary",
        sheet_name: str | int | None = None,
        overrides: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Parse-and-stash. Never writes to sales tables; safe to call repeatedly."""
        try:
            raw_df, sheet_used = _read_source_frame(
                file_content, filename, source_type, sheet_name
            )
        except Exception as exc:  # noqa: BLE001 — surface any reader failure as 400
            raise ImportPreviewError(f"Could not read file: {exc}", 400) from exc

        raw_headers = [str(c) for c in raw_df.columns]
        total_rows = int(len(raw_df))
        fingerprint = fingerprint_headers(raw_headers)

        remembered = self._memory.lookup(tenant_id, fingerprint)
        # Remembered mapping seeds the mapping; explicit user overrides win.
        effective = {**(remembered or {}), **(overrides or {})}

        report = analyze_columns(raw_headers, source_type, effective or None)

        # Attempt a real parse with the effective mapping for accurate counts/samples.
        importable_rows = 0
        sample_rows: list[dict[str, Any]] = []
        parse_error: str | None = None
        try:
            parsed = self._importer.parse_dataframe(
                file_content, filename, source_type, sheet_used, effective or None
            )
            importable_rows = int(len(parsed))
            sample_rows = _json_safe_records(
                parsed.head(_PREVIEW_SAMPLE_ROWS).to_dict(orient="records")
            )
        except ValueError as exc:
            parse_error = str(exc)

        job_id = str(uuid_lib.uuid4())
        storage_path: str | None = f"import-jobs/{tenant_id}/{job_id}/{filename}"
        try:
            self._supabase.storage.from_(self._bucket).upload(
                storage_path,
                file_content,
                {"content-type": "application/octet-stream", "x-upsert": "true"},
            )
        except Exception as exc:  # noqa: BLE001 — preview still useful without a stash
            logger.warning("preview file stash failed: %s", exc)
            storage_path = None

        try:
            self._supabase.table("import_jobs").insert(
                {
                    "id": job_id,
                    "tenant_id": str(tenant_id),
                    "user_id": str(user_id) if user_id else None,
                    "source_type": str(source_type),
                    "filename": filename,
                    "status": "preview",
                    "storage_path": storage_path,
                    "import_mapping": report["resolved_mapping"],
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001
            raise ImportPreviewError(f"Failed to create preview job: {exc}", 500) from exc

        can_commit = bool(storage_path) and parse_error is None and importable_rows > 0

        return {
            "job_id": job_id,
            "filename": filename,
            "source_type": source_type,
            "sheet": sheet_used,
            "fingerprint": fingerprint,
            "remembered_mapping_applied": bool(remembered),
            "total_rows": total_rows,
            "importable_rows": importable_rows,
            "dropped_rows": max(0, total_rows - importable_rows),
            "parse_error": parse_error,
            "can_commit": can_commit,
            "mapping": report,
            "sample_rows": sample_rows,
        }

    # ── commit ───────────────────────────────────────────────────────────────
    def commit_preview(
        self,
        *,
        job_id: str,
        tenant_id: UUID,
        overrides: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Re-parse the stashed file with confirmed overrides and import it."""
        job = self._get_preview_job(job_id, tenant_id)
        storage_path = job.get("storage_path")
        if not storage_path:
            raise ImportPreviewError(
                "Preview has no stored file — re-upload to preview again.", 409
            )
        filename = job.get("filename") or "upload.csv"
        source_type: SourceType = job.get("source_type") or "primary"  # type: ignore[assignment]

        try:
            content = self._supabase.storage.from_(self._bucket).download(storage_path)
        except Exception as exc:  # noqa: BLE001
            raise ImportPreviewError(f"Could not load stashed file: {exc}", 409) from exc

        # Explicit overrides win; otherwise reuse the mapping captured at preview.
        final = overrides if overrides is not None else (job.get("import_mapping") or None)

        # Recompute the fingerprint + resolved mapping from the actual file headers.
        raw_headers: list[str] = []
        sheet_used: str | int | None = None
        try:
            raw_df, sheet_used = _read_source_frame(content, filename, source_type, None)
            raw_headers = [str(c) for c in raw_df.columns]
        except Exception as exc:  # noqa: BLE001
            logger.warning("commit re-read for fingerprint failed: %s", exc)

        result = self._importer.import_file(
            file_content=content,
            filename=filename,
            tenant_id=tenant_id,
            source_type=source_type,
            sheet_name=sheet_used,
            import_job_id=job_id,
            overrides=final,
        )

        inserted = result.rows_inserted or 0
        status = "completed" if inserted > 0 else "failed"

        update: dict[str, Any] = {
            "status": status,
            "rows_inserted": inserted,
            "rows_skipped": result.rows_skipped or 0,
            "completed_at": datetime.now(UTC).isoformat(),
        }
        if final is not None:
            update["import_mapping"] = final
        if result.errors:
            update["error_message"] = "; ".join(result.errors)[:1000]
        try:
            self._supabase.table("import_jobs").update(update).eq("id", job_id).execute()
        except Exception as exc:  # noqa: BLE001
            logger.warning("failed to finalise preview job %s: %s", job_id, exc)

        mapping_remembered = False
        if inserted > 0 and raw_headers:
            fingerprint = fingerprint_headers(raw_headers)
            resolved = analyze_columns(raw_headers, source_type, final or None)[
                "resolved_mapping"
            ]
            self._memory.save(
                tenant_id, fingerprint, resolved, source_hint=str(source_type)
            )
            mapping_remembered = True

        # Founder path: record rows for dashboards, but do NOT consume upload quota.
        if inserted > 0:
            try:
                self._supabase.rpc(
                    "increment_usage",
                    {
                        "p_tenant_id": str(tenant_id),
                        "p_field": "rows_imported",
                        "p_amount": inserted,
                    },
                ).execute()
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to increment rows_imported usage: %s", exc)

        return {
            "job_id": job_id,
            "status": status,
            "source_type": source_type,
            "rows_inserted": inserted,
            "rows_skipped": result.rows_skipped or 0,
            "errors": result.errors,
            "warnings": result.warnings,
            "import_id": result.import_id,
            "mapping_remembered": mapping_remembered,
        }

    def estimate_commit(
        self,
        *,
        job_id: str,
        tenant_id: UUID,
        overrides: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Re-parse the stashed file for counts WITHOUT importing (commit dry-run).

        Reflects the impact under the *supplied* overrides, which may differ from
        the mapping captured at preview time — so the operator sees exactly what
        committing now would do.
        """
        job = self._get_preview_job(job_id, tenant_id)
        storage_path = job.get("storage_path")
        if not storage_path:
            raise ImportPreviewError(
                "Preview has no stored file — re-upload to preview again.", 409
            )
        filename = job.get("filename") or "upload.csv"
        source_type: SourceType = job.get("source_type") or "primary"  # type: ignore[assignment]

        try:
            content = self._supabase.storage.from_(self._bucket).download(storage_path)
        except Exception as exc:  # noqa: BLE001
            raise ImportPreviewError(f"Could not load stashed file: {exc}", 409) from exc

        final = overrides if overrides is not None else (job.get("import_mapping") or None)

        raw_df, sheet_used = _read_source_frame(content, filename, source_type, None)
        raw_headers = [str(c) for c in raw_df.columns]
        total_rows = int(len(raw_df))
        report = analyze_columns(raw_headers, source_type, final or None)

        importable_rows = 0
        parse_error: str | None = None
        try:
            parsed = self._importer.parse_dataframe(
                content, filename, source_type, sheet_used, final or None
            )
            importable_rows = int(len(parsed))
        except ValueError as exc:
            parse_error = str(exc)

        return {
            "job_id": job_id,
            "source_type": source_type,
            "total_rows": total_rows,
            "importable_rows": importable_rows,
            "dropped_rows": max(0, total_rows - importable_rows),
            "parse_error": parse_error,
            "mapping": report,
        }

    def _get_preview_job(self, job_id: str, tenant_id: UUID) -> dict[str, Any]:
        try:
            res = (
                self._supabase.table("import_jobs")
                .select("*")
                .eq("id", job_id)
                .eq("tenant_id", str(tenant_id))
                .single()
                .execute()
            )
        except Exception as exc:  # noqa: BLE001
            raise ImportPreviewError("Preview job not found", 404) from exc
        data = res.data
        if not data:
            raise ImportPreviewError("Preview job not found", 404)
        if data.get("status") != "preview":
            raise ImportPreviewError(
                f"Job is not an open preview (status={data.get('status')}).", 409
            )
        return data
