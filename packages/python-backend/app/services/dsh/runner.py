"""DSH run orchestration with durable control-plane semantics (T30.1 §7, §10, §11).

Nuxt/Turso remains authoritative for run state; this runner normalizes DSH
events, validates node output contracts, enforces limits, and guarantees
workspace/session cleanup on success, failure, cancellation, and timeout.
"""

import asyncio
import logging
import time
from typing import Any

from app.services.dsh.sdk import (
    DSHLaunchConfig,
    DSHUnavailable,
    cleanup_workspace,
    launch_sdk_run,
    prepare_workspace,
)
from app.services.dsh.events import ExecutionEvent, is_terminal, normalize_event
from app.services.dsh.limits import DSHLimits, LimitExceeded, check_output_size

logger = logging.getLogger(__name__)

SUPPORTED_OUTPUT_KINDS = frozenset(
    {
        "research_result",
        "social_post_draft",
        "humanized_social_post",
        "fabric_scene",
        "reel_storyboard",
        "approval_request",
        "publishing_intent",
    }
)


class OutputContractError(ValueError):
    """DSH output failed node contract validation."""


def validate_node_output(output: Any, output_kind: str | None, limits: DSHLimits | None = None) -> dict:
    """Validate DSH node output against its declared contract.

    The model may not silently choose another schema: unknown kinds and
    non-object payloads enter node.failed via this error.
    """
    if not output_kind or output_kind not in SUPPORTED_OUTPUT_KINDS:
        raise OutputContractError(f"Unsupported node output kind: {output_kind!r}")
    if not isinstance(output, dict):
        raise OutputContractError(f"Node output must be an object for kind {output_kind!r}")
    check_output_size(len(str(output).encode("utf-8", errors="ignore")), limits or DSHLimits())
    return {"kind": output_kind, "output": output}


def build_event(
    name: str,
    run_id: str,
    workflow_id: str,
    sequence: int,
    node_id: str | None = None,
    status: str = "info",
    metadata: dict | None = None,
) -> ExecutionEvent:
    """Build a control-plane event (degraded mode, checkpoints, cleanup)."""
    return ExecutionEvent(
        run_id=run_id,
        workflow_id=workflow_id,
        node_id=node_id,
        event=name,
        sequence=sequence,
        timestamp=time.time(),
        status=status,
        metadata=metadata or {},
    )


async def run_node(
    *,
    run_id: str,
    workflow_id: str,
    node_id: str | None,
    task: dict,
    output_kind: str | None,
    launch_config: DSHLaunchConfig,
    limits: DSHLimits,
    allow_local_fallback: bool,
    local_fallback,
    emit,
) -> dict:
    """Execute one workflow node through DSH (or the loud local fallback).

    ``emit`` receives normalized ExecutionEvents in order. ``local_fallback``
    is an async callable used only when the SDK is unavailable and fallback
    is explicitly enabled; it must raise on failure (no silent success).
    Returns the validated node output envelope.
    """
    sequence = 0

    async def checkpoint(name: str, status: str = "info", metadata: dict | None = None):
        nonlocal sequence
        await emit(build_event(name, run_id, workflow_id, sequence, node_id, status, metadata))
        sequence += 1

    await checkpoint("run.started", "running", {"profile": launch_config.profile})
    workspace = prepare_workspace(launch_config)
    try:
        try:
            raw_output = await asyncio.wait_for(
                launch_sdk_run(launch_config, task),
                timeout=limits.max_duration_seconds,
            )
        except DSHUnavailable:
            if not allow_local_fallback:
                await checkpoint("run.failed", "failed", {"reason": "dsh_unavailable"})
                raise
            await checkpoint(
                "run.started",
                "degraded",
                {"reason": "dsh_sdk_missing", "fallback": "local_engine", "workspace": str(workspace)},
            )
            raw_output = await asyncio.wait_for(
                local_fallback(task),
                timeout=limits.max_duration_seconds,
            )
        await checkpoint("node.checkpointed", "running", {"node_id": node_id})
        validated = validate_node_output(raw_output, output_kind)
        await checkpoint("run.completed", "completed", {"node_id": node_id})
        return validated
    except (asyncio.TimeoutError, asyncio.CancelledError) as exc:
        await checkpoint("run.cancelled", "cancelled", {"reason": type(exc).__name__})
        raise
    except (OutputContractError, LimitExceeded) as exc:
        await checkpoint("run.failed", "failed", {"reason": str(exc)[:300]})
        raise
    finally:
        cleaned = cleanup_workspace(launch_config)
        await checkpoint(
            "run.cleanup_completed",
            "completed" if cleaned else "failed",
            {"workspace": str(workspace)},
        )


def is_terminal_event(name: str) -> bool:
    """Re-export for the API layer."""
    return is_terminal(name)
