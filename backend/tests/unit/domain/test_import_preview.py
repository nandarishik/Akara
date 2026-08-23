"""Unit tests for ImportPreviewService (assisted CSV onboarding).

Uses a purpose-built fake Supabase that models the three surfaces the preview
service touches — storage (upload/download), the import_jobs table, and RPCs
(mapping-memory upsert + usage increment) — so build/commit run end-to-end
against real parsing without a live database.
"""

from __future__ import annotations

import io
from unittest.mock import MagicMock
from uuid import UUID

import pandas as pd
import pytest

from app.domain.data_import.preview import ImportPreviewError, ImportPreviewService

TENANT = UUID("00000000-0000-0000-0000-000000000001")
OTHER_TENANT = UUID("00000000-0000-0000-0000-0000000000ff")


def make_csv(rows: list[dict]) -> bytes:
    buf = io.StringIO()
    pd.DataFrame(rows).to_csv(buf, index=False)
    return buf.getvalue().encode()


PRIMARY_ROWS = [
    {"Bill Date": "2026-01-15", "Customer": "Sharma Traders", "Bill Amt": 1500, "Cashier": "Ravi"},
    {"Bill Date": "2026-01-16", "Customer": "Verma Stores", "Bill Amt": 900, "Cashier": "Sita"},
]


# ── fake supabase ─────────────────────────────────────────────────────────────

class _FakeBucket:
    def __init__(self, store: dict[str, bytes]) -> None:
        self._store = store

    def upload(self, path: str, content: bytes, opts: dict | None = None):
        self._store[path] = content
        return MagicMock()

    def download(self, path: str) -> bytes:
        if path not in self._store:
            raise RuntimeError(f"object not found: {path}")
        return self._store[path]


class _FakeStorage:
    def __init__(self, store: dict[str, bytes]) -> None:
        self._store = store

    def from_(self, _bucket: str) -> _FakeBucket:
        return _FakeBucket(self._store)


class _FakeTable:
    def __init__(self, client: "_FakePreviewSupabase", name: str) -> None:
        self._c = client
        self._name = name
        self._op: str | None = None
        self._payload = None
        self._filters: dict[str, object] = {}

    def insert(self, payload):
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload):
        self._op, self._payload = "update", payload
        return self

    def select(self, *_a, **_k):
        self._op = "select"
        return self

    def eq(self, col: str, val):
        self._filters[col] = val
        return self

    def limit(self, *_a, **_k):
        return self

    def single(self):
        return self

    def maybe_single(self):
        return self

    def execute(self):
        if self._name == "import_jobs":
            if self._op == "insert":
                rows = self._payload if isinstance(self._payload, list) else [self._payload]
                for r in rows:
                    self._c.import_jobs[str(r["id"])] = dict(r)
                return MagicMock(data=rows)
            if self._op == "update":
                jid = str(self._filters.get("id"))
                if jid in self._c.import_jobs:
                    self._c.import_jobs[jid].update(self._payload)
                self._c.job_updates.append((jid, dict(self._payload)))
                return MagicMock(data=[self._c.import_jobs.get(jid, {})])
            # select
            row = self._c.import_jobs.get(str(self._filters.get("id")))
            tid = self._filters.get("tenant_id")
            if row and tid is not None and str(row.get("tenant_id")) != str(tid):
                row = None
            return MagicMock(data=row)

        if self._name == "mapping_memory" and self._op == "select":
            return MagicMock(data=list(self._c.remembered_rows))

        # sales_data / secondary_sales_data / scheme_master / generated_reports
        if self._op == "insert":
            self._c.inserts.setdefault(self._name, []).append(self._payload)
            return MagicMock(data=[{}])
        return MagicMock(data=[])


class _FakePreviewSupabase:
    def __init__(
        self,
        *,
        remembered: list[dict] | None = None,
        seed_jobs: dict[str, dict] | None = None,
        seed_storage: dict[str, bytes] | None = None,
    ) -> None:
        self.import_jobs: dict[str, dict] = dict(seed_jobs or {})
        self.storage_files: dict[str, bytes] = dict(seed_storage or {})
        self.storage = _FakeStorage(self.storage_files)
        self.remembered_rows = remembered or []
        self.inserts: dict[str, list] = {}
        self.job_updates: list[tuple[str, dict]] = []
        self.rpc_calls: list[tuple[str, dict | None]] = []

    def table(self, name: str) -> _FakeTable:
        return _FakeTable(self, name)

    def rpc(self, name: str, params: dict | None = None):
        self.rpc_calls.append((name, params))
        chain = MagicMock()
        chain.execute.return_value = MagicMock(data=None)
        return chain


