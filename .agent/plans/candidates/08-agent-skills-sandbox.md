# Candidate: Agent Skills & Code Execution Sandbox

## Status
`pending`

## Priority
High

## Episode
Episode 4 of the [Claude Code Agentic RAG Series](https://github.com/theaiautomators/claude-code-agentic-rag-series/tree/main/ep4-skills-sandbox-video)

## Source
Adapted from [PRD-Skills-Sandbox.md](https://github.com/theaiautomators/claude-code-agentic-rag-series/blob/main/ep4-skills-sandbox-video/PRD-Skills-Sandbox.md)

## What It Is

Transforms the AI agent into a customizable platform with reusable skills, file attachments, and sandboxed code execution. Users teach the AI specialized behaviors. The AI can execute Python to generate files, process data, and run computations.

## Feature 1: Agent Skills

### Progressive Discovery Pattern
1. **Lightweight catalog in system prompt** — Name + short description per skill (cheap on tokens)
2. **On-demand loading** — LLM calls `load_skill` when query matches a skill description
3. **Anti-speculation guardrail** — System prompt prevents unnecessary tool calls

### Skill Properties
| Property | Description |
|----------|-------------|
| name | Lowercase, hyphenated (e.g., `analyzing-sales-data`) |
| description | 1-2 sentences — what it does AND when to use |
| instructions | Full markdown, loaded on demand |
| enabled | Toggle for discovery visibility |
| isGlobal | Private vs shared with all users |

### Three Creation Paths
1. **Create with AI** — Skill-creator skill guides the user conversationally
2. **Create Manually** — Form dialog with validated fields
3. **Import from File** — ZIP in agentskills.io open standard format

### LLM Tools
| Tool | Purpose |
|------|---------|
| `load_skill` | Fetch full instructions on demand |
| `save_skill` | Persist new skill from AI-guided creation |
| `read_skill_file` | Read content of attached file |

## Feature 2: Skill Building-Block Files

Skills can have files attached — Python scripts, templates, data files, fonts. Stored in dedicated storage, loaded on demand, not indexed for RAG.

## Feature 3: Code Execution Sandbox

### Technical Approach
- **Runtime**: Docker containers using `llm-sandbox` library
- **Session persistence**: IPython kernel, variables survive across calls within a thread (TTL 30min)
- **Streaming**: stdout/stderr via SSE events
- **File output**: Generated files uploaded to storage, served via signed URLs
- **Feature flag**: `SANDBOX_ENABLED=false` by default
- **Security**: Blocks subprocess, os.system, socket, ctypes, filesystem outside sandbox

### Custom Docker Image
| Category | Packages |
|----------|----------|
| Documents | python-pptx, python-docx, openpyxl, fpdf2 |
| Data | pandas, numpy |
| Visualization | matplotlib, pillow |
| Web | requests, beautifulsoup4 |

### LLM Tool
| Tool | Purpose |
|------|---------|
| `execute_code` | Run Python in sandboxed container |

### SSE Events
`code_execution_start` → `code_stdout` (streaming) → `code_stderr` (streaming) → `code_execution_complete`

## Feature 4: Skills Open Standard

Export/import skills as ZIP using agentskills.io format:
```
skill-name/
  SKILL.md      # YAML frontmatter + markdown instructions
  scripts/      # Code files
  references/   # Text/document files
  assets/       # Binary/media files
```

## Feature 5: Persistent Tool Memory

Tool call results persisted across conversation turns. Reconstructed on load so AI can reference previous tool outputs without re-executing.

## Cluster

- `packages/python-backend/app/services/skills/` — Skill registry, file management
- `packages/python-backend/app/services/sandbox/` — Docker code execution
- `packages/python-backend/app/api/v1/skills.py` — Skills endpoints
- `packages/python-backend/app/api/v1/sandbox.py` — Sandbox endpoints
- `packages/db/db/skills/` — skills, skill_files, code_executions, sandbox_files tables
- `packages/db/server/services/skill.service.ts` — Skills CRUD
- `packages/ai-tools/app/pages/app/ai-tools/skills/` — Skills management UI

## Stack Adaptation

| Reference | Our Stack |
|-----------|-----------|
| Supabase Storage | Local filesystem |
| React | Nuxt 4 + Vue 3 |
| FastAPI | FastAPI (same) |
| Docker sandbox | Docker + llm-sandbox (same) |
| Supabase Auth | Better Auth |

## New LLM Tools

| Tool | Purpose |
|------|---------|
| `load_skill` | Fetch full instructions when query matches |
| `save_skill` | Persist new skill from AI creation |
| `read_skill_file` | Read attached file content |
| `execute_code` | Run Python in sandboxed Docker container |

## Implementation Phases

### Phase 1: Skills Schema & CRUD
- skills table (id, userId, name, description, instructions, enabled, isGlobal)
- skill_files table (id, skillId, filename, content, mimeType)
- SkillService CRUD with global/private support
- API endpoints (REST)

### Phase 2: Skill Tools
- load_skill, save_skill tool definitions
- Progressive discovery in system prompt
- Skill-creator global skill

### Phase 3: Skill Files
- File upload/download to skill
- read_skill_file tool
- File preview in UI

### Phase 4: Code Sandbox
- Docker container management
- execute_code tool with session persistence
- SSE streaming for stdout/stderr
- File generation + signed URLs
- Security policy

### Phase 5: Open Standard
- SKILL.md parser/generator
- ZIP export with file categorization
- ZIP import with validation

### Phase 6: Persistent Tool Memory
- Store tool results in message metadata
- Reconstruct on conversation load

### Phase 7: Frontend
- Skills page (list, editor, file management)
- Code execution panel in chat
- Import/export UI

## Reference Links

- **Episode 4 PRD:** https://github.com/theaiautomators/claude-code-agentic-rag-series/blob/main/ep4-skills-sandbox-video/PRD-Skills-Sandbox.md
- **Episode 4 README:** https://github.com/theaiautomators/claude-code-agentic-rag-series/tree/main/ep4-skills-sandbox-video
- **llm-sandbox:** https://github.com/agentica-project/llm-sandbox
- **agentskills.io format:** https://agentskills.io
- **Full Series:** https://github.com/theaiautomators/claude-code-agentic-rag-series

## Python Backend Dependencies

Add to `packages/python-backend/pyproject.toml`:
```toml
[project.optional-dependencies]
sandbox = [
    "llm-sandbox>=0.1.0",
    "docker>=7.0.0",
    "python-pptx>=0.6.23",
    "openpyxl>=3.1.0",
    "fpdf2>=2.7.0",
    "pandas>=2.2.0",
    "numpy>=1.26.0",
    "matplotlib>=3.8.0",
    "pillow>=10.0.0",
    "requests>=2.31.0",
    "beautifulsoup4>=4.12.0",
]
```

## Sandbox Service Structure (Python)

```
packages/python-backend/app/services/sandbox/
├── __init__.py
├── container.py        # Docker container lifecycle
├── session.py          # IPython kernel session management
├── executor.py         # Code execution with streaming
├── security.py         # Blocked modules, filesystem restrictions
└── file_manager.py     # File upload/download from sandbox
```

## Custom Dockerfile for Sandbox

```dockerfile
FROM python:3.11-slim
RUN pip install pandas numpy matplotlib pillow requests beautifulsoup4 \
    python-pptx python-docx openpyxl fpdf2 ipython
WORKDIR /sandbox
```

## Optimized System Prompt (for Skills & Sandbox)

```
You have access to reusable skills and a code execution sandbox.

SKILLS:
- Use load_skill(name) when a query matches a skill's description
- Skills contain specialized instructions and reference files
- After loading, follow the skill's instructions precisely
- Do NOT call load_skill speculatively

CODE EXECUTION:
- Use execute_code(python_code) for data processing, file generation, computations
- Code runs in an isolated Docker container with IPython
- Variables persist across calls within the same conversation
- Generated files are available via signed URLs
- You can import: pandas, numpy, matplotlib, requests, bs4, python-docx, openpyxl, pptx
- Do NOT use: subprocess, os.system, socket, ctypes
```

---
*Adapted: 2026-03-31*
