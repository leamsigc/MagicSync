import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def api_prefix():
    return "/api/v1"


@pytest.fixture(autouse=True)
def mock_auth_validation():
    """Auto-mock auth validation for all tests to avoid HTTP calls to Nuxt server."""
    with patch(
        "app.core.security.validate_session",
        new_callable=AsyncMock,
        return_value={"id": "test-user", "email": "test@example.com"},
    ):
        yield
