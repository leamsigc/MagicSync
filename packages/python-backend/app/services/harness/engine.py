import logging
import json
from typing import Optional, Any
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class PhaseType(str, Enum):
    PROGRAMMATIC = "programmatic"
    LLM_SINGLE = "llm_single"
    LLM_AGENT = "llm_agent"
    LLM_BATCH_AGENTS = "llm_batch_agents"
    LLM_HUMAN_INPUT = "llm_human_input"


class HarnessStatus(str, Enum):
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class PhaseResult:
    phase_id: int
    phase_name: str
    phase_type: PhaseType
    input_data: Any
    output_data: Any
    status: str
    error: Optional[str] = None
    duration_ms: int = 0


@dataclass
class HarnessState:
    id: str
    harness_type: str
    status: HarnessStatus
    current_phase: int = 0
    phase_results: list[PhaseResult] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)
    started_at: int = 0
    completed_at: Optional[int] = None


class PhaseExecutor:
    """Base class for phase executors."""
    
    async def execute(self, phase_input: Any, context: dict) -> dict:
        raise NotImplementedError


class ProgrammaticExecutor(PhaseExecutor):
    """Pure Python execution - no LLM."""
    
    _handlers = None
    
    @classmethod
    def _get_handlers(cls):
        if cls._handlers is None:
            try:
                from app.services.harness.harnesses.contract_review import CONTRACT_REVIEW_HANDLERS
                cls._handlers = CONTRACT_REVIEW_HANDLERS
            except ImportError:
                cls._handlers = {}
        return cls._handlers
    
    async def execute(self, phase_input: Any, context: dict) -> dict:
        handler_name = context.get("handler")
        if handler_name:
            handlers = self._get_handlers()
            handler = handlers.get(handler_name)
            if handler:
                return await handler(phase_input, context)
            return {"error": f"Handler '{handler_name}' not found"}
        return {"result": "No handler configured"}


class LLMSingleExecutor(PhaseExecutor):
    """Single LLM call with structured output."""
    
    async def execute(self, phase_input: Any, context: dict) -> dict:
        from app.services.llm import llm_service
        
        prompt = context.get("prompt", "")
        schema = context.get("schema")
        llm = context.get("llm") or {}

        response = await llm_service.chat_text([
            {"role": "system", "content": context.get("system_prompt", "You are a helpful assistant.")},
            {"role": "user", "content": f"{prompt}\n\nInput: {phase_input}"}
        ], json_mode=bool(schema),
            provider=llm.get("provider"),
            model=llm.get("model"),
            api_key=llm.get("api_key"),
            api_base=llm.get("api_base"))
        
        if schema:
            try:
                data = json.loads(response)
                return {"result": data}
            except Exception:
                return {"result": response, "raw": True}
        
        return {"result": response}


class LLMAgentExecutor(PhaseExecutor):
    """Multi-round agent loop with tools."""
    
    async def execute(self, phase_input: Any, context: dict) -> dict:
        from app.services.agent.deep_mode import DeepModeAgent
        
        config = context.get("deep_mode_config")
        agent = DeepModeAgent(
            user_id=context.get("user_id", ""),
            thread_id=context.get("thread_id", ""),
            config=config,
            llm=context.get("llm"),
        )
        
        result = await agent.run(str(phase_input))
        return {"result": result}


class LLMBatchAgentsExecutor(PhaseExecutor):
    """Batched parallel sub-agents per item."""
    
    async def execute(self, phase_input: Any, context: dict) -> dict:
        import asyncio
        from app.services.agent.sub_agent import SubAgentService, SubAgentStatus
        
        items = phase_input if isinstance(phase_input, list) else [phase_input]
        
        sub_agent_service = SubAgentService()
        
        async def run_single_agent(idx: int, item: Any) -> dict:
            agent = sub_agent_service.spawn(
                task=str(item),
                parent_message_id=f"batch_{idx}",
                user_id=context.get("user_id", ""),
                max_steps=context.get("max_steps", 5)
            )
            sub_agent_service.start_agent(agent.id)
            
            step_count = 0
            max_steps = context.get("max_steps", 5)
            
            while agent.status != SubAgentStatus.COMPLETED and step_count < max_steps:
                await asyncio.sleep(0.1)
                step_count += 1
            
            return {
                "item": item,
                "agent_id": agent.id,
                "status": agent.status.value,
                "result": agent.result if hasattr(agent, 'result') else None
            }
        
        results = await asyncio.gather(*[
            run_single_agent(idx, item) for idx, item in enumerate(items)
        ])
        
        return {"results": list(results), "count": len(results)}


