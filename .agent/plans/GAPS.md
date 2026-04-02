# Implementation Gap Analysis

What exists vs what's needed for Episodes 2-6.

## Episode 1: Agentic RAG Layer ✅ COMPLETE

### What We Have
- [x] FastAPI backend with auth (`packages/python-backend/app/`)
- [x] RAG pipeline (`app/services/rag/`)
- [x] Chat + thread management (`app/api/v1/`)
- [x] Tool framework (`app/services/tools/`)
- [x] Sub-agent system (`app/services/agent/`)
- [x] 171 Python tests passing
- [x] Nuxt frontend with chat UI
- [x] Turso vector database

### Dependencies Already Installed
- fastapi, uvicorn, httpx, pydantic
- pypdf, python-docx, beautifulsoup4, lxml, markdown
- duckduckgo-search, litellm, pyjwt
- sse-starlette, langsmith

---

## Episode 2: Knowledge Base Explorer

### What We Need to Add

**Python Backend:**
- [ ] `app/services/tools/knowledge_base.py` — KB tool implementations
- [ ] `app/schemas/knowledge_base.py` — KB request/response schemas
- [ ] `app/api/v1/knowledge_base.py` — KB API endpoints
- [ ] DB migration: `knowledge_folders` table
- [ ] DB migration: Add `folder_id` to `documents` table

**Frontend:**
- [ ] Tree view component for folder navigation
- [ ] Breadcrumb navigation
- [ ] Drag-and-drop document organization
- [ ] Scoped search within folders

**Dependencies:** None (uses existing stack)

**Reference:** https://github.com/theaiautomators/claude-code-agentic-rag-series/tree/main/ep2-knowledgebase-video

---

## Episode 3: PII Redaction

### What We Need to Add

**Python Backend:**
- [ ] `app/services/privacy/` — New service directory
- [ ] `app/services/privacy/pii_detection.py` — Presidio-based detection
- [ ] `app/services/privacy/anonymization.py` — Faker surrogate generation
- [ ] `app/services/privacy/entity_resolution.py` — Name clustering
- [ ] `app/services/privacy/deanonymization.py` — Reverse mapping
- [ ] `app/services/privacy/pipeline.py` — Full flow
- [ ] `app/api/v1/privacy.py` — Privacy endpoints
- [ ] DB migration: `entity_registry` table

**Frontend:**
- [ ] Privacy settings page
- [ ] Redaction status indicator in chat
- [ ] Entity type configuration UI

**Dependencies to Add:**
```
presidio-analyzer, presidio-anonymizer
spacy (en_core_web_trf model)
faker, nameparser, rapidfuzz, gender-guesser
```

**Reference:** https://github.com/theaiautomators/claude-code-agentic-rag-series/tree/main/ep3-redaction-anonymization-video

---

## Episode 4: Agent Skills & Sandbox

### What We Need to Add

**Python Backend:**
- [ ] `app/services/skills/` — New service directory
- [ ] `app/services/skills/registry.py` — Skill CRUD
- [ ] `app/services/skills/file_manager.py` — Skill file management
- [ ] `app/services/sandbox/` — New service directory
- [ ] `app/services/sandbox/container.py` — Docker lifecycle
- [ ] `app/services/sandbox/session.py` — IPython session management
- [ ] `app/services/sandbox/executor.py` — Code execution
- [ ] `app/services/sandbox/security.py` — Security policies
- [ ] `app/api/v1/skills.py` — Skills endpoints
- [ ] `app/api/v1/sandbox.py` — Sandbox endpoints
- [ ] DB migration: `skills`, `skill_files`, `code_executions`, `sandbox_files` tables

**Frontend:**
- [ ] Skills management page (list, editor, file management)
- [ ] Code execution panel in chat
- [ ] Import/export UI (ZIP format)

**Dependencies to Add:**
```
llm-sandbox, docker
python-pptx, openpyxl, fpdf2
pandas, numpy, matplotlib, pillow
```

