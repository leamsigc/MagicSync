from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from types import SimpleNamespace


def _fake_completion(*args, **kwargs):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="pong"))]
    )


class TestLlmTestEndpoint:
    def test_ok_and_no_key_echo(self, client: TestClient, api_prefix: str, test_headers: dict):
        with patch(
            "app.api.v1.llm.llm_service.test_connection",
            new_callable=AsyncMock,
            return_value={"ok": True, "model_used": "ollama/qwen3.5", "latency_ms": 12},
        ):
            response = client.post(
                f"{api_prefix}/llm/test",
                json={"provider": "ollama", "model": "qwen3.5", "api_key": "sk-secret-123"},
                headers=test_headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["ok"] is True
            assert data["model_used"] == "ollama/qwen3.5"
            assert isinstance(data["latency_ms"], int)
            assert "sk-secret-123" not in response.text
            assert "api_key" not in data

    def test_invalid_provider_rejected(self, client: TestClient, api_prefix: str, test_headers: dict):
        response = client.post(
            f"{api_prefix}/llm/test",
            json={"provider": "ftp", "model": "x"},
            headers=test_headers,
        )
        assert response.status_code == 400
        assert "ftp" not in response.text or "Unsupported" in response.text

    def test_backend_failure_maps_to_502(self, client: TestClient, api_prefix: str, test_headers: dict):
        with patch(
            "app.api.v1.llm.llm_service.test_connection",
            new_callable=AsyncMock,
            side_effect=Exception("invalid api key"),
        ):
            response = client.post(
                f"{api_prefix}/llm/test",
                json={"provider": "openai", "model": "gpt-4o", "api_key": "sk-bad-key"},
                headers=test_headers,
            )
            assert response.status_code == 502
            assert "sk-bad-key" not in response.text

    def test_falls_back_to_jwt_creds(self, client: TestClient, api_prefix: str, test_headers: dict):
        with patch(
            "app.api.v1.llm.llm_service.test_connection",
            new_callable=AsyncMock,
            return_value={"ok": True, "model_used": "ollama/qwen3.5", "latency_ms": 5},
        ) as mocked:
            response = client.post(
                f"{api_prefix}/llm/test",
                json={"provider": "ollama", "model": "qwen3.5"},
                headers=test_headers,
            )
            assert response.status_code == 200
            assert mocked.await_count == 1