# ── build_preview ─────────────────────────────────────────────────────────────

def test_build_preview_happy_path() -> None:
    supa = _FakePreviewSupabase()
    svc = ImportPreviewService(supa)

    result = svc.build_preview(
        file_content=make_csv(PRIMARY_ROWS),
        filename="sales.csv",
        tenant_id=TENANT,
        user_id=UUID("00000000-0000-0000-0000-0000000000aa"),
    )

    assert result["total_rows"] == 2
    assert result["importable_rows"] == 2
    assert result["dropped_rows"] == 0
    assert result["parse_error"] is None
    assert result["can_commit"] is True
    assert result["remembered_mapping_applied"] is False

    resolved = result["mapping"]["resolved_mapping"]
    assert resolved["bill_date"] == "invoice_date"
    assert resolved["customer"] == "party_name"
    assert resolved["bill_amt"] == "total_amount"
    # Unrecognised column falls through to raw_data.
    assert [u["source"] for u in result["mapping"]["unmapped"]] == ["Cashier"]

    # A preview job was persisted with status='preview' + the resolved mapping,
    # and the raw bytes were stashed. No usage RPC fires at preview time.
    job = supa.import_jobs[result["job_id"]]
    assert job["status"] == "preview"
    assert job["import_mapping"]["bill_amt"] == "total_amount"
    assert job["storage_path"] in supa.storage_files
    assert supa.rpc_calls == []

    # Sample rows are JSON-safe (dates already serialised, no numpy scalars).
    assert result["sample_rows"]
    assert result["sample_rows"][0]["party_name"] == "Sharma Traders"


def test_build_preview_applies_remembered_mapping() -> None:
    # A previously-confirmed mapping for this tenant force-maps an odd column
    # ("teller") that no built-in alias would recognise as party_name.
    supa = _FakePreviewSupabase(
        remembered=[{"column_mapping": {"teller": "route", "bill_amt": "total_amount"}}]
    )
    svc = ImportPreviewService(supa)

    result = svc.build_preview(
        file_content=make_csv(
            [{"Bill Date": "2026-01-15", "Customer": "A", "Bill Amt": 100, "Teller": "West"}]
        ),
        filename="sales.csv",
        tenant_id=TENANT,
    )

    assert result["remembered_mapping_applied"] is True
    assert result["mapping"]["resolved_mapping"]["teller"] == "route"
    assert result["importable_rows"] == 1


def test_build_preview_missing_required_cannot_commit() -> None:
    supa = _FakePreviewSupabase()
    svc = ImportPreviewService(supa)

    # No party_name or amount column at all → parser raises, preview reports it.
    result = svc.build_preview(
        file_content=make_csv([{"Bill Date": "2026-01-15", "Note": "x"}]),
        filename="sales.csv",
        tenant_id=TENANT,
    )

    assert result["importable_rows"] == 0
    assert result["parse_error"] is not None
    assert result["can_commit"] is False
    assert "party_name" in result["mapping"]["missing_required"]
    assert "total_amount" in result["mapping"]["missing_required"]
    # The preview job is still recorded (operator can re-preview with overrides).
    assert supa.import_jobs[result["job_id"]]["status"] == "preview"


def test_build_preview_override_forces_unmapped_column() -> None:
    supa = _FakePreviewSupabase()
    svc = ImportPreviewService(supa)

    result = svc.build_preview(
        file_content=make_csv(PRIMARY_ROWS),
        filename="sales.csv",
        tenant_id=TENANT,
        overrides={"Cashier": "route"},
    )

    resolved = result["mapping"]["resolved_mapping"]
    assert resolved["cashier"] == "route"
    assert result["mapping"]["unmapped"] == []


# ── commit_preview ────────────────────────────────────────────────────────────

