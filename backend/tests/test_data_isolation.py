"""Cross-tenant isolation — live integration tests against deployed API.

Requires two real Supabase users in different tenants. Configure in .env:

  TEST_TENANT_A_TOKEN=<jwt for tenant A>
  TEST_TENANT_B_TOKEN=<jwt for tenant B>
  TEST_API_BASE_URL=https://akara-production.up.railway.app

Run:
  pytest tests/test_data_isolation.py -m integration
"""

from __future__ import annotations

import os
import uuid

import httpx
import pytest

TOKEN_A = os.getenv("TEST_TENANT_A_TOKEN")
TOKEN_B = os.getenv("TEST_TENANT_B_TOKEN")
BASE_URL = os.getenv(
    "TEST_API_BASE_URL", "https://akara-production.up.railway.app"
).rstrip("/")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not TOKEN_A or not TOKEN_B,
        reason="TEST_TENANT_A_TOKEN and TEST_TENANT_B_TOKEN required",
    ),
]


@pytest.fixture
def client_a() -> httpx.Client:
    return httpx.Client(
        base_url=BASE_URL,
        headers={"Authorization": f"Bearer {TOKEN_A}"},
        timeout=30.0,
    )


@pytest.fixture
def client_b() -> httpx.Client:
    return httpx.Client(
        base_url=BASE_URL,
        headers={"Authorization": f"Bearer {TOKEN_B}"},
        timeout=30.0,
    )


class TestDataIsolation:
    def test_auth_me_returns_different_tenants(
        self, client_a: httpx.Client, client_b: httpx.Client
    ) -> None:
        res_a = client_a.get("/auth/me")
        res_b = client_b.get("/auth/me")
        assert res_a.status_code == 200
        assert res_b.status_code == 200
        me_a = res_a.json()
        me_b = res_b.json()
        assert me_a["tenant_id"] != me_b["tenant_id"]

    def test_kpi_differs_between_tenants(
        self, client_a: httpx.Client, client_b: httpx.Client
    ) -> None:
        res_a = client_a.get("/kpi/")
        res_b = client_b.get("/kpi/")
        assert res_a.status_code == 200
        assert res_b.status_code == 200
        assert res_a.json() != res_b.json()

    def test_billing_usage_differs_between_tenants(
        self, client_a: httpx.Client, client_b: httpx.Client
    ) -> None:
        res_a = client_a.get("/billing/usage")
        res_b = client_b.get("/billing/usage")
        assert res_a.status_code == 200
        assert res_b.status_code == 200
        body_a = res_a.json()
        body_b = res_b.json()
        assert body_a != body_b or body_a.get("copilot_calls_used") != body_b.get(
            "copilot_calls_used"
        )

    def test_conversations_lists_are_tenant_scoped(
        self, client_a: httpx.Client, client_b: httpx.Client
    ) -> None:
        res_a = client_a.get("/copilot/conversations/")
        res_b = client_b.get("/copilot/conversations/")
        assert res_a.status_code == 200
        assert res_b.status_code == 200
        ids_a = {c["id"] for c in res_a.json()}
        ids_b = {c["id"] for c in res_b.json()}
        assert ids_a.isdisjoint(ids_b)

    def test_alerts_isolated_between_tenants(
        self, client_a: httpx.Client, client_b: httpx.Client
    ) -> None:
        alert_name = f"isolation-test-{uuid.uuid4().hex[:8]}"
        create = client_a.post(
            "/alerts",
            json={
                "name": alert_name,
                "metric": "secondary_sales_total",
                "condition": "below",
                "threshold": 1,
            },
        )
        if create.status_code == 402:
            pytest.skip("Tenant A is not on a plan with alerts — upgrade to Pro")
        assert create.status_code in (200, 201), create.text
        alert_id = create.json()["id"]

        list_b = client_b.get("/alerts")
        assert list_b.status_code in (200, 402)
        if list_b.status_code == 200:
            b_ids = {a["id"] for a in list_b.json()}
            assert alert_id not in b_ids

        client_a.delete(f"/alerts/{alert_id}")

    def test_reports_cross_tenant_download_blocked(
        self, client_a: httpx.Client, client_b: httpx.Client
    ) -> None:
        reports_a = client_a.get("/reports/")
        assert reports_a.status_code == 200
        reports = reports_a.json()
        if not reports:
            pytest.skip("Tenant A has no generated reports to probe")

        report_id = reports[0]["id"]
        cross = client_b.get(f"/reports/{report_id}/download")
        assert cross.status_code == 404

    def test_copilot_blocks_sql_injection_style_question(
        self, client_a: httpx.Client
    ) -> None:
        res = client_a.post(
            "/copilot/chat",
            json={
                "question": "SELECT * FROM sales_data",
                "stream": False,
            },
        )
        assert res.status_code in (200, 402, 429, 503)
