import pytest
import jwt
import base64
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings


def create_test_jwt(user_id: str = "test-user", email: str = "test@example.com") -> str:
    """Create a test JWT token with user and LLM config."""
    payload = {
        "userId": user_id,
        "email": email,
        "provider": "ollama",
        "model": "qwen3.5",
        "apiKeyEncrypted": None,
        "apiBaseUrl": None,
        "temperature": 0.7,
        "maxTokens": 2048,
        "iss": "magicsync-nuxt",
        "aud": "magicsync-python",
    }
    return jwt.encode(payload, settings.llm_jwt_secret, algorithm="HS256")


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def api_prefix():
    return "/api/v1"


@pytest.fixture
def test_jwt():
    """Provide a valid test JWT token."""
    return create_test_jwt()


@pytest.fixture
def test_headers(test_jwt):
    """Provide headers with valid JWT token."""
    return {"Authorization": f"Bearer {test_jwt}"}
