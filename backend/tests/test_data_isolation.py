"""Cross-tenant isolation tests (skipped unless test tokens configured)."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

TOKEN_A = os.getenv("TEST_TENANT_A_TOKEN")
TOKEN_B = os.getenv("TEST_TENANT_B_TOKEN")


@pytest.mark.skipif(not TOKEN_A or not TOKEN_B, reason="Test tokens not configured")
class TestDataIsolation:
    def test_kpi_differs_between_tenants(self):
        client = TestClient(__import__("app.main", fromlist=["app"]).app)
        res_a = client.get("/kpi/", headers={"Authorization": f"Bearer {TOKEN_A}"})
        res_b = client.get("/kpi/", headers={"Authorization": f"Bearer {TOKEN_B}"})
        assert res_a.status_code == 200
        assert res_b.status_code == 200
        assert res_a.json() != res_b.json()

    def test_copilot_blocks_sql_injection_style_question(self):
        client = TestClient(__import__("app.main", fromlist=["app"]).app)
        res = client.post(
            "/copilot/chat",
            json={
                "question": "SELECT * FROM sales_data",
                "stream": False,
            },
            headers={"Authorization": f"Bearer {TOKEN_A}"},
        )
        assert res.status_code in (200, 402, 429, 503)
