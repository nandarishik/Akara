"""OpenTelemetry setup — no-op unless otel_enabled and otel_endpoint are set."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("akara.telemetry")


def setup_telemetry(app: Any, settings: Any) -> None:
    """Instrument FastAPI + httpx when OTEL is explicitly enabled."""
    if not getattr(settings, "otel_enabled", False) or not getattr(
        settings, "otel_endpoint", ""
    ):
        return
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter,
        )
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        resource = Resource.create(
            {
                "service.name": getattr(settings, "service_name", "akara-api"),
                "service.version": getattr(settings, "git_sha", "dev"),
                "deployment.environment": getattr(
                    settings, "environment", "development"
                ),
            }
        )
        provider = TracerProvider(resource=resource)
        exporter = OTLPSpanExporter(endpoint=settings.otel_endpoint)
        provider.add_span_processor(
            BatchSpanProcessor(
                exporter,
                max_export_batch_size=128,
                schedule_delay_millis=5000,
            )
        )
        trace.set_tracer_provider(provider)
        FastAPIInstrumentor.instrument_app(app)
        HTTPXClientInstrumentor().instrument()
    except Exception:
        logger.exception("OpenTelemetry setup failed; continuing without traces")
