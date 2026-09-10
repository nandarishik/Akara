import inspect
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.workers.import_worker import ImportWorker


@pytest.mark.asyncio
async def test_notify_import_failure_does_not_call_asyncio_run():
    with patch(
        "app.workers.import_worker.get_supabase_service_client",
        return_value=MagicMock(),
    ):
        worker = ImportWorker()

    job_id = uuid4()
    user_id = uuid4()
    tenant_id = uuid4()

    job_result = MagicMock()
    job_result.data = {
        "user_id": str(user_id),
        "filename": "sales.csv",
        "tenant_id": str(tenant_id),
    }
    profile_result = MagicMock()
    profile_result.data = {
        "phone_number": "+911234567890",
        "preferences": {"whatsapp_alerts_enabled": True},
    }

    worker.supabase = MagicMock()
    worker.supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.side_effect = [
        job_result,
        profile_result,
    ]
    user = MagicMock()
    user.user.email = None
    worker.supabase.auth.admin.get_user_by_id.return_value = user

    with (
        patch("app.workers.import_worker.settings") as mock_settings,
        patch("app.workers.import_worker.asyncio.run") as mock_run,
        patch(
            "app.infra.notifications.whatsapp.send_whatsapp_template",
            new_callable=AsyncMock,
            side_effect=RuntimeError("boom"),
        ),
    ):
        mock_settings.whatsapp_sends_enabled = True
        notify = worker._notify_import_failure
        if inspect.iscoroutinefunction(notify):
            await notify(job_id, "parse failed")
        else:
            notify(job_id, "parse failed")
        mock_run.assert_not_called()
