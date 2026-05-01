import pytest
from unittest.mock import AsyncMock, patch
from app.services.agent.orchestrator import AgentOrchestrator, SpawnDecision


class TestOrchestratorDetection:
    """Test detection of when a sub-agent should be spawned."""

    def test_research_request_triggers_spawn(self):
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="Research the best social media marketing strategies for 2026",
            context=[],
        )
        assert decision.should_spawn is True
        assert decision.task_type == "research"

    def test_multi_step_request_triggers_spawn(self):
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="First analyze my posts, then compare with competitors, and finally suggest a content calendar.",
            context=[],
        )
        assert decision.should_spawn is True
        assert decision.task_type == "multi-step"

    def test_analysis_request_triggers_spawn(self):
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="Analyze my document and extract all key topics and target audience demographics.",
            context=[],
        )
        assert decision.should_spawn is True
        assert decision.task_type == "analysis"

    def test_simple_chat_no_spawn(self):
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="Hello, how are you?",
            context=[],
        )
        assert decision.should_spawn is False

    def test_simple_question_no_spawn(self):
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="What is the best time to post on Instagram?",
            context=[],
        )
        assert decision.should_spawn is False

    def test_short_message_no_spawn(self):
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="Thanks!",
            context=[],
        )
        assert decision.should_spawn is False


class TestOrchestratorTaskGeneration:
    """Test that the orchestrator generates appropriate sub-agent tasks."""

    def test_research_task_extracts_topic(self):
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="Research competitor Instagram strategies and summarize the top 5 approaches.",
            context=[],
        )
        assert decision.sub_agent_task is not None
        assert "Instagram" in decision.sub_agent_task

    def test_analysis_task_includes_context(self):
        orchestrator = AgentOrchestrator()
        context = [
            {"role": "user", "content": "I uploaded my business plan document."},
            {"role": "assistant", "content": "I can see the document. What would you like to know?"},
        ]
        decision = orchestrator.should_spawn_sub_agent(
            message="Analyze this document and extract the target audience and key messaging.",
            context=context,
        )
        assert decision.sub_agent_task is not None
        assert "document" in decision.sub_agent_task.lower()

    def test_multi_step_task_preserves_steps(self):
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="Research trends, analyze my current performance, and create a strategy.",
            context=[],
        )
        assert decision.sub_agent_task is not None
        # The task should capture the multi-step nature
        assert len(decision.sub_agent_task) > 20


class TestOrchestratorConfidence:
    """Test confidence scoring for spawn decisions."""

    def test_explicit_research_has_high_confidence(self):
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="Please research and analyze the top social media trends.",
            context=[],
        )
        assert decision.confidence > 0.7

    def test_ambiguous_request_has_lower_confidence(self):
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="Tell me about posting.",
            context=[],
        )
        # Could be simple or complex - lower confidence
        assert decision.confidence < 0.5

    def test_explicit_multi_step_has_high_confidence(self):
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="Step 1: Search for trends. Step 2: Analyze my data. Step 3: Write recommendations.",
            context=[],
        )
        assert decision.confidence > 0.8


class TestSpawnDecisionModel:
    """Test the SpawnDecision data model."""

    def test_spawn_decision_fields(self):
        decision = SpawnDecision(
            should_spawn=True,
            task_type="research",
            sub_agent_task="Research Instagram trends",
            confidence=0.9,
        )
        assert decision.should_spawn is True
        assert decision.task_type == "research"
        assert decision.sub_agent_task == "Research Instagram trends"
        assert decision.confidence == 0.9

    def test_no_spawn_decision(self):
        decision = SpawnDecision(
            should_spawn=False,
            task_type=None,
            sub_agent_task=None,
            confidence=0.1,
        )
        assert decision.should_spawn is False
        assert decision.sub_agent_task is None


