import pytest
from fastapi.testclient import TestClient


class TestHealthEndpoints:
    def test_health_check(self, client: TestClient, api_prefix: str):
        response = client.get(f"{api_prefix}/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "magicsync-ai"

    def test_llm_health(self, client: TestClient, api_prefix: str):
        response = client.get(f"{api_prefix}/health/llm")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] in ["ok", "error"]
