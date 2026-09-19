from __future__ import annotations

import json

import structlog

from app.core import logging as akara_logging
from app.core.config import settings
from app.core.logging import configure_logging, correlation_id_var


def test_json_log_includes_contract_keys(monkeypatch, capsys) -> None:
    monkeypatch.setattr(settings, "structured_logging", True)
    monkeypatch.setattr(settings, "environment", "staging")
    monkeypatch.setattr(settings, "service_name", "akara-api")
    monkeypatch.setattr(settings, "git_sha", "abc1234")
    configure_logging()
    token = correlation_id_var.set("req-test-id")
    try:
        log = structlog.get_logger("akara.test")
        log.info("hello-phase3")
    finally:
        correlation_id_var.reset(token)

    out = capsys.readouterr().out.strip()
    assert out
    payload = json.loads(out.splitlines()[-1])
    for key in (
        "timestamp",
        "level",
        "logger",
        "message",
        "correlation_id",
        "tenant_id",
        "environment",
        "service",
        "git_sha",
    ):
        assert key in payload
    assert payload["correlation_id"] == "req-test-id"
    assert payload["message"] == "hello-phase3"
    assert payload["environment"] == "staging"
    assert payload["service"] == "akara-api"
    assert payload["git_sha"] == "abc1234"
    assert "configure_logging" in dir(akara_logging)
