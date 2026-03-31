import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient


class TestSecurity:
    def test_anonymous_without_token(self, client: TestClient, api_prefix: str):
        """Requests without Authorization header are rejected with 401."""
        with patch(
            "app.core.security.validate_session",
            new_callable=AsyncMock,
            return_value={},
        ):
            response = client.post(
                f"{api_prefix}/chat",
                json={"messages": [{"role": "user", "content": "Hello"}]},
            )
            assert response.status_code == 401

    def test_authenticated_with_valid_token(self, client: TestClient, api_prefix: str):
        """Requests with valid token return authenticated user."""
        with patch(
            "app.core.security.validate_session",
            new_callable=AsyncMock,
            return_value={"id": "user-123", "email": "user@example.com"},
        ):
            async def mock_chat(*args, **kwargs):
                yield "response"

            with patch(
                "app.services.llm.ollama.ollama_service.chat",
                return_value=mock_chat(),
            ):
                response = client.post(
                    f"{api_prefix}/chat",
                    json={"messages": [{"role": "user", "content": "Hello"}]},
                    headers={"Authorization": "Bearer valid-token"},
                )
                assert response.status_code == 200

    def test_anonymous_with_invalid_token(self, client: TestClient, api_prefix: str):
        """Requests with invalid token are rejected with 401."""
        with patch(
            "app.core.security.validate_session",
            new_callable=AsyncMock,
            return_value={},
        ):
            response = client.post(
                f"{api_prefix}/chat",
                json={"messages": [{"role": "user", "content": "Hello"}]},
                headers={"Authorization": "Bearer invalid-token"},
            )
            assert response.status_code == 401
