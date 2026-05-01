import logging
from fastapi import APIRouter, Depends
from app.schemas.social_media import (
    GeneratePostRequest, GeneratePostResponse,
    GenerateBatchRequest, GenerateBatchResponse,
    GenerateThreadRequest, GenerateThreadResponse,
    GenerateVariationsRequest, GenerateVariationsResponse,
    GenerateHooksRequest, GenerateHooksResponse,
    GenerateHashtagsRequest, GenerateHashtagsResponse,
    GenerateBulkTemplateRequest, GenerateBulkTemplateResponse,
    PlatformLimitsResponse, PlatformInfo,
    ModerationResultSchema,
)
from app.services.social_media import (
    get_social_media_generator,
    PLATFORM_LIMITS,
    format_post_for_platform,
)
from app.core.security import require_user, UserContext

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/generate", response_model=GeneratePostResponse)
async def generate_post(
    request: GeneratePostRequest,
    user: UserContext = Depends(require_user),
):
    """
    Generate a single social media post for a specific platform.

    Uses AI to create platform-optimized content with:
    - Platform-specific formatting and character limits
    - Hashtag optimization
    - Tone-appropriate content
    - Content moderation (PII detection, harmful content filtering)
    """
    generator = get_social_media_generator(user.user_id, moderate=request.moderate)

    result = await generator.generate_post(
        topic=request.topic,
        platform=request.platform,
        tone=request.tone,
        include_hashtags=request.include_hashtags,
        include_cta=request.include_cta,
        additional_context=request.additional_context,
        max_length=request.max_length,
        moderate=request.moderate,
    )

    if "error" in result:
        return GeneratePostResponse(error=result["error"])

    # Attach moderation result if present
    post = result
    if "moderation_result" in result:
        post["moderation_result"] = ModerationResultSchema(**result["moderation_result"])

    return GeneratePostResponse(post=post)


@router.post("/generate-batch", response_model=GenerateBatchResponse)
async def generate_batch(
    request: GenerateBatchRequest,
    user: UserContext = Depends(require_user),
):
    """
    Generate posts across multiple platforms in a single request.
    
    Useful for content repurposing - create one topic and adapt it
    for different social media platforms simultaneously.
    """
    generator = get_social_media_generator(user.user_id)
    
    result = await generator.generate_batch(
        topic=request.topic,
        platforms=request.platforms,
        tone=request.tone,
        include_hashtags=request.include_hashtags,
        include_cta=request.include_cta,
        count_per_platform=request.count_per_platform,
    )
    
    return GenerateBatchResponse(
        posts=result.get("posts", {}),
        generated_count=result.get("generated_count", 0),
        errors=result.get("errors"),
    )


@router.post("/generate-thread", response_model=GenerateThreadResponse)
async def generate_thread(
    request: GenerateThreadRequest,
    user: UserContext = Depends(require_user),
):
    """
    Generate a thread/tweetstorm for platforms that support it.

    Creates a series of connected posts that tell a story or
    share comprehensive information on a topic.
    Content moderation is applied to all tweets in the thread.
    """
    generator = get_social_media_generator(user.user_id, moderate=request.moderate)

    result = await generator.generate_thread(
        topic=request.topic,
        platform=request.platform,
        tweet_count=request.tweet_count,
        hook_first=request.hook_first,
        moderate=request.moderate,
    )

    if "error" in result:
        return GenerateThreadResponse(error=result["error"])

    # Build response with thread and moderation info
    response = {
        "thread": result.get("thread", []),
        "tweet_count": result.get("tweet_count", 0),
    }

    # Add moderation result if present
    if "moderation_result" in result:
        response["moderation_result"] = ModerationResultSchema(**result["moderation_result"])

    return GenerateThreadResponse(**response)


@router.post("/generate-variations", response_model=GenerateVariationsResponse)
async def generate_variations(
    request: GenerateVariationsRequest,
    user: UserContext = Depends(require_user),
):
    """
    Generate multiple variations of an existing post.
    
    Useful for A/B testing or adapting content for different audiences.
    """
    generator = get_social_media_generator(user.user_id)
    
    result = await generator.generate_variations(
        base_content=request.base_content,
        platform=request.platform,
        count=request.count,
        variation_type=request.variation_type,
    )
    
    if "error" in result:
        return GenerateVariationsResponse(error=result["error"])
    
    return GenerateVariationsResponse(
        variations=result.get("variations", []),
        count=result.get("count", 0),
    )


