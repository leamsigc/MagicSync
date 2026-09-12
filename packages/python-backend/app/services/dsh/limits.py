"""DSH execution limits (T30.1 §3, §11)."""

from dataclasses import dataclass


@dataclass
class DSHLimits:
    """Depth, count, duration, concurrency, token, and output limits."""

    max_duration_seconds: int = 600
    max_child_agents: int = 4
    max_agent_depth: int = 3
    max_tool_calls: int = 50
    max_output_bytes: int = 256_000
    max_concurrency: int = 4


def limits_from_settings(settings) -> DSHLimits:
    """Build limits from FastAPI settings with safe fallbacks."""
    get = getattr
    return DSHLimits(
        max_duration_seconds=int(get(settings, "dsh_max_duration_seconds", 600)),
        max_child_agents=int(get(settings, "dsh_max_child_agents", 4)),
        max_agent_depth=int(get(settings, "dsh_max_agent_depth", 3)),
        max_tool_calls=int(get(settings, "dsh_max_tool_calls", 50)),
        max_output_bytes=int(get(settings, "dsh_max_output_bytes", 256_000)),
        max_concurrency=int(get(settings, "dsh_max_concurrency", 4)),
    )


class LimitExceeded(RuntimeError):
    """Raised when a run exceeds an enforced DSH limit."""


def check_output_size(output_bytes: int, limits: DSHLimits) -> None:
    """Reject oversized outputs before they enter run state."""
    if output_bytes > limits.max_output_bytes:
        raise LimitExceeded(
            f"Output exceeded limit: {output_bytes} bytes "
            f"(max {limits.max_output_bytes}). Split the node output and retry."
        )


def check_tool_calls(tool_calls: int, limits: DSHLimits) -> None:
    """Reject runaway tool-call loops."""
    if tool_calls > limits.max_tool_calls:
        raise LimitExceeded(
            f"Tool calls exceeded limit: {tool_calls} (max {limits.max_tool_calls})."
        )


def check_child_agents(child_count: int, depth: int, limits: DSHLimits) -> None:
    """Reject runaway child-agent fan-out and depth."""
    if child_count > limits.max_child_agents:
        raise LimitExceeded(
            f"Child agents exceeded limit: {child_count} (max {limits.max_child_agents})."
        )
    if depth > limits.max_agent_depth:
        raise LimitExceeded(
            f"Agent depth exceeded limit: {depth} (max {limits.max_agent_depth})."
        )
