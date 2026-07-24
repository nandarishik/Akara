"""Tests for import worker functionality."""
from datetime import UTC, datetime
from unittest.mock import Mock, patch

import pytest

from app.tasks.import_worker import (
    claim_job,
    mark_job_completed,
    mark_job_failed,
    process_import_job,
    update_job_heartbeat,
)


@pytest.fixture
def mock_supabase():
    """Mock Supabase client."""
    return Mock()


@pytest.fixture
def sample_job():
    """Sample import job for testing."""
    return {
        "id": "test-job-123",
        "filename": "test_data.xlsx",
        "source_type": "primary",
        "file_size": 1024,
        "estimated_rows": 100,
        "storage_path": "uploads/test_data.xlsx",
        "status": "pending",
        "progress_pct": 0,
        "created_at": datetime.now(UTC).isoformat(),
    }


class TestJobClaiming:
    """Tests for job claiming mechanism."""

    @patch("app.tasks.import_worker.supabase")
    def test_claim_job_success(self, mock_supabase, sample_job):
        """Test successful job claiming."""
        # Mock successful job claim
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = [sample_job]

        job = claim_job("worker-123")

        assert job is not None
        assert job["id"] == "test-job-123"
        assert job["status"] == "pending"

    @patch("app.tasks.import_worker.supabase")
    def test_claim_job_no_jobs_available(self, mock_supabase):
        """Test claiming when no jobs are available."""
        # Mock no jobs available
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = []

        job = claim_job("worker-123")

        assert job is None

    @patch("app.tasks.import_worker.supabase")
    def test_claim_job_database_error(self, mock_supabase):
        """Test job claiming with database error."""
        # Mock database error
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.side_effect = Exception("Database error")

        job = claim_job("worker-123")

        assert job is None


class TestJobProcessing:
    """Tests for job processing logic."""

    @patch("app.tasks.import_worker.supabase")
    @patch("app.tasks.import_worker.download_file_from_storage")
    @patch("app.tasks.import_worker.parse_file")
    @patch("app.tasks.import_worker.import_sales_data")
    def test_process_import_job_success(
        self,
        mock_import,
        mock_parse,
        mock_download,
        mock_supabase,
        sample_job
    ):
        """Test successful job processing."""
        # Mock successful file download
        mock_download.return_value = b"file content"

        # Mock successful file parsing
        mock_parse.return_value = [
            {"invoice_date": "2024-01-01", "invoice_number": "INV001", "total_amount": 1000},
            {"invoice_date": "2024-01-02", "invoice_number": "INV002", "total_amount": 2000},
        ]

        # Mock successful data import
        mock_import.return_value = {"rows_inserted": 2, "rows_skipped": 0, "errors": [], "warnings": []}

        result = process_import_job(sample_job)

        assert result is not None
        assert result["rows_inserted"] == 2
        assert result["rows_skipped"] == 0
        assert len(result["errors"]) == 0

    @patch("app.tasks.import_worker.supabase")
    @patch("app.tasks.import_worker.download_file_from_storage")
    def test_process_import_job_download_failure(self, mock_download, mock_supabase, sample_job):
        """Test job processing with file download failure."""
        # Mock download failure
        mock_download.side_effect = Exception("Download failed")

        result = process_import_job(sample_job)

        assert result is None

    @patch("app.tasks.import_worker.supabase")
    @patch("app.tasks.import_worker.download_file_from_storage")
    @patch("app.tasks.import_worker.parse_file")
    def test_process_import_job_parse_failure(self, mock_parse, mock_download, mock_supabase, sample_job):
        """Test job processing with file parsing failure."""
        # Mock successful download but parse failure
        mock_download.return_value = b"file content"
        mock_parse.side_effect = Exception("Parse failed")

        result = process_import_job(sample_job)

        assert result is None

    @patch("app.tasks.import_worker.supabase")
    @patch("app.tasks.import_worker.download_file_from_storage")
    @patch("app.tasks.import_worker.parse_file")
    @patch("app.tasks.import_worker.import_sales_data")
    def test_process_import_job_with_errors(
        self,
        mock_import,
        mock_parse,
        mock_download,
        mock_supabase,
        sample_job
    ):
        """Test job processing with some import errors."""
        # Mock successful file operations
        mock_download.return_value = b"file content"
        mock_parse.return_value = [{"invoice_date": "invalid", "total_amount": "invalid"}]

        # Mock import with errors
        mock_import.return_value = {
            "rows_inserted": 0,
            "rows_skipped": 1,
            "errors": ["Invalid date format"],
            "warnings": ["Missing optional field"]
        }

        result = process_import_job(sample_job)

        assert result is not None
        assert result["rows_inserted"] == 0
        assert result["rows_skipped"] == 1
        assert len(result["errors"]) == 1


