from fastapi import HTTPException

from app.api.internal.reports import _authorize


class _Req:
    def __init__(self) -> None:
        self.headers = {}


def test_missing_service_key_401(monkeypatch) -> None:
    from app.core import config

    monkeypatch.setattr(config.settings, "backend_service_key", "secret")
    try:
        _authorize(None, _Req())
        raise AssertionError("expected 401")
    except HTTPException as exc:
        assert exc.status_code == 401
