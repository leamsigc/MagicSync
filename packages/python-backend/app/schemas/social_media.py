from pydantic import BaseModel, Field
from typing import Optional


class GeneratePostRequest(BaseModel):
    """Request to generate a single social media post."""
    topic: str = Field(..., description="The main topic/theme of the post")
    platform: str = Field(..., description="Target platform (twitter, linkedin, instagram, etc.)")
    tone: str = Field(default="professional", description="Tone of voice (professional, casual, humorous)")
    include_hashtags: bool = Field(default=True, description="Whether to include hashtags")
    include_cta: bool = Field(default=False, description="Whether to include a call-to-action")
    additional_context: str = Field(default="", description="Additional context or requirements")
    max_length: int | None = Field(default=None, description="Override platform's default max length")
    moderate: bool = Field(default=True, description="Whether to run content moderation (PII, harmful content)")


class GenerateBatchRequest(BaseModel):
    """Request to generate posts across multiple platforms."""
    topic: str = Field(..., description="The main topic/theme")
    platforms: list[str] = Field(..., description="List of target platforms")
    tone: str = Field(default="professional", description="Tone of voice")
    include_hashtags: bool = Field(default=True, description="Whether to include hashtags")
    include_cta: bool = Field(default=False, description="Whether to include CTAs")
    count_per_platform: int = Field(default=1, ge=1, le=5, description="Variations per platform")


class GenerateThreadRequest(BaseModel):
    """Request to generate a thread/tweetstorm."""
    topic: str = Field(..., description="The thread topic")
    platform: str = Field(default="twitter", description="Base platform (twitter or threads)")
    tweet_count: int = Field(default=5, ge=2, le=25, description="Number of tweets in thread")
    hook_first: bool = Field(default=True, description="Whether to start with a hook")
    moderate: bool = Field(default=True, description="Whether to run content moderation")


class GenerateVariationsRequest(BaseModel):
    """Request to generate variations of an existing post."""
    base_content: str = Field(..., description="The original post content")
    platform: str = Field(..., description="Target platform")
    count: int = Field(default=3, ge=1, le=10, description="Number of variations")
    variation_type: str = Field(default="rephrase", description="Type (rephrase, expand, shorten)")


class GenerateHooksRequest(BaseModel):
    """Request to generate hook options for a post."""
    topic: str = Field(..., description="The post topic")
    platform: str = Field(..., description="Target platform")
    count: int = Field(default=5, ge=1, le=20, description="Number of hook options")


class GenerateHashtagsRequest(BaseModel):
    """Request to generate hashtags for a topic."""
    topic: str = Field(..., description="The post topic")
    platform: str = Field(..., description="Target platform")
    count: int = Field(default=5, ge=1, le=30, description="Number of hashtags")
    style: str = Field(default="mixed", description="Style (popular, niche, mixed, trending)")
    moderate: bool = Field(default=True, description="Whether to run content moderation")


class GenerateBulkTemplateRequest(BaseModel):
    """Request to generate content for bulk scheduling templates."""
    topic: str = Field(..., description="The content topic/theme")
    platforms: list[str] = Field(..., description="Target platforms")
    template_variables: list[str] = Field(default=[], description="Variable names for template")
    tone: str = Field(default="professional", description="Tone of voice")
    include_hashtags: bool = Field(default=True, description="Whether to include hashtags")
    count: int = Field(default=10, ge=1, le=100, description="Number of content variations")


class GeneratedPost(BaseModel):
    """A single generated social media post."""
    text: str
    hashtags: list[str] = []
    platform: str
    character_count: int
    warning: str | None = None
    moderation_result: "ModerationResultSchema | None" = None


class ModerationFlagSchema(BaseModel):
    """A single moderation flag."""
    category: str
    type: str
    severity: str
    message: str
    location: str | None = None


class ModerationResultSchema(BaseModel):
    """Result of content moderation."""
    passed: bool
    flags: list[ModerationFlagSchema] = []
    pii_detected: bool = False
    pii_types: list[str] = []
    action_taken: str | None = None


class HookOption(BaseModel):
    """A hook/openion option for a post."""
    hook: str
    hook_type: str  # question, statement, fact, contrast


class PlatformLimitsResponse(BaseModel):
    """Platform limits and capabilities."""
    platform: str
    max_length: int
    recommended_length: int | None = None
    max_hashtags: int | None = None
    max_images: int = 1
    hashtag_placement: str
    link_handling: str
    supports_threads: bool = False


class PlatformInfo(BaseModel):
    """Information about a platform."""
    name: str
    display_name: str
    limits: PlatformLimitsResponse


class GeneratePostResponse(BaseModel):
    """Response for single post generation."""
    post: GeneratedPost | None = None
    error: str | None = None


class GenerateBatchResponse(BaseModel):
    """Response for batch generation."""
    posts: dict[str, list[GeneratedPost]] = {}
    generated_count: int = 0
    errors: list[str] | None = None


class GenerateThreadResponse(BaseModel):
    """Response for thread generation."""
    thread: list[GeneratedPost] = []
    tweet_count: int = 0
    error: str | None = None
    moderation_result: "ModerationResultSchema | None" = None


class GenerateVariationsResponse(BaseModel):
    """Response for variation generation."""
    variations: list[GeneratedPost] = []
    count: int = 0
    error: str | None = None


class GenerateHooksResponse(BaseModel):
    """Response for hook generation."""
    hooks: list[HookOption] = []
    count: int = 0
    error: str | None = None


class GenerateHashtagsResponse(BaseModel):
    """Response for hashtag generation."""
    hashtags: list[str] = []
    count: int = 0
    error: str | None = None
    moderation_result: "ModerationResultSchema | None" = None


class GenerateBulkTemplateResponse(BaseModel):
    """Response for bulk template generation."""
    templates: list[dict] = []
    count: int = 0
    errors: list[str] | None = None
