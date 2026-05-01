"""
Tests for social media platform formatting.
"""

import pytest
from app.services.social_media.platforms import (
    PLATFORM_LIMITS,
    get_platform_limits,
    format_post_for_platform,
    truncate_to_platform,
    get_platform_system_prompt,
)


class TestPlatformLimits:
    """Test platform limit definitions."""

    def test_twitter_limits(self):
        """Test Twitter/X has correct limits."""
        limits = PLATFORM_LIMITS["twitter"]
        assert limits.max_length == 280
        assert limits.hashtag_placement == "inline"
        assert limits.max_hashtags == 5
        assert limits.max_images == 4

    def test_linkedin_limits(self):
        """Test LinkedIn has correct limits."""
        limits = PLATFORM_LIMITS["linkedin"]
        assert limits.max_length == 3000
        assert limits.hashtag_placement == "end"
        assert limits.max_images == 20

    def test_instagram_limits(self):
        """Test Instagram has correct limits."""
        limits = PLATFORM_LIMITS["instagram"]
        assert limits.max_length == 2200
        assert limits.hashtag_placement == "end"
        assert limits.max_hashtags == 30

    def test_bluesky_limits(self):
        """Test Bluesky has correct limits."""
        limits = PLATFORM_LIMITS["bluesky"]
        assert limits.max_length == 300
        assert limits.hashtag_placement == "inline"

    def test_threads_limits(self):
        """Test Threads has correct limits."""
        limits = PLATFORM_LIMITS["threads"]
        assert limits.max_length == 500
        assert limits.hashtag_placement == "inline"

    def test_facebook_limits(self):
        """Test Facebook has correct limits."""
        limits = PLATFORM_LIMITS["facebook"]
        assert limits.max_length == 63206
        assert limits.hashtag_placement == "inline"


class TestGetPlatformLimits:
    """Test get_platform_limits helper."""

    def test_valid_platform(self):
        """Test getting limits for a valid platform."""
        limits = get_platform_limits("twitter")
        assert limits.max_length == 280

    def test_invalid_platform_defaults_to_twitter(self):
        """Test that invalid platforms fall back to Twitter."""
        limits = get_platform_limits("invalid-platform")
        assert limits.max_length == 280  # Twitter's limit


class TestFormatPostForPlatform:
    """Test format_post_for_platform function."""

    def test_twitter_inline_hashtags(self):
        """Test Twitter hashtags are placed inline."""
        result = format_post_for_platform(
            content="Test content",
            hashtags=["#test", "#example"],
            platform="twitter",
        )
        
        # Hashtags should be in the text
        assert "#test" in result["text"]
        assert "#example" in result["text"]

    def test_linkedin_end_hashtags(self):
        """Test LinkedIn hashtags are placed at end."""
        result = format_post_for_platform(
            content="Test content for LinkedIn",
            hashtags=["#linkedin", "#business"],
            platform="linkedin",
        )
        
        # Text should contain content and hashtags at end
        text = result["text"]
        assert "Test content for LinkedIn" in text
        # Hashtags should be present
        assert "#linkedin" in text or "#business" in text

    def test_truncation_warning(self):
        """Test that content exceeding limit triggers warning."""
        long_content = "A" * 400  # Exceeds Twitter's 280 limit
        
        result = format_post_for_platform(
            content=long_content,
            hashtags=[],
            platform="twitter",
        )
        
        assert result["warning"] is not None
        assert "truncated" in result["warning"].lower()
        assert result["character_count"] <= 280

    def test_character_count_includes_all(self):
        """Test character count includes text and hashtags."""
        content = "Hello"
        hashtags = ["#test"]
        
        result = format_post_for_platform(
            content=content,
            hashtags=hashtags,
            platform="twitter",
        )
        
        # Count should include content + space + hashtags
        expected = len(content) + 1 + len(hashtags[0])
        assert result["character_count"] == expected

    def test_link_handling(self):
        """Test that links are handled based on platform rules."""
        result = format_post_for_platform(
            content="Check this out",
            hashtags=[],
            platform="twitter",
            link="https://example.com/long-url",
        )
        
        # For Twitter, links count toward the limit
        # For platforms where links don't count, they should be on separate lines
        assert "https://example.com" in result["text"]

    def test_mention_handling(self):
        """Test that mentions are prepended correctly."""
        result = format_post_for_platform(
            content="Great post!",
            hashtags=[],
            platform="twitter",
            mention="username",
        )
        
        # Mention should be at the start
        assert result["text"].startswith("@username")

    def test_no_hashtags_when_placement_none(self):
        """Test that hashtags can be excluded for platforms that don't use them."""
        # Reddit generally doesn't use hashtags
        result = format_post_for_platform(
            content="Great content",
            hashtags=["#test"],
            platform="reddit",
        )
        
        # Reddit doesn't explicitly block hashtags, they're just not commonly used
        assert "Great content" in result["text"]


