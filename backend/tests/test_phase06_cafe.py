from app.core.plan_limits import PLAN_LIMITS
from app.domain.data_import.detector import classify_import_type


def test_cafe_plan_keys():
    for plan in ("free", "pro", "business"):
        features = PLAN_LIMITS[plan]["features"]
        assert "cafe_import" in features
        assert "ai_mapping" in features
        assert features["quarantine_ui"] is True
    assert PLAN_LIMITS["free"]["max_upload_bytes"] == 10_000_000
    assert PLAN_LIMITS["pro"]["max_upload_bytes"] == 50_000_000
    assert PLAN_LIMITS["business"]["max_upload_bytes"] == 200_000_000


def test_cafe_detector_petpooja():
    headers = ["Order Time", "Bill No", "Bill Amt", "Channel", "Covers"]
    assert classify_import_type(headers) == "cafe_orders"


def test_cafe_detector_fmcg():
    headers = ["invoice_date", "party_name", "product_name", "net_amount"]
    assert classify_import_type(headers) == "fmcg"


def test_cafe_flags_in_openapi(client):
    paths = client.get("/openapi.json").json()["paths"]
    assert "/data/cafe/flags" in paths or "/v1/data/cafe/flags" in paths
    assert "/data/imports/cafe-orders" in paths or "/v1/data/imports/cafe-orders" in paths
