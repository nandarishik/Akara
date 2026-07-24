"""
Background processor for large async file imports (POST /data/import/async).

Uses asyncpg for atomic job claiming (SELECT FOR UPDATE SKIP LOCKED) and
DataImportService for parse + batch insert (same path as sync import).
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import asyncpg
from supabase import Client

from app.core.config import settings
from app.core.errors import DataImportError
from app.core.tenant import get_supabase_service_client
from app.services.data_import.service import DataImportService

logger = logging.getLogger(__name__)

IMPORTS_BUCKET = settings.supabase_imports_bucket


class ImportWorker:
    def __init__(self) -> None:
        self.worker_id = f"worker-{uuid.uuid4().hex[:8]}"
        self.supabase: Client = get_supabase_service_client()
        self.db_pool: asyncpg.Pool | None = None
        self.shutdown_requested = False
        self.heartbeat_interval = 10
        self.job_timeout = 300
        self.max_retries = 3
        self.retry_delays = [60, 300, 900]

    async def connect_db(self) -> None:
        if self.db_pool is not None:
            return
        postgres_url = settings.postgres_url
        if not postgres_url:
            raise RuntimeError(
                "SUPABASE_DB_URL or SUPABASE_POOLER_URL is required for the import worker"
            )
        self.db_pool = await asyncpg.create_pool(
            postgres_url,
            min_size=1,
            max_size=5,
            command_timeout=60,
        )
        logger.info("Worker %s connected to Postgres", self.worker_id)

    async def close_db(self) -> None:
        if self.db_pool:
            await self.db_pool.close()
            self.db_pool = None

    async def claim_job(self) -> dict[str, Any] | None:
        query = """
        UPDATE import_jobs
        SET
            status = 'processing',
            worker_id = $1,
            heartbeat_at = NOW()
        WHERE id = (
            SELECT id FROM import_jobs
            WHERE status = 'queued'
            ORDER BY created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        RETURNING id, tenant_id, user_id, source_type, filename,
                  storage_path, retry_count, created_at;
        """
        assert self.db_pool is not None
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(query, self.worker_id)
            if row:
                job = dict(row)
                logger.info("Worker %s claimed job %s", self.worker_id, job["id"])
                return job
        return None

    def update_heartbeat(self, job_id: UUID) -> None:
        self.supabase.table("import_jobs").update(
            {"heartbeat_at": datetime.now(UTC).isoformat()}
        ).eq("id", str(job_id)).execute()

    def complete_job(
        self,
        job_id: UUID,
        success: bool,
        rows_inserted: int = 0,
        error_message: str | None = None,
    ) -> None:
        status = "completed" if success else "failed"
        self.supabase.table("import_jobs").update(
            {
                "status": status,
                "rows_inserted": rows_inserted,
                "error_message": error_message,
                "completed_at": datetime.now(UTC).isoformat(),
                "worker_id": None,
            }
        ).eq("id", str(job_id)).execute()
        logger.info("Job %s marked as %s", job_id, status)

    def retry_job(self, job_id: UUID, retry_count: int, error_message: str) -> None:
        if retry_count >= self.max_retries:
            self.complete_job(
                job_id,
                False,
                0,
                f"Max retries exceeded: {error_message}",
            )
            logger.error(
                "Job %s moved to dead letter after %s retries", job_id, retry_count
            )
            return

        self.supabase.table("import_jobs").update(
            {
                "status": "queued",
                "retry_count": retry_count + 1,
                "error_message": error_message,
                "worker_id": None,
                "heartbeat_at": None,
            }
        ).eq("id", str(job_id)).execute()
        delay = self.retry_delays[min(retry_count, len(self.retry_delays) - 1)]
        logger.info(
            "Job %s scheduled for retry #%s in %ss", job_id, retry_count + 1, delay
        )

    def download_file(self, storage_path: str) -> bytes:
        if not storage_path:
            raise DataImportError("Missing storage_path on import job")
        try:
            response = self.supabase.storage.from_(IMPORTS_BUCKET).download(storage_path)
            if not response:
                raise DataImportError(f"Empty download for {storage_path}")
            return response
        except DataImportError:
            raise
        except Exception as exc:
            raise DataImportError(f"Storage download failed: {exc}") from exc

    async def _heartbeat_loop(self, job_id: UUID, timeout_seconds: int) -> None:
        start = time.time()
        try:
            while time.time() - start < timeout_seconds:
                await asyncio.sleep(self.heartbeat_interval)
                self.update_heartbeat(job_id)
        except asyncio.CancelledError:
            pass

    async def process_job(self, job: dict[str, Any]) -> bool:
        job_id = job["id"]
        tenant_id = UUID(str(job["tenant_id"]))
        source_type = str(job.get("source_type") or "primary")
        filename = str(job.get("filename") or "upload.csv")
        retry_count = int(job.get("retry_count") or 0)

        if source_type not in ("primary", "secondary", "scheme"):
            source_type = "primary"

        heartbeat_task = asyncio.create_task(self._heartbeat_loop(job_id, self.job_timeout))
        service = DataImportService(self.supabase)
        loop = asyncio.get_event_loop()

        try:
            file_data = await loop.run_in_executor(
                None, self.download_file, str(job["storage_path"])
            )
            df = await loop.run_in_executor(
                None,
                lambda: service.parse_dataframe(
                    file_data,
                    filename,
                    source_type=source_type,  # type: ignore[arg-type]
                ),
            )
            result = await loop.run_in_executor(
                None,
                lambda: service.import_dataframe(
                    df,
                    tenant_id,
                    source_type=source_type,  # type: ignore[arg-type]
                    filename=filename,
                    import_job_id=str(job_id),
                ),
            )
            if result.errors:
                raise DataImportError("; ".join(result.errors[:3]))

            self.complete_job(job_id, True, result.rows_inserted)
            logger.info(
                "Job %s completed: %s rows inserted",
                job_id,
                result.rows_inserted,
            )
            return True
        except Exception as exc:
            error_msg = str(exc)
            logger.error("Job %s failed: %s", job_id, error_msg)
            self.retry_job(job_id, retry_count, error_msg)
            return False
        finally:
            heartbeat_task.cancel()

    async def cleanup_stale_jobs(self) -> None:
        assert self.db_pool is not None
        stale_threshold = datetime.now(UTC) - timedelta(minutes=10)
        query = """
        UPDATE import_jobs
        SET
            status = 'queued',
            worker_id = NULL,
            retry_count = retry_count + 1,
            error_message = 'Worker timeout - rescheduled',
            heartbeat_at = NULL
        WHERE status = 'processing'
          AND heartbeat_at < $1
          AND retry_count < $2
        RETURNING id;
        """
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query, stale_threshold, self.max_retries)
            if rows:
                ids = [str(r["id"]) for r in rows]
                logger.info("Rescheduled %s stale jobs: %s", len(ids), ids)

    async def run_once(self) -> None:
        try:
            await self.connect_db()
            await self.cleanup_stale_jobs()
            job = await self.claim_job()
            if job:
                await self.process_job(job)
            else:
                logger.debug("Worker %s: no jobs available", self.worker_id)
        except Exception as exc:
            logger.error("Worker %s error: %s", self.worker_id, exc)
        finally:
            await self.close_db()

    async def run_forever(self, interval: int = 60) -> None:
        logger.info("Worker %s started (interval=%ss)", self.worker_id, interval)
        while not self.shutdown_requested:
            try:
                await self.run_once()
                await asyncio.sleep(interval)
            except KeyboardInterrupt:
                self.shutdown_requested = True
            except Exception as exc:
                logger.error("Worker %s unexpected error: %s", self.worker_id, exc)
                await asyncio.sleep(5)
        logger.info("Worker %s stopped", self.worker_id)


async def main() -> None:
    worker = ImportWorker()
    if os.getenv("WORKER_MODE") == "continuous":
        await worker.run_forever(interval=60)
    else:
        await worker.run_once()


if __name__ == "__main__":
    asyncio.run(main())
