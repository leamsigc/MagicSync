import pytest
from unittest.mock import AsyncMock, patch
from app.services.agent.sub_agent import SubAgentService, SubAgentStatus


class TestSubAgentLifecycle:
    """Test sub-agent creation, status transitions, and cleanup."""

    def test_spawn_creates_agent_with_isolated_context(self):
        service = SubAgentService()
        agent = service.spawn(
            task="Research the best posting times for Instagram",
            parent_message_id="msg-123",
            user_id="user-1",
        )
        assert agent.id is not None
        assert agent.task == "Research the best posting times for Instagram"
        assert agent.parent_message_id == "msg-123"
        assert agent.user_id == "user-1"
        assert agent.status == SubAgentStatus.CREATED
        assert agent.messages == []  # Isolated context starts empty

    def test_spawn_with_initial_context(self):
        service = SubAgentService()
        context = [
            {"role": "system", "content": "You are a social media expert."},
            {"role": "user", "content": "Research Instagram best practices."},
        ]
        agent = service.spawn(
            task="Research Instagram",
            parent_message_id="msg-123",
            user_id="user-1",
            context=context,
        )
        assert len(agent.messages) == 2
        assert agent.messages[0]["role"] == "system"

    def test_spawn_generates_unique_ids(self):
        service = SubAgentService()
        agent1 = service.spawn(task="Task 1", parent_message_id="msg-1", user_id="user-1")
        agent2 = service.spawn(task="Task 2", parent_message_id="msg-1", user_id="user-1")
        assert agent1.id != agent2.id

    def test_get_agent_by_id(self):
        service = SubAgentService()
        agent = service.spawn(task="Test", parent_message_id="msg-1", user_id="user-1")
        retrieved = service.get_agent(agent.id)
        assert retrieved is not None
        assert retrieved.id == agent.id

    def test_get_agent_returns_none_for_unknown_id(self):
        service = SubAgentService()
        assert service.get_agent("nonexistent") is None

    def test_list_agents_for_user(self):
        service = SubAgentService()
        service.spawn(task="Task 1", parent_message_id="msg-1", user_id="user-1")
        service.spawn(task="Task 2", parent_message_id="msg-2", user_id="user-1")
        service.spawn(task="Task 3", parent_message_id="msg-3", user_id="user-2")
        agents = service.list_agents(user_id="user-1")
        assert len(agents) == 2

    def test_list_agents_filters_by_parent_message(self):
        service = SubAgentService()
        service.spawn(task="Task 1", parent_message_id="msg-1", user_id="user-1")
        service.spawn(task="Task 2", parent_message_id="msg-2", user_id="user-1")
        agents = service.list_agents(user_id="user-1", parent_message_id="msg-1")
        assert len(agents) == 1

    def test_delete_agent(self):
        service = SubAgentService()
        agent = service.spawn(task="Test", parent_message_id="msg-1", user_id="user-1")
        assert service.get_agent(agent.id) is not None
        service.delete_agent(agent.id)
        assert service.get_agent(agent.id) is None


class TestSubAgentStatusTransitions:
    """Test sub-agent status transitions during execution."""

    def test_start_transitions_to_running(self):
        service = SubAgentService()
        agent = service.spawn(task="Test", parent_message_id="msg-1", user_id="user-1")
        service.start_agent(agent.id)
        updated = service.get_agent(agent.id)
        assert updated.status == SubAgentStatus.RUNNING

    def test_complete_transitions_to_completed(self):
        service = SubAgentService()
        agent = service.spawn(task="Test", parent_message_id="msg-1", user_id="user-1")
        service.start_agent(agent.id)
        service.complete_agent(agent.id, result="Done")
        updated = service.get_agent(agent.id)
        assert updated.status == SubAgentStatus.COMPLETED
        assert updated.result == "Done"

    def test_fail_transitions_to_failed(self):
        service = SubAgentService()
        agent = service.spawn(task="Test", parent_message_id="msg-1", user_id="user-1")
        service.start_agent(agent.id)
        service.fail_agent(agent.id, error="Something went wrong")
        updated = service.get_agent(agent.id)
        assert updated.status == SubAgentStatus.FAILED
        assert updated.error == "Something went wrong"

    def test_cannot_start_completed_agent(self):
        service = SubAgentService()
        agent = service.spawn(task="Test", parent_message_id="msg-1", user_id="user-1")
        service.start_agent(agent.id)
        service.complete_agent(agent.id, result="Done")
        with pytest.raises(ValueError, match="Cannot start agent"):
            service.start_agent(agent.id)


