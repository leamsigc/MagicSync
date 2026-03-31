from pydantic import BaseModel, Field
from typing import Literal


class AgentSpawnRequest(BaseModel):
    task: str = Field(..., min_length=1, max_length=2000)
    parent_message_id: str
    context: list[dict] | None = None
    max_steps: int = Field(default=10, ge=1, le=50)


class AgentSpawnResponse(BaseModel):
    id: str
    task: str
    status: str
    parent_message_id: str
    max_steps: int
    step_count: int = 0


class AgentStatusResponse(BaseModel):
    id: str
    task: str
    status: str
    parent_message_id: str
    step_count: int
    max_steps: int
    result: str | None = None
    error: str | None = None
    message_count: int


class AgentStepResponse(BaseModel):
    content: str | None
    done: bool = False
    tool_call: dict | None = None
    step_count: int
    error: str | None = None


class AgentMessageRequest(BaseModel):
    role: Literal["user", "assistant", "system", "tool"]
    content: str
    tool_name: str | None = None


class AgentMessageResponse(BaseModel):
    message_count: int


class AgentListItem(BaseModel):
    id: str
    task: str
    status: str
    parent_message_id: str
    step_count: int
    created_at: str | None = None


class AgentListResponse(BaseModel):
    agents: list[AgentListItem]


class SpawnDecisionResponse(BaseModel):
    should_spawn: bool
    task_type: str | None = None
    sub_agent_task: str | None = None
    confidence: float
