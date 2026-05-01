"""
AI-powered social media post generation service.

Generates platform-optimized content using the configured LLM.
Includes content moderation with PII detection and harmful content filtering.
"""

import json
import logging
from typing import Optional
from app.services.llm import llm_service
from app.services.social_media.platforms import (
    get_platform_limits,
    get_platform_system_prompt,
    format_post_for_platform,
    truncate_to_platform,
)
from app.services.social_media.moderator import (
    ContentModerator,
    ModerationResult,
    get_content_moderator,
    SeverityLevel,
)

logger = logging.getLogger(__name__)


class SocialMediaGenerator:
    """
    Generates social media content for multiple platforms.

    Uses the LLM service to create platform-optimized posts with:
    - Platform-specific formatting
    - Character limit enforcement
    - Hashtag optimization
    - CTA and hook generation
    - Content moderation (PII detection, harmful content filtering)
    """

    SUPPORTED_PLATFORMS = [
        "twitter", "x", "linkedin", "linkedin-page", "instagram",
        "instagram-standalone", "facebook", "threads", "bluesky",
        "tiktok", "reddit", "youtube", "google", "mastodon",
        "devto", "wordpress", "pinterest", "discord", "dribbble",
    ]

    def __init__(self, user_id: str, moderate: bool = True, auto_censor: bool = True):
        self.user_id = user_id
        self.moderate = moderate
        self.auto_censor = auto_censor
        self._moderator: Optional[ContentModerator] = None

    @property
    def moderator(self) -> ContentModerator:
        """Lazy-load moderator to avoid import issues."""
        if self._moderator is None:
            self._moderator = get_content_moderator(
                user_id=self.user_id,
                auto_censor=self.auto_censor,
            )
        return self._moderator

    async def _moderate_content(
        self,
        text: str,
        content_type: str = "post",
    ) -> ModerationResult:
        """Run content moderation if enabled."""
        if not self.moderate:
            return ModerationResult(passed=True)
        return await self.moderator.moderate(text, content_type=content_type)

    async def generate_post(
        self,
        topic: str,
        platform: str,
        tone: str = "professional",
        include_hashtags: bool = True,
        include_cta: bool = False,
        additional_context: str = "",
        max_length: int | None = None,
        moderate: bool | None = None,
    ) -> dict:
        """
        Generate a single social media post for a specific platform.

        Args:
            topic: The main topic/theme of the post
            platform: Target platform (twitter, linkedin, etc.)
            tone: Tone of voice (professional, casual, humorous)
            include_hashtags: Whether to include hashtags
            include_cta: Whether to include a call-to-action
            additional_context: Additional context or requirements
            max_length: Override the platform's default max length
            moderate: Override default moderation setting (default: self.moderate)

        Returns:
            dict with keys: text, hashtags, platform, character_count, warning, moderation_result
        """
        # Use instance default if not specified
        do_moderate = moderate if moderate is not None else self.moderate

        if platform not in self.SUPPORTED_PLATFORMS:
            return {
                "error": f"Unsupported platform: {platform}",
                "supported_platforms": self.SUPPORTED_PLATFORMS,
            }

        limits = get_platform_limits(platform)
        system_prompt = get_platform_system_prompt(platform)

        # Build user prompt
        max_chars = max_length or limits.max_length
        user_prompt = self._build_generation_prompt(
            topic=topic,
            platform=platform,
            tone=tone,
            max_length=max_chars,
            include_hashtags=include_hashtags,
            include_cta=include_cta,
            additional_context=additional_context,
        )

        try:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]

            response = await llm_service.chat_complete(
                messages=messages,
                temperature=0.8,
                max_tokens=1024,
            )

            content = response.get("message", {}).get("content", "")

            # Parse the generated content
            result = self._parse_generated_content(
                content=content,
                platform=platform,
                include_hashtags=include_hashtags,
            )

            # Run content moderation if enabled
            if do_moderate:
                mod_result = await self._moderate_content(
                    text=result.get("text", ""),
                    content_type="post",
                )
                result["moderation_result"] = self._format_moderation_result(mod_result)

                # Handle rejected content
                if not mod_result.passed:
                    return {
                        "error": mod_result.error_message,
                        "platform": platform,
                        "moderation_result": self._format_moderation_result(mod_result),
                    }

                # Use sanitized content if available
                if mod_result.sanitized_content:
                    result["text"] = mod_result.sanitized_content
                    result["warning"] = (result.get("warning") or "") + " [Content auto-censored]"

            return result

        except Exception as e:
            logger.error(f"Post generation failed for {platform}: {e}")
            return {
                "error": f"Generation failed: {str(e)}",
                "platform": platform,
            }

    async def generate_batch(
        self,
        topic: str,
        platforms: list[str],
        tone: str = "professional",
        include_hashtags: bool = True,
        include_cta: bool = False,
        count_per_platform: int = 1,
        moderate: bool | None = None,
    ) -> dict:
        """
        Generate multiple posts across different platforms.

        Args:
            topic: The main topic/theme
            platforms: List of target platforms
            tone: Tone of voice
            include_hashtags: Whether to include hashtags
            include_cta: Whether to include CTAs
            count_per_platform: Number of variations per platform
            moderate: Override default moderation setting

        Returns:
            dict with platform keys, each containing list of generated posts
        """
        # Use instance default if not specified
        do_moderate = moderate if moderate is not None else self.moderate

        results = {}
        errors = []

        for platform in platforms:
            if platform not in self.SUPPORTED_PLATFORMS:
                errors.append(f"Unsupported platform: {platform}")
                continue

            platform_posts = []
            for i in range(count_per_platform):
                try:
                    post = await self.generate_post(
                        topic=topic,
                        platform=platform,
                        tone=tone,
                        include_hashtags=include_hashtags,
                        include_cta=include_cta,
                        moderate=do_moderate,
                    )
                    if "error" not in post:
                        platform_posts.append(post)
                    else:
                        errors.append(f"{platform}: {post.get('error')}")
                except Exception as e:
                    errors.append(f"{platform} (attempt {i+1}): {str(e)}")

            if platform_posts:
                results[platform] = platform_posts

        return {
            "posts": results,
            "errors": errors if errors else None,
            "generated_count": sum(len(v) for v in results.values()),
        }

    async def generate_variations(
        self,
        base_content: str,
        platform: str,
        count: int = 3,
        variation_type: str = "rephrase",
        moderate: bool | None = None,
    ) -> dict:
        """
        Generate variations of an existing post.

        Args:
            base_content: The original post content
            platform: Target platform
            count: Number of variations to generate
            variation_type: Type of variation (rephrase, expand, shorten)
            moderate: Override default moderation setting

        Returns:
            dict with list of variations
        """
        # Use instance default if not specified
        do_moderate = moderate if moderate is not None else self.moderate

        if platform not in self.SUPPORTED_PLATFORMS:
            return {"error": f"Unsupported platform: {platform}"}

        limits = get_platform_limits(platform)

        prompt = f"""Generate {count} variations of this social media post for {platform}.
Max length: {limits.max_length} characters.

Original post:
{base_content}

Variation type: {variation_type}

Generate the variations as a JSON array of objects with keys: text, hashtags (array).
Respond with ONLY the JSON array, no markdown fences or explanation."""

        try:
            messages = [
                {"role": "user", "content": prompt},
            ]

            response = await llm_service.chat_complete(
                messages=messages,
                temperature=0.9,
                max_tokens=2048,
            )

            content = response.get("message", {}).get("content", "")

            # Parse JSON response
            variations = self._parse_json_array(content)

            if variations:
                formatted = []
                for v in variations:
                    text = v.get("text", "")
                    hashtags = v.get("hashtags", [])

                    # Run moderation on each variation
                    if do_moderate:
                        mod_result = await self._moderate_content(text, content_type="post")
                        if not mod_result.passed:
                            # Skip rejected variations
                            continue
                        if mod_result.sanitized_content:
                            text = mod_result.sanitized_content

                    formatted_result = format_post_for_platform(
                        content=text,
                        hashtags=hashtags if include_hashtags else [],
                        platform=platform,
                    )

                    if do_moderate:
                        formatted_result["moderation_result"] = self._format_moderation_result(mod_result)

                    formatted.append(formatted_result)

                return {
                    "variations": formatted,
                    "count": len(formatted),
                }
            else:
                return {"error": "Failed to parse variations", "raw_content": content}

        except Exception as e:
            logger.error(f"Variation generation failed: {e}")
            return {"error": f"Variation generation failed: {str(e)}"}

    async def generate_thread(
        self,
        topic: str,
        platform: str = "twitter",
        tweet_count: int = 5,
        hook_first: bool = True,
        moderate: bool | None = None,
    ) -> dict:
        """
        Generate a thread/tweetstorm for platforms that support it.

        Args:
            topic: The thread topic
            platform: Base platform (twitter or threads)
            tweet_count: Number of tweets in the thread
            hook_first: Whether to make the first tweet a hook
            moderate: Override default moderation setting

        Returns:
            dict with list of tweets forming a thread, plus moderation_result
        """
        # Use instance default if not specified
        do_moderate = moderate if moderate is not None else self.moderate

        if platform not in ["twitter", "x", "threads", "bluesky"]:
            return {"error": f"Threads not supported for {platform}"}

        limits = get_platform_limits(platform)

        prompt = f"""Generate a thread of {tweet_count} connected posts about this topic for {platform}.
Max length per post: {limits.max_length} characters.
{'Start with a compelling hook to grab attention.' if hook_first else ''}

Topic: {topic}

Generate as a JSON array where each item has: text, hashtags (array), tweet_number (1-indexed).
Respond with ONLY the JSON array, no markdown fences."""

        try:
            messages = [
                {"role": "user", "content": prompt},
            ]

            response = await llm_service.chat_complete(
                messages=messages,
                temperature=0.8,
                max_tokens=2048,
            )

            content = response.get("message", {}).get("content", "")
            tweets = self._parse_json_array(content)

            if tweets:
                formatted = []
                for tweet in tweets:
                    text = tweet.get("text", "")
                    hashtags = tweet.get("hashtags", [])
                    result = format_post_for_platform(
                        content=text,
                        hashtags=hashtags,
                        platform=platform,
                    )
                    result["tweet_number"] = tweet.get("tweet_number", len(formatted) + 1)
                    formatted.append(result)

                # Moderate the entire thread
                if do_moderate:
                    moderated_tweets, overall_result = self.moderator.moderate_thread(formatted)

                    return {
                        "thread": moderated_tweets,
                        "tweet_count": len(moderated_tweets),
                        "moderation_result": self._format_moderation_result(overall_result),
                        "error": overall_result.error_message if not overall_result.passed else None,
                    }

                return {
                    "thread": formatted,
                    "tweet_count": len(formatted),
                }
            else:
                return {"error": "Failed to parse thread", "raw_content": content}

        except Exception as e:
            logger.error(f"Thread generation failed: {e}")
            return {"error": f"Thread generation failed: {str(e)}"}

    async def generate_hooks(
        self,
        topic: str,
        platform: str,
        count: int = 5,
        moderate: bool | None = None,
    ) -> dict:
        """
        Generate multiple hook options for a post.

        Args:
            topic: The post topic
            platform: Target platform
            count: Number of hook options
            moderate: Override default moderation setting

        Returns:
            dict with list of hook options
        """
        # Use instance default if not specified
        do_moderate = moderate if moderate is not None else self.moderate

        if platform not in self.SUPPORTED_PLATFORMS:
            return {"error": f"Unsupported platform: {platform}"}

        limits = get_platform_limits(platform)

        prompt = f"""Generate {count} different hook/openers for a post about this topic on {platform}.
Max hook length: 100 characters.

Topic: {topic}

A hook should grab attention in the first few words.
Examples: "I tested 100...", "Nobody talks about...", "Here's the truth about..."

Generate as a JSON array of objects with keys: hook, hook_type (question/statement/fact/contrast).
Respond with ONLY the JSON array."""

        try:
            messages = [
                {"role": "user", "content": prompt},
            ]

            response = await llm_service.chat_complete(
                messages=messages,
                temperature=0.9,
                max_tokens=1024,
            )

            content = response.get("message", {}).get("content", "")
            hooks = self._parse_json_array(content)

            # Moderate hooks if enabled
            if do_moderate and hooks:
                moderated_hooks = []
                all_flags = []
                for hook in hooks:
                    hook_text = hook.get("hook", "")
                    mod_result = await self._moderate_content(hook_text, content_type="hooks")

                    # Only include hooks that pass moderation
                    if mod_result.passed:
                        hook_copy = hook.copy()
                        hook_copy["moderation_result"] = self._format_moderation_result(mod_result)
                        hook_copy["text"] = mod_result.sanitized_content or hook_text
                        moderated_hooks.append(hook_copy)
                        all_flags.extend(mod_result.flags)

                return {
                    "hooks": moderated_hooks if moderated_hooks else hooks,
                    "count": len(moderated_hooks) if moderated_hooks else len(hooks),
                }

            return {
                "hooks": hooks if hooks else [],
                "count": len(hooks) if hooks else 0,
            }

        except Exception as e:
            logger.error(f"Hook generation failed: {e}")
            return {"error": f"Hook generation failed: {str(e)}"}

    async def generate_hashtags(
        self,
        topic: str,
        platform: str,
        count: int = 5,
        style: str = "mixed",
        moderate: bool | None = None,
    ) -> dict:
        """
        Generate optimized hashtags for a topic and platform.

        Args:
            topic: The post topic
            platform: Target platform
            count: Number of hashtags
            style: Style of hashtags (popular, niche, mixed, trending)
            moderate: Override default moderation setting

        Returns:
            dict with list of hashtags and moderation_result
        """
        # Use instance default if not specified
        do_moderate = moderate if moderate is not None else self.moderate

        if platform not in self.SUPPORTED_PLATFORMS:
            return {"error": f"Unsupported platform: {platform}"}

        limits = get_platform_limits(platform)
        max_hashtags = limits.max_hashtags or count

        prompt = f"""Generate {min(count, max_hashtags)} hashtags for a {platform} post about: {topic}

Style: {style} hashtags
- popular: Broad, high-volume tags
- niche: Specific, targeted tags
- mixed: Mix of both
- trending: Currently popular tags (add # where needed)

Respond with ONLY a JSON array of hashtag strings like ["#topic", "#example"].
Do not include explanations or other text."""

        try:
            messages = [
                {"role": "user", "content": prompt},
            ]

            response = await llm_service.chat_complete(
                messages=messages,
                temperature=0.8,
                max_tokens=256,
            )

            content = response.get("message", {}).get("content", "")
            hashtags = self._parse_hashtag_array(content)

            # Ensure we don't exceed platform limit
            if limits.max_hashtags:
                hashtags = hashtags[:limits.max_hashtags]

            # Moderate hashtags if enabled
            if do_moderate and hashtags:
                moderated_hashtags, mod_result = self.moderator.moderate_hashtags(hashtags)
                return {
                    "hashtags": moderated_hashtags,
                    "count": len(moderated_hashtags),
                    "moderation_result": self._format_moderation_result(mod_result),
                }

            return {
                "hashtags": hashtags,
                "count": len(hashtags),
            }

        except Exception as e:
            logger.error(f"Hashtag generation failed: {e}")
            return {"error": f"Hashtag generation failed: {str(e)}"}

    def _build_generation_prompt(
        self,
        topic: str,
        platform: str,
        tone: str,
        max_length: int,
        include_hashtags: bool,
        include_cta: bool,
        additional_context: str,
    ) -> str:
        """Build the user prompt for content generation."""
        limits = get_platform_limits(platform)
        rec_length = limits.recommended_length or (max_length // 2)
        
        prompt_parts = [
            f"Write a social media post for {platform}.",
            f"\n\nTopic: {topic}",
            f"\n\nTone: {tone}",
            f"\n\nConstraints:",
            f"- Maximum {max_length} characters",
            f"- Aim for around {rec_length} characters for optimal engagement",
        ]
        
        if include_hashtags:
            max_tags = limits.max_hashtags or 10
            prompt_parts.append(f"- Include {max_tags // 2}-{max_tags} relevant hashtags")
        else:
            prompt_parts.append("- Do not include hashtags")
        
        if include_cta:
            prompt_parts.append("- Include a clear call-to-action")
        
        if additional_context:
            prompt_parts.append(f"\n\nAdditional context: {additional_context}")
        
        prompt_parts.append(
            f'\n\nRespond with ONLY a JSON object (no markdown fences):\n'
            f'{{"text": "post content here", "hashtags": ["#tag1", "#tag2"]}}'
        )
        
        return "".join(prompt_parts)

    def _parse_generated_content(
        self,
        content: str,
        platform: str,
        include_hashtags: bool,
    ) -> dict:
        """Parse the LLM-generated content into structured format."""
        # Try to parse as JSON
        parsed = self._parse_json_object(content)
        
        if parsed:
            text = parsed.get("text", content)
            hashtags = parsed.get("hashtags", [])
            
            # Format for platform
            formatted = format_post_for_platform(
                content=text,
                hashtags=hashtags if include_hashtags else [],
                platform=platform,
            )
            formatted["platform"] = platform
            return formatted
        
        # Fallback: use content as-is
        return {
            "text": content.strip(),
            "character_count": len(content),
            "platform": platform,
        }

    def _parse_json_object(self, content: str) -> dict | None:
        """Parse content as a JSON object."""
        content = content.strip()
        
        # Strip markdown fences
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        
        # Try to find JSON object
        start = content.find("{")
        end = content.rfind("}") + 1
        
        if start >= 0 and end > start:
            try:
                return json.loads(content[start:end])
            except json.JSONDecodeError:
                pass
        
        return None

    def _parse_json_array(self, content: str) -> list | None:
        """Parse content as a JSON array."""
        content = content.strip()
        
        # Strip markdown fences
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        
        # Try to find JSON array
        start = content.find("[")
        end = content.rfind("]") + 1
        
        if start >= 0 and end > start:
            try:
                return json.loads(content[start:end])
            except json.JSONDecodeError:
                pass
        
        return None

    def _format_moderation_result(self, result: ModerationResult) -> dict:
        """Format moderation result for API response."""
        return {
            "passed": result.passed,
            "flags": [
                {
                    "category": f.category,
                    "type": f.type,
                    "severity": f.severity.value,
                    "message": f.message,
                    "location": f.location,
                }
                for f in result.flags
            ],
            "pii_detected": result.pii_detected,
            "pii_types": result.pii_types,
            "action_taken": result.action_taken,
        }

    def _parse_hashtag_array(self, content: str) -> list[str]:
        """Parse content as an array of hashtags."""
        content = content.strip()
        
        # Strip markdown fences
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        
        # Try to parse as JSON array
        start = content.find("[")
        end = content.rfind("]") + 1
        
        if start >= 0 and end > start:
            try:
                parsed = json.loads(content[start:end])
                if isinstance(parsed, list):
                    return [str(h).strip() for h in parsed if h]
            except json.JSONDecodeError:
                pass
        
        # Fallback: extract hashtags with regex
        import re
        hashtags = re.findall(r'#\w+', content)
        return hashtags


# Singleton instance factory
def get_social_media_generator(
    user_id: str,
    moderate: bool = True,
    auto_censor: bool = True,
) -> SocialMediaGenerator:
    """Get a social media generator instance for a user."""
    return SocialMediaGenerator(user_id, moderate=moderate, auto_censor=auto_censor)
