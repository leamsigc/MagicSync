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
                "run_id": run_id
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


@router.get("/harness/{run_id}")
async def get_harness_status(
    run_id: str,
    user: UserContext = Depends(require_user),
):
    """Get status of a harness run."""
    return {
        "run_id": run_id,
        "status": "completed",
        "message": "Harness status endpoint"
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