def _seed_preview_job(
    supa: _FakePreviewSupabase,
    *,
    job_id: str = "11111111-1111-1111-1111-111111111111",
    tenant_id: UUID = TENANT,
    status: str = "preview",
    mapping: dict | None = None,
) -> str:
    path = f"import-jobs/{tenant_id}/{job_id}/sales.csv"
    supa.import_jobs[job_id] = {
        "id": job_id,
        "tenant_id": str(tenant_id),
        "status": status,
        "storage_path": path,
        "filename": "sales.csv",
        "source_type": "primary",
        "import_mapping": mapping or {"bill_amt": "total_amount"},
    }
    supa.storage_files[path] = make_csv(PRIMARY_ROWS)
    return job_id


def test_commit_preview_happy_path_imports_and_remembers() -> None:
    supa = _FakePreviewSupabase()
    job_id = _seed_preview_job(supa)
    svc = ImportPreviewService(supa)

    result = svc.commit_preview(job_id=job_id, tenant_id=TENANT)

    assert result["status"] == "completed"
    assert result["rows_inserted"] == 2
    assert result["mapping_remembered"] is True

    # Job finalised in place.
    assert supa.import_jobs[job_id]["status"] == "completed"
    assert supa.import_jobs[job_id]["rows_inserted"] == 2
    assert "completed_at" in supa.import_jobs[job_id]

    # Rows landed in sales_data.
    assert "sales_data" in supa.inserts

    # Mapping was remembered for this tenant + file shape.
    rpc_names = [name for name, _ in supa.rpc_calls]
    assert "upsert_mapping_memory" in rpc_names


def test_commit_founder_bypass_only_increments_rows_imported() -> None:
    supa = _FakePreviewSupabase()
    job_id = _seed_preview_job(supa)
    svc = ImportPreviewService(supa)

    svc.commit_preview(job_id=job_id, tenant_id=TENANT)

    usage = [params for name, params in supa.rpc_calls if name == "increment_usage"]
    fields = {p.get("p_field") for p in usage}
    # Founder onboarding: rows are recorded for dashboards, but the per-tenant
    # upload-count caps are NOT consumed.
    assert "rows_imported" in fields
    assert "uploads_count" not in fields
    assert "uploads_today" not in fields
    rows_call = next(p for p in usage if p.get("p_field") == "rows_imported")
    assert rows_call["p_amount"] == 2


def test_commit_preview_override_wins_over_stored_mapping() -> None:
    supa = _FakePreviewSupabase()
    job_id = _seed_preview_job(supa)
    svc = ImportPreviewService(supa)

    # Drop the amount column via override → nothing importable → failed commit.
    result = svc.commit_preview(job_id=job_id, tenant_id=TENANT, overrides={"Bill Amt": ""})

    assert result["status"] == "failed"
    assert result["rows_inserted"] == 0
    assert supa.import_jobs[job_id]["status"] == "failed"


def test_commit_preview_rejects_non_preview_job() -> None:
    supa = _FakePreviewSupabase()
    job_id = _seed_preview_job(supa, status="completed")
    svc = ImportPreviewService(supa)

    with pytest.raises(ImportPreviewError) as exc:
        svc.commit_preview(job_id=job_id, tenant_id=TENANT)
    assert exc.value.status_code == 409


def test_commit_preview_missing_job_is_404() -> None:
    supa = _FakePreviewSupabase()
    svc = ImportPreviewService(supa)

    with pytest.raises(ImportPreviewError) as exc:
        svc.commit_preview(job_id="99999999-9999-9999-9999-999999999999", tenant_id=TENANT)
    assert exc.value.status_code == 404


def test_commit_preview_cross_tenant_is_404() -> None:
    supa = _FakePreviewSupabase()
    job_id = _seed_preview_job(supa, tenant_id=TENANT)
    svc = ImportPreviewService(supa)

    # A different tenant must not be able to commit this job.
    with pytest.raises(ImportPreviewError) as exc:
        svc.commit_preview(job_id=job_id, tenant_id=OTHER_TENANT)
    assert exc.value.status_code == 404


def test_estimate_commit_reports_impact_without_importing() -> None:
    supa = _FakePreviewSupabase()
    job_id = _seed_preview_job(supa)
    svc = ImportPreviewService(supa)

    est = svc.estimate_commit(job_id=job_id, tenant_id=TENANT)

    assert est["total_rows"] == 2
    assert est["importable_rows"] == 2
    assert est["parse_error"] is None
    # Dry-run must not import, remember, or finalise anything.
    assert "sales_data" not in supa.inserts
    assert supa.rpc_calls == []
    assert supa.import_jobs[job_id]["status"] == "preview"
