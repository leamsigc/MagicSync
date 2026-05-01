import logging
import re
from dataclasses import dataclass
from typing import Literal

from app.services.llm import llm_service
from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class SpawnDecision:
    should_spawn: bool
    task_type: str | None
    sub_agent_task: str | None
    confidence: float


RESEARCH_KEYWORDS = [
    "research", "investigate", "explore", "find out", "look into",
    "study", "examine", "survey", "discover",
]

ANALYSIS_KEYWORDS = [
    "analyze", "analyse", "compare", "evaluate", "assess",
    "review", "audit", "examine", "benchmark",
]

MULTI_STEP_INDICATORS = [
    "first", "then", "finally", "step 1", "step 2", "step 3",
    "and then", "after that", "next,", "lastly",
]

COMPLEX_TASK_PHRASES = [
    "create a report", "write a detailed", "summarize the",
    "generate a comprehensive", "build a strategy", "develop a plan",
    "create a content calendar", "draft a proposal",
]

# LLM config for decision-making
LLM_DECISION_MODEL = "qwen3:0.5b"
LLM_DECISION_PROVIDER = "ollama"
LLM_DECISION_TEMPERATURE = 0.1
LLM_DECISION_MAX_TOKENS = 256

# Confidence thresholds for LLM escalation
LOW_CONFIDENCE_THRESHOLD = 0.3
HIGH_CONFIDENCE_THRESHOLD = 0.7

# Prompt template for LLM decision-making
LLM_DECISION_PROMPT = """You are a task complexity analyzer. Given a user message, determine if spawning a sub-agent would help.

User Message: {message}

Analyze the message for these indicators:
- Does this task require research/investigation? (gathering info, finding sources, digging into topics)
- Is this a multi-step task? (multiple distinct actions or stages)
- Does this need analysis/evaluation? (breaking down, comparing, judging quality)
- Would a sub-agent help complete this faster? (background work, parallel processing, deep focus)

Respond with ONLY a JSON object (no markdown, no explanation):
{{
    "should_spawn": true or false,
    "task_type": "research" or "analysis" or "multi-step" or "complex" or null,
    "confidence": 0.0 to 1.0,
    "reasoning": "brief explanation of why"
}}

Be conservative with should_spawn=true. Only spawn when sub-agent would clearly help."""


