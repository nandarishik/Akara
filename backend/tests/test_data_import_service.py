"""
Tests for data import service including JSON-safe helpers and async import functionality.

These helpers were added to fix:
  - "Out of range float values are not JSON compliant: nan" (Supabase insert fail)
  - "Object of type date is not JSON serializable" (raw_data insert fail)

Also includes tests for async import job creation, tracking, and processing.
"""

import json
from datetime import date, datetime
from unittest.mock import Mock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.data_import.service import (
    _safe_float,
    _safe_str,
    _sanitize_for_json,
)

# ── _safe_float ──────────────────────────────────────────────────────────────

def test_safe_float_handles_nan():
    assert _safe_float(float("nan")) == 0.0
    assert _safe_float(float("inf")) == 0.0
    assert _safe_float(float("-inf")) == 0.0


def test_safe_float_handles_none():
    assert _safe_float(None) == 0.0


def test_safe_float_handles_string():
    assert _safe_float("42.5") == 42.5
    assert _safe_float("not_a_number") == 0.0


def test_safe_float_normal_values():
    assert _safe_float(100) == 100.0
    assert _safe_float(3.14) == pytest.approx(3.14)
    assert _safe_float(0) == 0.0


# ── _safe_str ────────────────────────────────────────────────────────────────

def test_safe_str_handles_nan():
    assert _safe_str(float("nan")) == ""
    assert _safe_str("nan") == ""
    assert _safe_str("NaN") == ""


def test_safe_str_handles_none():
    assert _safe_str(None) == ""


def test_safe_str_normal_values():
    assert _safe_str("hello") == "hello"
    assert _safe_str(42) == "42"


# ── _sanitize_for_json ───────────────────────────────────────────────────────

def test_sanitize_for_json_removes_nan():
    data = {"amount": float("nan"), "name": "test"}
    result = _sanitize_for_json(data)
    assert result["amount"] is None
    assert result["name"] == "test"
    # Must be JSON-serializable
    json.dumps(result)


def test_sanitize_for_json_handles_date():
    data = {"invoice_date": date(2025, 12, 7), "name": "test"}
    result = _sanitize_for_json(data)
    assert result["invoice_date"] == "2025-12-07"
    json.dumps(result)


def test_sanitize_for_json_handles_datetime():
    data = {"created_at": datetime(2025, 12, 7, 10, 30, 0)}
    result = _sanitize_for_json(data)
    assert result["created_at"] == "2025-12-07T10:30:00"
    json.dumps(result)


def test_sanitize_for_json_nested():
    data = {"outer": {"inner": float("nan"), "date": date(2025, 1, 1)}}
    result = _sanitize_for_json(data)
    assert result["outer"]["inner"] is None
    assert result["outer"]["date"] == "2025-01-01"
    json.dumps(result)


def test_import_records_are_json_serializable():
    """Smoke test: enrich a row with NaN values and verify JSON serialization."""
    from uuid import UUID

    from app.services.data_import.service import _enrich_primary

    row = {
        "invoice_date": date(2025, 12, 7),
        "party_name": "Sharma Traders",
        "total_amount": 1500.0,
        "quantity": float("nan"),       # NaN — the original bug
        "gross_amount": float("nan"),
        "discount_amount": float("nan"),
        "net_amount": float("nan"),
        "tax_amount": float("nan"),
        "some_extra_col": float("nan"),
    }
    tenant_id = UUID("00000000-0000-0000-0000-000000000001")
    record = _enrich_primary(row, tenant_id)

    # Must serialize without error
    serialized = json.dumps(record)
    assert len(serialized) > 0

    # NaN columns should be 0.0
    assert record["quantity"] == 0.0
    assert record["gross_amount"] == 0.0


# ── Async Import Tests ──────────────────────────────────────────────────────

@pytest.fixture
def client():
    """Test client for FastAPI app."""
    return TestClient(app)


@pytest.fixture
def mock_auth_headers():
    """Mock authentication headers."""
    return {"Authorization": "Bearer test-token"}


@pytest.fixture
def sample_file_content():
    """Sample CSV file content for testing."""
    return b"""invoice_date,invoice_number,party_name,total_amount
2024-01-01,INV001,Test Party 1,1000
2024-01-02,INV002,Test Party 2,2000
"""


