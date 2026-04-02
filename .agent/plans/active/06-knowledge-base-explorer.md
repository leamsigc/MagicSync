# Knowledge Base Explorer

## Status
`complete`

## Priority
High

## Episode
Episode 2 of the [Claude Code Agentic RAG Series](https://github.com/theaiautomators/claude-code-agentic-rag-series)

## Cluster

- `packages/python-backend/app/services/agent/` — Agent tool registry
- `packages/python-backend/app/api/v1/` — Knowledge base API endpoints
- `packages/python-backend/app/schemas/` — KB schemas
- `packages/db/db/rag/` — Knowledge base schema (documents, folders)
- `packages/db/server/services/` — KB service layer
- `packages/ai-tools/app/pages/app/ai-tools/` — KB explorer frontend

## Problem Statement

The current RAG system treats documents as a flat collection. Users cannot navigate, browse, or explore their knowledge base hierarchically. The agent has no filesystem-like tools to discover what's available.

### Current Friction
- Documents are a flat list — no folders, no hierarchy
- Agent cannot explore what documents exist before searching
- No way to browse by topic, date, or category
- Search is query-only — no discovery mode

## Why Coupled

1. Knowledge base navigation requires changes to the document schema (adding folder/category hierarchy)
2. The agent needs new tools (`ls`, `tree`, `grep`, `glob`, `read`) that integrate with the existing tool system
3. Frontend needs a tree-view explorer component
4. Retrieval must be scoped to specific folders/categories

## Dependency Category

- Vertical: Feature spans UI → API → Service → DB schema

## Test Impact

**Currently:**
- 171 Python tests, no KB explorer tests

**After consolidation:**
- Tests for KB tools (ls, tree, grep, glob, read)
- Tests for folder hierarchy CRUD
- Tests for scoped retrieval within folders
- Tests for KB explorer frontend components

## Proposed Solution

Build filesystem-like tools that let the agent navigate a hierarchical knowledge base:

### Modules

#### Module 1: Knowledge Base Schema
- [x] Add `knowledge_folders` table (id, userId, name, parentId, path, createdAt)
- [x] Add `folderId` to documents table
- [x] Folder CRUD service

#### Module 2: Agent KB Tools
- [x] `kb_ls(folder_path)` — List contents of a folder
- [x] `kb_tree(folder_path)` — Show full tree structure
- [x] `kb_grep(pattern, folder_path)` — Search within folder contents
- [x] `kb_glob(pattern)` — Find files by name pattern
- [x] `kb_read(document_id)` — Read full document content
- [x] KB Tools API endpoints (Python backend)
- [x] Folder CRUD API endpoints (Nuxt server)
- [x] Tool executor for chat integration (keyword detection)

#### Module 3: Frontend Explorer
- [x] Tree view component for folder navigation
- [x] Drag-and-drop document organization
- [x] Breadcrumb navigation
- [x] Scoped search within folders

#### Module 4: Scoped Retrieval
- [x] Retrieval accepts optional folder scope
- [x] Hybrid search scoped to folder subtree
- [x] Agent uses KB tools before retrieval to narrow search (keyword detection + tool executor)

## Tech Stack Adaptation

| Reference | Our Stack |
|-----------|-----------|
| Supabase (Postgres) | Turso (libSQL) |
| React + shadcn/ui | Nuxt 4 + Vue 3 + Nuxt UI |
| FastAPI (unchanged) | FastAPI (unchanged) |

## Reference Links

- **Episode 2 PRD & Planning:** https://github.com/theaiautomators/claude-code-agentic-rag-series/tree/main/ep2-knowledgebase-video
- **GSD Planning Files:** https://github.com/glittercowboy/get-shit-done
- **Full Series:** https://github.com/theaiautomators/claude-code-agentic-rag-series
- **YouTube Episode:** https://www.youtube.com/playlist?list=PLmc6yUBIbca9ALRkJtz2Z4zLjkYXy1Y1n

## Python Backend Dependencies

Add to `packages/python-backend/pyproject.toml`:
```toml
# No new external deps needed - uses existing FastAPI + Turso
```

## KB Tool Implementations (Python)

Each tool goes in `packages/python-backend/app/services/tools/knowledge_base.py`:

```python
# Tool signatures for LLM function calling
tools = [
    {
        "name": "kb_ls",
        "description": "List documents and subfolders in a knowledge folder",
        "parameters": {"folder_path": "string (optional, defaults to root)"}
    },
    {
        "name": "kb_tree", 
        "description": "Show full hierarchical tree of knowledge base",
        "parameters": {"folder_path": "string (optional)"}
    },
    {
        "name": "kb_grep",
        "description": "Search for pattern within folder documents",
        "parameters": {"pattern": "string", "folder_path": "string (optional)"}
    },
    {
        "name": "kb_glob",
        "description": "Find documents matching filename pattern",
        "parameters": {"pattern": "string"}
    },
    {
        "name": "kb_read",
        "description": "Read full content of a specific document",
        "parameters": {"document_id": "string"}
    }
]
```

## Optimized System Prompt (for KB Explorer)

```
You have access to a knowledge base with hierarchical folders.
Before searching, explore the structure using kb_ls and kb_tree.
Use kb_grep to search within specific folders.
Use kb_read to examine individual documents.
Always start broad, then narrow down based on findings.
```

## Next Steps

1. Design knowledge_folders schema
2. Write TDD tests for KB tools
3. Implement KB tools in Python backend
4. Create folder service in DB layer
5. Build tree-view explorer frontend
