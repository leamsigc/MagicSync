import uuid
import json
import re
import logging
import time
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
    created_at: int = field(default_factory=lambda: int(time.time()))
    updated_at: int = field(default_factory=lambda: int(time.time()))


class SubAgentService:
    """Manages sub-agent lifecycle, isolated context, and step execution with SQLite persistence."""

    def __init__(self):
        self._agents: dict[str, SubAgent] = {}
        # Load agents from database on initialization
        self._initialized = False

    async def _ensure_initialized(self):
        """Ensure database table exists and agents are loaded."""
        if self._initialized:
            return
        from app.core.db import ensure_sub_agents_table
        await ensure_sub_agents_table()
        self._initialized = True

    async def save_agent(self, agent: SubAgent) -> None:
        """Persist agent state to database."""
        await self._ensure_initialized()
        from app.core.db import get_db_pool

        pool = await get_db_pool()
        conn = pool.acquire()
        async with conn:
            now = int(time.time())
            await conn.execute(
                """INSERT OR REPLACE INTO sub_agents
                   (agent_id, task, parent_message_id, user_id, status, messages, result, error, max_steps, step_count, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    agent.id,
                    agent.task,
                    agent.parent_message_id,
                    agent.user_id,
                    agent.status.value,
                    json.dumps(agent.messages),
                    agent.result,
                    agent.error,
                    agent.max_steps,
                    agent.step_count,
                    agent.created_at,
                    now,
                ),
            )

    async def load_agents(self, user_id: str | None = None) -> dict[str, SubAgent]:
        """Load agents from database. If user_id provided, filter by user."""
        await self._ensure_initialized()
        from app.core.db import get_db_pool

        pool = await get_db_pool()
        conn = pool.acquire()
        async with conn:
            if user_id:
                result = await conn.execute(
                    """SELECT agent_id, task, parent_message_id, user_id, status, messages, result, error, max_steps, step_count, created_at, updated_at
                       FROM sub_agents WHERE user_id = ?""",
                    (user_id,),
                )
            else:
                result = await conn.execute(
                    """SELECT agent_id, task, parent_message_id, user_id, status, messages, result, error, max_steps, step_count, created_at, updated_at
                       FROM sub_agents""",
                )

            rows = result.fetchall()
            agents = {}
            for row in rows:
                # Handle both tuple and dict-like access
                if hasattr(row, 'keys'):
                    data = dict(row)
                else:
                    data = {
                        'agent_id': row[0],
                        'task': row[1],
                        'parent_message_id': row[2],
                        'user_id': row[3],
                        'status': row[4],
                        'messages': row[5],
                        'result': row[6],
                        'error': row[7],
                        'max_steps': row[8],
                        'step_count': row[9],
                        'created_at': row[10],
                        'updated_at': row[11],
                    }

                agent = SubAgent(
                    id=data['agent_id'],
                    task=data['task'],
                    parent_message_id=data['parent_message_id'],
                    user_id=data['user_id'],
                    status=SubAgentStatus(data['status']),
                    messages=json.loads(data['messages']),
                    result=data['result'],
                    error=data['error'],
                    max_steps=int(data['max_steps']),
                    step_count=int(data['step_count']),
                    created_at=int(data['created_at']),
                    updated_at=int(data['updated_at']),
                )
                agents[agent.id] = agent

            self._agents.update(agents)
            return agents

    async def spawn(
        self,
        task: str,
        parent_message_id: str,
        user_id: str,
        context: list[dict] | None = None,
        max_steps: int = 10,
    ) -> SubAgent:
        # Load existing agents for this user first
        await self.load_agents(user_id)

        agent_id = f"agent-{uuid.uuid4().hex[:12]}"
        now = int(time.time())
        agent = SubAgent(
            id=agent_id,
            task=task,
            parent_message_id=parent_message_id,
            user_id=user_id,
            messages=context[:] if context else [],
            max_steps=max_steps,
            created_at=now,
            updated_at=now,
        )
        self._agents[agent_id] = agent
        # Persist to database
        await self.save_agent(agent)
        return agent

    def get_agent(self, agent_id: str) -> SubAgent | None:
        return self._agents.get(agent_id)

    async def list_agents(
        self,
        user_id: str,
        parent_message_id: str | None = None,
    ) -> list[SubAgent]:
        # Load agents from DB for this user
        await self.load_agents(user_id)
        agents = [a for a in self._agents.values() if a.user_id == user_id]
        if parent_message_id:
            agents = [a for a in agents if a.parent_message_id == parent_message_id]
        return agents

    async def delete_agent(self, agent_id: str) -> bool:
        if agent_id in self._agents:
            del self._agents[agent_id]
            # Remove from database
            from app.core.db import get_db_pool
            pool = await get_db_pool()
            conn = pool.acquire()
            async with conn:
                await conn.execute("DELETE FROM sub_agents WHERE agent_id = ?", (agent_id,))
            return True
        return False

    async def start_agent(self, agent_id: str) -> None:
        agent = self.get_agent(agent_id)
        if agent is None:
            raise ValueError(f"Agent {agent_id} not found")
        if agent.status not in (SubAgentStatus.CREATED,):
            raise ValueError(f"Cannot start agent in status {agent.status}")
        agent.status = SubAgentStatus.RUNNING
        agent.updated_at = int(time.time())
        await self.save_agent(agent)

    async def complete_agent(self, agent_id: str, result: str) -> None:
        agent = self.get_agent(agent_id)
        if agent is None:
            raise ValueError(f"Agent {agent_id} not found")
        agent.status = SubAgentStatus.COMPLETED
        agent.result = result
        agent.updated_at = int(time.time())
        await self.save_agent(agent)

    async def fail_agent(self, agent_id: str, error: str) -> None:
        agent = self.get_agent(agent_id)
        if agent is None:
            raise ValueError(f"Agent {agent_id} not found")
        agent.status = SubAgentStatus.FAILED
        agent.error = error
        agent.updated_at = int(time.time())
        await self.save_agent(agent)

    async def add_message(self, agent_id: str, role: str, content: str) -> None:
        agent = self.get_agent(agent_id)
        if agent is None:
            raise ValueError(f"Agent {agent_id} not found")
        agent.messages.append({"role": role, "content": content})
        agent.updated_at = int(time.time())
        await self.save_agent(agent)

    async def add_tool_result(self, agent_id: str, tool_name: str, result: str) -> None:
        agent = self.get_agent(agent_id)
        if agent is None:
            raise ValueError(f"Agent {agent_id} not found")
        agent.messages.append({
            "role": "tool",
            "content": result,
            "name": tool_name,
        })
        agent.updated_at = int(time.time())
        await self.save_agent(agent)

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
            await self.start_agent(agent_id)

        if agent.status != SubAgentStatus.RUNNING:
            raise ValueError(f"Cannot step agent in status {agent.status}")

        # Check max steps
        if agent.step_count >= agent.max_steps:
            await self.complete_agent(agent_id, result=agent.messages[-1].get("content", "Max steps reached.") if agent.messages else "Max steps reached.")
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
            await self.add_message(agent_id, "assistant", content)

            # Check for completion signal
            if "[DONE]" in content:
                await self.complete_agent(agent_id, result=content)
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
            await self.fail_agent(agent_id, error=str(e))
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
