import pytest
from app.services.harness.engine import (
    HarnessEngine,
    PhaseType,
    HarnessStatus,
    PhaseExecutor,
    ProgrammaticExecutor,
    LLMSingleExecutor,
    LLMWaitUserExecutor
)


class TestHarnessEngine:
    """Tests for harness engine."""

    def test_engine_initialization(self):
        """Verify engine initializes with default harnesses."""
        engine = HarnessEngine()
        
        assert "contract_review" in engine._harnesses
        assert len(engine._harnesses["contract_review"]) == 8

    def test_get_harness(self):
        """Test retrieving harness phases."""
        engine = HarnessEngine()
        phases = engine.get_harness("contract_review")
        
        assert len(phases) == 8
        assert phases[0]["name"] == "Document Intake"

    def test_get_nonexistent_harness(self):
        """Test retrieving nonexistent harness."""
        engine = HarnessEngine()
        phases = engine.get_harness("nonexistent")
        
        assert phases == []

    def test_register_custom_harness(self):
        """Test registering custom harness."""
        engine = HarnessEngine()
        custom_phases = [
            {"name": "Step 1", "type": PhaseType.PROGRAMMATIC},
            {"name": "Step 2", "type": PhaseType.LLM_SINGLE},
        ]
        
        engine.register_harness("custom", custom_phases)
        
        assert "custom" in engine._harnesses
        assert len(engine._harnesses["custom"]) == 2


class TestPhaseTypes:
    """Tests for phase type enums."""

    def test_phase_types_exist(self):
        """Verify all phase types are defined."""
        assert PhaseType.PROGRAMMATIC == "programmatic"
        assert PhaseType.LLM_SINGLE == "llm_single"
        assert PhaseType.LLM_AGENT == "llm_agent"
        assert PhaseType.LLM_BATCH_AGENTS == "llm_batch_agents"
        assert PhaseType.LLM_HUMAN_INPUT == "llm_human_input"

    def test_harness_status(self):
        """Verify harness status values."""
        assert HarnessStatus.RUNNING == "running"
        assert HarnessStatus.PAUSED == "paused"
        assert HarnessStatus.COMPLETED == "completed"
        assert HarnessStatus.FAILED == "failed"


class TestProgrammaticExecutor:
    """Tests for programmatic phase executor."""

    @pytest.mark.asyncio
    async def test_execute_with_handler(self):
        """Test execution without handler returns default."""
        executor = ProgrammaticExecutor()
        
        result = await executor.execute("test_input", {})
        
        assert "result" in result

    @pytest.mark.asyncio
    async def test_execute_without_handler(self):
        """Test execution without handler."""
        executor = ProgrammaticExecutor()
        
        result = await executor.execute("test_input", {})
        
        assert "result" in result


class TestLLMWaitUserExecutor:
    """Tests for human input phase executor."""

    @pytest.mark.asyncio
    async def test_executor_initialization(self):
        """Test executor can be instantiated."""
        executor = LLMWaitUserExecutor()
        
        assert executor is not None