class TestSubAgentContextIsolation:
    """Test that sub-agents maintain isolated message contexts."""

    def test_add_message_to_agent_context(self):
        service = SubAgentService()
        agent = service.spawn(task="Test", parent_message_id="msg-1", user_id="user-1")
        service.add_message(agent.id, "user", "Hello sub-agent")
        updated = service.get_agent(agent.id)
        assert len(updated.messages) == 1
        assert updated.messages[0]["content"] == "Hello sub-agent"

    def test_agent_context_does_not_leak(self):
        service = SubAgentService()
        agent1 = service.spawn(task="Task 1", parent_message_id="msg-1", user_id="user-1")
        agent2 = service.spawn(task="Task 2", parent_message_id="msg-2", user_id="user-1")
        service.add_message(agent1.id, "user", "Secret info for agent 1")
        updated2 = service.get_agent(agent2.id)
        assert len(updated2.messages) == 0

    def test_agent_context_accumulates_messages(self):
        service = SubAgentService()
        agent = service.spawn(task="Test", parent_message_id="msg-1", user_id="user-1")
        service.add_message(agent.id, "user", "First message")
        service.add_message(agent.id, "assistant", "Response 1")
        service.add_message(agent.id, "user", "Follow-up")
        updated = service.get_agent(agent.id)
        assert len(updated.messages) == 3

    def test_get_isolated_messages_for_llm(self):
        """Messages returned for LLM should include system prompt + context."""
        service = SubAgentService()
        agent = service.spawn(
            task="Analyze post performance",
            parent_message_id="msg-1",
            user_id="user-1",
            context=[{"role": "system", "content": "You are a data analyst."}],
        )
        service.add_message(agent.id, "user", "Show me metrics")
        messages = service.get_llm_messages(agent.id)
        assert messages[0]["role"] == "system"
        assert messages[1]["content"] == "Show me metrics"
        assert len(messages) == 2


