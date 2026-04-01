import pytest
import jwt
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.core.config import settings


class TestSecurity:
    def test_no_token_rejected(self, client: TestClient, api_prefix: str):
        """Requests without Authorization header are rejected with 401."""
        response = client.post(
            f"{api_prefix}/chat",
            json={"messages": [{"role": "user", "content": "Hello"}]},
        )
        assert response.status_code == 401

    def test_valid_jwt_accepted(self, client: TestClient, api_prefix: str, test_headers: dict):
        """Requests with valid JWT are accepted."""
        async def mock_chat(*args, **kwargs):
            yield "response"

        with patch(
            "app.services.llm.ollama.llm_service.chat",
            return_value=mock_chat(),
        ):
            response = client.post(
                f"{api_prefix}/chat",
                json={"messages": [{"role": "user", "content": "Hello"}]},
                headers=test_headers,
            )
            assert response.status_code == 200

    def test_invalid_jwt_rejected(self, client: TestClient, api_prefix: str):
        """Requests with invalid JWT are rejected with 401."""
        response = client.post(
            f"{api_prefix}/chat",
            json={"messages": [{"role": "user", "content": "Hello"}]},
            headers={"Authorization": "Bearer invalid-jwt-token"},
        )
        assert response.status_code == 401

    def test_expired_jwt_rejected(self, client: TestClient, api_prefix: str):
        """Requests with expired JWT are rejected with 401."""
        payload = {
            "userId": "test-user",
            "email": "test@example.com",
            "provider": "ollama",
            "model": "qwen3.5",
            "apiKeyEncrypted": None,
            "apiBaseUrl": None,
            "temperature": 0.7,
            "maxTokens": 2048,
            "iss": "magicsync-nuxt",
            "aud": "magicsync-python",
            "exp": 0,  # Expired
        }
        expired_jwt = jwt.encode(payload, settings.llm_jwt_secret, algorithm="HS256")

        response = client.post(
            f"{api_prefix}/chat",
            json={"messages": [{"role": "user", "content": "Hello"}]},
            headers={"Authorization": f"Bearer {expired_jwt}"},
        )
        assert response.status_code == 401

    def test_wrong_issuer_rejected(self, client: TestClient, api_prefix: str):
        """Requests with JWT from wrong issuer are rejected."""
        payload = {
            "userId": "test-user",
            "email": "test@example.com",
            "provider": "ollama",
            "model": "qwen3.5",
            "apiKeyEncrypted": None,
            "apiBaseUrl": None,
            "temperature": 0.7,
            "maxTokens": 2048,
            "iss": "wrong-issuer",
            "aud": "magicsync-python",
        }
        wrong_jwt = jwt.encode(payload, settings.llm_jwt_secret, algorithm="HS256")

        response = client.post(
            f"{api_prefix}/chat",
            json={"messages": [{"role": "user", "content": "Hello"}]},
            headers={"Authorization": f"Bearer {wrong_jwt}"},
        )
        assert response.status_code == 401
