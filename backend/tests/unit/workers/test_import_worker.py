"""Tests for async import worker."""
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.domain.data_import.models import ImportResult
from app.workers.import_worker import ImportWorker


@pytest.fixture
def worker() -> ImportWorker:
    return ImportWorker()


@pytest.mark.asyncio
async def test_claim_job_returns_none_when_empty(worker: ImportWorker) -> None:
    mock_conn = AsyncMock()
    mock_conn.fetchrow = AsyncMock(return_value=None)
    mock_pool = MagicMock()
    mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)
    worker.db_pool = mock_pool

    job = await worker.claim_job()
    assert job is None


@pytest.mark.asyncio
async def test_process_job_completes_on_success(worker: ImportWorker) -> None:
    tenant_id = uuid4()
    job_id = uuid4()
    job = {
        "id": job_id,
        "tenant_id": tenant_id,
        "source_type": "primary",
        "filename": "sales.csv",
        "storage_path": "import-jobs/x/y/sales.csv",
        "retry_count": 0,
    }

    worker.download_file = MagicMock(return_value=b"csv-data")
    worker.complete_job = MagicMock()
    worker.retry_job = MagicMock()

    status_chain = MagicMock()
    status_chain.execute.return_value = MagicMock(data={"status": "processing"})
    worker.supabase = MagicMock()
    worker.supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = (
        status_chain
    )

    mock_df = MagicMock()
    mock_result = ImportResult(
        rows_inserted=10,
        rows_skipped=0,
        errors=[],
        warnings=[],
    )

    with patch("app.workers.import_worker.DataImportService") as mock_service_cls:
        mock_service = mock_service_cls.return_value
        mock_service.parse_dataframe.return_value = mock_df
        mock_service.import_dataframe.return_value = mock_result

        ok = await worker.process_job(job)

    assert ok is True
    worker.complete_job.assert_called_once_with(job_id, True, 10)
    worker.retry_job.assert_not_called()
