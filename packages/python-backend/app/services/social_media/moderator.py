"""
Content moderation for social media generation.

Provides PII detection, harmful content filtering, and policy violation checks.
"""

import logging
import re
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum

from app.services.pii.engine import pii_engine

logger = logging.getLogger(__name__)


class SeverityLevel(Enum):
    """Content moderation severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class ModerationFlag:
    """A single moderation issue found in content."""
    category: str  # "pii", "harmful", "policy", "spam"
    type: str  # e.g., "email", "hate_speech", "violence"
    severity: SeverityLevel
    message: str
    location: str | None = None  # Where in the content
    original_text: str | None = None  # The flagged text


@dataclass
class ModerationResult:
    """Result of content moderation check."""
    passed: bool
    flags: list[ModerationFlag] = field(default_factory=list)
    pii_detected: bool = False
    pii_types: list[str] = field(default_factory=list)
    action_taken: str | None = None  # "censored", "rejected", "warned"
    error_message: str | None = None
    sanitized_content: str | None = None  # Content after auto-censor

    @property
    def severity_summary(self) -> dict[str, int]:
        """Get count of flags by severity."""
        return {
            "low": sum(1 for f in self.flags if f.severity == SeverityLevel.LOW),
            "medium": sum(1 for f in self.flags if f.severity == SeverityLevel.MEDIUM),
            "high": sum(1 for f in self.flags if f.severity == SeverityLevel.HIGH),
        }


# Patterns for harmful content detection
HARMFUL_PATTERNS = {
    "hate_speech": [
        # Case-insensitive patterns for common hate speech indicators
        (r"kill\s*(all\s*)?(them|you|us)", "threat", SeverityLevel.HIGH),
        (r"death\s*to", "violent_hate", SeverityLevel.HIGH),
        (r"(i\s*)?will\s*(hurt|kill|attack)", "threat", SeverityLevel.HIGH),
    ],
    "violence": [
        (r"(execute|execute\s*)*assassinate", "violence", SeverityLevel.HIGH),
        (r"(gore|bloody|murder)", "graphic_violence", SeverityLevel.HIGH),
        (r"(bomb|explosive|attack)\s*(someone|them|it)", "violent_threat", SeverityLevel.HIGH),
    ],
    "self_harm": [
        (r"suicide", "self_harm", SeverityLevel.HIGH),
        (r"self[-\s]harm", "self_harm", SeverityLevel.HIGH),
        (r"kill\s*(myself|yourself|himself|herself)", "self_harm", SeverityLevel.HIGH),
    ],
    "discrimination": [
        (r"(you|they)\s*(people|folks)", "implied_discrimination", SeverityLevel.LOW),
        (r"all\s*(must|should|need\s*to)", "sweeping_generalization", SeverityLevel.LOW),
    ],
}

# Spam patterns
SPAM_PATTERNS = {
    "spam": [
        # Urgency spam: free/winner/click here + now/immediately/limited
        (r"free", "urgency_spam_free", SeverityLevel.MEDIUM),
        (r"winner", "urgency_spam_winner", SeverityLevel.MEDIUM),
        (r"(click\s*here|clickhere)", "urgency_spam_click", SeverityLevel.MEDIUM),
        (r"buynow|buy-now|buy\s*now", "direct_sales_spam", SeverityLevel.MEDIUM),
        (r"ordernow|order\s*now", "direct_sales_spam", SeverityLevel.MEDIUM),
        (r"https?://bit\.ly", "link_squatting", SeverityLevel.LOW),
        (r"(100%|guaranteed|miracle)", "false_claims", SeverityLevel.LOW),
        (r"limited\s*time", "urgency_spam_limited", SeverityLevel.MEDIUM),
    ],
    "misleading": [
        (r"(fact:\s*|fake|hoax|scam)\b", "misinformation", SeverityLevel.MEDIUM),
        (r"(you\s+won|won't\s+believe|need\s+to\s+see)", "clickbait", SeverityLevel.LOW),
    ],
}

# Policy violation categories
POLICY_PATTERNS = {
    "profanity": [
        # Mild profanity patterns (cENSORED versions)
        (r"\b[s*][h*][i*][t*]\b", "mild_profanity", SeverityLevel.LOW),
        (r"\b[s*][h*][i*][t*]\b", "mild_profanity", SeverityLevel.LOW),
        # Real profanity patterns (medium severity)
        (r"\b(shit|fuck|bitch|ass|damn)\b", "profanity", SeverityLevel.MEDIUM),
    ],
    "suspicious": [
        (r"\b(invest|earn|money)\s+(fast|quickly|overnight)\b", "financial_scheme", SeverityLevel.MEDIUM),
        (r"\b(pills|medication|diet\s+pills)\b.*\b(buy|order|sale)\b", "regulated_product", SeverityLevel.HIGH),
    ],
}


class ContentModerator:
    """
    Content moderation for social media generation.

    Checks for:
    - PII (emails, phone numbers, names, etc.)
    - Harmful content (hate speech, violence, self-harm)
    - Spam patterns
    - Policy violations
    - Profanity

    Actions based on severity:
    - Low: Include warning in response
    - Medium: Replace flagged content with placeholder
    - High: Reject content and return error
    """

    def __init__(self, user_id: str, auto_censor: bool = True):
        self.user_id = user_id
        self.auto_censor = auto_censor
        self._pii_types_found: list[str] = []

    def moderate(
        self,
        text: str,
        content_type: str = "post",  # "post", "thread", "hashtags"
    ) -> ModerationResult:
        """
        Run content moderation on text.

        Args:
            text: The content to moderate
            content_type: Type of content (affects some checks)

        Returns:
            ModerationResult with flags and action taken
        """
        if not text:
            return ModerationResult(passed=True)

        flags: list[ModerationFlag] = []
        all_text = text.lower()

        # 1. PII Detection
        pii_flags = self._check_pii(text)
        flags.extend(pii_flags)

        # 2. Harmful content check
        harmful_flags = self._check_harmful_content(text)
        flags.extend(harmful_flags)

        # 3. Spam detection
        spam_flags = self._check_spam(text)
        flags.extend(spam_flags)

        # 4. Policy violations
        policy_flags = self._check_policy_violations(text)
        flags.extend(policy_flags)

        # 5. Determine overall pass/fail and actions
        high_severity = [f for f in flags if f.severity == SeverityLevel.HIGH]
        medium_severity = [f for f in flags if f.severity == SeverityLevel.MEDIUM]

        passed = len(high_severity) == 0

        if not passed:
            return ModerationResult(
                passed=False,
                flags=flags,
                pii_detected=len(pii_flags) > 0,
                pii_types=list(set(f.type for f in pii_flags)),
                action_taken="rejected",
                error_message=f"Content rejected due to {len(high_severity)} high-severity violation(s)",
            )

        # Content passed but may need actions for medium/low
        action_taken = None
        sanitized = text

        if medium_severity and self.auto_censor:
            sanitized, action_taken = self._auto_censor(text, medium_severity)

        return ModerationResult(
            passed=True,
            flags=flags,
            pii_detected=len(pii_flags) > 0,
            pii_types=list(set(f.type for f in pii_flags)),
            action_taken=action_taken,
            sanitized_content=sanitized if action_taken else None,
        )

    def _check_pii(self, text: str) -> list[ModerationFlag]:
        """Check for PII in text."""
        flags = []
        self._pii_types_found = []

        try:
            entities = pii_engine.detect(text, threshold=0.6)

            for entity in entities:
                pii_type = entity["entity_type"]
                self._pii_types_found.append(pii_type)

                # Determine severity based on PII type
                if pii_type in ["SSN", "CREDIT_CARD", "PASSPORT", "DRIVER_LICENSE"]:
                    severity = SeverityLevel.HIGH
                elif pii_type in ["PERSON", "EMAIL", "PHONE"]:
                    severity = SeverityLevel.MEDIUM
                else:
                    severity = SeverityLevel.LOW

                flags.append(ModerationFlag(
                    category="pii",
                    type=pii_type,
                    severity=severity,
                    message=f"Detected {pii_type}: {entity['text']}",
                    location=f"chars {entity['start']}-{entity['end']}",
                    original_text=entity["text"],
                ))

        except Exception as e:
            logger.error(f"PII detection failed: {e}")

        return flags

    def _check_harmful_content(self, text: str) -> list[ModerationFlag]:
        """Check for hate speech, violence, and self-harm."""
        flags = []
        text_lower = text.lower()

        for category, patterns in HARMFUL_PATTERNS.items():
            for pattern, flag_type, severity in patterns:
                matches = list(re.finditer(pattern, text_lower, re.IGNORECASE))
                for match in matches:
                    # Get original text (preserve case)
                    original_start = match.start()
                    original_end = match.end()
                    original_text = text[original_start:original_end]

                    flags.append(ModerationFlag(
                        category="harmful",
                        type=flag_type,
                        severity=severity,
                        message=f"Detected {flag_type.replace('_', ' ')} in content",
                        location=f"chars {original_start}-{original_end}",
                        original_text=original_text,
                    ))

        return flags

    def _check_spam(self, text: str) -> list[ModerationFlag]:
        """Check for spam patterns."""
        flags = []
        text_lower = text.lower()

        for category, patterns in SPAM_PATTERNS.items():
            for pattern, flag_type, severity in patterns:
                matches = list(re.finditer(pattern, text_lower, re.IGNORECASE))
                for match in matches:
                    original_start = match.start()
                    original_end = match.end()
                    original_text = text[original_start:original_end]

                    flags.append(ModerationFlag(
                        category="spam",
                        type=flag_type,
                        severity=severity,
                        message=f"Detected {flag_type.replace('_', ' ')} pattern",
                        location=f"chars {original_start}-{original_end}",
                        original_text=original_text,
                    ))

        return flags

    def _check_policy_violations(self, text: str) -> list[ModerationFlag]:
        """Check for policy violations (profanity, etc.)."""
        flags = []
        text_lower = text.lower()

        for category, patterns in POLICY_PATTERNS.items():
            for pattern, flag_type, severity in patterns:
                matches = list(re.finditer(pattern, text_lower, re.IGNORECASE))
                for match in matches:
                    original_start = match.start()
                    original_end = match.end()
                    original_text = text[original_start:original_end]

                    flags.append(ModerationFlag(
                        category="policy",
                        type=flag_type,
                        severity=severity,
                        message=f"Detected {flag_type.replace('_', ' ')}",
                        location=f"chars {original_start}-{original_end}",
                        original_text=original_text,
                    ))

        return flags

    def _auto_censor(
        self,
        text: str,
        medium_flags: list[ModerationFlag],
    ) -> tuple[str, str]:
        """Replace flagged content with placeholders."""
        sanitized = text

        # Sort by location in reverse order to avoid offset issues
        sorted_flags = sorted(medium_flags, key=lambda f: f.location or "0-0", reverse=True)

        placeholder = "[...]"

        for flag in sorted_flags:
            if flag.location and flag.original_text:
                try:
                    # Parse location "chars X-Y"
                    parts = flag.location.replace("chars ", "").split("-")
                    start, end = int(parts[0]), int(parts[1])
                    sanitized = sanitized[:start] + placeholder + sanitized[end:]
                except (ValueError, IndexError):
                    # Fallback: replace the original text
                    sanitized = sanitized.replace(
                        flag.original_text,
                        placeholder,
                        1  # Only replace first occurrence
                    )

        return sanitized, "censored"

    def moderate_thread(self, tweets: list[dict]) -> tuple[list[dict], ModerationResult]:
        """
        Moderate a thread (list of tweets).

        Returns:
            Tuple of (moderated_tweets, overall_result)
        """
        if not tweets:
            return tweets, ModerationResult(passed=True)

        all_flags: list[ModerationFlag] = []
        pii_detected = False
        pii_types: set[str] = set()
        any_rejected = False

        moderated_tweets = []
        for tweet in tweets:
            text = tweet.get("text", "")
            # Run synchronous moderation
            result = self.moderate(text, content_type="thread")

            all_flags.extend(result.flags)
            if result.pii_detected:
                pii_detected = True
                pii_types.update(result.pii_types)

            if not result.passed:
                any_rejected = True

            # Use sanitized content if available
            tweet_copy = tweet.copy()
            if result.sanitized_content:
                tweet_copy["text"] = result.sanitized_content
            tweet_copy["moderation"] = {
                "passed": result.passed,
                "flags": [
                    {
                        "category": f.category,
                        "type": f.type,
                        "severity": f.severity.value,
                        "message": f.message,
                    }
                    for f in result.flags
                ],
            }
            moderated_tweets.append(tweet_copy)

        # Overall result
        if any_rejected:
            overall_result = ModerationResult(
                passed=False,
                flags=all_flags,
                pii_detected=pii_detected,
                pii_types=list(pii_types),
                action_taken="rejected",
                error_message="One or more tweets in thread failed moderation",
            )
        else:
            action_taken = "censored" if any(f.severity == SeverityLevel.MEDIUM for f in all_flags) else None
            overall_result = ModerationResult(
                passed=True,
                flags=all_flags,
                pii_detected=pii_detected,
                pii_types=list(pii_types),
                action_taken=action_taken,
            )

        return moderated_tweets, overall_result

    def moderate_hashtags(self, hashtags: list[str]) -> tuple[list[str], ModerationResult]:
        """
        Moderate a list of hashtags.

        Returns:
            Tuple of (moderated_hashtags, result)
        """
        if not hashtags:
            return hashtags, ModerationResult(passed=True)

        all_flags: list[ModerationFlag] = []
        moderated: list[str] = []
        any_rejected = False

        for tag in hashtags:
            text = tag.lower()

            # Check for spam in hashtags
            spam_flags = self._check_spam(text)
            all_flags.extend(spam_flags)

            # Check for PII
            pii_flags = self._check_pii(text)
            all_flags.extend(pii_flags)

            # Check for policy violations
            policy_flags = self._check_policy_violations(text)
            all_flags.extend(policy_flags)

            # Check for harmful content
            harmful_flags = self._check_harmful_content(text)
            all_flags.extend(harmful_flags)

            # Reject hashtags with HIGH severity flags
            high_flags = [f for f in spam_flags + pii_flags + policy_flags + harmful_flags if f.severity == SeverityLevel.HIGH]

            if high_flags:
                any_rejected = True
                # Don't include rejected hashtags
                continue

            moderated.append(tag)

        if any_rejected:
            result = ModerationResult(
                passed=False,
                flags=all_flags,
                pii_detected=any(f.category == "pii" for f in all_flags),
                pii_types=list(set(f.type for f in all_flags if f.category == "pii")),
                action_taken="rejected",
                error_message="One or more hashtags failed moderation",
            )
        else:
            result = ModerationResult(
                passed=True,
                flags=all_flags,
                pii_detected=any(f.category == "pii" for f in all_flags),
                pii_types=list(set(f.type for f in all_flags if f.category == "pii")),
            )

        return moderated, result


def get_content_moderator(user_id: str, auto_censor: bool = True) -> ContentModerator:
    """Get a content moderator instance for a user."""
    return ContentModerator(user_id=user_id, auto_censor=auto_censor)