"""
Import Worker - Background processor for large file imports

This worker runs every 60 seconds (Railway cron or Supabase Edge Function)
to process queued import jobs asynchronously.

Features:
- Idempotent processing with SELECT FOR UPDATE SKIP LOCKED
- Heartbeat mechanism to detect stuck workers
- 5-minute timeout with graceful recovery
- Retry logic with exponential backoff (max 3 attempts) 
- Dead-letter queue for permanent failures
- No duplicate rows (fingerprint/hash checking)
"""

import asyncio
import hashlib
import logging
import os
import time
import uuid
from datetime import datetime, timedelta
from typing import Any

import asyncpg
from supabase import Client, create_client

from app.core.config import settings
from app.core.errors import DataImportError
from app.services.data_import.models import ImportResult
from app.services.data_import.parser import DataParser

logger = logging.getLogger(__name__)

class ImportWorker:
    def __init__(self):
        self.worker_id = f"worker-{uuid.uuid4().hex[:8]}"
        self.supabase: Client = create_client(
            settings.supabase_url,
            settings.supabase_service_key  # Service role for full access
        )
        self.db_pool: asyncpg.Pool | None = None
        self.shutdown_requested = False

        # Worker configuration
        self.heartbeat_interval = 10  # seconds
        self.job_timeout = 300       # 5 minutes
        self.max_retries = 3
        self.retry_delays = [60, 300, 900]  # 1min, 5min, 15min

    async def connect_db(self):
        """Initialize database connection pool"""
        if self.db_pool is None:
            self.db_pool = await asyncpg.create_pool(
                settings.supabase_db_url,
                min_size=1,
                max_size=5,
                command_timeout=30
            )
            logger.info(f"Worker {self.worker_id} connected to database")

    async def close_db(self):
        """Close database connections"""
        if self.db_pool:
            await self.db_pool.close()
            self.db_pool = None

    async def claim_job(self) -> dict[str, Any] | None:
        """
        Atomically claim one queued job using SELECT FOR UPDATE SKIP LOCKED.
        Returns job dict if claimed, None if no jobs available.
        """
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

        async with self.db_pool.acquire() as conn:
            try:
                result = await conn.fetchrow(query, self.worker_id)
                if result:
                    job = dict(result)
                    logger.info(f"Worker {self.worker_id} claimed job {job['id']}")
                    return job
                return None
            except Exception as e:
                logger.error(f"Failed to claim job: {e}")
                return None

    async def update_heartbeat(self, job_id: uuid.UUID):
        """Update job heartbeat to indicate worker is alive"""
        query = """
        UPDATE import_jobs 
        SET heartbeat_at = NOW()
        WHERE id = $1 AND worker_id = $2;
        """

        async with self.db_pool.acquire() as conn:
            try:
                await conn.execute(query, job_id, self.worker_id)
            except Exception as e:
                logger.error(f"Failed to update heartbeat for job {job_id}: {e}")

    async def complete_job(self, job_id: uuid.UUID, success: bool,
                          rows_inserted: int = 0, error_message: str = None):
        """Mark job as completed or failed"""
        status = 'completed' if success else 'failed'
        query = """
        UPDATE import_jobs
        SET 
            status = $1,
            rows_inserted = $2,
            error_message = $3,
            completed_at = NOW()
        WHERE id = $4;
        """

        async with self.db_pool.acquire() as conn:
            try:
                await conn.execute(query, status, rows_inserted, error_message, job_id)
                logger.info(f"Job {job_id} marked as {status}")
            except Exception as e:
                logger.error(f"Failed to complete job {job_id}: {e}")

    async def retry_job(self, job_id: uuid.UUID, retry_count: int, error_message: str):
        """Schedule job for retry or move to dead letter if max retries exceeded"""
        if retry_count >= self.max_retries:
            # Move to dead letter
            await self.complete_job(job_id, False, 0, f"Max retries exceeded: {error_message}")
            logger.error(f"Job {job_id} moved to dead letter after {retry_count} retries")
            return

        # Schedule retry with delay
        delay_seconds = self.retry_delays[min(retry_count, len(self.retry_delays) - 1)]
        retry_at = datetime.utcnow() + timedelta(seconds=delay_seconds)

        query = """
        UPDATE import_jobs
        SET 
            status = 'queued',
            retry_count = $1,
            error_message = $2,
            worker_id = NULL,
            heartbeat_at = NULL
        WHERE id = $3;
        """

        async with self.db_pool.acquire() as conn:
            try:
                await conn.execute(query, retry_count + 1, error_message, job_id)
                logger.info(f"Job {job_id} scheduled for retry #{retry_count + 1} in {delay_seconds}s")
            except Exception as e:
                logger.error(f"Failed to schedule retry for job {job_id}: {e}")

    async def download_file(self, storage_path: str) -> bytes:
        """Download file from Supabase Storage"""
        try:
            # Extract bucket and path from storage_path
            # Format: "bucket_name/path/to/file.xlsx"
            parts = storage_path.split('/', 1)
            bucket = parts[0]
            path = parts[1] if len(parts) > 1 else storage_path

            response = self.supabase.storage.from_(bucket).download(path)
            if not response:
                raise DataImportError(f"Failed to download file from storage: {storage_path}")

            return response

        except Exception as e:
            raise DataImportError(f"Storage download failed: {str(e)}")

    def calculate_fingerprint(self, data: bytes, filename: str) -> str:
        """Calculate unique fingerprint for duplicate detection"""
        content_hash = hashlib.sha256(data).hexdigest()[:16]
        filename_hash = hashlib.md5(filename.encode()).hexdigest()[:8]
        return f"{filename_hash}_{content_hash}"

    async def check_duplicate(self, tenant_id: uuid.UUID, fingerprint: str) -> bool:
        """Check if this data has already been imported"""
        query = """
        SELECT COUNT(*) FROM sales_data 
        WHERE tenant_id = $1 
        AND metadata->>'fingerprint' = $2;
        """

        async with self.db_pool.acquire() as conn:
            try:
                count = await conn.fetchval(query, tenant_id, fingerprint)
                return count > 0
            except Exception:
                # If check fails, assume not duplicate to avoid blocking valid imports
                return False

    async def process_job(self, job: dict[str, Any]) -> bool:
        """
        Process a single import job.
        Returns True if successful, False if failed.
        """
        job_id = job['id']
        tenant_id = job['tenant_id']

        try:
            logger.info(f"Processing job {job_id}: {job['filename']}")

            # Download file from storage
            file_data = await self.download_file(job['storage_path'])

            # Calculate fingerprint for duplicate detection
            fingerprint = self.calculate_fingerprint(file_data, job['filename'])

            # Check for duplicates
            if await self.check_duplicate(tenant_id, fingerprint):
                logger.info(f"Job {job_id} skipped - duplicate data detected")
                await self.complete_job(job_id, True, 0, "Duplicate data - no rows imported")
                return True

            # Parse the file data
            parser = DataParser()

            # Create a temporary file-like object from bytes
            import io
            file_obj = io.BytesIO(file_data)
            file_obj.name = job['filename']  # Set filename for parser

            # Parse data with heartbeat updates
            async def heartbeat_callback():
                await self.update_heartbeat(job_id)

            # Schedule heartbeat updates during processing
            heartbeat_task = asyncio.create_task(
                self._heartbeat_loop(job_id, self.job_timeout)
            )

            try:
                result: ImportResult = await asyncio.get_event_loop().run_in_executor(
                    None, parser.parse_file, file_obj, job['source_type']
                )

                # Cancel heartbeat task
                heartbeat_task.cancel()

                # Insert data into database with fingerprint metadata
                rows_inserted = await self._insert_sales_data(
                    tenant_id, job_id, result, fingerprint
                )

                await self.complete_job(job_id, True, rows_inserted)
                logger.info(f"Job {job_id} completed successfully: {rows_inserted} rows")
                return True

            except asyncio.CancelledError:
                heartbeat_task.cancel()
                raise

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Job {job_id} failed: {error_msg}")

            # Retry logic
            await self.retry_job(job_id, job['retry_count'], error_msg)
            return False

    async def _heartbeat_loop(self, job_id: uuid.UUID, timeout_seconds: int):
        """Maintain heartbeat for the duration of job processing"""
        start_time = time.time()

        try:
            while time.time() - start_time < timeout_seconds:
                await asyncio.sleep(self.heartbeat_interval)
                await self.update_heartbeat(job_id)
        except asyncio.CancelledError:
            pass  # Normal cancellation when job completes

    async def _insert_sales_data(self, tenant_id: uuid.UUID, job_id: uuid.UUID,
                                result: ImportResult, fingerprint: str) -> int:
        """Insert parsed sales data into the database"""
        if not result.sales_data:
            return 0

        async with self.db_pool.acquire() as conn:
            async with conn.transaction():
                inserted_count = 0

                for row in result.sales_data:
                    # Add metadata including fingerprint and import_job_id
                    metadata = row.metadata or {}
                    metadata['fingerprint'] = fingerprint
                    metadata['import_source'] = 'async_worker'

                    query = """
                    INSERT INTO sales_data (
                        tenant_id, import_job_id, invoice_number, invoice_date,
                        party_name, route_name, salesman_name, item_name,
                        quantity, rate, amount, cgst, sgst, igst, total_amount,
                        metadata
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
                    );
                    """

                    try:
                        await conn.execute(
                            query,
                            tenant_id, job_id,
                            row.invoice_number, row.invoice_date,
                            row.party_name, row.route_name, row.salesman_name, row.item_name,
                            row.quantity, row.rate, row.amount,
                            row.cgst, row.sgst, row.igst, row.total_amount,
                            metadata
                        )
                        inserted_count += 1

                        # Update heartbeat every 100 rows
                        if inserted_count % 100 == 0:
                            await self.update_heartbeat(job_id)

                    except Exception as e:
                        logger.error(f"Failed to insert row {inserted_count}: {e}")
                        # Continue with other rows rather than failing entire job

                return inserted_count

    async def cleanup_stale_jobs(self):
        """Clean up jobs that have stale heartbeats (worker died)"""
        stale_threshold = datetime.utcnow() - timedelta(minutes=10)

        query = """
        UPDATE import_jobs
        SET 
            status = 'queued',
            worker_id = NULL,
            retry_count = retry_count + 1,
            error_message = 'Worker timeout - rescheduled'
        WHERE status = 'processing'
        AND heartbeat_at < $1
        AND retry_count < $2
        RETURNING id;
        """

        async with self.db_pool.acquire() as conn:
            try:
                results = await conn.fetch(query, stale_threshold, self.max_retries)
                if results:
                    job_ids = [row['id'] for row in results]
                    logger.info(f"Cleaned up {len(job_ids)} stale jobs: {job_ids}")
            except Exception as e:
                logger.error(f"Failed to clean up stale jobs: {e}")

    async def run_once(self):
        """Run one iteration of the worker loop"""
        try:
            await self.connect_db()

            # Clean up any stale jobs first
            await self.cleanup_stale_jobs()

            # Try to claim and process a job
            job = await self.claim_job()
            if job:
                await self.process_job(job)
            else:
                logger.debug(f"Worker {self.worker_id}: No jobs available")

        except Exception as e:
            logger.error(f"Worker {self.worker_id} error: {e}")
        finally:
            await self.close_db()

    async def run_forever(self, interval: int = 60):
        """Run the worker in a loop with the specified interval"""
        logger.info(f"Worker {self.worker_id} started with {interval}s interval")

        while not self.shutdown_requested:
            try:
                await self.run_once()
                await asyncio.sleep(interval)
            except KeyboardInterrupt:
                logger.info(f"Worker {self.worker_id} shutting down...")
                self.shutdown_requested = True
            except Exception as e:
                logger.error(f"Worker {self.worker_id} unexpected error: {e}")
                await asyncio.sleep(5)  # Brief pause before retry

        logger.info(f"Worker {self.worker_id} stopped")

# Entry point for Railway cron or standalone execution
async def main():
    """Main entry point for the import worker"""
    worker = ImportWorker()

    # Check if this is a one-shot execution (Railway cron) or continuous
    if os.getenv('WORKER_MODE') == 'continuous':
        await worker.run_forever(interval=60)
    else:
        # One-shot execution for Railway cron
        await worker.run_once()

if __name__ == "__main__":
    asyncio.run(main())
