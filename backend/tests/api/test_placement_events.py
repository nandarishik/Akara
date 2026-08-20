"""Placement impression/click events."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.services.content.cms_service import placement_stats, record_placement_event


@patch("app.services.content.cms_service.get_supabase_service_client")
def test_record_placement_impression(mock_supa):
    mock_supa.return_value.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{"id": "evt-1", "slot_key": "slot_a", "event_type": "impression"}]
    )
    event = record_placement_event("slot_a", "impression")
    assert event["event_type"] == "impression"


@patch("app.services.content.cms_service.get_supabase_service_client")
def test_placement_stats_aggregation(mock_supa):
    mock_supa.return_value.table.return_value.select.return_value.gte.return_value.execute.return_value = MagicMock(
        data=[
            {"slot_key": "slot_a", "event_type": "impression"},
            {"slot_key": "slot_a", "event_type": "impression"},
            {"slot_key": "slot_a", "event_type": "click"},
        ]
    )
    stats = placement_stats(days=7)
    slot_a = next(s for s in stats if s["slot_key"] == "slot_a")
    assert slot_a["impressions"] == 2
    assert slot_a["clicks"] == 1


@patch("app.services.content.cms_service.record_placement_event")
def test_placement_impression_http_returns_200(mock_record):
    mock_record.return_value = {"id": "evt-1", "slot_key": "landing.banner.a", "event_type": "impression"}
    from app.main import app

    client = TestClient(app)
    res = client.post("/public/placements/landing.banner.a/impression", json={"metadata": {}})
    assert res.status_code == 200
    assert res.json()["ok"] is True


@patch("app.services.content.cms_service.get_supabase_service_client")
def test_get_active_placements_audience_filter(mock_supa):
    from app.services.content.cms_service import get_active_placements

    now = "2026-01-01T00:00:00+00:00"
    mock_supa.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[
            {
                "key": "dashboard.welcome",
                "kind": "promotion",
                "published_content": {"title": "Hi"},
                "audience_rules": {"plans": ["pro"]},
                "starts_at": None,
                "ends_at": None,
            },
            {
                "key": "landing.banner.a",
                "kind": "promotion",
                "published_content": {"title": "All"},
                "audience_rules": {},
                "starts_at": None,
                "ends_at": None,
            },
        ]
    )
    pro_items = get_active_placements(plan="pro")
    assert len(pro_items) == 2
    free_items = get_active_placements(plan="free")
    assert len(free_items) == 1
    assert free_items[0]["key"] == "landing.banner.a"
