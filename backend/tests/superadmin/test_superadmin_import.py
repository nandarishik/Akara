"""Route tests for superadmin assisted CSV import (preview + commit).

The domain logic lives in ImportPreviewService and is unit-tested end-to-end in
tests/unit/domain/test_import_preview.py. These tests patch that service to a
stub and focus on the HTTP wiring the routes own: sudo + CSRF gating, multipart
parsing, source_type / overrides validation, the dry-run branch, audit
recording, and ImportPreviewError → HTTP status mapping.
"""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.domain.data_import.preview import ImportPreviewError
from tests.conftest import TENANT_FREE, USER_SUPERADMIN
from tests.superadmin.superadmin_helpers import (
    QaMatrixSupabase,
    patch_supabase_everywhere,
    sudo_session_row,
)

CSRF = "csrf-token-value"

PREVIEW_URL = f"/superadmin/tenants/{TENANT_FREE}/data/import/preview"
COMMIT_URL = f"/superadmin/tenants/{TENANT_FREE}/data/import/commit"

_PREVIEW_RESULT = {
    "job_id": "11111111-1111-1111-1111-111111111111",
    "filename": "sales.csv",
    "source_type": "primary",
    "sheet": None,
    "fingerprint": "abc123",
    "remembered_mapping_applied": False,
    "total_rows": 2,
    "importable_rows": 2,
    "dropped_rows": 0,
    "parse_error": None,
    "can_commit": True,
    "mapping": {"mapped": [], "unmapped": [], "missing_required": [], "resolved_mapping": {}},
    "sample_rows": [{"party_name": "Sharma Traders"}],
}

_COMMIT_RESULT = {
    "job_id": "11111111-1111-1111-1111-111111111111",
    "status": "completed",
    "source_type": "primary",
    "rows_inserted": 2,
    "rows_skipped": 0,
    "errors": [],
    "warnings": [],
    "import_id": "22222222-2222-2222-2222-222222222222",
    "mapping_remembered": True,
}

_ESTIMATE_RESULT = {
    "job_id": "11111111-1111-1111-1111-111111111111",
    "source_type": "primary",
    "total_rows": 2,
    "importable_rows": 2,
    "dropped_rows": 0,
    "parse_error": None,
    "mapping": {"mapped": [], "unmapped": [], "missing_required": [], "resolved_mapping": {}},
}


@pytest.fixture
def sudo_client():
    """A superadmin TestClient with a valid sudo + CSRF cookie pair, plus the
    matching QaMatrixSupabase (auth/tenant/audit surface)."""
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.main import app

    fake = AuthenticatedUser(
        user_id=USER_SUPERADMIN, email="superadmin@akara.test", role="superadmin"
    )
    app.dependency_overrides[get_current_user] = lambda: fake

    sid = uuid4()
    client = TestClient(app, headers={"Authorization": "Bearer fake-test-token"})
    client.cookies.set("akara_sudo", str(sid))
    client.cookies.set("akara_csrf", CSRF)
    supa = QaMatrixSupabase(sudo_session=sudo_session_row(session_id=sid))
    try:
        yield client, supa
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def _csv_file(content: bytes = b"Bill Date,Customer,Bill Amt\n2026-01-15,Acme,100\n"):
    return {"file": ("sales.csv", content, "text/csv")}


# ── preview ──────────────────────────────────────────────────────────────────

def test_preview_happy_path(sudo_client) -> None:
    client, supa = sudo_client
    with patch_supabase_everywhere(supa), patch(
        "app.api.superadmin.data.ImportPreviewService"
    ) as cls:
        cls.return_value.build_preview.return_value = _PREVIEW_RESULT
        resp = client.post(
            PREVIEW_URL,
            files=_csv_file(),
            data={"source_type": "primary"},
            headers={"X-CSRF-Token": CSRF},
        )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is True
    assert body["can_commit"] is True
    assert body["importable_rows"] == 2
    # The service received the file bytes + tenant.
    _, kwargs = cls.return_value.build_preview.call_args
    assert kwargs["tenant_id"] == TENANT_FREE
    assert kwargs["source_type"] == "primary"
    assert kwargs["file_content"]


def test_preview_forwards_parsed_overrides(sudo_client) -> None:
    client, supa = sudo_client
    with patch_supabase_everywhere(supa), patch(
        "app.api.superadmin.data.ImportPreviewService"
    ) as cls:
        cls.return_value.build_preview.return_value = _PREVIEW_RESULT
        resp = client.post(
            PREVIEW_URL,
            files=_csv_file(),
            data={"source_type": "primary", "overrides": '{"Cashier": "route"}'},
            headers={"X-CSRF-Token": CSRF},
        )

    assert resp.status_code == 200, resp.text
    _, kwargs = cls.return_value.build_preview.call_args
    assert kwargs["overrides"] == {"Cashier": "route"}


def test_preview_rejects_invalid_source_type(sudo_client) -> None:
    client, supa = sudo_client
    with patch_supabase_everywhere(supa):
        resp = client.post(
            PREVIEW_URL,
            files=_csv_file(),
            data={"source_type": "bogus"},
            headers={"X-CSRF-Token": CSRF},
        )
    assert resp.status_code == 400
    assert "source_type" in resp.text