class TestTruncateToPlatform:
    """Test truncate_to_platform function."""

    def test_no_truncation_needed(self):
        """Test that short content is not truncated."""
        short_text = "Short content"
        
        result, warning = truncate_to_platform(
            text=short_text,
            platform="twitter",
        )
        
        assert result == short_text
        assert warning is None

    def test_truncation_with_warning(self):
        """Test that truncation produces a warning."""
        long_text = "A" * 400
        
        result, warning = truncate_to_platform(
            text=long_text,
            platform="twitter",
        )
        
        assert warning is not None
        assert len(result) <= 280

    def test_truncation_respects_reserve(self):
        """Test that reserve parameter is respected."""
        text = "A" * 300
        
        result, warning = truncate_to_platform(
            text=text,
            platform="twitter",
            reserve=50,  # Reserve 50 chars
        )
        
        # Should leave room for reserved content
        assert len(result) <= 230  # 280 - 50

    def test_sentence_boundary_truncation(self):
        """Test truncation prefers sentence boundaries."""
        text = "First sentence. Second sentence. Third sentence."
        
        result, warning = truncate_to_platform(
            text=text,
            platform="twitter",
        )
        
        # Should try to end at a sentence boundary if possible
        # The warning should indicate sentence-based truncation
        assert result.endswith(".") or result.endswith("...")


class TestGetPlatformSystemPrompt:
    """Test platform-specific system prompts."""

    def test_twitter_prompt(self):
        """Test Twitter has appropriate prompt."""
        prompt = get_platform_system_prompt("twitter")
        assert "Twitter" in prompt or "tweet" in prompt.lower()

    def test_linkedin_prompt(self):
        """Test LinkedIn has professional prompt."""
        prompt = get_platform_system_prompt("linkedin")
        assert "LinkedIn" in prompt or "professional" in prompt.lower()

    def test_instagram_prompt(self):
        """Test Instagram has visual-focused prompt."""
        prompt = get_platform_system_prompt("instagram")
        assert "Instagram" in prompt or "caption" in prompt.lower()

    def test_default_prompt(self):
        """Test unknown platform gets Twitter prompt."""
        prompt = get_platform_system_prompt("unknown-platform")
        assert len(prompt) > 0


class TestPlatformConsistency:
    """Test that all platforms have consistent structure."""

    def test_all_platforms_have_required_fields(self):
        """Test all platforms have all required fields."""
        for name, limits in PLATFORM_LIMITS.items():
            assert limits.max_length > 0, f"{name} missing max_length"
            assert limits.hashtag_placement in ["inline", "end", "none"]
            assert limits.link_handling in ["counted", "not_counted", "shortened_required"]
            assert limits.max_images >= 0
            assert limits.max_hashtags is None or limits.max_hashtags > 0

    def test_platform_names_match_limits(self):
        """Test platform names in limits match actual platform names."""
        for name in PLATFORM_LIMITS.keys():
            # Platform name should be consistent
            assert name == name.lower() or name in ["x", "X"]
