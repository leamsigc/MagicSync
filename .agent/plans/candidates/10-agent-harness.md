# Candidate: Agent Harness & Domain-Specific Workflows

## Status
`pending`

## Priority
High

## Episode
Episode 6 of the [Claude Code Agentic RAG Series](https://github.com/theaiautomators/claude-code-agentic-rag-series)

## Cluster

- `packages/python-backend/app/services/harness/` — Harness engine and state machine
- `packages/python-backend/app/services/agent/` — Deep mode agent loop
- `packages/python-backend/app/api/v1/` — Harness and deep mode endpoints
- `packages/db/db/` — Harness runs, workspace files, agent todos schema
- `packages/db/server/services/` — Harness and workspace services
- `packages/ai-tools/app/pages/app/ai-tools/` — Deep mode UI, harness UI

## Problem Statement

The agent is a chat assistant with tool-calling. It cannot autonomously plan and execute multi-step tasks. There is no way to enforce deterministic workflows (like contract review) where the system controls the process rather than the LLM.

### Current Friction
- Agent cannot plan multi-step tasks autonomously
- No persistent workspace for artifacts
- Sub-agents are specialized only, not general-purpose
- No human-in-the-loop capability mid-task
- No domain-specific workflow enforcement
- No deliverable generation (reports, documents)

## Why Coupled

1. Deep Mode adds an autonomous agent loop with planning (todos), workspace, and sub-agent delegation
2. Harness engine is a backend state machine with typed phases
3. Contract review is the first domain harness with 8 deterministic phases
4. Workspace requires a virtual filesystem with DB persistence
5. All of this builds on the existing sub-agent infrastructure (Module 8)

## Dependency Category

- Vertical: Full stack from agent loop → state machine → workspace → UI

## Test Impact

**Currently:**
- 171 Python tests, no harness/deep mode tests

**After consolidation:**
- Tests for Deep Mode agent loop (planning, execution, recovery)
- Tests for workspace file CRUD
- Tests for harness state machine (phase transitions, gates)
- Tests for contract review phases (intake, classification, analysis)
- Tests for DOCX report generation
- Tests for batched parallel sub-agents

## Proposed Solution

Two-layer agent platform: Deep Mode (soft harness) + Harness Engine (hard harness):

### Modules

#### Module 1: Deep Mode Agent Loop
- Per-message toggle for autonomous mode
- Agent planning via managed todo list
- Workspace filesystem (per-thread virtual FS)
- General-purpose `task` tool for sub-agent delegation
- `ask_user` tool for mid-task clarification
- Error recovery (append-only errors, LLM-driven recovery)
- Max rounds limit with graceful termination

#### Module 2: Workspace & Todos
- `agent_todos` table (threadId, content, status, createdAt)
- `workspace_files` table (threadId, filename, content, mimeType, createdAt)
- Workspace CRUD service
- Todo management service
- File serving via signed URLs

#### Module 3: Harness Engine
- Backend state machine with typed phases:
  - `programmatic` — Pure Python, no LLM
  - `llm_single` — Single LLM call with structured output
  - `llm_agent` — Multi-round agent loop with tools
  - `llm_batch_agents` — Parallel sub-agents per item
  - `llm_human_input` — Pause for user input
- `harness_runs` table (id, threadId, harnessType, currentPhase, status, results, createdAt)
- Phase validation gates
- Per-phase curated tool sets

#### Module 4: Contract Review Harness
- 8 deterministic phases:
  1. Document Intake (programmatic) — Extract text from uploaded DOCX/PDF
  2. Classification (llm_single) — Classify contract type
  3. Gather Context (llm_human_input) — Ask user for review focus
  4. Load Playbook (llm_agent) — RAG search for relevant standards
  5. Clause Extraction (programmatic) — Parse contract into clauses
  6. Risk Analysis (llm_batch_agents) — 5 parallel sub-agents per batch
  7. Redline Generation (llm_batch_agents) — Generate redlines with fallbacks
  8. Executive Summary (llm_single + DOCX) — Summary + formatted report
- Risk levels: GREEN/YELLOW/RED per clause
- DOCX report generation via python-docx

#### Module 5: Deep Mode Frontend
- Deep Mode toggle in chat input
- Todo sidebar panel (real-time updates)
- Workspace file browser
- Agent status indicators (working, waiting, complete, error)
- Locked plan panel for harness phases
- Phase-level SSE events

## Tech Stack Adaptation

| Reference | Our Stack |
|-----------|-----------|
| Supabase (Postgres + Storage) | Turso (libSQL) + local filesystem |
| React | Nuxt 4 + Vue 3 |
| Python backend | Same (FastAPI) |
| python-docx | Same |

## Next Steps

1. Design workspace and todos schema
2. Write TDD tests for Deep Mode agent loop
3. Implement workspace and todo services
4. Build harness engine state machine
5. Implement contract review phases 1-4
6. Implement contract review phases 5-8 with DOCX generation
7. Build Deep Mode frontend (toggle, todos, workspace)
8. Build harness UI (locked plan panel, phase events)