def test_preview_rejects_empty_file(sudo_client) -> None:
    client, supa = sudo_client
    with patch_supabase_everywhere(supa):
        resp = client.post(
            PREVIEW_URL,
            files={"file": ("empty.csv", b"", "text/csv")},
            data={"source_type": "primary"},
            headers={"X-CSRF-Token": CSRF},
        )
    assert resp.status_code == 400
    assert "empty" in resp.text.lower()


def test_preview_rejects_malformed_overrides(sudo_client) -> None:
    client, supa = sudo_client
    with patch_supabase_everywhere(supa):
        resp = client.post(
            PREVIEW_URL,
            files=_csv_file(),
            data={"source_type": "primary", "overrides": "not-json"},
            headers={"X-CSRF-Token": CSRF},
        )
    assert resp.status_code == 400
    assert "overrides" in resp.text


def test_preview_maps_domain_error_to_http(sudo_client) -> None:
    client, supa = sudo_client
    with patch_supabase_everywhere(supa), patch(
        "app.api.superadmin.data.ImportPreviewService"
    ) as cls:
        cls.return_value.build_preview.side_effect = ImportPreviewError(
            "Could not read file: bad", 400
        )
        resp = client.post(
            PREVIEW_URL,
            files=_csv_file(),
            data={"source_type": "primary"},
            headers={"X-CSRF-Token": CSRF},
        )
    assert resp.status_code == 400
    assert "Could not read file" in resp.text


def test_preview_requires_sudo(sudo_client) -> None:
    client, supa = sudo_client
    client.cookies.delete("akara_sudo")
    with patch_supabase_everywhere(supa):
        resp = client.post(
            PREVIEW_URL,
            files=_csv_file(),
            data={"source_type": "primary"},
            headers={"X-CSRF-Token": CSRF},
        )
    assert resp.status_code == 403


def test_preview_requires_csrf(sudo_client) -> None:
    client, supa = sudo_client
    with patch_supabase_everywhere(supa):
        resp = client.post(
            PREVIEW_URL,
            files=_csv_file(),
            data={"source_type": "primary"},
            # No X-CSRF-Token header → double-submit check fails.
        )
    assert resp.status_code == 403


# ── commit ───────────────────────────────────────────────────────────────────

def test_commit_happy_path_records_audit(sudo_client) -> None:
    client, supa = sudo_client
    with patch_supabase_everywhere(supa), patch(
        "app.api.superadmin.data.ImportPreviewService"
    ) as cls:
        cls.return_value.commit_preview.return_value = _COMMIT_RESULT
        resp = client.post(
            COMMIT_URL,
            json={
                "job_id": "11111111-1111-1111-1111-111111111111",
                "reason": "Importing confirmed primary sales for onboarding",
            },
            headers={"X-CSRF-Token": CSRF},
        )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is True
    assert body["status"] == "completed"
    assert body["rows_inserted"] == 2
    assert body["mapping_remembered"] is True
    assert "audit" in body
    cls.return_value.commit_preview.assert_called_once()
    # Real commit path must NOT call the dry-run estimator.
    cls.return_value.estimate_commit.assert_not_called()


def test_commit_dry_run_uses_estimator_and_skips_import(sudo_client) -> None:
    client, supa = sudo_client
    with patch_supabase_everywhere(supa), patch(
        "app.api.superadmin.data.ImportPreviewService"
    ) as cls:
        cls.return_value.estimate_commit.return_value = _ESTIMATE_RESULT
        resp = client.post(
            COMMIT_URL,
            json={
                "job_id": "11111111-1111-1111-1111-111111111111",
                "reason": "Checking impact before committing the import",
                "dry_run": True,
            },
            headers={"X-CSRF-Token": CSRF},
        )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["dry_run"] is True
    assert body["impact"]["importable_rows"] == 2
    cls.return_value.estimate_commit.assert_called_once()
    cls.return_value.commit_preview.assert_not_called()


def test_commit_short_reason_rejected(sudo_client) -> None:
    client, supa = sudo_client
    with patch_supabase_everywhere(supa), patch(
        "app.api.superadmin.data.ImportPreviewService"
    ):
        resp = client.post(
            COMMIT_URL,
            json={"job_id": "11111111-1111-1111-1111-111111111111", "reason": "short"},
            headers={"X-CSRF-Token": CSRF},
        )
    assert resp.status_code == 422


def test_commit_maps_conflict_error_to_http(sudo_client) -> None:
    client, supa = sudo_client
    with patch_supabase_everywhere(supa), patch(
        "app.api.superadmin.data.ImportPreviewService"
    ) as cls:
        cls.return_value.commit_preview.side_effect = ImportPreviewError(
            "Job is not an open preview (status=completed).", 409
        )
        resp = client.post(
            COMMIT_URL,
            json={
                "job_id": "11111111-1111-1111-1111-111111111111",
                "reason": "Attempting to commit an already-finalised job",
            },
            headers={"X-CSRF-Token": CSRF},
        )
    assert resp.status_code == 409


def test_commit_requires_sudo(sudo_client) -> None:
    client, supa = sudo_client
    client.cookies.delete("akara_sudo")
    with patch_supabase_everywhere(supa), patch(
        "app.api.superadmin.data.ImportPreviewService"
    ):
        resp = client.post(
            COMMIT_URL,
            json={
                "job_id": "11111111-1111-1111-1111-111111111111",
                "reason": "Importing confirmed primary sales for onboarding",
            },
            headers={"X-CSRF-Token": CSRF},
        )
    assert resp.status_code == 403
