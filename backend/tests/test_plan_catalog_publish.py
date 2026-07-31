from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tests.superadmin_helpers import clear_auth_override, make_superadmin_client


def test_public_plans_fallback():
    from fastapi.testclient import TestClient
    from app.main import app

    with patch("app.services.catalog.plan_catalog_service.get_supabase_service_client") as mock_supa:
        mock_supa.side_effect = Exception("table missing")
        client = TestClient(app)
        res = client.get("/public/plans")
        assert res.status_code == 200
        body = res.json()
        assert len(body["items"]) >= 3
        codes = {p["code"] for p in body["items"]}
        assert "free" in codes
        assert "pro" in codes


def test_plan_diff_draft_fields():
    from app.services.catalog.plan_catalog_service import plan_diff

    before = {
        "limits": {"users": 1},
        "draft_limits": {"users": 5},
        "monthly_price_minor": 100,
        "draft_monthly_price_minor": 200,
    }
    diff = plan_diff(before)
    assert diff["limits"]["draft"] == {"users": 5}
    assert diff["monthly_price_minor"]["draft"] == 200


@patch("app.core.superadmin.get_supabase_service_client")
@patch("app.services.catalog.plan_catalog_service.get_supabase_service_client")
def test_catalog_plans_list(mock_catalog_supa, mock_core):
    profile_mock = MagicMock()
    profile_mock.execute.return_value = MagicMock(data={"role": "superadmin"})
    mock_core.return_value.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = (
        profile_mock
    )

    chain = MagicMock()
    chain.order.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[
            {
                "code": "pro",
                "display_name": "Pro",
                "monthly_price_minor": 799900,
                "is_public": True,
                "is_active": True,
                "version": 1,
            }
        ]
    )
    chain.order.return_value.execute.return_value = MagicMock(data=[])
    mock_catalog_supa.return_value.table.return_value.select.return_value = chain

    client = make_superadmin_client()
    try:
        res = client.get("/superadmin/catalog/plans")
        assert res.status_code == 200
        items = res.json()["items"]
        assert len(items) >= 1
        assert items[0]["code"] == "pro"
    finally:
        clear_auth_override()


@patch("app.core.superadmin.get_supabase_service_client")
@patch("app.services.catalog.plan_catalog_service.get_supabase_service_client")
def test_plan_publish_version_conflict_returns_409(mock_catalog_supa, mock_core):
    from app.core.errors import AkaraHTTPException
    from app.services.catalog.plan_catalog_service import publish_plan

    plan_row = {
        "code": "pro",
        "display_name": "Pro",
        "version": 5,
        "draft_limits": {"users": 5},
        "limits": {"users": 3},
        "draft_entitlements": {},
        "entitlements": {},
    }
    chain = MagicMock()
    chain.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=plan_row)
    mock_catalog_supa.return_value.table.return_value.select.return_value = chain

    with pytest.raises(AkaraHTTPException) as exc:
        publish_plan("pro", actor_id=None, expected_version=4)
    assert exc.value.status_code == 409