**References:**
- Episode 4: https://github.com/theaiautomators/claude-code-agentic-rag-series/tree/main/ep4-skills-sandbox-video
- llm-sandbox: https://github.com/agentica-project/llm-sandbox
- agentskills.io: https://agentskills.io

---

## Episode 5: Advanced Tool Calling

### What We Need to Add

**Python Backend:**
- [ ] `app/services/tools/registry.py` — Dynamic tool registry
- [ ] `app/services/tools/catalog.py` — Compact catalog generation
- [ ] `app/services/mcp/` — MCP client directory
- [ ] `app/services/mcp/client.py` — MCP server connection
- [ ] `app/services/mcp/discovery.py` — Tool discovery
- [ ] `app/core/tokens.py` — Token counting utility
- [ ] `app/api/v1/tools.py` — Extended with tool_search

**Frontend:**
- [ ] Context window usage indicator
- [ ] Tool search UI
- [ ] MCP server configuration UI
- [ ] History state persistence

**Dependencies to Add:**
```
mcp (Model Context Protocol SDK)
tiktoken
```

**Reference:** https://github.com/theaiautomators/claude-code-agentic-rag-series/tree/main/ep5-advanced-tool-use

---

## Episode 6: Agent Harness

### What We Need to Add

**Python Backend:**
- [ ] `app/services/harness/` — New service directory
- [ ] `app/services/harness/engine.py` — State machine
- [ ] `app/services/harness/phases.py` — Phase executors
- [ ] `app/services/harness/gatekeeper.py` — Validation
- [ ] `app/services/harness/registry.py` — Phase registry
- [ ] `app/services/harness/harnesses/contract_review.py` — First harness
- [ ] `app/services/agent/deep_mode.py` — Deep mode loop
- [ ] `app/services/agent/workspace.py` — Virtual filesystem
- [ ] `app/services/agent/todo_manager.py` — Todo management
- [ ] `app/api/v1/harness.py` — Harness endpoints
- [ ] `app/api/v1/workspace.py` — Workspace endpoints
- [ ] DB migration: `agent_todos`, `workspace_files`, `harness_runs` tables

**Frontend:**
- [ ] Deep mode toggle in chat input
- [ ] Todo sidebar panel (SSE updates)
- [ ] Workspace file browser
- [ ] Agent status indicators
- [ ] Harness phase progress UI
- [ ] File upload for DOCX/PDF

**Dependencies:** python-docx, pypdf (already installed)

**Reference:** https://github.com/theaiautomators/claude-code-agentic-rag-series/tree/main/ep6-agent-harness

---

## Cross-Cutting Infrastructure (Candidate #11)

### What We Need to Add

**Python Backend:**
- [ ] Optional dependency groups in `pyproject.toml`
- [ ] Dynamic tool registry base class
- [ ] Token counting utility
- [ ] Feature flag configuration
- [ ] Service directory scaffolding

**Environment:**
- [ ] Feature flag env vars
- [ ] Token management config
- [ ] MCP server config

---

## Summary: What to Implement Next

### Immediate (Before Episode 2)
1. **Candidate #11** — Python Backend Infrastructure
   - Add optional dependency groups
   - Create service directory scaffolding
   - Set up dynamic tool registry base

### Next Episode
2. **Candidate #6** — Knowledge Base Explorer
   - KB tools (kb_ls, kb_tree, kb_grep, kb_glob, kb_read)
   - Folder hierarchy schema
   - Tree view frontend

### Future Episodes
3. **Candidate #7** — PII Redaction (privacy deps + pipeline)
4. **Candidate #8** — Skills & Sandbox (Docker + llm-sandbox)
5. **Candidate #9** — Advanced Tools (MCP + dynamic registry)
6. **Candidate #10** — Agent Harness (state machine + workflows)

---

*Generated: 2026-04-02*
