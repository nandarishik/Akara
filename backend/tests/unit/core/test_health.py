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
    assert data["environment"] in {"development", "production", "staging", "ci"}


def test_version_endpoint(client: TestClient) -> None:
    response = client.get("/version")
    assert response.status_code == 200
    data = response.json()
    assert data["llm_provider"] == "openrouter"
    assert "/" in data["llm_model"]


def test_health_response_has_x_request_id(client: TestClient) -> None:
    response = client.get("/health")
    assert "X-Request-ID" in response.headers
    assert len(response.headers["X-Request-ID"]) > 0
