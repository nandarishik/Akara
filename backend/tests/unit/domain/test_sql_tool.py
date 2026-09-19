from unittest.mock import MagicMock
from uuid import UUID

import pytest

from app.domain.copilot.tools.sql_tool import SQLTool

_TENANT = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")


def _tool() -> SQLTool:
    return SQLTool(executor=MagicMock(), tenant_id=_TENANT)


def test_bind_params_substitutes_uuid_and_dates():
    tool = _tool()
    bound = tool._bind_params(
        "SELECT :tenant_id, :start_date, :end_date",
        "2026-01-01",
        "2026-01-31",
    )
    assert str(_TENANT) in bound
    assert "2026-01-01" in bound
    assert "2026-01-31" in bound
    assert ":tenant_id" not in bound
    assert ":start_date" not in bound
    assert ":end_date" not in bound


def test_bind_params_rejects_non_uuid_tenant():
    tool = _tool()
    tool._tenant_id = "not-a-uuid"
    with pytest.raises(TypeError):
        tool._bind_params("SELECT :tenant_id", "2026-01-01", "2026-01-31")


def test_bind_params_rejects_invalid_date():
    tool = _tool()
    with pytest.raises(ValueError):
        tool._bind_params("SELECT :start_date", "2026/01/01", "2026-01-31")
