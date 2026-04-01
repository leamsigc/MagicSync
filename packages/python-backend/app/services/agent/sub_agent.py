import uuid
import json
import re
import logging
from dataclasses import dataclass, field
from enum import Enum
from app.services.llm import llm_service

logger = logging.getLogger(__name__)


class SubAgentStatus(str, Enum):
    CREATED = "created"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class SubAgent:
    id: str
    task: str
    parent_message_id: str
    user_id: str
    status: SubAgentStatus = SubAgentStatus.CREATED
    messages: list[dict] = field(default_factory=list)
    result: str | None = None
    error: str | None = None
    max_steps: int = 10
    step_count: int = 0


class SubAgentService:
    """Manages sub-agent lifecycle, isolated context, and step execution."""

    def __init__(self):
        self._agents: dict[str, SubAgent] = {}

    def spawn(
        self,
        task: str,
        parent_message_id: str,
        user_id: str,
        context: list[dict] | None = None,
        max_steps: int = 10,
    ) -> SubAgent:
        agent_id = f"agent-{uuid.uuid4().hex[:12]}"
        agent = SubAgent(
            id=agent_id,
            task=task,
            parent_message_id=parent_message_id,
            user_id=user_id,
            messages=context[:] if context else [],
            max_steps=max_steps,
        )
        self._agents[agent_id] = agent
        return agent

    def get_agent(self, agent_id: str) -> SubAgent | None:
        return self._agents.get(agent_id)

    def list_agents(
        self,
        user_id: str,
        parent_message_id: str | None = None,
    ) -> list[SubAgent]:
        agents = [a for a in self._agents.values() if a.user_id == user_id]
        if parent_message_id:
            agents = [a for a in agents if a.parent_message_id == parent_message_id]
        return agents

    def delete_agent(self, agent_id: str) -> bool:
        if agent_id in self._agents:
            del self._agents[agent_id]
            return True
        return False

    def start_agent(self, agent_id: str) -> None:
        agent = self.get_agent(agent_id)
        if agent is None:
            raise ValueError(f"Agent {agent_id} not found")
        if agent.status not in (SubAgentStatus.CREATED,):
            raise ValueError(f"Cannot start agent in status {agent.status}")
        agent.status = SubAgentStatus.RUNNING

    def complete_agent(self, agent_id: str, result: str) -> None:
        agent = self.get_agent(agent_id)
        if agent is None:
            raise ValueError(f"Agent {agent_id} not found")
        agent.status = SubAgentStatus.COMPLETED
        agent.result = result

    def fail_agent(self, agent_id: str, error: str) -> None:
        agent = self.get_agent(agent_id)
        if agent is None:
            raise ValueError(f"Agent {agent_id} not found")
        agent.status = SubAgentStatus.FAILED
        agent.error = error

    def add_message(self, agent_id: str, role: str, content: str) -> None:
        agent = self.get_agent(agent_id)
        if agent is None:
            raise ValueError(f"Agent {agent_id} not found")
        agent.messages.append({"role": role, "content": content})

    def add_tool_result(self, agent_id: str, tool_name: str, result: str) -> None:
        agent = self.get_agent(agent_id)
        if agent is None:
            raise ValueError(f"Agent {agent_id} not found")
        agent.messages.append({
            "role": "tool",
            "content": result,
            "name": tool_name,
        })

    def get_llm_messages(self, agent_id: str) -> list[dict]:
        agent = self.get_agent(agent_id)
        if agent is None:
            raise ValueError(f"Agent {agent_id} not found")
        return list(agent.messages)

    async def step(self, agent_id: str) -> dict:
        """Execute one LLM step for a sub-agent.

        Returns:
            dict with keys: content, done, tool_call, step_count, error
        """
        agent = self.get_agent(agent_id)
        if agent is None:
            raise ValueError(f"Agent {agent_id} not found")

        # Auto-start if created
        if agent.status == SubAgentStatus.CREATED:
            self.start_agent(agent_id)

        if agent.status != SubAgentStatus.RUNNING:
            raise ValueError(f"Cannot step agent in status {agent.status}")

        # Check max steps
        if agent.step_count >= agent.max_steps:
            self.complete_agent(agent_id, result=agent.messages[-1].get("content", "Max steps reached.") if agent.messages else "Max steps reached.")
            return {
                "content": agent.result,
                "done": True,
                "tool_call": None,
                "step_count": agent.step_count,
                "error": None,
            }

        try:
            messages = self.get_llm_messages(agent_id)
            response = await llm_service.chat_complete(messages=messages)
            content = response.get("message", {}).get("content", "")
            agent.step_count += 1

            # Add assistant response to context
            self.add_message(agent_id, "assistant", content)

            # Check for completion signal
            if "[DONE]" in content:
                self.complete_agent(agent_id, result=content)
                return {
                    "content": content,
                    "done": True,
                    "tool_call": None,
                    "step_count": agent.step_count,
                    "error": None,
                }

            # Check for tool use
            tool_call = self._parse_tool_call(content)
            if tool_call:
                return {
                    "content": content,
                    "done": False,
                    "tool_call": tool_call,
                    "step_count": agent.step_count,
                    "error": None,
                }

            return {
                "content": content,
                "done": False,
                "tool_call": None,
                "step_count": agent.step_count,
                "error": None,
            }

        except Exception as e:
            logger.error(f"Sub-agent step failed for {agent_id}: {e}")
            self.fail_agent(agent_id, error=str(e))
            return {
                "content": None,
                "done": False,
                "tool_call": None,
                "step_count": agent.step_count,
                "error": str(e),
            }

    def _parse_tool_call(self, content: str) -> dict | None:
        """Parse tool call from LLM response.

        Expected format: [TOOL:tool-name] {"key": "value"}
        """
        match = re.search(r"\[TOOL:([\w-]+)\]\s*(\{.*\})", content, re.DOTALL)
        if match:
            tool_name = match.group(1)
            try:
                tool_input = json.loads(match.group(2))
                return {"tool": tool_name, "input": tool_input}
            except json.JSONDecodeError:
                return {"tool": tool_name, "input": {"raw": match.group(2)}}
        return None


sub_agent_service = SubAgentService()
