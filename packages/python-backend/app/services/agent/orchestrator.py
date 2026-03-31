import re
from dataclasses import dataclass


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


class AgentOrchestrator:
    """Detects when a sub-agent should be spawned based on message analysis."""

    def should_spawn_sub_agent(
        self,
        message: str,
        context: list[dict],
    ) -> SpawnDecision:
        message_lower = message.lower()
        word_count = len(message.split())

        # Check for multi-step indicators
        multi_step_score = self._score_keywords(message_lower, MULTI_STEP_INDICATORS)
        if multi_step_score >= 2:
            return SpawnDecision(
                should_spawn=True,
                task_type="multi-step",
                sub_agent_task=self._generate_task(message, "multi-step"),
                confidence=min(0.95, 0.7 + multi_step_score * 0.1),
            )

        # Check for research keywords
        research_score = self._score_keywords(message_lower, RESEARCH_KEYWORDS)
        if research_score >= 1 and word_count >= 6:
            return SpawnDecision(
                should_spawn=True,
                task_type="research",
                sub_agent_task=self._generate_task(message, "research"),
                confidence=min(0.95, 0.6 + research_score * 0.15),
            )

        # Check for analysis keywords
        analysis_score = self._score_keywords(message_lower, ANALYSIS_KEYWORDS)
        if analysis_score >= 1 and word_count >= 6:
            return SpawnDecision(
                should_spawn=True,
                task_type="analysis",
                sub_agent_task=self._generate_task(message, "analysis"),
                confidence=min(0.95, 0.6 + analysis_score * 0.15),
            )

        # Check for complex task phrases
        complex_score = self._score_keywords(message_lower, COMPLEX_TASK_PHRASES)
        if complex_score >= 1 and word_count >= 8:
            return SpawnDecision(
                should_spawn=True,
                task_type="complex",
                sub_agent_task=self._generate_task(message, "complex"),
                confidence=min(0.9, 0.5 + complex_score * 0.15),
            )

        # Short messages or simple questions don't need sub-agents
        if word_count < 5:
            return SpawnDecision(
                should_spawn=False,
                task_type=None,
                sub_agent_task=None,
                confidence=0.1,
            )

        # Ambiguous case
        return SpawnDecision(
            should_spawn=False,
            task_type=None,
            sub_agent_task=None,
            confidence=0.3,
        )

    def _score_keywords(self, message: str, keywords: list[str]) -> int:
        score = 0
        for keyword in keywords:
            if keyword in message:
                score += 1
        return score

    def _generate_task(self, message: str, task_type: str) -> str:
        """Generate a focused sub-agent task from the user's message."""
        # Prefix with task type for context
        prefix_map = {
            "research": "Research and investigate",
            "analysis": "Analyze and evaluate",
            "multi-step": "Complete the following multi-step task",
            "complex": "Complete the following task",
        }
        prefix = prefix_map.get(task_type, "Complete")

        # Clean up the message for the sub-agent
        task = message.strip()
        # Remove leading phrases that won't make sense in sub-agent context
        for phrase in ["please", "can you", "could you", "i want you to", "i need you to"]:
            task = re.sub(rf"^{phrase}\s+", "", task, flags=re.IGNORECASE)

        return f"{prefix}: {task}"
