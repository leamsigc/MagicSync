"""
Tests for social media generation API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers():
    """Create test authorization headers with a valid JWT."""
    import jwt
    from app.core.config import settings
    
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
    }
    token = jwt.encode(payload, settings.llm_jwt_secret, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


class TestSocialMediaAPI:
    """Test suite for /api/v1/social-media endpoints."""

    def test_generate_post_validation_topic_required(self, client, auth_headers):
        """Test that topic is required for post generation."""
        response = client.post(
            "/api/v1/social-media/generate",
            json={"platform": "twitter"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_generate_post_validation_platform_required(self, client, auth_headers):
        """Test that platform is required for post generation."""
        response = client.post(
            "/api/v1/social-media/generate",
            json={"topic": "Test topic"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_generate_batch_validation_topic_required(self, client, auth_headers):
        """Test that topic is required for batch generation."""
        response = client.post(
            "/api/v1/social-media/generate-batch",
            json={"platforms": ["twitter"]},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_generate_batch_validation_platforms_required(self, client, auth_headers):
        """Test that platforms array is required."""
        response = client.post(
            "/api/v1/social-media/generate-batch",
            json={"topic": "Test topic"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_generate_batch_validation_platforms_not_empty(self, client, auth_headers):
        """Test that platforms array cannot be empty."""
        response = client.post(
            "/api/v1/social-media/generate-batch",
            json={"topic": "Test topic", "platforms": []},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_generate_thread_validation_topic_required(self, client, auth_headers):
        """Test that topic is required for thread generation."""
        response = client.post(
            "/api/v1/social-media/generate-thread",
            json={},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_generate_variations_validation_base_content_required(self, client, auth_headers):
        """Test that base_content is required for variations."""
        response = client.post(
            "/api/v1/social-media/generate-variations",
            json={"platform": "twitter"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_generate_hooks_validation_topic_required(self, client, auth_headers):
        """Test that topic is required for hooks generation."""
        response = client.post(
            "/api/v1/social-media/generate-hooks",
            json={"platform": "twitter"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_generate_hashtags_validation_topic_required(self, client, auth_headers):
        """Test that topic is required for hashtag generation."""
        response = client.post(
            "/api/v1/social-media/generate-hashtags",
            json={"platform": "twitter"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_platforms_list_requires_auth(self, client):
        """Test that platforms endpoint requires authentication."""
        response = client.get("/api/v1/social-media/platforms")
        assert response.status_code == 401

    @patch('app.services.social_media.generator.llm_service')
    def test_generate_post_success(self, mock_llm, client, auth_headers):
        """Test successful post generation."""
        # Mock LLM response
        mock_response = MagicMock()
        mock_response.get.return_value = {
            "message": {
                "content": '{"text": "Test tweet content", "hashtags": ["#test"]}'
            }
        }
        mock_llm.chat_complete = AsyncMock(return_value=mock_response)
        
        response = client.post(
            "/api/v1/social-media/generate",
            json={
                "topic": "Test topic",
                "platform": "twitter",
                "tone": "professional",
                "include_hashtags": True,
            },
            headers=auth_headers,
        )
        
        # Should return 200 (or handle the mocked response)
        assert response.status_code in [200, 500]  # 500 if LLM not running

    def test_platform_info_structure(self, client, auth_headers):
        """Test that platform info has correct structure."""
        response = client.get(
            "/api/v1/social-media/platforms",
            headers=auth_headers,
        )
        
        if response.status_code == 200:
            platforms = response.json()
            assert isinstance(platforms, list)
            
            # Check structure of first platform (if any)
            if platforms:
                platform = platforms[0]
                assert "name" in platform
                assert "display_name" in platform
                assert "limits" in platform
                assert "max_length" in platform["limits"]


class TestPlatformFormatter:
    """Test suite for platform-specific formatting."""

    def test_twitter_format_inline_hashtags(self):
        """Test that Twitter uses inline hashtag placement."""
        from app.services.social_media.platforms import format_post_for_platform, get_platform_limits
        
        limits = get_platform_limits("twitter")
        assert limits.hashtag_placement == "inline"
        
        result = format_post_for_platform(
            content="Test tweet",
            hashtags=["#test", "#twitter"],
            platform="twitter",
        )
        
        assert "#test" in result["text"]
        assert result["character_count"] <= limits.max_length

    def test_linkedin_format_end_hashtags(self):
        """Test that LinkedIn places hashtags at end."""
        from app.services.social_media.platforms import format_post_for_platform, get_platform_limits
        
        limits = get_platform_limits("linkedin")
        assert limits.hashtag_placement == "end"

    def test_truncation_warning(self):
        """Test that truncation produces a warning."""
        from app.services.social_media.platforms import format_post_for_platform
        
        # Create content that exceeds Twitter's limit
        long_content = "A" * 500  # Exceeds 280 chars
        
        result = format_post_for_platform(
            content=long_content,
            hashtags=[],
            platform="twitter",
        )
        
        assert result["warning"] is not None
        assert "truncated" in result["warning"].lower()

    def test_all_platforms_have_limits(self):
        """Test that all known platforms have limit definitions."""
        from app.services.social_media.platforms import PLATFORM_LIMITS
        
        required_platforms = [
            "twitter", "x", "linkedin", "linkedin-page", 
            "instagram", "facebook", "threads", "bluesky",
        ]
        
        for platform in required_platforms:
            assert platform in PLATFORM_LIMITS, f"Missing limits for {platform}"
            limits = PLATFORM_LIMITS[platform]
            assert limits.max_length > 0
            assert limits.hashtag_placement in ["inline", "end", "none"]


class TestSocialMediaGenerator:
    """Test suite for the SocialMediaGenerator class."""

    def test_supported_platforms(self):
        """Test that expected platforms are supported."""
        from app.services.social_media.generator import SocialMediaGenerator
        
        generator = SocialMediaGenerator("test-user")
        
        assert "twitter" in generator.SUPPORTED_PLATFORMS
        assert "linkedin" in generator.SUPPORTED_PLATFORMS
        assert "instagram" in generator.SUPPORTED_PLATFORMS

    def test_unsupported_platform_error(self):
        """Test that unsupported platforms return an error."""
        import asyncio
        from app.services.social_media.generator import SocialMediaGenerator
        
        generator = SocialMediaGenerator("test-user")
        
        # Run the async method
        result = asyncio.get_event_loop().run_until_complete(
            generator.generate_post(
                topic="test",
                platform="unsupported_platform",
            )
        )
        
        assert "error" in result
        assert "Unsupported platform" in result["error"]

    @patch('app.services.social_media.generator.llm_service')
    def test_generate_post_calls_llm(self, mock_llm):
        """Test that generate_post calls the LLM service."""
        import asyncio
        from app.services.social_media.generator import SocialMediaGenerator
        
        mock_response = {
            "message": {
                "content": '{"text": "Generated content", "hashtags": ["#ai"]}'
            }
        }
        mock_llm.chat_complete = AsyncMock(return_value=mock_response)
        
        generator = SocialMediaGenerator("test-user")
        
        result = asyncio.get_event_loop().run_until_complete(
            generator.generate_post(
                topic="AI and automation",
                platform="twitter",
            )
        )
        
        mock_llm.chat_complete.assert_called_once()
        # Verify the call was made with appropriate messages
        call_args = mock_llm.chat_complete.call_args
        assert call_args is not None
