# Candidate: Agent Harness & Domain-Specific Workflows

## Status
`pending`

## Priority
High

## Episode
Episode 6 of the [Claude Code Agentic RAG Series](https://github.com/theaiautomators/claude-code-agentic-rag-series/tree/main/ep6-agent-harness)

## Source
Adapted from [PRD-Agent-Harness.md](https://github.com/theaiautomators/claude-code-agentic-rag-series/blob/main/ep6-agent-harness/PRD-Agent-Harness.md)

## Core Insight

**The model is commoditized. Structured enforcement of process is the moat.**

Two layers: Deep Mode (soft harness — LLM controls flow) + Harness Engine (hard harness — system controls flow).

## What It Is

### Deep Mode (Soft Harness)
Autonomous agent with planning, workspace, and sub-agent delegation:
- Per-message activation via toggle
- Agent-managed todo list
- Per-thread virtual filesystem (workspace)
- General-purpose `task` tool for sub-agent delegation
- `ask_user` tool for mid-task clarification
- Error recovery (append-only, LLM-driven)

### Harness Engine (Hard Harness)
Backend state machine with deterministic phases:
- System controls the flow, LLM executes within phases
- Programmatic validation gates between phases
- Curated per-phase tool sets
- 5 phase types: programmatic, llm_single, llm_agent, llm_batch_agents, llm_human_input

### Contract Review Harness (First Domain)
8 deterministic phases:
1. **Document Intake** (programmatic) → Extract text from DOCX/PDF
2. **Classification** (llm_single) → Classify contract type
3. **Gather Context** (llm_human_input) → Ask user for review focus
4. **Load Playbook** (llm_agent) → RAG search for relevant standards
5. **Clause Extraction** (programmatic) → Parse contract into clauses
6. **Risk Analysis** (llm_batch_agents) → 5 parallel sub-agents per batch
7. **Redline Generation** (llm_batch_agents) → Generate redlines with fallbacks
8. **Executive Summary** (llm_single + DOCX) → Summary + formatted report

## New LLM Tools (Deep Mode)

| Tool | Purpose |
|------|---------|
| `write_todos` | Create/replace agent todo list |
| `read_todos` | Read current todos (recitation pattern) |
| `write_file` | Create/overwrite workspace file |
| `read_file` | Read workspace file |
| `edit_file` | Edit file via exact string replacement |
| `list_files` | List all workspace files |
| `task` | Delegate work to isolated sub-agent |
| `ask_user` | Ask user a question and pause |

## Harness Phase Types

| Type | Description |
|------|-------------|
| `programmatic` | Pure Python, no LLM |
| `llm_single` | Single LLM call with Pydantic-validated JSON output |
| `llm_agent` | Multi-round agent loop with tools |
| `llm_batch_agents` | Batched parallel sub-agents per item |
| `llm_human_input` | Pause for user input, generate informed questions |

## New Data Models

| Table | Purpose |
|-------|---------|
| `agent_todos` | Per-thread planning todo list |
| `workspace_files` | Per-thread virtual filesystem |
| `harness_runs` | Harness execution state, phase results, status |

## Cluster

- `packages/python-backend/app/services/harness/` — Harness engine, state machine, phase executors
- `packages/python-backend/app/services/agent/deep_mode.py` — Deep mode agent loop
- `packages/python-backend/app/api/v1/harness.py` — Harness endpoints
- `packages/python-backend/app/api/v1/workspace.py` — Workspace endpoints
- `packages/db/db/agent/` — agent_todos, workspace_files, harness_runs tables
- `packages/db/server/services/workspace.service.ts` — Workspace CRUD
- `packages/db/server/services/harness.service.ts` — Harness state persistence
- `packages/ai-tools/app/pages/app/ai-tools/chat/` — Deep mode UI, harness UI

## Stack Adaptation

| Reference | Our Stack |
|-----------|-----------|
| Supabase (Postgres + Storage) | Turso (libSQL) + local filesystem |
| React | Nuxt 4 + Vue 3 |
| FastAPI | FastAPI (same) |
| python-docx | python-docx (same) |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_DEEP_ROUNDS` | `50` | Maximum agent loop iterations |
| `MAX_SUB_AGENT_ROUNDS` | `15` | Maximum rounds for sub-agents |

## Implementation Phases

### Phase 1: Workspace & Todos Schema
- agent_todos table (threadId, content, status, order, createdAt)
- workspace_files table (threadId, filename, content, mimeType, createdAt)
- WorkspaceService and TodoService CRUD

### Phase 2: Deep Mode Agent Loop
- Deep mode toggle (per-message)
- Agent loop: plan → execute → evaluate → repeat
- write_todos, read_todos, write_file, read_file, edit_file, list_files tools
- task tool for sub-agent delegation
- ask_user tool for clarification
- Error recovery with append-only errors
- Max rounds with graceful termination

### Phase 3: Harness Engine
- HarnessEngine state machine
- Phase registry with 5 types
- Gatekeeper LLM (pre-harness validation)
- Post-harness response LLM
- harness_runs table + service
- Phase validation gates

### Phase 4: Contract Review — Phases 1-4
- Phase 1: Document intake (pypdf/python-docx extraction)
- Phase 2: Classification (llm_single with structured output)
- Phase 3: Gather context (llm_human_input with informed questions)
- Phase 4: Load playbook (llm_agent with RAG tools)

### Phase 5: Contract Review — Phases 5-8
- Phase 5: Clause extraction (programmatic parsing)
- Phase 6: Risk analysis (llm_batch_agents — 5 parallel sub-agents per batch)
- Phase 7: Redline generation (llm_batch_agents with fallback positions)
- Phase 8: Executive summary + DOCX report (python-docx in sandbox)

### Phase 6: Deep Mode Frontend
- Deep mode toggle in chat input
- Todo sidebar panel (real-time SSE updates)
- Workspace file browser with preview
- Agent status indicators (working, waiting, complete, error)

### Phase 7: Harness Frontend
- Locked plan panel for harness phases (system-driven, LLM can't modify)
- Phase-level SSE events (transitions, sub-agent spawns, batch progress)
- File upload to workspace (DOCX/PDF with extraction)
- Contract review UI flow

---
*Adapted: 2026-03-31*