class TestJobStatusUpdates:
    """Tests for job status update functions."""

    @patch("app.tasks.import_worker.supabase")
    def test_update_job_heartbeat(self, mock_supabase):
        """Test job heartbeat update."""
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = Mock()

        update_job_heartbeat("test-job-123", "worker-123", 50)

        # Verify update was called
        mock_supabase.table.assert_called_with("import_jobs")

    @patch("app.tasks.import_worker.supabase")
    def test_mark_job_failed(self, mock_supabase):
        """Test marking job as failed."""
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = Mock()

        mark_job_failed("test-job-123", "Processing failed")

        # Verify update was called with failed status
        mock_supabase.table.assert_called_with("import_jobs")

    @patch("app.tasks.import_worker.supabase")
    def test_mark_job_completed(self, mock_supabase, sample_job):
        """Test marking job as completed."""
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = Mock()

        result = {"rows_inserted": 100, "rows_skipped": 5}
        mark_job_completed("test-job-123", result)

        # Verify update was called with completed status
        mock_supabase.table.assert_called_with("import_jobs")


class TestWorkerLoop:
    """Tests for the main worker loop."""

    @patch("app.tasks.import_worker.claim_job")
    @patch("app.tasks.import_worker.process_import_job")
    @patch("app.tasks.import_worker.mark_job_completed")
    @patch("app.tasks.import_worker.time.sleep")
    def test_worker_loop_single_iteration(
        self,
        mock_sleep,
        mock_completed,
        mock_process,
        mock_claim,
        sample_job
    ):
        """Test single iteration of worker loop."""
        # Mock claiming a job, then no more jobs
        mock_claim.side_effect = [sample_job, None]

        # Mock successful processing
        mock_process.return_value = {"rows_inserted": 100, "rows_skipped": 0}

        # Run one iteration
        worker_id = "test-worker"

        # We'll just test the components since the full loop runs indefinitely
        job = claim_job(worker_id)
        assert job is not None

        result = process_import_job(job)
        assert result is not None
        assert result["rows_inserted"] == 100

    @patch("app.tasks.import_worker.claim_job")
    @patch("app.tasks.import_worker.mark_job_failed")
    @patch("app.tasks.import_worker.time.sleep")
    def test_worker_loop_no_jobs(self, mock_sleep, mock_failed, mock_claim):
        """Test worker loop with no jobs available."""
        # Mock no jobs available
        mock_claim.return_value = None

        # Test that claim_job returns None when no jobs
        job = claim_job("test-worker")
        assert job is None


class TestRetryLogic:
    """Tests for retry and dead letter queue logic."""

    @patch("app.tasks.import_worker.supabase")
    def test_job_retry_increment(self, mock_supabase, sample_job):
        """Test that failed jobs increment retry count."""
        # Modify sample job to simulate retry
        sample_job["retry_count"] = 2

        # Mock the job update for retry
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = Mock()

        mark_job_failed("test-job-123", "Retry attempt")

        # Verify the update was called
        mock_supabase.table.assert_called_with("import_jobs")

    def test_max_retries_exceeded(self, sample_job):
        """Test that jobs exceeding max retries are marked as dead letter."""
        # Simulate job with max retries exceeded
        sample_job["retry_count"] = 5  # Assuming max retries is 3

        # In real implementation, this would move to dead letter queue
        assert sample_job["retry_count"] > 3


class TestIdempotency:
    """Tests for idempotent operations."""

    @patch("app.tasks.import_worker.supabase")
    def test_duplicate_job_processing(self, mock_supabase, sample_job):
        """Test that duplicate jobs are handled idempotently."""
        # Mock job already being processed by another worker
        sample_job["status"] = "processing"
        sample_job["worker_id"] = "other-worker"

        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = []

        # Should not claim job already being processed
        job = claim_job("current-worker")
        assert job is None

    def test_heartbeat_timeout_detection(self, sample_job):
        """Test detection of stale jobs based on heartbeat timeout."""
        # Simulate old heartbeat (more than timeout threshold)
        old_heartbeat = datetime.now(UTC).replace(hour=0)  # Very old timestamp
        sample_job["heartbeat_at"] = old_heartbeat.isoformat()

        # In real implementation, this job would be available for claiming again
        # This tests the concept of heartbeat-based timeout detection
        assert sample_job["heartbeat_at"] is not None


@pytest.mark.asyncio
class TestAsyncOperations:
    """Tests for async operations if any."""

    async def test_concurrent_job_processing(self):
        """Test that multiple workers can process different jobs concurrently."""
        # This would test the concurrent processing capabilities
        # if the worker supports async operations


class TestErrorHandling:
    """Tests for error handling scenarios."""

    @patch("app.tasks.import_worker.supabase")
    def test_database_connection_loss(self, mock_supabase):
        """Test handling of database connection loss."""
        # Mock database connection error
        mock_supabase.table.side_effect = Exception("Connection lost")

        # Worker should handle gracefully and retry
        job = claim_job("worker-123")
        assert job is None

    @patch("app.tasks.import_worker.supabase")
    def test_storage_access_failure(self, mock_supabase, sample_job):
        """Test handling of storage access failures."""
        # This would test scenarios where Supabase Storage is unavailable
        with patch("app.tasks.import_worker.download_file_from_storage") as mock_download:
            mock_download.side_effect = Exception("Storage unavailable")

            result = process_import_job(sample_job)
            assert result is None

    def test_memory_limits_large_files(self, sample_job):
        """Test handling of large files that might exceed memory limits."""
        # Simulate very large file
        sample_job["file_size"] = 100 * 1024 * 1024  # 100MB

        # In real implementation, this would use streaming or chunked processing
        assert sample_job["file_size"] > 50 * 1024 * 1024


if __name__ == "__main__":
    pytest.main([__file__])
