from app.domain.connectors.base import ConnectorBase, SyncResult
from app.domain.intelligence.confidence import compute_confidence
from app.domain.intelligence.forecast import run_forecast_for_tenant
from tests.conftest import TENANT_FREE


def test_connector_openapi(client):
    paths = client.get("/openapi.json").json()["paths"]
    assert "/api/v1/connectors/" in paths
    assert "/admin/connectors/trigger-scheduled-sync" in paths


def test_kpi_summary_openapi(client):
    paths = client.get("/openapi.json").json()["paths"]
    assert "/kpi/summary" in paths or "/v1/kpi/summary" in paths
    assert "/copilot/status" in paths or "/v1/copilot/status" in paths
    assert "/actions" in paths or "/v1/actions" in paths


def test_connector_base_sync():
    import asyncio

    result = asyncio.run(ConnectorBase().sync())
    assert isinstance(result, SyncResult)
    assert result.status == "success"


def test_forecast_stub():
    out = run_forecast_for_tenant(TENANT_FREE)
    assert out["status"] == "ok"


def test_confidence_bounds():
    assert 0 <= compute_confidence(0.9, 30) <= 1
