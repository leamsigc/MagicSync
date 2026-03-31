# Candidate: Agent Skills & Code Execution Sandbox

## Status
`pending`

## Priority
High

## Episode
Episode 4 of the [Claude Code Agentic RAG Series](https://github.com/theaiautomators/claude-code-agentic-rag-series)

## Cluster

- `packages/python-backend/app/services/skills/` — Skill registry and executor
- `packages/python-backend/app/services/sandbox/` — Code execution sandbox
- `packages/python-backend/app/api/v1/` — Skills and sandbox endpoints
- `packages/db/db/` — Skills schema
- `packages/db/server/services/` — Skills service layer
- `packages/ai-tools/app/pages/app/ai-tools/` — Skills management UI

## Problem Statement

The AI agent has fixed capabilities. Users cannot teach it specialized behaviors (legal review, sales analysis, report generation). There is no way to execute code to generate files or process data dynamically.

### Current Friction
- Agent capabilities are hardcoded
- No way to create reusable AI behaviors
- Cannot generate files (Excel, PowerPoint, charts)
- No code execution for data processing
- Tool results are ephemeral

## Why Coupled

1. Skills need a registry that the agent discovers at runtime
2. Skill files (scripts, templates) need storage and retrieval
3. Code sandbox requires Docker integration
4. Generated files need serving via signed URLs
5. Skills must integrate with the existing tool-calling system

## Dependency Category

- Vertical: Feature spans agent → sandbox → storage → UI

## Test Impact

**Currently:**
- 171 Python tests, no skills/sandbox tests

**After consolidation:**
- Tests for skill CRUD and discovery
- Tests for skill file management
- Tests for sandbox code execution (Docker)
- Tests for file generation and serving
- Tests for skill import/export (agentskills.io format)

## Proposed Solution

A skills system with sandboxed code execution:

### Modules

#### Module 1: Skills Schema & Service
- `skills` table (id, userId, name, description, instructions, isGlobal, createdAt)
- `skill_files` table (id, skillId, filename, content, mimeType, createdAt)
- Skills CRUD service
- Skill discovery (lightweight catalog for system prompt)

#### Module 2: Skill Tools
- `load_skill(skill_name)` — Fetch full instructions on demand
- `save_skill(name, description, instructions)` — Persist new skill
- `read_skill_file(skill_id, filename)` — Read attached file content
- Skills Open Standard format (agentskills.io) for import/export

#### Module 3: Code Execution Sandbox
- Docker-based sandbox using llm-sandbox
- `execute_code(code, language)` tool
- Session persistence (Python variables survive across calls)
- Streaming stdout/stderr
- File generation (Excel, PowerPoint, CSV, charts)
- Signed URL serving for generated files

#### Module 4: Frontend
- Skills management page (create, edit, delete, import/export)
- Code execution panel in chat
- File browser for generated artifacts
- Skill creation wizard (AI-guided, manual, import)

## Tech Stack Adaptation

| Reference | Our Stack |
|-----------|-----------|
| Supabase Storage | Local filesystem + Nuxt serve |
| React | Nuxt 4 + Vue 3 |
| Docker sandbox | Same (llm-sandbox or custom) |
| FastAPI | Same |

## Next Steps

1. Design skills schema and migration
2. Write TDD tests for skill CRUD
3. Implement SkillRegistry service
4. Set up Docker sandbox for code execution
5. Build skill tools (load, save, read_file, execute_code)
6. Create skills management UI
