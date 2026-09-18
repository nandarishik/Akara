import asyncio
import logging
from app.core.cron_ping import ping_cron_health
logger = logging.getLogger(__name__)
async def main() -> None:
    logger.info("connector sync worker idle")
    ping_cron_health("connector_sync_worker")
if __name__ == "__main__":
    asyncio.run(main())
