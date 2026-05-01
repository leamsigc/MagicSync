"""
Platform-specific social media formatters.

Each platform has different:
- Character limits
- Hashtag placement rules
- Link handling
- Image requirements
- Tone and style guidelines
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class PlatformLimits:
    """Platform-specific constraints for a social media platform."""
    max_length: int
    hashtag_placement: str  # 'inline' | 'end' | 'none'
    link_handling: str  # 'counted' | 'not_counted' | 'shortened_required'
    max_hashtags: int | None = None
    max_images: int = 1
    supports_threads: bool = False
    supports_mentions: bool = True
    recommended_length: int | None = None  # For optimal engagement


PLATFORM_LIMITS = {
    # Twitter/X: 280 chars, hashtags inline or end, links count toward limit
    "twitter": PlatformLimits(
        max_length=280,
        hashtag_placement="inline",
        link_handling="counted",
        max_hashtags=5,
        max_images=4,
        recommended_length=200,
    ),
    "x": PlatformLimits(
        max_length=280,
        hashtag_placement="inline",
        link_handling="counted",
        max_hashtags=5,
        max_images=4,
        recommended_length=200,
    ),
    # LinkedIn: 3000 chars, hashtags at end, links counted
    "linkedin": PlatformLimits(
        max_length=3000,
        hashtag_placement="end",
        link_handling="counted",
        max_hashtags=10,
        max_images=20,
        recommended_length=1500,
    ),
    "linkedin-page": PlatformLimits(
        max_length=3000,
        hashtag_placement="end",
        link_handling="counted",
        max_hashtags=10,
        max_images=20,
        recommended_length=1500,
    ),
    # Instagram: 2200 chars, hashtags at end, no link previews
    "instagram": PlatformLimits(
        max_length=2200,
        hashtag_placement="end",
        link_handling="not_counted",
        max_hashtags=30,
        max_images=10,
        recommended_length=1250,
    ),
    "instagram-standalone": PlatformLimits(
        max_length=2200,
        hashtag_placement="end",
        link_handling="not_counted",
        max_hashtags=30,
        max_images=10,
        recommended_length=1250,
    ),
    # Facebook: 63206 chars, hashtags inline, links counted
    "facebook": PlatformLimits(
        max_length=63206,
        hashtag_placement="inline",
        link_handling="counted",
        max_hashtags=None,
        max_images=10,
        recommended_length=5000,
    ),
    # Threads: 500 chars, hashtags inline, links displayed
    "threads": PlatformLimits(
        max_length=500,
        hashtag_placement="inline",
        link_handling="not_counted",
        max_hashtags=10,
        max_images=10,
        recommended_length=400,
    ),
    # Bluesky: 300 chars (standard), hashtags inline
    "bluesky": PlatformLimits(
        max_length=300,
        hashtag_placement="inline",
        link_handling="counted",
        max_hashtags=5,
        max_images=4,
        recommended_length=250,
    ),
    # TikTok: 2200 chars, hashtags inline
    "tiktok": PlatformLimits(
        max_length=2200,
        hashtag_placement="inline",
        link_handling="not_counted",
        max_hashtags=100,
        max_images=35,
        recommended_length=1500,
    ),
    # Reddit: 40000 chars (post title 300), hashtags inline
    "reddit": PlatformLimits(
        max_length=40000,
        hashtag_placement="inline",
        link_handling="not_counted",
        max_hashtags=None,
        max_images=20,
        recommended_length=5000,
    ),
    # YouTube: 5000 chars (description), hashtags at end
    "youtube": PlatformLimits(
        max_length=5000,
        hashtag_placement="end",
        link_handling="not_counted",
        max_hashtags=15,
        max_images=1,  # Thumbnail only
        recommended_length=3000,
    ),
    # Google Business: 1500 chars, hashtags inline
    "google": PlatformLimits(
        max_length=1500,
        hashtag_placement="inline",
        link_handling="not_counted",
        max_hashtags=10,
        max_images=1,
        recommended_length=1000,
    ),
    # Pinterest: 500 chars (description), hashtags inline
    "pinterest": PlatformLimits(
        max_length=500,
        hashtag_placement="inline",
        link_handling="not_counted",
        max_hashtags=20,
        max_images=1,
        recommended_length=400,
    ),
    # Mastodon: 500 chars, hashtags inline
    "mastodon": PlatformLimits(
        max_length=500,
        hashtag_placement="inline",
        link_handling="counted",
        max_hashtags=None,
        max_images=4,
        recommended_length=400,
    ),
    # Discord: 2000 chars, hashtags inline
    "discord": PlatformLimits(
        max_length=2000,
        hashtag_placement="inline",
        link_handling="not_counted",
        max_hashtags=None,
        max_images=10,
        recommended_length=1500,
    ),
    # Dev.to: 50000 chars, hashtags inline
    "devto": PlatformLimits(
        max_length=50000,
        hashtag_placement="inline",
        link_handling="not_counted",
        max_hashtags=None,
        max_images=5,
        recommended_length=3000,
    ),
    # WordPress: 10000 chars, hashtags inline
    "wordpress": PlatformLimits(
        max_length=10000,
        hashtag_placement="inline",
        link_handling="not_counted",
        max_hashtags=None,
        max_images=10,
        recommended_length=5000,
    ),
    # Dribbble: 500 chars, hashtags inline
    "dribbble": PlatformLimits(
        max_length=500,
        hashtag_placement="inline",
        link_handling="not_counted",
        max_hashtags=5,
        max_images=1,
        recommended_length=300,
    ),
}


# Platform-specific system prompts for LLM generation
PLATFORM_SYSTEM_PROMPTS = {
    "twitter": """You are a social media expert specializing in Twitter/X content.
