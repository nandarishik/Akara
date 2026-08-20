"""Publish scheduled CMS content and apply due plan price migrations."""

from __future__ import annotations

import logging

from app.core.cron_ping import ping_cron_health
from app.infra.catalog.plan_catalog_service import apply_due_price_migrations
from app.infra.content.cms_service import publish_due_scheduled_content

logger = logging.getLogger(__name__)


def run_content_scheduler() -> dict:
    content = publish_due_scheduled_content()
    migrations = apply_due_price_migrations()
    logger.info(
        "Content scheduler: content_published=%s migrations_applied=%s",
        content.get("published"),
        migrations.get("applied"),
    )
    return {"ok": True, "content": content, "price_migrations": migrations}


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    try:
        details = run_content_scheduler()
        ping_cron_health("content_scheduler", details=details)
    except Exception:
        logger.exception("Content scheduler failed")
        ping_cron_health("content_scheduler", status="failed")
        raise


if __name__ == "__main__":
    main()
