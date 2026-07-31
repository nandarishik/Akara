"""Scheduled content publish."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

from app.services.content.cms_service import publish_content, publish_due_scheduled_content


@patch("app.services.content.cms_service.get_supabase_service_client")
def test_scheduled_content_deferred_until_due(_mock_supa):
    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    entry = {
        "draft_value": {"title": "Hello"},
        "scheduled_at": future,
        "version": 1,
    }
    with patch("app.services.content.cms_service.get_content_entry", return_value=entry):
        result = publish_content("landing.hero.title", force=False)
        assert result.get("deferred") is True
        assert result.get("scheduled_at") == future


@patch("app.services.content.cms_service.publish_content")
@patch("app.services.content.cms_service.get_supabase_service_client")
def test_publish_due_scheduled_content(mock_supa, mock_publish):
    mock_supa.return_value.table.return_value.select.return_value.not_.is_.return_value.lte.return_value.execute.return_value = MagicMock(
        data=[{"key": "landing.hero.title", "locale": "en-IN"}]
    )
    mock_publish.return_value = {"key": "landing.hero.title", "published_at": "now"}
    result = publish_due_scheduled_content()
    assert result["published"] == 1
    mock_publish.assert_called_once()
