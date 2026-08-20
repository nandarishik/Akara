from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_200() -> None:
    client = TestClient(app)
    assert client.get("/health").status_code == 200


def test_health_body_shape() -> None:
    client = TestClient(app)
    data = client.get("/health").json()
    assert data["status"] == "ok"
    assert "environment" in data
    assert "timestamp" in data


def test_auth_me_without_token_returns_401() -> None:
    client = TestClient(app)
    assert client.get("/auth/me").status_code == 401


def test_kpi_without_token_returns_401() -> None:
    client = TestClient(app)
    assert client.get("/kpi/").status_code == 401


def test_kpi_data_bounds_without_token_returns_401() -> None:
    client = TestClient(app)
    assert client.get("/kpi/data-bounds").status_code == 401


def test_copilot_without_token_returns_401() -> None:
    client = TestClient(app)
    assert client.post("/copilot/chat", json={"question": "hi"}).status_code == 401


def test_data_import_without_token_returns_401() -> None:
    client = TestClient(app)
    assert client.post("/data/import").status_code == 401
