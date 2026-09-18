"""Structured logging for AKARA (Phase 3)."""

from __future__ import annotations

import logging
import sys
from contextvars import ContextVar
from typing import Any

import structlog

from app.core.config import settings

correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")
tenant_id_var: ContextVar[str | None] = ContextVar("tenant_id", default=None)


def get_correlation_id() -> str:
    return correlation_id_var.get()


def _inject_akara_fields(
    logger: Any, method_name: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    event_dict.setdefault("correlation_id", correlation_id_var.get() or None)
    event_dict.setdefault("tenant_id", tenant_id_var.get())
    event_dict["environment"] = settings.environment
    event_dict["service"] = settings.service_name
    event_dict["git_sha"] = settings.git_sha
    if "logger" not in event_dict:
        name = getattr(logger, "name", None)
        event_dict["logger"] = name or "akara"
    return event_dict


def configure_logging() -> None:
    """Configure structlog. JSON when structured_logging or staging/production."""
    use_json = bool(settings.structured_logging) or settings.environment in {
        "staging",
        "production",
    }

    shared: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", key="timestamp"),
        _inject_akara_fields,
        structlog.processors.EventRenamer("message"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]
    renderer: Any = (
        structlog.processors.JSONRenderer()
        if use_json
        else structlog.dev.ConsoleRenderer()
    )

    structlog.configure(
        processors=[*shared, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, settings.log_level.upper(), logging.INFO)
        ),
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=False,
    )

    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        stream=sys.stdout,
        force=True,
    )
