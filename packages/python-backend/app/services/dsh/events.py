"""DSH lifecycle event normalization (T30.1 §9).

Converts raw DSH runtime events into durable, append-only MagicSync
execution events. Writes are idempotent by (run_id, sequence) at the
persistence layer; this module assigns the sequence and redacts secrets.
"""

import logging
import re
import time
from typing import Any

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

KNOWN_EVENTS = (
    "run.started",
    "workflow.started",
    "workflow.phase",
    "agent.started",
    "agent.tool_started",
    "agent.tool_finished",
    "agent.finished",
    "review.required",
    "review.approved",
    "review.changes_requested",
    "node.checkpointed",
    "run.completed",
    "run.failed",
    "run.cancelled",
    "run.cleanup_completed",
)

TERMINAL_EVENTS = frozenset(
    {"run.completed", "run.failed", "run.cancelled", "run.cleanup_completed"}
)

_REDACT_PATTERNS = (
    re.compile(r"sk-[A-Za-z0-9_-]{8,}"),
    re.compile(r"(api[_-]?key|secret|password|token)\s*[:=]\s*['\"]?[^\s'\";,}]+", re.IGNORECASE),
)


def redact_event_text(text: str) -> str:
    """Redact credential-like values from event metadata."""
    out = text
    for pattern in _REDACT_PATTERNS:
        out = pattern.sub("[REDACTED]", out)
    return out


def redact_metadata(metadata: dict | None) -> dict:
    """Redact string values in event metadata (shallow, no secret logging)."""
    if not metadata:
        return {}
    clean: dict[str, Any] = {}
    for key, value in metadata.items():
        clean[key] = redact_event_text(value) if isinstance(value, str) else value
    return clean


class ExecutionEvent(BaseModel):
    """Normalized, persistable execution event."""

    run_id: str
    workflow_id: str
    node_id: str | None = None
    agent_id: str | None = None
    parent_agent_id: str | None = None
    event: str
    sequence: int = 0
    timestamp: float = Field(default_factory=time.time)
    status: str = "info"
    metadata: dict = Field(default_factory=dict)
    tokens: int | None = None
    cost: float | None = None


def normalize_event(raw: dict, run_id: str, workflow_id: str, sequence: int) -> ExecutionEvent | None:
    """Normalize one raw DSH event. Returns None for unknown event names."""
    name = raw.get("event") or raw.get("type")
    if name not in KNOWN_EVENTS:
        logger.warning("Unknown DSH event dropped run=%s name=%r", run_id, name)
        return None
    return ExecutionEvent(
        run_id=run_id,
        workflow_id=workflow_id,
        node_id=raw.get("node_id") or raw.get("nodeId"),
        agent_id=raw.get("agent_id") or raw.get("agentId"),
        parent_agent_id=raw.get("parent_agent_id") or raw.get("parentAgentId"),
        event=name,
        sequence=sequence,
        timestamp=float(raw.get("timestamp", time.time())),
        status=str(raw.get("status", "info")),
        metadata=redact_metadata(raw.get("metadata") if isinstance(raw.get("metadata"), dict) else None),
        tokens=raw.get("tokens"),
        cost=raw.get("cost"),
    )


def is_terminal(event_name: str) -> bool:
    """Whether the event closes the run lifecycle."""
    return event_name in TERMINAL_EVENTS