@router.post("/generate-hooks", response_model=GenerateHooksResponse)
async def generate_hooks(
    request: GenerateHooksRequest,
    user: UserContext = Depends(require_user),
):
    """
    Generate multiple hook/opener options for a post.
    
    Hooks are the first few words that grab attention and
    encourage the reader to continue.
    """
    generator = get_social_media_generator(user.user_id)
    
    result = await generator.generate_hooks(
        topic=request.topic,
        platform=request.platform,
        count=request.count,
    )
    
    if "error" in result:
        return GenerateHooksResponse(error=result["error"])
    
    return GenerateHooksResponse(
        hooks=result.get("hooks", []),
        count=result.get("count", 0),
    )


@router.post("/generate-hashtags", response_model=GenerateHashtagsResponse)
async def generate_hashtags(
    request: GenerateHashtagsRequest,
    user: UserContext = Depends(require_user),
):
    """
    Generate optimized hashtags for a topic and platform.

    Returns a mix of popular, niche, and trending hashtags
    appropriate for the specified platform.
    Content moderation filters out spam and harmful hashtags.
    """
    generator = get_social_media_generator(user.user_id, moderate=request.moderate)

    result = await generator.generate_hashtags(
        topic=request.topic,
        platform=request.platform,
        count=request.count,
        style=request.style,
        moderate=request.moderate,
    )

    if "error" in result:
        return GenerateHashtagsResponse(error=result["error"])

    # Build response
    response = {
        "hashtags": result.get("hashtags", []),
        "count": result.get("count", 0),
    }

    # Add moderation result if present
    if "moderation_result" in result:
        response["moderation_result"] = ModerationResultSchema(**result["moderation_result"])

    return GenerateHashtagsResponse(**response)


@router.get("/platforms", response_model=list[PlatformInfo])
async def list_platforms(
    user: UserContext = Depends(require_user),
):
    """
    List all supported platforms with their limits and capabilities.
    
    Use this endpoint to get platform-specific constraints before
    generating content.
    """
    platform_info = []
    
    for platform, limits in PLATFORM_LIMITS.items():
        info = PlatformInfo(
            name=platform,
            display_name=_get_platform_display_name(platform),
            limits=PlatformLimitsResponse(
                platform=platform,
                max_length=limits.max_length,
                recommended_length=limits.recommended_length,
                max_hashtags=limits.max_hashtags,
                max_images=limits.max_images,
                hashtag_placement=limits.hashtag_placement,
                link_handling=limits.link_handling,
                supports_threads=limits.supports_threads,
            ),
        )
        platform_info.append(info)
    
    return platform_info


@router.get("/platforms/{platform}", response_model=PlatformInfo | dict)
async def get_platform(
    platform: str,
    user: UserContext = Depends(require_user),
):
    """
    Get detailed information about a specific platform.
    """
    if platform not in PLATFORM_LIMITS:
        return {"error": f"Unknown platform: {platform}"}
    
    limits = PLATFORM_LIMITS[platform]
    
    return PlatformInfo(
        name=platform,
        display_name=_get_platform_display_name(platform),
        limits=PlatformLimitsResponse(
            platform=platform,
            max_length=limits.max_length,
            recommended_length=limits.recommended_length,
            max_hashtags=limits.max_hashtags,
            max_images=limits.max_images,
            hashtag_placement=limits.hashtag_placement,
            link_handling=limits.link_handling,
            supports_threads=limits.supports_threads,
        ),
    )


@router.post("/format")
async def format_post(
    content: str,
    platform: str,
    hashtags: list[str] = [],
    link: str | None = None,
    mention: str | None = None,
    user: UserContext = Depends(require_user),
):
    """
    Format existing content for a specific platform.
    
    This endpoint takes already-written content and applies
    platform-specific formatting (hashtag placement, truncation, etc.)
    without regenerating the content.
    """
    result = format_post_for_platform(
        content=content,
        hashtags=hashtags,
        platform=platform,
        link=link,
        mention=mention,
    )
    
    return result


def _get_platform_display_name(platform: str) -> str:
    """Get a user-friendly display name for a platform."""
    names = {
        "twitter": "X (Twitter)",
        "x": "X",
        "linkedin": "LinkedIn (Personal)",
        "linkedin-page": "LinkedIn (Company Page)",
        "instagram": "Instagram",
        "instagram-standalone": "Instagram (Standalone)",
        "facebook": "Facebook",
        "threads": "Threads",
        "bluesky": "Bluesky",
        "tiktok": "TikTok",
        "reddit": "Reddit",
        "youtube": "YouTube",
        "google": "Google Business",
        "mastodon": "Mastodon",
        "devto": "Dev.to",
        "wordpress": "WordPress",
        "pinterest": "Pinterest",
        "discord": "Discord",
        "dribbble": "Dribbble",
    }
    return names.get(platform, platform.replace("-", " ").title())
