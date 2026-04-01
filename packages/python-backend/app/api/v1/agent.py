import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from app.schemas.agent import (
    AgentSpawnRequest, AgentSpawnResponse,
    AgentStatusResponse, AgentStepResponse,
    AgentMessageRequest, AgentMessageResponse,
    AgentListResponse, AgentListItem,
    SpawnDecisionResponse,
)
from app.services.agent import sub_agent_service
from app.services.agent.orchestrator import AgentOrchestrator
from app.core.security import require_user, UserContext

logger = logging.getLogger(__name__)

router = APIRouter()
orchestrator = AgentOrchestrator()


@router.post("/spawn", response_model=AgentSpawnResponse)
async def spawn_agent(
    request: AgentSpawnRequest,
    user: UserContext = Depends(require_user),
):
    """Spawn a new sub-agent with isolated context."""
    agent = sub_agent_service.spawn(
        task=request.task,
        parent_message_id=request.parent_message_id,
        user_id=user.user_id,
        context=request.context,
        max_steps=request.max_steps,
    )
    return AgentSpawnResponse(
        id=agent.id,
        task=agent.task,
        status=agent.status.value,
        parent_message_id=agent.parent_message_id,
        max_steps=agent.max_steps,
        step_count=agent.step_count,
    )


@router.get("", response_model=AgentListResponse)
async def list_agents(
    parent_message_id: str | None = Query(None),
    user: UserContext = Depends(require_user),
):
    """List all sub-agents for the current user."""
    agents = sub_agent_service.list_agents(
        user_id=user.user_id,
        parent_message_id=parent_message_id,
    )
    return AgentListResponse(
        agents=[
            AgentListItem(
                id=a.id,
                task=a.task,
                status=a.status.value,
                parent_message_id=a.parent_message_id,
                step_count=a.step_count,
            )
            for a in agents
        ]
    )


@router.get("/{agent_id}/status", response_model=AgentStatusResponse)
async def get_agent_status(
    agent_id: str,
    user: UserContext = Depends(require_user),
):
    """Get the current status of a sub-agent."""
    agent = sub_agent_service.get_agent(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return AgentStatusResponse(
        id=agent.id,
        task=agent.task,
        status=agent.status.value,
        parent_message_id=agent.parent_message_id,
        step_count=agent.step_count,
        max_steps=agent.max_steps,
        result=agent.result,
        error=agent.error,
        message_count=len(agent.messages),
    )


@router.post("/{agent_id}/step", response_model=AgentStepResponse)
async def execute_step(
    agent_id: str,
    user: UserContext = Depends(require_user),
):
    """Execute one step of a sub-agent."""
    agent = sub_agent_service.get_agent(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await sub_agent_service.step(agent_id)
    return AgentStepResponse(**result)


@router.post("/{agent_id}/message", response_model=AgentMessageResponse)
async def add_message(
    agent_id: str,
    request: AgentMessageRequest,
    user: UserContext = Depends(require_user),
):
    """Add a message to a sub-agent's isolated context."""
    agent = sub_agent_service.get_agent(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if request.role == "tool" and request.tool_name:
        sub_agent_service.add_tool_result(agent_id, request.tool_name, request.content)
    else:
        sub_agent_service.add_message(agent_id, request.role, request.content)

    updated = sub_agent_service.get_agent(agent_id)
    return AgentMessageResponse(message_count=len(updated.messages))


@router.get("/{agent_id}/stream")
async def stream_agent(
    agent_id: str,
    user: UserContext = Depends(require_user),
):
    """Stream sub-agent execution via SSE."""
    agent = sub_agent_service.get_agent(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    async def generate():
        while True:
            current_agent = sub_agent_service.get_agent(agent_id)
            if current_agent is None:
                yield f"data: {json.dumps({'error': 'Agent not found'})}\n\n"
                break

            if current_agent.status.value in ("completed", "failed"):
                yield f"data: {json.dumps({'status': current_agent.status.value, 'result': current_agent.result, 'error': current_agent.error, 'done': True})}\n\n"
                break

            # Execute one step
            result = await sub_agent_service.step(agent_id)
            yield f"data: {json.dumps(result)}\n\n"

            if result.get("done") or result.get("error"):
                break

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.delete("/{agent_id}")
async def delete_agent(
    agent_id: str,
    user: UserContext = Depends(require_user),
):
    """Delete a sub-agent and its context."""
    agent = sub_agent_service.get_agent(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    sub_agent_service.delete_agent(agent_id)
    return {"deleted": True}


@router.post("/detect", response_model=SpawnDecisionResponse)
async def detect_sub_agent_need(
    body: dict,
    user: UserContext = Depends(require_user),
):
    """Analyze a message to determine if a sub-agent should be spawned."""
    message = body.get("message", "")
    context = body.get("context", [])

    if not message.strip():
        raise HTTPException(status_code=400, detail="Message is required")

    decision = orchestrator.should_spawn_sub_agent(message=message, context=context)
    return SpawnDecisionResponse(
        should_spawn=decision.should_spawn,
        task_type=decision.task_type,
        sub_agent_task=decision.sub_agent_task,
        confidence=decision.confidence,
    )