class LLMWaitUserExecutor(PhaseExecutor):
    """Pause for user input, generate informed questions."""
    
    async def execute(self, phase_input: Any, context: dict) -> dict:
        from app.services.llm import llm_service
        
        prompt = f"""Based on this context: {phase_input}

Generate 3-5 clear questions to ask the user that will help complete this task.
Output as JSON array: [{{"question": "...", "purpose": "..."}}]"""
        
        response = await llm_service.chat_text([
            {"role": "system", "content": "You are helping gather context for a task."},
            {"role": "user", "content": prompt}
        ], json_mode=True)
        
        try:
            questions = json.loads(response)
            return {"status": "waiting", "questions": questions}
        except Exception:
            return {"status": "error", "raw_response": response}


class HarnessEngine:
    """State machine for deterministic harness execution."""
    
    def __init__(self):
        self.phase_executors: dict[PhaseType, PhaseExecutor] = {
            PhaseType.PROGRAMMATIC: ProgrammaticExecutor(),
            PhaseType.LLM_SINGLE: LLMSingleExecutor(),
            PhaseType.LLM_AGENT: LLMAgentExecutor(),
            PhaseType.LLM_BATCH_AGENTS: LLMBatchAgentsExecutor(),
            PhaseType.LLM_HUMAN_INPUT: LLMWaitUserExecutor(),
        }
        
        self._harnesses: dict[str, list[dict]] = {}
        self._register_default_harnesses()

    def _register_default_harnesses(self):
        """Register built-in harnesses."""
        self._harnesses["contract_review"] = [
            {"name": "Document Intake", "type": PhaseType.PROGRAMMATIC, "handler": "extract_document"},
            {"name": "Classification", "type": PhaseType.LLM_SINGLE, "schema": "contract_type"},
            {"name": "Gather Context", "type": PhaseType.LLM_HUMAN_INPUT},
            {"name": "Load Playbook", "type": PhaseType.LLM_AGENT},
            {"name": "Clause Extraction", "type": PhaseType.PROGRAMMATIC, "handler": "extract_clauses"},
            {"name": "Risk Analysis", "type": PhaseType.LLM_BATCH_AGENTS},
            {"name": "Redline Generation", "type": PhaseType.LLM_BATCH_AGENTS},
            {"name": "Executive Summary", "type": PhaseType.LLM_SINGLE},
        ]
        
        self._harnesses["document_analysis"] = [
            {"name": "Extract Text", "type": PhaseType.PROGRAMMATIC, "handler": "extract_document"},
            {"name": "Summarize", "type": PhaseType.LLM_SINGLE},
            {"name": "Extract Entities", "type": PhaseType.LLM_AGENT},
        ]
        
        self._harnesses["research"] = [
            {"name": "Gather Sources", "type": PhaseType.LLM_SINGLE},
            {"name": "Parallel Analysis", "type": PhaseType.LLM_BATCH_AGENTS},
            {"name": "Synthesize", "type": PhaseType.LLM_SINGLE},
        ]

        # Social pipeline: Research -> Writer -> Humanizer -> HTML Design -> Human review.
        # Editable at runtime via register_harness(); run from chat, frontend
        # buttons, or quick actions. Design output is HTML only (asset templates).
        self._harnesses["social_pipeline"] = [
            {
                "name": "Research topics",
                "type": PhaseType.LLM_AGENT,
                "system_prompt": (
                    "You are a social media research agent. Given the user brief, "
                    "business context, and any reference documents, return the best "
                    "topics with angles, hooks, and source notes as JSON."
                ),
            },
            {
                "name": "Write post",
                "type": PhaseType.LLM_SINGLE,
                "system_prompt": (
                    "You are a social media content writer. Use the research output "
                    "and business context to write the post caption and slide copy."
                ),
                "schema": "social_post",
            },
            {
                "name": "Humanize",
                "type": PhaseType.LLM_SINGLE,
                "system_prompt": (
                    "You are a human behavior and sentiment editor. Rewrite the draft "
                    "to sound human and emotional without changing facts or structure."
                ),
            },
            {
                "name": "Design HTML",
                "type": PhaseType.LLM_SINGLE,
                "system_prompt": (
                    "You are a social design agent. Output HTML only for the post "
                    "image, carousel slides, or hero thumbnail, referencing the "
                    "provided asset/template slots. No explanations."
                ),
                "schema": "social_design",
            },
            {"name": "Human review", "type": PhaseType.LLM_HUMAN_INPUT},
        ]

    def get_harness(self, harness_type: str) -> list[dict]:
        """Get harness phases by type."""
        return self._harnesses.get(harness_type, [])

    def register_harness(self, harness_type: str, phases: list[dict]):
        """Register a custom harness."""
        self._harnesses[harness_type] = phases

    async def execute_phase(
        self,
        harness_type: str,
        phase_index: int,
        phase_input: Any,
        context: dict,
        phases: list[dict] | None = None,
    ) -> dict:
        """Execute a single phase (registered harness or inline definitions)."""
        phases = phases if phases is not None else self.get_harness(harness_type)
        if phase_index >= len(phases):
            return {"error": f"Phase {phase_index} not found"}

        phase = phases[phase_index]
        try:
            PhaseType(phase.get("type", PhaseType.PROGRAMMATIC))
        except ValueError:
            return {"error": f"Unknown phase type {phase.get('type')}"}
        phase_type = PhaseType(phase.get("type", PhaseType.PROGRAMMATIC))
        
        executor = self.phase_executors.get(phase_type)
        if not executor:
            return {"error": f"No executor for phase type {phase_type}"}
        
        result = await executor.execute(phase_input, {**context, **phase})
        
        return {
            "phase": phase_index,
            "phase_name": phase.get("name"),
            "phase_type": phase_type,
            "result": result
        }

    async def run_harness(
        self,
        harness_type: str,
        initial_input: Any,
        context: dict
    ) -> dict:
        """Run full harness from start to finish."""
        phases = self.get_harness(harness_type)
        if not phases:
            return {"error": f"Harness '{harness_type}' not found"}
        
        state = HarnessState(
            id=context.get("run_id", "unknown"),
            harness_type=harness_type,
            status=HarnessStatus.RUNNING
        )
        
        results = []
        current_input = initial_input
        
        import time
        state.started_at = int(time.time())
        
        for idx, phase in enumerate(phases):
            phase_result = await self.execute_phase(harness_type, idx, current_input, context)
            
            results.append(phase_result)
            state.current_phase = idx
            
            await self._persist_run(state, results)
            
            if "error" in phase_result:
                state.status = HarnessStatus.FAILED
                await self._persist_run(state, results, completed=True)
                return {"state": state.__dict__, "results": results}
            
            if phase_result.get("result", {}).get("status") == "waiting":
                state.status = HarnessStatus.PAUSED
                await self._persist_run(state, results)
                return {"state": state.__dict__, "results": results}
            
            current_input = phase_result.get("result", {})
        
        state.status = HarnessStatus.COMPLETED
        state.completed_at = int(time.time())
        await self._persist_run(state, results, completed=True)
        return {"state": state.__dict__, "results": results}
    
    async def _persist_run(self, state: HarnessState, results: list, completed: bool = False):
        """Persist harness run to database."""
        try:
            from app.core.db import get_db_pool
            
            pool = await get_db_pool()
            async with pool.acquire() as conn:
                import json
                await conn.execute(
                    """INSERT OR REPLACE INTO harness_runs 
                       (id, thread_id, user_id, harness_type, status, current_phase, phase_results, metadata, started_at, completed_at, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        state.id,
                        "",
                        "",
                        state.harness_type,
                        state.status.value,
                        state.current_phase,
                        json.dumps(results),
                        json.dumps(state.metadata),
                        state.started_at,
                        state.completed_at,
                        state.started_at
                    )
                )
        except Exception as e:
            logger.warning(f"Failed to persist harness run: {e}")


harness_engine = HarnessEngine()