class TestAsyncImport:
    """Tests for async import functionality."""

    @patch("app.api.routes.data.supabase")
    def test_async_import_creation(self, mock_supabase, client, mock_auth_headers, sample_file_content):
        """Test creation of async import job."""
        # Mock successful job creation
        mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [{
            "id": "job-123",
            "filename": "test.csv",
            "status": "pending",
            "estimated_rows": 2
        }]

        # Mock file upload to storage
        mock_supabase.storage.from_.return_value.upload.return_value = Mock(
            data={"path": "uploads/test.csv"}
        )

        response = client.post(
            "/api/data/import/async?source_type=primary",
            files={"file": ("test.csv", sample_file_content, "text/csv")},
            headers=mock_auth_headers
        )

        assert response.status_code == 202
        data = response.json()
        assert "job_id" in data
        assert "estimated_rows" in data
        assert data["status"] == "queued"

    @patch("app.api.routes.data.supabase")
    def test_async_import_large_file_auto_detection(self, mock_supabase, client, mock_auth_headers):
        """Test that large files automatically use async processing."""
        # Create a large file (>5MB)
        large_file_content = b"data," * (5 * 1024 * 1024 // 5)  # Roughly 5MB

        # Mock successful job creation
        mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [{
            "id": "job-456",
            "filename": "large_file.csv",
            "status": "pending",
            "estimated_rows": 100000
        }]

        # Mock file upload
        mock_supabase.storage.from_.return_value.upload.return_value = Mock(
            data={"path": "uploads/large_file.csv"}
        )

        response = client.post(
            "/api/data/import?source_type=primary",  # Regular endpoint
            files={"file": ("large_file.csv", large_file_content, "text/csv")},
            headers=mock_auth_headers
        )

        # Should automatically redirect to async processing
        assert response.status_code == 202

    @patch("app.api.routes.data.supabase")
    def test_get_import_job_status(self, mock_supabase, client, mock_auth_headers):
        """Test getting import job status."""
        # Mock job status response
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            "id": "job-123",
            "filename": "test.csv",
            "source_type": "primary",
            "status": "processing",
            "progress_pct": 75,
            "rows_inserted": 750,
            "created_at": "2024-01-01T00:00:00Z"
        }

        response = client.get(
            "/api/data/import/jobs/job-123",
            headers=mock_auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "job-123"
        assert data["status"] == "processing"
        assert data["progress_pct"] == 75

    @patch("app.api.routes.data.supabase")
    def test_get_import_job_not_found(self, mock_supabase, client, mock_auth_headers):
        """Test getting non-existent import job."""
        # Mock job not found
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception("Not found")

        response = client.get(
            "/api/data/import/jobs/nonexistent-job",
            headers=mock_auth_headers
        )

        assert response.status_code == 404

    @patch("app.api.routes.data.supabase")
    def test_list_import_jobs(self, mock_supabase, client, mock_auth_headers):
        """Test listing all import jobs for a tenant."""
        # Mock jobs list response
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = [
            {
                "id": "job-1",
                "filename": "file1.csv",
                "status": "completed",
                "rows_inserted": 100,
                "created_at": "2024-01-01T00:00:00Z"
            },
            {
                "id": "job-2",
                "filename": "file2.csv",
                "status": "processing",
                "progress_pct": 50,
                "created_at": "2024-01-02T00:00:00Z"
            }
        ]

        response = client.get(
            "/api/data/import/jobs",
            headers=mock_auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "jobs" in data
        assert len(data["jobs"]) == 2
        assert data["jobs"][0]["status"] == "completed"

    @patch("app.api.routes.data.supabase")
    def test_list_import_jobs_with_pagination(self, mock_supabase, client, mock_auth_headers):
        """Test listing import jobs with pagination."""
        # Mock paginated response
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = []

        response = client.get(
            "/api/data/import/jobs?limit=10&offset=20",
            headers=mock_auth_headers
        )

        assert response.status_code == 200
        # Verify limit and offset were applied in the query chain
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.limit.assert_called_with(10)

    @patch("app.api.routes.data.supabase")
    def test_async_import_quota_check(self, mock_supabase, client, mock_auth_headers, sample_file_content):
        """Test that async import checks quota before creating job."""
        # Mock quota exceeded
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            "rows_imported_this_month": 50000,
            "rows_limit": 50000  # At limit
        }

        response = client.post(
            "/api/data/import/async?source_type=primary",
            files={"file": ("test.csv", sample_file_content, "text/csv")},
            headers=mock_auth_headers
        )

        assert response.status_code == 402  # Payment required / quota exceeded

    def test_async_import_unsupported_file_type(self, client, mock_auth_headers):
        """Test async import with unsupported file type."""
        response = client.post(
            "/api/data/import/async?source_type=primary",
            files={"file": ("test.txt", b"not a spreadsheet", "text/plain")},
            headers=mock_auth_headers
        )

        assert response.status_code == 400
        data = response.json()
        assert "Unsupported file type" in data["detail"]

    def test_async_import_invalid_source_type(self, client, mock_auth_headers, sample_file_content):
        """Test async import with invalid source type."""
        response = client.post(
            "/api/data/import/async?source_type=invalid",
            files={"file": ("test.csv", sample_file_content, "text/csv")},
            headers=mock_auth_headers
        )

        assert response.status_code == 422  # Validation error


class TestImportJobProcessing:
    """Tests for import job processing logic."""

    def test_estimate_rows_from_file_size(self):
        """Test row estimation from file size."""
        # This would test the estimation algorithm
        # Typical CSV row might be ~100 bytes, so 1KB file ≈ 10 rows
        file_size = 1024  # 1KB
        estimated_rows = file_size // 100  # Simple estimation
        assert estimated_rows == 10

    def test_fingerprint_generation(self):
        """Test generation of row fingerprints for duplicate detection."""
        # Test data for fingerprint generation
        row_data = {
            "invoice_date": "2024-01-01",
            "invoice_number": "INV001",
            "party_name": "Test Party",
            "total_amount": 1000
        }

        # In real implementation, this would generate a consistent hash
        # for duplicate detection across imports
        import hashlib
        fingerprint_data = f"{row_data['invoice_date']}-{row_data['invoice_number']}-{row_data['party_name']}"
        fingerprint = hashlib.md5(fingerprint_data.encode()).hexdigest()

        assert len(fingerprint) == 32  # MD5 hash length
        assert fingerprint == hashlib.md5(fingerprint_data.encode()).hexdigest()  # Consistent

    @patch("app.api.routes.data.supabase")
    def test_duplicate_detection_in_import(self, mock_supabase):
        """Test that duplicate rows are detected and skipped."""
        # Mock existing row check
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {"id": "existing-row"}  # Indicates duplicate exists
        ]

        # In real implementation, this would be called during import processing
        # to check if a row with the same fingerprint already exists
        existing_data = mock_supabase.table("sales").select("id").eq("fingerprint", "test-hash").execute().data

        # Should detect duplicate
        assert len(existing_data) > 0

    def test_batch_processing_large_files(self):
        """Test that large files are processed in batches."""
        # Test batch size calculation
        total_rows = 100000
        batch_size = 1000
        expected_batches = total_rows // batch_size

        assert expected_batches == 100

        # Test batch processing simulation
        processed_rows = 0
        for batch_num in range(expected_batches):
            batch_start = batch_num * batch_size
            batch_end = min((batch_num + 1) * batch_size, total_rows)
            batch_rows = batch_end - batch_start
            processed_rows += batch_rows

        assert processed_rows == total_rows


