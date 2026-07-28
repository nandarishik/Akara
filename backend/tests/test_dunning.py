"""Tests for daily dunning cycle (GAP 12)."""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from app.tasks import dunning as dunning_module


def _past_due_since(days_ago: int) -> str:
    ts = datetime.now(UTC) - timedelta(days=days_ago)
    return ts.isoformat()


@pytest.mark.asyncio
async def test_dunning_sends_day3_reminder_once():
    mock_supa = MagicMock()
    tenant_id = "tenant-1"
    mock_supa.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[
            {
                "id": tenant_id,
                "plan_status": "past_due",
                "past_due_since": _past_due_since(3),
                "plan": "pro",
            }
        ]
    )

    def table_side_effect(name: str):
        t = MagicMock()
        if name == "tenants":
            t.select.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[
                    {
                        "id": tenant_id,
                        "plan_status": "past_due",
                        "past_due_since": _past_due_since(3),
                        "plan": "pro",
                    }
                ]
            )
        elif name == "profiles":
            t.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
                data=[{"id": "admin-1"}]
            )
        elif name == "dunning_events":
            chain = MagicMock()
            chain.select.return_value.eq.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
                data=None
            )
            chain.insert.return_value.execute.return_value = MagicMock(data=[{}])
            return chain
        return t

    mock_supa.table.side_effect = table_side_effect
    mock_supa.auth.admin.get_user_by_id.return_value = MagicMock(user=MagicMock(email="admin@test.com"))

    with patch.object(dunning_module, "get_supabase_service_client", return_value=mock_supa):
        with patch.object(dunning_module, "send_dunning_reminder_email", return_value=True) as mock_email:
            await dunning_module.run_dunning_cycle()

    mock_email.assert_called_once_with("admin@test.com", 3)


@pytest.mark.asyncio
async def test_dunning_downgrades_on_day14():
    mock_supa = MagicMock()
    tenant_id = "tenant-2"
    update_mock = MagicMock()
    update_mock.eq.return_value.execute.return_value = MagicMock(data=[{}])

    tenants_table = MagicMock()
    tenants_table.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[
            {
                "id": tenant_id,
                "plan_status": "past_due",
                "past_due_since": _past_due_since(20),
                "plan": "pro",
            }
        ]
    )
    tenants_table.update.return_value = update_mock

    def table_side_effect(name: str):
        if name == "tenants":
            return tenants_table
        if name == "profiles":
            t = MagicMock()
            t.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
                data=[{"id": "admin-2"}]
            )
            return t
        if name == "dunning_events":
            chain = MagicMock()
            chain.select.return_value.eq.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
                data=None
            )
            chain.insert.return_value.execute.return_value = MagicMock(data=[{}])
            return chain
        return MagicMock()

    mock_supa.table.side_effect = table_side_effect
    mock_supa.auth.admin.get_user_by_id.return_value = MagicMock(user=MagicMock(email="admin2@test.com"))

    with patch.object(dunning_module, "get_supabase_service_client", return_value=mock_supa):
        with patch.object(dunning_module, "send_dunning_reminder_email", return_value=True):
            with patch.object(dunning_module, "send_downgrade_email", return_value=True):
                with patch.object(
                    dunning_module,
                    "apply_plan_downgrade",
                    return_value={"status": "ok", "target_plan": "free"},
                ) as mock_downgrade:
                    await dunning_module.run_dunning_cycle()

    mock_downgrade.assert_called_once_with(tenant_id, "free", reason="dunning_day_14")


@pytest.mark.asyncio
async def test_dunning_skips_when_already_sent():
    mock_supa = MagicMock()
    tenant_id = "tenant-3"

    def table_side_effect(name: str):
        t = MagicMock()
        if name == "tenants":
            t.select.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[
                    {
                        "id": tenant_id,
                        "plan_status": "past_due",
                        "past_due_since": _past_due_since(3),
                        "plan": "pro",
                    }
                ]
            )
        elif name == "profiles":
            t.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
                data=[{"id": "admin-3"}]
            )
        elif name == "dunning_events":
            chain = MagicMock()
            chain.select.return_value.eq.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
                data={"id": "existing"}
            )
            return chain
        return t

    mock_supa.table.side_effect = table_side_effect
    mock_supa.auth.admin.get_user_by_id.return_value = MagicMock(user=MagicMock(email="admin3@test.com"))

    with patch.object(dunning_module, "get_supabase_service_client", return_value=mock_supa):
        with patch.object(dunning_module, "send_dunning_reminder_email", return_value=True) as mock_email:
            await dunning_module.run_dunning_cycle()

    mock_email.assert_not_called()
