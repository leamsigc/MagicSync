"""MagicSync Python tools service (FastAPI).

Run:
    uvicorn app.main:app --host 127.0.0.1 --port 8100

Then set the URL (and token) in MagicSync -> AI settings -> Tool backends. The
Nuxt agent exposes `python_tools_list` / `python_tool_run` and calls this
service server-to-server.

Security posture:
  * `PYTHON_TOOLS_TOKEN` is REQUIRED — the service refuses to start without it,
    so it can never run unauthenticated behind a compose network.
  * No CORS by default. This is a server-to-server service; a browser has no
    reason to call it.
  * Every outbound fetch is checked against private/loopback/link-local ranges.
"""

from __future__ import annotations

import hmac
import os
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .tools import TOOL_HANDLERS, TOOLS, ToolUnavailable

TOKEN = os.environ.get("PYTHON_TOOLS_TOKEN", "").strip()
if not TOKEN:
    raise RuntimeError(
        "PYTHON_TOOLS_TOKEN is required. Refusing to start an unauthenticated "
        "tool service — generate one with `openssl rand -hex 32` and set it in .env."
    )

app = FastAPI(title="MagicSync Python Tools", version="0.1.0")

_allowed_origins = [o.strip() for o in os.environ.get("PYTHON_TOOLS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
if _allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )


def require_token(authorization: str | None = Header(default=None)) -> None:
    """Constant-time bearer check. Always enforced."""
    expected = f"Bearer {TOKEN}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
async def health() -> dict[str, Any]:
    # Deliberately minimal: unauthenticated callers learn nothing about tools.
    return {"status": "ok"}


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
