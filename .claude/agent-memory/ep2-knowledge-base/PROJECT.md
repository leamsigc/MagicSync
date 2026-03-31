# Episode 2: Knowledge Base Explorer — Project Definition

## What This Is

A Claude Code-inspired exploration layer for MagicSync's RAG system. Gives the AI agent filesystem-like tools to navigate, search, and read a hierarchical knowledge base stored in Turso. Users organize documents into nested folders (global or personal), and the agent can explore this structure using `ls`, `tree`, `grep`, `glob`, and `read` tools — just like Claude Code explores codebases.

## Core Value

The agent can explore the knowledge base the same way Claude Code explores codebases — navigating folders, pattern-matching filenames, searching content, and reading specific documents.

## Source

Adapted from [claude-code-agentic-rag-series Episode 2](https://github.com/theaiautomators/claude-code-agentic-rag-series/tree/main/ep2-knowledgebase-video) for our Nuxt 4 + FastAPI + Turso stack.

## Validated Prerequisites

These already exist in our codebase:

- [x] Chat interface with SSE streaming
- [x] Document ingestion via Python backend (multi-format: PDF, DOCX, HTML, Markdown, CSV, JSON)
- [x] Hybrid search (keyword + vector with RRF fusion)
- [x] Sub-agent system (Module 8 complete)
- [x] Tool calling framework (text-to-sql, web-search)
- [x] Row-Level Security via Better Auth + service layer
- [x] Thread and message management
- [x] Real-time ingestion status via SSE

## Active Requirements

- [ ] Nested folder structure with unlimited depth
- [ ] Global folders (shared across all users) and per-user folders (private)
- [ ] Store full extracted markdown alongside chunks for grep/read operations
- [ ] `kb_ls` tool — list files and subfolders in a given path
- [ ] `kb_tree` tool — hierarchical structure with depth limit and truncation
- [ ] `kb_grep` tool — regex search over document content, returns matching document names
- [ ] `kb_glob` tool — file pattern matching against document names (e.g., `*.md`, `reports/**/*.pdf`)
- [ ] `kb_read` tool — read full document or line range (split at newlines)
- [ ] Explorer sub-agent — orchestrates KB tools + document analysis agent for deep exploration
- [ ] Folder CRUD in knowledge base UI (create, rename, delete folders)
- [ ] Move files between folders
- [ ] Move folders (with contents)
- [ ] Upload files to selected folder
- [ ] Visual indicator in UI for global vs per-user folders

## Out of Scope

- Automatic local folder scanning/import
- Team-based folder sharing with access controls
- Real-time collaboration on folders
- Folder-level permissions (global = all users, per-user = private only)

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Store full markdown alongside chunks | Enables efficient grep/read without reconstruction | Pending |
| Unlimited folder nesting depth | Flexibility like real filesystem | Pending |
| Global + per-user folders (no teams) | Avoids permission complexity while enabling shared content | Pending |
| grep returns document names only | Keeps output lightweight; use read for content | Pending |
| tree uses depth limit + truncation | Protects context window for large KBs | Pending |
| Turso adjacency list (parent_id) | Standard pattern for hierarchical data in SQLite | Pending |
| FTS5 for grep content search | Leverages existing FTS infrastructure from Module 6 | Pending |

## Constraints

- **Tech stack**: Must use existing Turso + FastAPI + Nuxt infrastructure
- **Context window**: Tree/ls output must respect context limits — use depth limits and truncation
- **Auth**: All tools must respect user scoping — users only see their folders/documents (except global)
- **Ingestion dependency**: grep/glob/read only work on ingested content, not raw uploaded files
- **Existing schema**: Documents table already exists — add folder_id as nullable foreign key

## Stack Adaptation

| Reference Repo | Our Stack |
|----------------|-----------|
| Supabase (Postgres + pgvector) | Turso (libSQL) + Drizzle ORM |
| React + shadcn/ui | Nuxt 4 + Vue 3 + Nuxt UI |
| FastAPI (unchanged) | FastAPI (unchanged) |
| Supabase Auth | Better Auth |
| Supabase Storage | Local filesystem (existing pattern) |
| Supabase Realtime | SSE (existing pattern) |

---
*Last updated: 2026-03-31*
