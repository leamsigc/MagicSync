import json
import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


class VideoAnalysisError(Exception):
    pass


class VideoAnalysisService:

    async def analyze_transcription(
        self,
        transcription: str,
        topic_hint: str | None = None,
    ) -> dict[str, Any]:
        prompt = self._build_prompt(transcription, topic_hint)
        try:
            from litellm import completion

            response = completion(
                model=settings.ollama_default_model or "qwen3.5",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                api_base=settings.ollama_base_url if not settings.ollama_default_model.startswith("gpt") else None,
            )

            text = response.choices[0].message.content
            if not text:
                raise VideoAnalysisError("Empty response from LLM")

            parsed = json.loads(text)
            return parsed

        except json.JSONDecodeError as e:
            raise VideoAnalysisError(f"Failed to parse LLM response: {e}") from e
        except Exception as e:
            raise VideoAnalysisError(f"Analysis failed: {e}") from e

    def _build_prompt(self, transcription: str, topic_hint: str | None) -> str:
        return f"""Analyze this video transcription and extract the following as JSON:

1. **hook_type**: What type of hook is used? (e.g., "negative", "curiosity gap", "contrarian", "listicle", "storytelling", "question", "statistic", "problem-agitate-solution", "pattern-interrupt", "other")
2. **hook_text**: The exact hook sentence or phrase
3. **structure**: Break down the video's structure into sections with timestamps
4. **pattern**: What content pattern does this follow? (e.g., "problem-solution", "storytelling arc", "educational", "behind-the-scenes", "tutorial", "comparison", "review", "listicle", "Q&A")
5. **retention_triggers**: Key moments designed to keep viewers watching
6. **cta_type**: What type of call-to-action is used?
7. **replicable_template**: A template with [PLACEHOLDERS] that can be reused to recreate similar videos

Topic hint: {topic_hint or "Not specified"}

Transcription:
{transcription}

Return ONLY valid JSON with these fields:
- hook_type (string)
- hook_text (string)
- estimated_hook_duration_seconds (number)
- structure (array of {section: string, content_summary: string} objects)
- pattern (string)
- retention_triggers (array of strings)
- cta_type (string)
- target_audience (string)
- replicable_template (string with [PLACEHOLDERS])
"""