"""DeepSeek Harness runtime boundary (T30).

The official SDK starts a child ``dsh`` process, so all blocking SDK calls
run through an async worker boundary with explicit cancellation, timeout,
and cleanup. When the SDK is unavailable the runner fails loudly unless
local fallback is explicitly enabled (dev only).
"""

from app.services.dsh.sdk import DSH_AVAILABLE, DSHLaunchConfig, DSHUnavailable
from app.services.dsh.events import ExecutionEvent, normalize_event
from app.services.dsh.limits import DSHLimits, limits_from_settings
from app.services.dsh.capability import (
    CapabilityError,
    issue_capability,
    verify_capability,
)

__all__ = [
    "DSH_AVAILABLE",
    "DSHLaunchConfig",
    "DSHUnavailable",
    "ExecutionEvent",
    "normalize_event",
    "DSHLimits",
    "limits_from_settings",
    "CapabilityError",
    "issue_capability",
    "verify_capability",
]