- Write concise, punchy posts that spark engagement
- Use wordplay, questions, or bold statements to hook readers
- Keep it conversational and authentic
- Avoid being overly promotional
- Hashtags should be relevant and not excessive (2-5 max)
- End with a question or call-to-action when appropriate
- Twitter rewards brevity and clarity""",
    
    "linkedin": """You are a LinkedIn content expert.
- Write professional but not stiff content
- Share insights, lessons learned, or industry perspectives
- Use storytelling elements when appropriate
- Keep paragraphs short (2-3 sentences max)
- Include a clear takeaway or insight
- Professional tone but conversational delivery
- Hashtags should be professional and industry-relevant (3-10)
- LinkedIn rewards thoughtful, value-driven content""",
    
    "linkedin-page": """You are a LinkedIn Page content expert for business accounts.
- Write content that builds brand authority
- Share company news, industry insights, or thought leadership
- Professional tone with company voice
- Use data or specific examples when possible
- Keep it informative and valuable to followers
- Hashtags should be industry and brand-focused (3-10)
- Balance promotional content with valuable insights""",
    
    "instagram": """You are an Instagram content expert.
- Write captions that complement visual content
- Start with a hook in the first 2-3 lines (visible before "more")
- Use a mix of storytelling and value
- Include a call-to-action (comment, save, share)
- Hashtags belong at the end, mix of popular and niche (5-15)
- Instagram rewards authentic, visually complementary content
- Can use line breaks and emoji for readability""",
    
    "facebook": """You are a Facebook content expert.
- Write conversational, shareable content
- Tell stories or share moments that connect
- Use questions or prompts to drive comments
- Mix of personal and informative content
- Hashtags can be used throughout or at end (3-8)
- Facebook rewards engagement-driving content""",
    
    "threads": """You are a Threads content expert.
- Write casual, conversational posts
- Share hot takes, opinions, or relatable moments
- Keep it short and punchy - Threads moves fast
- Can be more opinionated than other platforms
- Hashtags optional and minimal (1-3)
- Threads rewards authentic, direct communication""",
    
    "bluesky": """You are a Bluesky content expert.
- Write thoughtful, conversation-starting posts
- Bluesky values substance over virality
- Can be longer than Twitter but still concise
- Hashtags inline but not excessive (2-5)
- Good for sharing opinions, links, and discussions
- Bluesky rewards genuine conversation""",
    
    "tiktok": """You are a TikTok content expert.
- Write captions that drive video engagement
- Hook viewers in the first 3 seconds of caption
- Use trending phrases and patterns
- Include relevant trending hashtags
- Call-to-action for comments and shares
- Keep it energetic and authentic
- 3-10 relevant hashtags, can include trending ones""",
    
    "reddit": """You are a Reddit content expert.
- Write helpful, informative post content
- Lead with the most valuable information
- Use clear structure and formatting
- Avoid clickbait or overly promotional language
- Hashtags generally not needed on Reddit
- Reddit rewards genuine value and good formatting""",
    
    "youtube": """You are a YouTube description expert.
- Write descriptions that drive views and engagement
- Include timestamps for key moments
- Add relevant keywords naturally
- Include social links and CTAs
- Hashtags at the end (3-5)
- YouTube rewards detailed, keyword-rich descriptions""",
    
    "google": """You are a Google Business Profile content expert.
