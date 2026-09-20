from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.workers.account_export_worker import run_export_cycle


@patch("app.core.tenant.get_supabase_service_client")
def test_export_cycle_empty(mock_supa) -> None:
    mock_supa.return_value.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[]
    )
    assert run_export_cycle() == {"completed": 0, "failed": 0}
