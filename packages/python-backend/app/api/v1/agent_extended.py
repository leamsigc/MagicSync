import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.agent.deep_mode import DeepModeAgent, DeepModeConfig
from app.services.harness.engine import harness_engine
from app.core.security import require_user, UserContext

logger = logging.getLogger(__name__)

router = APIRouter()


class ErrorResponse(BaseModel):
    error: str
    code: Optional[str] = None


class DeepModeRequest(BaseModel):
    task: str
    thread_id: str
    max_rounds: Optional[int] = 50


class DeepModeResponse(BaseModel):
    status: str
    rounds: int
    final_state: dict


class HarnessRequest(BaseModel):
    harness_type: str
    input_data: dict
    thread_id: str


class PhaseDefinition(BaseModel):
    name: str
    type: str
    system_prompt: str | None = None
    prompt: str | None = None
    schema: str | None = None


class HarnessPhaseRequest(BaseModel):
    harness_type: str
    phase_index: int
    phase_input: dict
    thread_id: str
    phases: list[PhaseDefinition] | None = None


class HarnessPhaseResponse(BaseModel):
    phase: int
    phase_name: str | None = None
    phase_type: str | None = None
    result: dict


class HarnessResponse(BaseModel):
    run_id: str
    status: str
    results: list


class WorkspaceFileRequest(BaseModel):
    thread_id: str
    filename: str
    content: str


class TodoRequest(BaseModel):
    thread_id: str
    todos: list[dict]


@router.post("/deep-mode/run", response_model=DeepModeResponse)
async def run_deep_mode(
    request: DeepModeRequest,
    user: UserContext = Depends(require_user),
):
    """Run deep mode agent for complex tasks."""
    try:
        config = DeepModeConfig(max_rounds=request.max_rounds)
        agent = DeepModeAgent(
            user_id=user.user_id,
            thread_id=request.thread_id,
            config=config
        )
        
        result = await agent.run(request.task)
        
        return DeepModeResponse(
            status=result.get("status", "unknown"),
            rounds=result.get("rounds", 0),
            final_state=result.get("final_state", {})
        )
    except Exception as e:
        logger.error(f"Deep mode error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/harness/execute", response_model=HarnessResponse)
async def execute_harness(
    request: HarnessRequest,
    user: UserContext = Depends(require_user),
):
    """Execute a harness (e.g., contract review)."""
    try:
        import time
        
        run_id = f"harness-{int(time.time() * 1000)}"
        
        result = await harness_engine.run_harness(
            harness_type=request.harness_type,
            initial_input=request.input_data,
            context={
                "user_id": user.user_id,
                "thread_id": request.thread_id,
                "run_id": run_id,
                "llm": {
                    "provider": user.llm_config.provider,
                    "model": user.llm_config.model,
                    "api_key": user.llm_config.api_key,
                    "api_base": user.llm_config.api_base,
                },
            }
        )
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return HarnessResponse(
            run_id=run_id,
            status=result.get("state", {}).get("status", "unknown"),
            results=result.get("results", [])
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Harness error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/harness/execute-phase", response_model=HarnessPhaseResponse)
async def execute_harness_phase(
    request: HarnessPhaseRequest,
    user: UserContext = Depends(require_user),
):
    """Execute a single harness phase so the UI can show + steer each step."""
    from app.services.dsh.status import record_run

    run_key = f"{request.thread_id or user.user_id}:{request.phase_index}"
    record_run(run_key, "running", {"harness_type": request.harness_type})
    try:
        result = await harness_engine.execute_phase(
            harness_type=request.harness_type,
            phase_index=request.phase_index,
            phase_input=request.phase_input,
            phases=[p.model_dump(exclude_none=True) for p in request.phases] if request.phases else None,
            context={
                "user_id": user.user_id,
                "thread_id": request.thread_id,
                "llm": {
                    "provider": user.llm_config.provider,
                    "model": user.llm_config.model,
                    "api_key": user.llm_config.api_key,
                    "api_base": user.llm_config.api_base,
                },
            },
        )

        if "error" in result:
            record_run(run_key, "failed", {"error": str(result["error"])[:300]})
            raise HTTPException(status_code=400, detail=result["error"])

        record_run(run_key, "completed", {"phase": result.get("phase", request.phase_index)})
        phase_result = result.get("result", {})
        return HarnessPhaseResponse(
            phase=result.get("phase", request.phase_index),
            phase_name=result.get("phase_name"),
            phase_type=str(result.get("phase_type", "")),
            result=phase_result if isinstance(phase_result, dict) else {"result": phase_result},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Harness phase error: {e}")
        try:
            from app.services.dsh.status import record_run as _record

            _record(run_key, "failed", {"error": str(e)[:300]})
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/harness/{run_id}")
async def get_harness_status(
    run_id: str,
    user: UserContext = Depends(require_user),
):
    """Get status of a harness run (truthful: unknown runs are 404)."""
    from app.services.dsh.status import get_run

    record = get_run(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Unknown harness run")
    return {
        "run_id": run_id,
        "status": record.get("status", "unknown"),
        "updated_at": record.get("updated_at"),
        "detail": {k: v for k, v in record.items() if k not in ("run_id", "status", "updated_at")},
    }


@router.post("/workspace/write")
async def write_workspace_file(
    request: WorkspaceFileRequest,
    user: UserContext = Depends(require_user),
):
    """Write a file to workspace."""
    try:
        from app.services.agent.workspace import WorkspaceService
        ws = WorkspaceService(user.user_id)
        
        result = await ws.write_file(
            thread_id=request.thread_id,
            filename=request.filename,
            content=request.content
        )
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Workspace write error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workspace/{thread_id}/files")
async def list_workspace_files(
    thread_id: str,
    user: UserContext = Depends(require_user),
):
    """List all files in workspace."""
    try:
        from app.services.agent.workspace import WorkspaceService
        ws = WorkspaceService(user.user_id)
        
        result = await ws.list_files(thread_id)
        return result
    except Exception as e:
        logger.error(f"Workspace list error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workspace/{thread_id}/files/{filename}")
async def read_workspace_file(
    thread_id: str,
    filename: str,
    user: UserContext = Depends(require_user),
):
    """Read a file from workspace."""
    try:
        from app.services.agent.workspace import WorkspaceService
        ws = WorkspaceService(user.user_id)
        
        result = await ws.read_file(thread_id, filename)
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Workspace read error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/todos/write")
async def write_todos(
    request: TodoRequest,
    user: UserContext = Depends(require_user),
):
    """Write todos for a thread."""
    try:
        from app.services.agent.workspace import TodoService
        ts = TodoService(user.user_id)
        
        result = await ts.write_todos(request.thread_id, request.todos)
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Todos write error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/todos/{thread_id}")
async def read_todos(
    thread_id: str,
    user: UserContext = Depends(require_user),
):
    """Read todos for a thread."""
    try:
        from app.services.agent.workspace import TodoService
        ts = TodoService(user.user_id)
        
        result = await ts.read_todos(thread_id)
        return result
    except Exception as e:
        logger.error(f"Todos read error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