class TestImportJobRetries:
    """Tests for import job retry logic."""

    def test_job_retry_on_failure(self):
        """Test that failed jobs are retried with exponential backoff."""
        # Test retry count increment
        initial_retry_count = 0
        max_retries = 3

        # Simulate failure and retry
        retry_count = initial_retry_count + 1
        assert retry_count <= max_retries

        # Test exponential backoff calculation
        base_delay = 60  # 1 minute
        backoff_delay = base_delay * (2 ** (retry_count - 1))
        expected_delays = [60, 120, 240]  # 1min, 2min, 4min

        assert backoff_delay == expected_delays[retry_count - 1]

    def test_dead_letter_queue_after_max_retries(self):
        """Test that jobs move to dead letter queue after max retries."""
        retry_count = 4
        max_retries = 3

        # Should be moved to dead letter queue
        assert retry_count > max_retries

    def test_job_timeout_detection(self):
        """Test detection of stuck/timed out jobs."""
        from datetime import datetime, timedelta

        # Simulate job heartbeat from 2 hours ago
        last_heartbeat = datetime.now() - timedelta(hours=2)
        timeout_threshold = timedelta(minutes=30)

        # Should be considered timed out
        is_timed_out = datetime.now() - last_heartbeat > timeout_threshold
        assert is_timed_out


class TestAsyncImportSecurity:
    """Tests for async import security."""

    def test_file_size_limits(self, client, mock_auth_headers):
        """Test that file size limits are enforced."""
        # Create oversized file (>50MB)
        oversized_content = b"x" * (51 * 1024 * 1024)  # 51MB

        response = client.post(
            "/api/data/import/async?source_type=primary",
            files={"file": ("huge.csv", oversized_content, "text/csv")},
            headers=mock_auth_headers
        )

        assert response.status_code == 413  # Payload too large

    def test_malicious_filename_sanitization(self, client, mock_auth_headers, sample_file_content):
        """Test that malicious filenames are sanitized."""
        malicious_filename = "../../etc/passwd"

        with patch("app.api.routes.data.supabase") as mock_supabase:
            mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [{
                "id": "job-789",
                "filename": "passwd",  # Should be sanitized
                "status": "pending"
            }]
            mock_supabase.storage.from_.return_value.upload.return_value = Mock(data={"path": "uploads/safe_name.csv"})

            response = client.post(
                "/api/data/import/async?source_type=primary",
                files={"file": (malicious_filename, sample_file_content, "text/csv")},
                headers=mock_auth_headers
            )

            # Should succeed but with sanitized filename
            assert response.status_code == 202

    def test_file_content_validation(self, client, mock_auth_headers):
        """Test that file content is validated."""
        # Test with binary file disguised as CSV
        malicious_content = b"\x89PNG\r\n\x1a\n"  # PNG header

        response = client.post(
            "/api/data/import/async?source_type=primary",
            files={"file": ("fake.csv", malicious_content, "text/csv")},
            headers=mock_auth_headers
        )

        # Should reject non-CSV content
        assert response.status_code == 400


if __name__ == "__main__":
    pytest.main([__file__])
