"""Official DeepSeek Harness SDK boundary (T30.1).

The SDK is optional at import time: production images pin it via
``DSH_SDK_VERSION`` and install it, while environments without it get an
explicit ``DSHUnavailable`` error instead of silent behavior changes.
"""

import asyncio
import logging
import shutil
import uuid
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

SDK_PROFILE = "sdk"

try:  # pragma: no cover - exercised via DSH_AVAILABLE in tests
    import deepseek_harness  # type: ignore[import-not-found]

    DSH_AVAILABLE = True
    _SDK_VERSION = getattr(deepseek_harness, "__version__", "unknown")
except Exception:  # ImportError and partial-install failures alike
    deepseek_harness = None  # type: ignore[assignment]
    DSH_AVAILABLE = False
    _SDK_VERSION = None


class DSHUnavailable(RuntimeError):
    """Raised when DSH execution is requested without the SDK runtime."""


def sdk_version() -> str | None:
    """Pinned/loaded SDK version for build verification and diagnostics."""
    return _SDK_VERSION


@dataclass
class DSHLaunchConfig:
    """Explicit per-run SDK launch parameters (PRD §3, §6)."""

    run_id: str
    workflow_id: str
    run_root: str
    profile: str = SDK_PROFILE
    session_id: str = ""
    max_duration_seconds: int = 600
    extra_env: dict = field(default_factory=dict)

    def workspace_dir(self) -> Path:
        return Path(self.run_root) / self.run_id

    def dsh_home(self) -> Path:
        return self.workspace_dir() / ".dsh-home"


def prepare_workspace(config: DSHLaunchConfig) -> Path:
    """Create the server-generated per-run workspace and DSH_HOME."""
    workspace = config.workspace_dir()
    workspace.mkdir(parents=True, exist_ok=True)
    config.dsh_home().mkdir(parents=True, exist_ok=True)
    if not config.session_id:
        config.session_id = f"run-{config.run_id}-{uuid.uuid4().hex[:8]}"
    return workspace


def cleanup_workspace(config: DSHLaunchConfig) -> bool:
    """Remove workspace/session resources on every terminal path."""
    try:
        shutil.rmtree(config.workspace_dir(), ignore_errors=True)
        return True
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("DSH workspace cleanup failed run=%s: %s", config.run_id, exc)
        return False


async def launch_sdk_run(config: DSHLaunchConfig, task: dict) -> dict:
    """Start a DSH run through the official SDK on a worker thread.

    Raises DSHUnavailable when the SDK is not installed, asyncio.TimeoutError
    on expiry (caller cancels + cleans up), and RuntimeError for provider
    failures without falling back to another model.
    """
    if not DSH_AVAILABLE or deepseek_harness is None:
        raise DSHUnavailable(
            "DeepSeek Harness SDK is not installed. Pin DSH_SDK_VERSION and "
            "install deepseek-harness-sdk, or enable the explicit local "
            "fallback (dsh_allow_local_fallback) for development only."
        )
    if config.profile != SDK_PROFILE:
        raise ValueError(f"DSH requires the full 'sdk' profile, got {config.profile!r}")
    workspace = prepare_workspace(config)

    def _start() -> dict:
        client = deepseek_harness.Client(  # type: ignore[union-attr]
            workspace=str(workspace),
            dsh_home=str(config.dsh_home()),
            profile=config.profile,
            session_id=config.session_id,
        )
        return client.run(task)

    return await asyncio.to_thread(_start)
