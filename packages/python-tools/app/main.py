"""MagicSync Python tools service (FastAPI).

Run:
    uvicorn app.main:app --host 0.0.0.0 --port 8100

Then set the URL (and optional token) in MagicSync -> AI settings -> Tool
backends. The Nuxt agent exposes `python_tools_list` / `python_tool_run` and
calls this service server-to-server.
"""

from __future__ import annotations

import os
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .tools import TOOL_HANDLERS, TOOLS, ToolUnavailable

app = FastAPI(title="MagicSync Python Tools", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

TOKEN = os.environ.get("PYTHON_TOOLS_TOKEN", "").strip()


def require_token(authorization: str | None = Header(default=None)) -> None:
    if not TOKEN:
        return
    if authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "magicsync-python-tools",
        "tools": len(TOOLS),
        "auth": bool(TOKEN),
    }


@app.get("/tools", dependencies=[Depends(require_token)])
async def list_tools() -> dict[str, Any]:
    return {"tools": TOOLS}


class RunRequest(BaseModel):
    args: dict[str, Any] = Field(default_factory=dict)


@app.post("/tools/{name}/run", dependencies=[Depends(require_token)])
async def run_tool(name: str, body: RunRequest) -> dict[str, Any]:
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        raise HTTPException(status_code=404, detail=f"Unknown tool: {name}")
    try:
        result = await handler(body.args)
    except ToolUnavailable as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface tool failures to the caller
        raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}") from exc
    return {"tool": name, "result": result}
