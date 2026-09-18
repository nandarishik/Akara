def test_health_smoke(client):
    response = client.get("/health")
    assert response.status_code == 200
