import pytest
from unittest.mock import AsyncMock, patch


class TestAgentSpawnEndpoint:
    """Test POST /agent/spawn endpoint."""

    def test_spawn_sub_agent(self, client, api_prefix, test_headers):
        response = client.post(
            f"{api_prefix}/agent/spawn",
            json={
                "task": "Research Instagram marketing strategies",
                "parent_message_id": "msg-123",
            },
            headers=test_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] is not None
        assert data["task"] == "Research Instagram marketing strategies"
        assert data["status"] == "created"
        assert data["parent_message_id"] == "msg-123"

    def test_spawn_with_context(self, client, api_prefix, test_headers):
        response = client.post(
            f"{api_prefix}/agent/spawn",
            json={
                "task": "Analyze document",
                "parent_message_id": "msg-456",
                "context": [
                    {"role": "system", "content": "You are an analyst."},
                ],
            },
            headers=test_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] is not None

    def test_spawn_with_custom_max_steps(self, client, api_prefix, test_headers):
        response = client.post(
            f"{api_prefix}/agent/spawn",
            json={
                "task": "Quick task",
                "parent_message_id": "msg-789",
                "max_steps": 5,
            },
            headers=test_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["max_steps"] == 5

    def test_spawn_rejects_empty_task(self, client, api_prefix, test_headers):
        response = client.post(
            f"{api_prefix}/agent/spawn",
            json={
                "task": "",
                "parent_message_id": "msg-123",
            },
            headers=test_headers,
        )
        assert response.status_code in (400, 422)

    def test_spawn_requires_auth(self, client, api_prefix, test_headers):
        # Test without JWT token
        response = client.post(
            f"{api_prefix}/agent/spawn",
            json={
                "task": "Test",
                "parent_message_id": "msg-123",
            },
        )
        assert response.status_code == 401


class TestAgentStatusEndpoint:
    """Test GET /agent/:id/status endpoint."""

    def test_get_agent_status(self, client, api_prefix, test_headers):
        # First spawn an agent
        spawn_response = client.post(
            f"{api_prefix}/agent/spawn",
            json={
                "task": "Test task",
                "parent_message_id": "msg-123",
            },
            headers=test_headers,
        )
        agent_id = spawn_response.json()["id"]

        # Get status
        response = client.get(
            f"{api_prefix}/agent/{agent_id}/status",
            headers=test_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == agent_id
        assert data["status"] == "created"
        assert data["step_count"] == 0

    def test_get_nonexistent_agent_status(self, client, api_prefix, test_headers):
        response = client.get(
            f"{api_prefix}/agent/nonexistent/status",
            headers=test_headers,
        )
        assert response.status_code == 404


class TestAgentStepEndpoint:
    """Test POST /agent/:id/step endpoint."""

    def test_execute_agent_step(self, client, api_prefix, test_headers):
        # Spawn agent
        spawn_response = client.post(
            f"{api_prefix}/agent/spawn",
            json={
                "task": "Test",
                "parent_message_id": "msg-123",
            },
            headers=test_headers,
        )
        agent_id = spawn_response.json()["id"]

        # Add a user message
        client.post(
            f"{api_prefix}/agent/{agent_id}/message",
            json={"role": "user", "content": "What are best posting times?"},
            headers=test_headers,
        )

        # Execute step
        mock_response = {
            "message": {
                "role": "assistant",
                "content": "Best times are 9am and 5pm.",
            }
        }

        with patch(
            "app.services.agent.sub_agent.llm_service.chat_complete",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            response = client.post(
                f"{api_prefix}/agent/{agent_id}/step",
                headers=test_headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["content"] == "Best times are 9am and 5pm."
            assert data["step_count"] == 1

    def test_step_on_nonexistent_agent(self, client, api_prefix, test_headers):
        response = client.post(
            f"{api_prefix}/agent/nonexistent/step",
            headers=test_headers,
        )
        assert response.status_code == 404

    def test_step_detects_tool_call(self, client, api_prefix, test_headers):
        spawn_response = client.post(
            f"{api_prefix}/agent/spawn",
            json={
                "task": "Research",
                "parent_message_id": "msg-123",
            },
            headers=test_headers,
        )
        agent_id = spawn_response.json()["id"]

        client.post(
            f"{api_prefix}/agent/{agent_id}/message",
            json={"role": "user", "content": "Search for trends."},
            headers=test_headers,
        )

        mock_response = {
            "message": {
                "role": "assistant",
                "content": '[TOOL:web-search] {"query": "social media trends 2026"}',
            }
        }

        with patch(
            "app.services.agent.sub_agent.llm_service.chat_complete",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            response = client.post(
                f"{api_prefix}/agent/{agent_id}/step",
                headers=test_headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["tool_call"] is not None
            assert data["tool_call"]["tool"] == "web-search"


class TestAgentMessageEndpoint:
    """Test POST /agent/:id/message endpoint."""

    def test_add_message_to_agent(self, client, api_prefix, test_headers):
        spawn_response = client.post(
            f"{api_prefix}/agent/spawn",
            json={
                "task": "Test",
                "parent_message_id": "msg-123",
            },
            headers=test_headers,
        )
        agent_id = spawn_response.json()["id"]

        response = client.post(
            f"{api_prefix}/agent/{agent_id}/message",
            json={"role": "user", "content": "Hello agent"},
            headers=test_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message_count"] == 1

    def test_add_tool_result_to_agent(self, client, api_prefix, test_headers):
        spawn_response = client.post(
            f"{api_prefix}/agent/spawn",
            json={
                "task": "Test",
                "parent_message_id": "msg-123",
            },
            headers=test_headers,
        )
        agent_id = spawn_response.json()["id"]

        response = client.post(
            f"{api_prefix}/agent/{agent_id}/message",
            json={"role": "tool", "content": "Search results here", "tool_name": "web-search"},
            headers=test_headers,
        )
        assert response.status_code == 200


class TestAgentStreamEndpoint:
    """Test GET /agent/:id/stream SSE endpoint."""

    def test_stream_agent_execution(self, client, api_prefix, test_headers):
        spawn_response = client.post(
            f"{api_prefix}/agent/spawn",
            json={
                "task": "Quick analysis",
                "parent_message_id": "msg-123",
                "max_steps": 1,
            },
            headers=test_headers,
        )
        agent_id = spawn_response.json()["id"]

        client.post(
            f"{api_prefix}/agent/{agent_id}/message",
            json={"role": "user", "content": "Analyze this."},
            headers=test_headers,
        )

        mock_response = {
            "message": {
                "role": "assistant",
                "content": "[DONE] Analysis complete.",
            }
        }

        with patch(
            "app.services.agent.sub_agent.llm_service.chat_complete",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            response = client.get(
                f"{api_prefix}/agent/{agent_id}/stream",
                headers=test_headers,
            )
            assert response.status_code == 200
            assert "text/event-stream" in response.headers.get("content-type", "")


class TestAgentListEndpoint:
    """Test GET /agent endpoint for listing agents."""

    def test_list_user_agents(self, client, api_prefix, test_headers):
        # Spawn two agents
        client.post(
            f"{api_prefix}/agent/spawn",
            json={"task": "Task 1", "parent_message_id": "msg-1"},
            headers=test_headers,
        )
        client.post(
            f"{api_prefix}/agent/spawn",
            json={"task": "Task 2", "parent_message_id": "msg-2"},
            headers=test_headers,
        )

        response = client.get(
            f"{api_prefix}/agent",
            headers=test_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["agents"]) >= 2

    def test_list_agents_filter_by_parent(self, client, api_prefix, test_headers):
        client.post(
            f"{api_prefix}/agent/spawn",
            json={"task": "Task 1", "parent_message_id": "msg-parent"},
            headers=test_headers,
        )

        response = client.get(
            f"{api_prefix}/agent?parent_message_id=msg-parent",
            headers=test_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert all(a["parent_message_id"] == "msg-parent" for a in data["agents"])


class TestAgentDeleteEndpoint:
    """Test DELETE /agent/:id endpoint."""

    def test_delete_agent(self, client, api_prefix, test_headers):
        spawn_response = client.post(
            f"{api_prefix}/agent/spawn",
            json={"task": "To delete", "parent_message_id": "msg-1"},
            headers=test_headers,
        )
        agent_id = spawn_response.json()["id"]

        response = client.delete(
            f"{api_prefix}/agent/{agent_id}",
            headers=test_headers,
        )
        assert response.status_code == 200

        # Verify deleted
        get_response = client.get(
            f"{api_prefix}/agent/{agent_id}/status",
            headers=test_headers,
        )
        assert get_response.status_code == 404

    def test_delete_nonexistent_agent(self, client, api_prefix, test_headers):
        response = client.delete(
            f"{api_prefix}/agent/nonexistent",
            headers=test_headers,
        )
        assert response.status_code == 404