class AgentOrchestrator:
    """Detects when a sub-agent should be spawned based on message analysis.

    Uses a two-tier approach:
    1. Fast keyword-based detection for obvious cases (high/low confidence)
    2. LLM-powered analysis for ambiguous cases (0.3-0.7 confidence range)
    """

    def __init__(self):
        self._llm_available = True  # Can be disabled for testing

    def should_spawn_sub_agent(
        self,
        message: str,
        context: list[dict],
    ) -> SpawnDecision:
        """Synchronous entry point - dispatches to async if needed."""
        import asyncio
        try:
            loop = asyncio.get_running_loop()
            # If we're already in an async context, create a task
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(
                    asyncio.run, self._should_spawn_async(message, context)
                )
                return future.result()
        except RuntimeError:
            # No running loop, safe to run directly
            return asyncio.run(self._should_spawn_async(message, context))

    async def should_spawn_sub_agent_async(
        self,
        message: str,
        context: list[dict],
    ) -> SpawnDecision:
        """Async entry point for use in async contexts."""
        return await self._should_spawn_async(message, context)

    async def _should_spawn_async(
        self,
        message: str,
        context: list[dict],
    ) -> SpawnDecision:
        """Internal async implementation with two-tier detection."""
        message_lower = message.lower()
        word_count = len(message.split())

        # Fast path: Check for obvious multi-step indicators
        multi_step_score = self._score_keywords(message_lower, MULTI_STEP_INDICATORS)
        if multi_step_score >= 2:
            return SpawnDecision(
                should_spawn=True,
                task_type="multi-step",
                sub_agent_task=self._generate_task(message, "multi-step"),
                confidence=min(0.95, 0.7 + multi_step_score * 0.1),
            )

        # Fast path: Check for research keywords
        research_score = self._score_keywords(message_lower, RESEARCH_KEYWORDS)
        if research_score >= 1 and word_count >= 6:
            return SpawnDecision(
                should_spawn=True,
                task_type="research",
                sub_agent_task=self._generate_task(message, "research"),
                confidence=min(0.95, 0.6 + research_score * 0.15),
            )

        # Fast path: Check for analysis keywords
        analysis_score = self._score_keywords(message_lower, ANALYSIS_KEYWORDS)
        if analysis_score >= 1 and word_count >= 6:
            return SpawnDecision(
                should_spawn=True,
                task_type="analysis",
                sub_agent_task=self._generate_task(message, "analysis"),
                confidence=min(0.95, 0.6 + analysis_score * 0.15),
            )

        # Fast path: Check for complex task phrases
        complex_score = self._score_keywords(message_lower, COMPLEX_TASK_PHRASES)
        if complex_score >= 1 and word_count >= 8:
            return SpawnDecision(
                should_spawn=True,
                task_type="complex",
                sub_agent_task=self._generate_task(message, "complex"),
                confidence=min(0.9, 0.5 + complex_score * 0.15),
            )

        # Fast path: Short messages or simple questions don't need sub-agents
        if word_count < 5:
            return SpawnDecision(
                should_spawn=False,
                task_type=None,
                sub_agent_task=None,
                confidence=0.1,
            )

        # Ambiguous case: Use LLM to make decision
        if self._llm_available:
            return await self._llm_decision(message, context)

        # LLM disabled (testing/fallback): return conservative decision
        return SpawnDecision(
            should_spawn=False,
            task_type=None,
            sub_agent_task=None,
            confidence=0.3,
        )

    async def _llm_decision(
        self,
        message: str,
        context: list[dict],
    ) -> SpawnDecision:
        """Use LLM to decide whether to spawn a sub-agent for ambiguous cases."""
        try:
            prompt = LLM_DECISION_PROMPT.format(message=message)
            messages = [{"role": "user", "content": prompt}]

            response = await llm_service.chat_complete(
                messages=messages,
                model=LLM_DECISION_MODEL,
                provider=LLM_DECISION_PROVIDER,
                temperature=LLM_DECISION_TEMPERATURE,
                max_tokens=LLM_DECISION_MAX_TOKENS,
                api_base=settings.ollama_base_url,
            )

            content = response["message"]["content"].strip()

            # Parse JSON response
            decision = self._parse_llm_response(content)

            if decision:
                # Enhance the task if spawning
                if decision.should_spawn:
                    task_type = decision.task_type or "task"
                    decision.sub_agent_task = self._generate_task(message, task_type)
                return decision

        except Exception as e:
            logger.warning(f"LLM decision failed, falling back: {e}")

        # Fallback: conservative decision
        return SpawnDecision(
            should_spawn=False,
            task_type=None,
            sub_agent_task=None,
            confidence=0.3,
        )

    def _parse_llm_response(self, content: str) -> SpawnDecision | None:
        """Parse LLM JSON response into SpawnDecision."""
        try:
            import json

            # Try to extract JSON from response (handle potential extra text)
            json_start = content.find("{")
            json_end = content.rfind("}") + 1

            if json_start == -1 or json_end == 0:
                logger.warning(f"No JSON found in LLM response: {content}")
                return None

            json_str = content[json_start:json_end]
            data = json.loads(json_str)

            should_spawn = bool(data.get("should_spawn", False))
            task_type = data.get("task_type")
            confidence = float(data.get("confidence", 0.5))

            # Validate confidence is in expected range
            confidence = max(0.0, min(1.0, confidence))

            return SpawnDecision(
                should_spawn=should_spawn,
                task_type=task_type,
                sub_agent_task=None,  # Will be set by caller
                confidence=confidence,
            )

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.warning(f"Failed to parse LLM response: {e}, content: {content}")
            return None

    def _score_keywords(self, message: str, keywords: list[str]) -> int:
        """Score message based on keyword matches."""
        score = 0
        for keyword in keywords:
            if keyword in message:
                score += 1
        return score

    def _generate_task(self, message: str, task_type: str) -> str:
        """Generate a focused sub-agent task from the user's message."""
        # Prefix with task type for context
        prefix_map: dict[str, str] = {
            "research": "Research and investigate",
            "analysis": "Analyze and evaluate",
            "multi-step": "Complete the following multi-step task",
            "complex": "Complete the following task",
            "task": "Complete the following task",
        }
        prefix = prefix_map.get(task_type, "Complete")

        # Clean up the message for the sub-agent
        task = message.strip()
        # Remove leading phrases that won't make sense in sub-agent context
        for phrase in ["please", "can you", "could you", "i want you to", "i need you to"]:
            task = re.sub(rf"^{phrase}\s+", "", task, flags=re.IGNORECASE)

        return f"{prefix}: {task}"

    def disable_llm(self) -> None:
        """Disable LLM decision-making (for testing/fallback scenarios)."""
        self._llm_available = False

    def enable_llm(self) -> None:
        """Enable LLM decision-making."""
        self._llm_available = True
