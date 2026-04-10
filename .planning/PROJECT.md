# Knowledge Base Explorer

## What This Is

A Claude Code-inspired exploration layer for a RAG application. Gives the AI agent filesystem-like tools to navigate, search, and read a hierarchical knowledge base stored in Supabase. Users organize documents into nested folders (global or personal), and the agent can explore this structure using ls, tree, grep, glob, and read tools — just like Claude Code explores codebases.

## Core Value

The agent can explore the knowledge base the same way Claude Code explores codebases — navigating folders, pattern-matching filenames, searching content, and reading specific documents.

## Requirements

### Validated

Please check to make sure the following capabilities already exist in the codebase as they are needed for this phase of the project:

- Chat interface with SSE streaming
- Document ingestion via Docling
- Hybrid search (keyword + vector with RRF fusion)
- Document analysis sub-agent (loads full document into isolated context)
- Tool calling framework
- Row-Level Security for per-user data isolation
- Supabase Auth with JWT verification
- Thread and message management
- Real-time ingestion status via Supabase Realtime

### Active

- [ ] Nested folder structure with unlimited depth
- [ ] Global folders (shared across all users) and per-user folders (private)
- [ ] Store full extracted markdown alongside chunks for grep/read operations
- [ ] `ls` tool — list files and subfolders in a given path
- [ ] `tree` tool — hierarchical structure with depth limit and truncation
- [ ] `grep` tool — regex search over document content, returns matching document names
- [ ] `glob` tool — file pattern matching against document names (e.g., `*.md`, `reports/**/*.pdf`)
- [ ] `read` tool — read full document or line range (split at newlines)
- [ ] Explorer sub-agent — orchestrates KB tools + document analysis agent for deep exploration
- [ ] Folder CRUD in ingestion UI (create, rename, delete folders)
- [ ] Move files between folders
- [ ] Move folders (with contents)
- [ ] Upload files to selected folder
- [ ] Visual indicator in UI for global vs per-user folders

### Out of Scope

- Automatic local folder scanning/import — Phase II feature, adds complexity
- Team-based folder sharing with access controls — Keep it simple: global or private only
- Real-time collaboration on folders — Not needed for current use case
- Folder-level permissions — Global folders visible to all, per-user folders private

## Context

**Existing Architecture**: 

Please check to make sure the following capabilities already exist

React/Vite frontend + FastAPI backend + Supabase (Postgres with pgvector). Documents are ingested via Docling, chunked, embedded, and stored in a database table. Currently no folder hierarchy — documents are flat per-user.

**Key Difference from Claude Code**: Claude Code greps/globs raw source files. This knowledge base has PDFs, DOCX, XLSX that need extraction first. The tools search *extracted markdown content* in Supabase, not raw files.

**Storage Model**: Documents stored in Supabase Storage bucket. Metadata and chunks in Postgres. New folder structure will be a Postgres table with parent_id for nesting. Full markdown stored alongside chunks for efficient grep/read.

**Sub-agent Pattern**: Existing sub-agent loads full document content into isolated context. Explorer sub-agent will follow similar pattern but with access to all KB tools.

## Constraints

- **Tech stack**: Must use existing Supabase infrastructure — no new databases or storage systems
- **Context window**: Tree/ls output must respect context limits — use depth limits and truncation
- **RLS**: All tools must respect Row-Level Security — users only see their folders/documents (except global)
- **Ingestion dependency**: grep/glob/read only work on ingested content, not raw uploaded files

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Store full markdown alongside chunks | Enables efficient grep/read without reconstruction | — Pending |
| Unlimited folder nesting depth | Flexibility like real filesystem | — Pending |
| Global + per-user folders (no teams) | Avoids permission complexity while enabling shared content | — Pending |
| grep returns document names only | Keeps output lightweight; use read for content | — Pending |
| tree uses depth limit + truncation | Protects context window for large KBs | — Pending |

---
*Last updated: 2026-02-04 after initialization*