class TestSubAgentStepExecution:
    """Test single-step execution of sub-agents."""

    @pytest.mark.asyncio
    async def test_step_executes_llm_and_updates_context(self):
        service = SubAgentService()
        agent = service.spawn(task="Test", parent_message_id="msg-1", user_id="user-1")
        service.add_message(agent.id, "user", "What are best posting times?")

        mock_response = {
            "message": {
                "role": "assistant",
                "content": "Best posting times are 9am and 5pm.",
            }
        }

        with patch(
            "app.services.agent.sub_agent.ollama_service.chat_complete",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await service.step(agent.id)
            assert result["content"] == "Best posting times are 9am and 5pm."
            updated = service.get_agent(agent.id)
            assert len(updated.messages) == 2  # user + assistant
            assert updated.status == SubAgentStatus.RUNNING

    @pytest.mark.asyncio
    async def test_step_handles_llm_error(self):
        service = SubAgentService()
        agent = service.spawn(task="Test", parent_message_id="msg-1", user_id="user-1")
        service.add_message(agent.id, "user", "Test")

        with patch(
            "app.services.agent.sub_agent.ollama_service.chat_complete",
            new_callable=AsyncMock,
            side_effect=Exception("LLM unavailable"),
        ):
            result = await service.step(agent.id)
            assert result["error"] is not None
            updated = service.get_agent(agent.id)
            assert updated.status == SubAgentStatus.FAILED

    @pytest.mark.asyncio
    async def test_step_detects_completion_signal(self):
        """When the LLM signals task completion, agent should transition."""
        service = SubAgentService()
        agent = service.spawn(task="Test", parent_message_id="msg-1", user_id="user-1")
        service.add_message(agent.id, "user", "Summarize this.")

        mock_response = {
            "message": {
                "role": "assistant",
                "content": "[DONE] Summary complete.",
            }
        }

        with patch(
            "app.services.agent.sub_agent.ollama_service.chat_complete",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await service.step(agent.id)
            assert result["done"] is True
            updated = service.get_agent(agent.id)
            assert updated.status == SubAgentStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_step_detects_tool_use(self):
        """When the LLM wants to use a tool, step should return tool call."""
        service = SubAgentService()
        agent = service.spawn(task="Test", parent_message_id="msg-1", user_id="user-1")
        service.add_message(agent.id, "user", "Search for posting times.")

        mock_response = {
            "message": {
                "role": "assistant",
                "content": '[TOOL:web-search] {"query": "best social media posting times 2026"}',
            }
        }

        with patch(
            "app.services.agent.sub_agent.ollama_service.chat_complete",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await service.step(agent.id)
            assert result["tool_call"] is not None
            assert result["tool_call"]["tool"] == "web-search"
            assert "posting times" in result["tool_call"]["input"]["query"]

    @pytest.mark.asyncio
    async def test_step_with_tool_result(self):
        """After tool execution, result should be fed back into context."""
        service = SubAgentService()
        agent = service.spawn(task="Test", parent_message_id="msg-1", user_id="user-1")
        service.add_message(agent.id, "user", "Search for best times.")

        # First step: LLM wants to use tool
        tool_response = {
            "message": {
                "role": "assistant",
                "content": '[TOOL:web-search] {"query": "best posting times"}',
            }
        }

        with patch(
            "app.services.agent.sub_agent.ollama_service.chat_complete",
            new_callable=AsyncMock,
            return_value=tool_response,
        ):
            await service.step(agent.id)

        # Feed tool result back
        tool_result = "Studies show 9am and 7pm are optimal."
        service.add_tool_result(agent.id, "web-search", tool_result)

        updated = service.get_agent(agent.id)
        assert len(updated.messages) == 3  # user + assistant(tool call) + tool result
        assert updated.messages[2]["role"] == "tool"
        assert "9am" in updated.messages[2]["content"]


class TestSubAgentOrchestrator:
    """Test the orchestrator that detects when sub-agents are needed."""

    def test_detects_complex_task_needs_sub_agent(self):
        from app.services.agent.orchestrator import AgentOrchestrator
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="Research the top 10 social media trends and create a detailed report with recommendations for each platform.",
            context=[],
        )
        assert decision.should_spawn is True
        assert decision.task_type == "research"

    def test_simple_question_no_sub_agent(self):
        from app.services.agent.orchestrator import AgentOrchestrator
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="What's the weather like?",
            context=[],
        )
        assert decision.should_spawn is False

    def test_multi_step_request_needs_sub_agent(self):
        from app.services.agent.orchestrator import AgentOrchestrator
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="First analyze my post performance, then compare with industry benchmarks, and finally suggest improvements.",
            context=[],
        )
        assert decision.should_spawn is True
        assert decision.task_type == "multi-step"

    def test_research_keywords_trigger_sub_agent(self):
        from app.services.agent.orchestrator import AgentOrchestrator
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="Research competitor strategies for Instagram marketing and identify the top performing content types.",
            context=[],
        )
        assert decision.should_spawn is True
        assert decision.task_type == "research"

    def test_orchestrator_generates_sub_agent_task(self):
        from app.services.agent.orchestrator import AgentOrchestrator
        orchestrator = AgentOrchestrator()
        decision = orchestrator.should_spawn_sub_agent(
            message="Research best times to post on Instagram and create a schedule.",
            context=[],
        )
        assert decision.sub_agent_task is not None
        assert "Instagram" in decision.sub_agent_task


class TestSubAgentMaxSteps:
    """Test that sub-agents have a maximum step limit to prevent infinite loops."""

    def test_max_steps_default(self):
        service = SubAgentService()
        agent = service.spawn(task="Test", parent_message_id="msg-1", user_id="user-1")
        assert agent.max_steps == 10

    def test_custom_max_steps(self):
        service = SubAgentService()
        agent = service.spawn(
            task="Test", parent_message_id="msg-1", user_id="user-1", max_steps=5,
        )
        assert agent.max_steps == 5

    @pytest.mark.asyncio
    async def test_step_increments_counter(self):
        service = SubAgentService()
        agent = service.spawn(task="Test", parent_message_id="msg-1", user_id="user-1", max_steps=2)
        service.add_message(agent.id, "user", "Test")

        mock_response = {"message": {"role": "assistant", "content": "Step result"}}

        with patch(
            "app.services.agent.sub_agent.ollama_service.chat_complete",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            await service.step(agent.id)
            updated = service.get_agent(agent.id)
            assert updated.step_count == 1

            await service.step(agent.id)
            updated = service.get_agent(agent.id)
            assert updated.step_count == 2

    @pytest.mark.asyncio
    async def test_exceeding_max_steps_completes_agent(self):
        service = SubAgentService()
        agent = service.spawn(task="Test", parent_message_id="msg-1", user_id="user-1", max_steps=1)
        service.add_message(agent.id, "user", "Test")

        mock_response = {"message": {"role": "assistant", "content": "Result"}}

        with patch(
            "app.services.agent.sub_agent.ollama_service.chat_complete",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            await service.step(agent.id)  # step 1
            result = await service.step(agent.id)  # should auto-complete
            assert result["done"] is True
            updated = service.get_agent(agent.id)
            assert updated.status == SubAgentStatus.COMPLETED