class TestLLMDecision:
    """Test LLM-powered decision-making for ambiguous cases."""

    @pytest.mark.asyncio
    async def test_llm_decides_complex_task(self):
        """Test that LLM correctly identifies complex tasks."""
        orchestrator = AgentOrchestrator()

        # Mock LLM response for complex task
        mock_response = {
            "message": {
                "content": '{"should_spawn": true, "task_type": "research", "confidence": 0.8}'
            }
        }

        with patch('app.services.agent.orchestrator.llm_service') as mock_llm:
            mock_llm.chat_complete = AsyncMock(return_value=mock_response)
            decision = await orchestrator.should_spawn_sub_agent_async(
                message="Look into the best practices for viral content and summarize key insights",
                context=[],
            )

        assert decision.should_spawn is True
        assert decision.task_type == "research"
        assert decision.confidence >= 0.7

    @pytest.mark.asyncio
    async def test_llm_decides_simple_task(self):
        """Test that LLM correctly identifies simple tasks."""
        orchestrator = AgentOrchestrator()

        # Mock LLM response for simple task
        mock_response = {
            "message": {
                "content": '{"should_spawn": false, "task_type": null, "confidence": 0.3}'
            }
        }

        with patch('app.services.agent.orchestrator.llm_service') as mock_llm:
            mock_llm.chat_complete = AsyncMock(return_value=mock_response)
            decision = await orchestrator.should_spawn_sub_agent_async(
                message="Can you explain what engagement means?",
                context=[],
            )

        assert decision.should_spawn is False
        assert decision.confidence <= 0.5

    @pytest.mark.asyncio
    async def test_llm_fallback_on_error(self):
        """Test that orchestrator falls back gracefully when LLM fails."""
        orchestrator = AgentOrchestrator()

        with patch('app.services.agent.orchestrator.llm_service') as mock_llm:
            mock_llm.chat_complete = AsyncMock(side_effect=Exception("LLM unavailable"))
            decision = await orchestrator.should_spawn_sub_agent_async(
                message="Help me understand this topic in depth",
                context=[],
            )

        # Should fall back to conservative decision
        assert decision.should_spawn is False
        assert decision.confidence == 0.3

    @pytest.mark.asyncio
    async def test_llm_handles_malformed_json(self):
        """Test that orchestrator handles malformed LLM responses."""
        orchestrator = AgentOrchestrator()

        with patch('app.services.agent.orchestrator.llm_service') as mock_llm:
            mock_llm.chat_complete = AsyncMock(return_value={
                "message": {"content": "Here's my analysis: spawn=true"}
            })
            decision = await orchestrator.should_spawn_sub_agent_async(
                message="This is a moderately complex request",
                context=[],
            )

        # Should fall back gracefully
        assert decision.should_spawn is False
        assert decision.confidence == 0.3

    @pytest.mark.asyncio
    async def test_llm_disabled_fallback(self):
        """Test that disabling LLM uses keyword fallback."""
        orchestrator = AgentOrchestrator()
        orchestrator.disable_llm()

        decision = await orchestrator.should_spawn_sub_agent_async(
            message="Some ambiguous message that needs LLM",
            context=[],
        )

        # Should return conservative keyword-based decision
        assert decision.should_spawn is False
        assert decision.confidence == 0.3

        orchestrator.enable_llm()


class TestComplexVsSimpleTasks:
    """Test verification that complex tasks trigger sub-agents while simple questions don't."""

    def test_complex_research_task_spawns(self):
        """Complex research tasks should spawn sub-agents."""
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="I need you to deeply research the competitive landscape for social media scheduling tools. Look at at least 10 competitors and create a detailed analysis report.",
            context=[],
        )
        assert decision.should_spawn is True
        assert decision.confidence > 0.6

    def test_simple_question_no_spawn(self):
        """Simple questions should NOT spawn sub-agents."""
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="What is MagicSync?",
            context=[],
        )
        assert decision.should_spawn is False
        assert decision.confidence < 0.5

    def test_multi_component_task_spawns(self):
        """Tasks with multiple components should spawn sub-agents."""
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="Analyze my last 10 posts, identify patterns in engagement, and suggest improvements.",
            context=[],
        )
        assert decision.should_spawn is True
        assert decision.confidence > 0.6

    def test_greeting_no_spawn(self):
        """Greetings should never spawn sub-agents."""
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="Hey there!",
            context=[],
        )
        assert decision.should_spawn is False
        assert decision.confidence == 0.1


class TestTaskGeneration:
    """Test task generation with various task types."""

    def test_generates_research_task(self):
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="Research the best time to post on social media",
            context=[],
        )
        assert decision.sub_agent_task is not None
        assert "Research and investigate" in decision.sub_agent_task

    def test_generates_analysis_task(self):
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="Analyze my engagement rates across all platforms",
            context=[],
        )
        assert decision.sub_agent_task is not None
        assert "Analyze and evaluate" in decision.sub_agent_task

    def test_removes_leading_please(self):
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="Please research AI tools for content generation",
            context=[],
        )
        assert decision.sub_agent_task is not None
        assert not decision.sub_agent_task.startswith("please")
