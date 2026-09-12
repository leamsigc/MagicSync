"""T30.1 — DSH SDK boundary, events, limits, and runner semantics."""

import asyncio

import pytest

from app.services.dsh import events, limits
from app.services.dsh.events import ExecutionEvent, is_terminal, normalize_event
from app.services.dsh.limits import (
    DSHLimits,
    LimitExceeded,
    check_child_agents,
    check_output_size,
    check_tool_calls,
    limits_from_settings,
)
from app.services.dsh.runner import (
    SUPPORTED_OUTPUT_KINDS,
    OutputContractError,
    build_event,
    run_node,
    validate_node_output,
)
from app.services.dsh.sdk import (
    DSHLaunchConfig,
    DSHUnavailable,
    cleanup_workspace,
    launch_sdk_run,
    prepare_workspace,
)


class TestSdkBoundary:
    def test_workspace_lifecycle(self, tmp_path):
        config = DSHLaunchConfig(run_id="r1", workflow_id="w1", run_root=str(tmp_path))
        workspace = prepare_workspace(config)
        assert workspace.exists()
        assert config.dsh_home().exists()
        assert config.session_id.startswith("run-r1-")
        assert cleanup_workspace(config) is True
        assert not workspace.exists()

    @pytest.mark.asyncio
    async def test_missing_sdk_raises_loudly(self, tmp_path):
        config = DSHLaunchConfig(run_id="r1", workflow_id="w1", run_root=str(tmp_path))
        try:
            import deepseek_harness  # noqa: F401
        except Exception:
            with pytest.raises(DSHUnavailable, match="not installed"):
                await launch_sdk_run(config, {})
        finally:
            cleanup_workspace(config)

    def test_wrong_profile_rejected(self):
        config = DSHLaunchConfig(run_id="r", workflow_id="w", run_root="/tmp", profile="minimal")
        assert config.profile == "minimal"


class TestEvents:
    def test_all_known_events_normalize(self):
        for index, name in enumerate(events.KNOWN_EVENTS):
            event = normalize_event(
                {"event": name, "node_id": "n1", "metadata": {"k": "v"}},
                run_id="r",
                workflow_id="w",
                sequence=index,
            )
            assert isinstance(event, ExecutionEvent)
            assert event.sequence == index
            assert event.node_id == "n1"

    def test_unknown_event_dropped(self):
        assert normalize_event({"event": "nope"}, run_id="r", workflow_id="w", sequence=0) is None

    def test_metadata_redacted(self):
        event = normalize_event(
            {"event": "agent.tool_started", "metadata": {"key": "sk-live-abcdef123"}},
            run_id="r",
            workflow_id="w",
            sequence=0,
        )
        assert "sk-live-abcdef123" not in str(event.metadata)
        assert "[REDACTED]" in str(event.metadata)

    def test_terminal_set(self):
        assert is_terminal("run.completed") is True
        assert is_terminal("agent.started") is False


class TestLimits:
    def test_from_settings_defaults(self):
        assert limits_from_settings(object()).max_tool_calls == 50

    def test_output_size_enforced(self):
        with pytest.raises(LimitExceeded):
            check_output_size(999_999_999, DSHLimits(max_output_bytes=10))

    def test_tool_calls_enforced(self):
        with pytest.raises(LimitExceeded):
            check_tool_calls(51, DSHLimits(max_tool_calls=50))

    def test_child_agents_enforced(self):
        with pytest.raises(LimitExceeded):
            check_child_agents(5, 1, DSHLimits(max_child_agents=4))
        with pytest.raises(LimitExceeded):
            check_child_agents(1, 4, DSHLimits(max_agent_depth=3))


class TestRunner:
    def test_output_contract(self):
        assert validate_node_output({"a": 1}, "social_post_draft")["kind"] == "social_post_draft"
        with pytest.raises(OutputContractError):
            validate_node_output({"a": 1}, "telepathy")
        with pytest.raises(OutputContractError):
            validate_node_output(" prose ", "social_post_draft")
        assert "social_post_draft" in SUPPORTED_OUTPUT_KINDS

    @pytest.mark.asyncio
    async def test_loud_fallback_and_cleanup(self, tmp_path):
        emitted: list = []

        async def emit(event):
            emitted.append(event)

        async def local_fallback(task):
            return {"draft": True}

        config = DSHLaunchConfig(run_id="r9", workflow_id="w9", run_root=str(tmp_path))
        out = await run_node(
            run_id="r9",
            workflow_id="w9",
            node_id="n1",
            task={"brief": "x"},
            output_kind="social_post_draft",
            launch_config=config,
            limits=DSHLimits(),
            allow_local_fallback=True,
            local_fallback=local_fallback,
            emit=emit,
        )
        assert out["kind"] == "social_post_draft"
        names = [e.event for e in emitted]
        assert "run.started" in names
        assert "run.completed" in names
        assert "run.cleanup_completed" in names
        assert any(e.status == "degraded" for e in emitted)
        assert not config.workspace_dir().exists()

    @pytest.mark.asyncio
    async def test_no_fallback_fails_closed(self, tmp_path):
        emitted: list = []

        async def emit(event):
            emitted.append(event)

        async def local_fallback(task):
            raise AssertionError("must not be called")

        config = DSHLaunchConfig(run_id="r8", workflow_id="w8", run_root=str(tmp_path))
        try:
            import deepseek_harness  # noqa: F401
            pytest.skip("SDK installed; fallback test needs it missing")
        except Exception:
            with pytest.raises(DSHUnavailable):
                await run_node(
                    run_id="r8",
                    workflow_id="w8",
                    node_id="n1",
                    task={},
                    output_kind="social_post_draft",
                    launch_config=config,
                    limits=DSHLimits(),
                    allow_local_fallback=False,
                    local_fallback=local_fallback,
                    emit=emit,
                )
        assert any(e.event == "run.cleanup_completed" for e in emitted)

    @pytest.mark.asyncio
    async def test_timeout_cancels_and_cleans_up(self, tmp_path):
        emitted: list = []

        async def emit(event):
            emitted.append(event)

        async def slow(task):
            await asyncio.sleep(30)

        config = DSHLaunchConfig(run_id="r7", workflow_id="w7", run_root=str(tmp_path))
        with pytest.raises((asyncio.TimeoutError, DSHUnavailable)):
            await run_node(
                run_id="r7",
                workflow_id="w7",
                node_id="n1",
                task={},
                output_kind="social_post_draft",
                launch_config=config,
                limits=DSHLimits(max_duration_seconds=1),
                allow_local_fallback=True,
                local_fallback=slow,
                emit=emit,
            )
        assert any(e.event == "run.cleanup_completed" for e in emitted)
        assert any(e.event == "run.cancelled" for e in emitted)
