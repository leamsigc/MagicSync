# Candidate: Knowledge Base Explorer

## Status
`pending`

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
- Add `knowledge_folders` table (id, userId, name, parentId, path, createdAt)
- Add `folderId` to documents table
- Folder CRUD service

#### Module 2: Agent KB Tools
- `kb_ls(folder_path)` — List contents of a folder
- `kb_tree(folder_path)` — Show full tree structure
- `kb_grep(pattern, folder_path)` — Search within folder contents
- `kb_glob(pattern)` — Find files by name pattern
- `kb_read(document_id)` — Read full document content

#### Module 3: Frontend Explorer
- Tree view component for folder navigation
- Drag-and-drop document organization
- Breadcrumb navigation
- Scoped search within folders

#### Module 4: Scoped Retrieval
- Retrieval accepts optional folder scope
- Hybrid search scoped to folder subtree
- Agent uses KB tools before retrieval to narrow search

## Tech Stack Adaptation

| Reference | Our Stack |
|-----------|-----------|
| Supabase (Postgres) | Turso (libSQL) |
| React + shadcn/ui | Nuxt 4 + Vue 3 + Nuxt UI |
| FastAPI (unchanged) | FastAPI (unchanged) |

## Next Steps

1. Design knowledge_folders schema
2. Write TDD tests for KB tools
3. Implement KB tools in Python backend
4. Create folder service in DB layer
5. Build tree-view explorer frontend
