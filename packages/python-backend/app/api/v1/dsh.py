import logging

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.services.dsh.capability import CapabilityError, verify_capability
from app.services.tools.manager import ToolManager

logger = logging.getLogger(__name__)

router = APIRouter()


class BridgeExecuteRequest(BaseModel):
    tool: str
    args: dict = {}
    user_id: str = "dsh"
    business_id: str | None = None
    run_id: str | None = None
    capability: str | None = None


def is_bridge_configured() -> bool:
    """The bridge is disabled until an explicit secret is configured."""
    return bool(settings.dsh_bridge_secret)


async def verify_bridge_secret(x_bridge_secret: str = Header(default="")) -> None:
    if not is_bridge_configured():
        raise HTTPException(status_code=503, detail="Tool bridge is not configured")
    if x_bridge_secret != settings.dsh_bridge_secret:
        raise HTTPException(status_code=401, detail="Invalid bridge secret")


@router.get("/tools", dependencies=[Depends(verify_bridge_secret)])
async def bridge_list_tools():
    """Tool catalog for the dsh MagicSync plugin bundle."""
    manager = ToolManager("dsh")
    return {"tools": manager.get_tool_definitions()}


@router.post("/tools/execute", dependencies=[Depends(verify_bridge_secret)])
async def bridge_execute_tool(request: BridgeExecuteRequest):
    """Execute one ToolManager tool on behalf of a dsh agent turn.

    Capability path (preferred): a signed scope verified against the
    request business/run/tool. Legacy path: bridge secret only, executed
    as the unprivileged ``dsh`` identity — caller-supplied ``user_id`` is
    never trusted as authority.
    """
    actor = "dsh"
    if request.capability:
        if not request.business_id or not request.run_id:
            raise HTTPException(status_code=400, detail="Capability calls require business_id and run_id")
        try:
            claims = verify_capability(
                request.capability,
                secret=settings.dsh_bridge_secret,
                business_id=request.business_id,
                run_id=request.run_id,
                tool=request.tool,
            )
        except CapabilityError as exc:
            raise HTTPException(status_code=403, detail=f"Capability rejected ({exc.code})")
        actor = str(claims.get("sub") or "dsh")
    manager = ToolManager(actor)
    try:
        result = await manager.execute_tool(request.tool, request.args or {})
        return {"result": result}
    except Exception as exc:
        logger.error(f"Bridge tool error {request.tool}: {exc}")
        return {"result": {"error": str(exc)}}
