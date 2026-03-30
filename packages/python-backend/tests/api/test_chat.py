import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch


class TestChatEndpoints:
    def test_chat_stream_request_validation(
        self, client: TestClient, api_prefix: str
    ):
        async def mock_chat(*args, **kwargs):
            yield "Hello! How can I help you?"

        with patch(
            "app.services.llm.ollama.ollama_service.chat",
            return_value=mock_chat(),
        ):
            response = client.post(
                f"{api_prefix}/chat",
                json={"messages": [{"role": "user", "content": "Hello"}]},
                headers={"Authorization": "Bearer test-token"},
            )
            assert response.status_code == 200
            assert "text/event-stream" in response.headers["content-type"]

    def test_chat_complete_request_validation(
        self, client: TestClient, api_prefix: str
    ):
        mock_response = {
            "message": {"role": "assistant", "content": "Hello! How can I help you?"},
            "model": "llama3.2",
        }

        with patch(
            "app.services.llm.ollama.ollama_service.chat_complete",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            response = client.post(
                f"{api_prefix}/chat/complete",
                json={
                    "messages": [{"role": "user", "content": "Hello"}],
                    "model": "llama3.2",
                    "temperature": 0.7,
                },
                headers={"Authorization": "Bearer test-token"},
            )
            assert response.status_code == 200
            data = response.json()
            assert "message" in data
            assert "model" in data

    def test_chat_empty_messages(self, client: TestClient, api_prefix: str):
        async def mock_chat(*args, **kwargs):
            yield "You haven't provided any messages."

        with patch(
            "app.services.llm.ollama.ollama_service.chat",
            return_value=mock_chat(),
        ):
            response = client.post(
                f"{api_prefix}/chat",
                json={"messages": []},
                headers={"Authorization": "Bearer test-token"},
            )
            assert response.status_code == 200

    def test_chat_invalid_temperature(self, client: TestClient, api_prefix: str):
        response = client.post(
            f"{api_prefix}/chat/complete",
            json={
                "messages": [{"role": "user", "content": "Hello"}],
                "temperature": 3.0,
            },
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 422

    def test_chat_negative_temperature(self, client: TestClient, api_prefix: str):
        response = client.post(
            f"{api_prefix}/chat/complete",
            json={
                "messages": [{"role": "user", "content": "Hello"}],
                "temperature": -0.5,
            },
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 422

    def test_chat_invalid_role(self, client: TestClient, api_prefix: str):
        response = client.post(
            f"{api_prefix}/chat/complete",
            json={
                "messages": [{"role": "invalid", "content": "Hello"}],
            },
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 422
