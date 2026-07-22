from fastapi.testclient import TestClient


def test_health_returns_200(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "timestamp" in data


def test_health_returns_environment(client: TestClient) -> None:
    response = client.get("/health")
    data = response.json()
    assert data["environment"] in {"development", "production", "staging"}
