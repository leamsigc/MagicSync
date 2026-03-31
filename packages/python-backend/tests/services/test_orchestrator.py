import pytest
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