- Write local-business focused content
- Highlight what makes your business unique
- Include relevant local keywords
- Keep it professional and customer-focused
- Hashtags inline but minimal (2-5)
- Google rewards accurate, helpful business information""",
    
    "mastodon": """You are a Mastodon content expert.
- Write thoughtful, conversation-focused content
- Mastodon values long-form and substance
- Engage with the fediverse community norms
- Hashtags inline but not excessive
- More personal and less corporate than Twitter""",
    
    "devto": """You are a Dev.to content expert.
- Write developer-focused technical content
- Share tutorials, insights, or opinions on tech
- Code examples should be clear
- Use relevant tech hashtags (3-8)
- Dev.to rewards helpful, well-written technical content""",
}


def get_platform_limits(platform: str) -> PlatformLimits:
    """Get platform limits, falling back to defaults."""
    return PLATFORM_LIMITS.get(platform, PLATFORM_LIMITS.get("twitter"))


def get_platform_system_prompt(platform: str) -> str:
    """Get the system prompt for a specific platform."""
    return PLATFORM_SYSTEM_PROMPTS.get(
        platform, 
        PLATFORM_SYSTEM_PROMPTS.get("twitter", "")
    )


def format_post_for_platform(
    content: str,
    hashtags: list[str],
    platform: str,
    link: str | None = None,
    mention: str | None = None,
) -> dict[str, str]:
    """
    Format a post for a specific platform.
    
    Returns dict with:
    - text: The formatted post text
    - hashtags: Array of hashtags (or empty array if platform doesn't use them)
    - character_count: Actual character count
    - warning: Warning message if content was truncated
    """
    limits = get_platform_limits(platform)
    warning = None
    
    # Build the main text
    main_text = content.strip()
    
    # Handle hashtags based on platform placement
    if limits.hashtag_placement == "end":
        # Add hashtags at the end with line break
        if hashtags:
            hashtag_text = " " + " ".join(hashtags)
    elif limits.hashtag_placement == "inline":
        # Hashtags are already in the content or added inline
        if hashtags and not any(h in main_text for h in hashtags):
            hashtag_text = " " + " ".join(hashtags)
        else:
            hashtag_text = ""
    else:
        hashtag_text = ""
    
    # Combine main text and hashtags
    full_text = main_text + hashtag_text
    
    # Add link if provided
    if link:
        if limits.link_handling == "counted":
            full_text = full_text + " " + link
        else:
            full_text = full_text + "\n\n" + link
    
    # Add mention if provided
    if mention and limits.supports_mentions:
        if mention not in full_text:
            full_text = f"@{mention} " + full_text
    
    # Truncate if necessary
    if len(full_text) > limits.max_length:
        warning = f"Content truncated from {len(full_text)} to {limits.max_length} characters for {platform}"
        # Try to keep hashtags but truncate main text
        if limits.hashtag_placement == "end" and hashtags:
            available = limits.max_length - len(hashtag_text) - 10  # buffer for truncation
            if available > 50:
                full_text = main_text[:available].rstrip() + "..." + hashtag_text
            else:
                full_text = main_text[:limits.max_length - len(hashtag_text) - 3].rstrip() + "..."
        else:
            full_text = full_text[:limits.max_length - 3].rstrip() + "..."
    
    return {
        "text": full_text,
        "character_count": len(full_text),
        "warning": warning,
    }


def truncate_to_platform(
    text: str,
    platform: str,
    reserve: int = 0,
) -> tuple[str, str | None]:
    """
    Truncate text to fit platform limits.
    
    Args:
        text: The text to truncate
        platform: Target platform
        reserve: Characters to reserve for hashtags/links
    
    Returns:
        (truncated_text, warning_or_none)
    """
    limits = get_platform_limits(platform)
    max_allowed = limits.max_length - reserve
    
    if len(text) <= max_allowed:
        return text, None
    
    warning = f"Content truncated from {len(text)} to {max_allowed} characters for {platform}"
    truncated = text[:max_allowed - 3].rstrip()
    
    # Try to end at a sentence or word boundary
    last_punct = max(truncated.rfind(". "), truncated.rfind("! "), truncated.rfind("? "))
    last_space = truncated.rfind(" ")
    
    if last_punct > max_allowed * 0.7:  # Only use if it keeps most of the text
        truncated = truncated[:last_punct + 1]
        warning = f"Content truncated to end of sentence"
    elif last_space > max_allowed * 0.8:
        truncated = truncated[:last_space]
        warning = f"Content truncated to end of word"
    
    return truncated + "...", warning
