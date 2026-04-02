# Architecture Improvement Plans

This directory contains RFC candidates for deepening modules and improving codebase architecture.

## Candidates

| # | Name | Status | Priority | Source |
|---|------|--------|----------|--------|
| 1 | Social Publishing Module | `completed` | High | Architecture |
| 2 | Post Creation Flow Consolidation | `completed` | High | Architecture |
| 3 | Auth/Account Type Consolidation | `completed` | Medium | Architecture |
| 4 | API Route → Service Layer Boundary | `completed` | Medium | Architecture |
| 5 | Agentic RAG Layer | `completed` | High | Episode 1 |
| 6 | Knowledge Base Explorer | `pending` | High | Episode 2 |
| 7 | PII Redaction & Anonymization | `pending` | High | Episode 3 |
| 8 | Agent Skills & Sandbox | `pending` | High | Episode 4 |
| 9 | Advanced Tool Calling & MCP | `pending` | Medium | Episode 5 |
| 10 | Agent Harness & Workflows | `pending` | High | Episode 6 |
| 11 | Python Backend Infrastructure | `pending` | Medium | Cross-cutting |

## Current Status

**Episode 1 (Agentic RAG Layer) is complete** — 171 Python tests passing.
Modules 1-8 implemented: App Shell, Retrieval, Record Manager, Metadata, Multi-Format, Hybrid Search, Tools, Sub-Agents.

## Episode Series

Candidates 6-10 are adapted from the [Claude Code Agentic RAG Series](https://github.com/theaiautomators/claude-code-agentic-rag-series) for our stack:
- **Nuxt 4** (Vue 3) frontend (instead of React)
- **Python FastAPI** backend (same)
- **Turso (libSQL)** with native vectors (instead of Supabase/Postgres)
- **Better Auth** (instead of Supabase Auth)
- **Ollama** for local LLMs (same)

## Next Episode: Knowledge Base Explorer

The next candidate to implement is **#06: Knowledge Base Explorer** — giving the agent filesystem-like tools (ls, tree, grep, glob, read) to navigate a hierarchical knowledge base.

See `candidates/06-knowledge-base-explorer.md` for full plan.

## How to Use

1. Review candidates in `candidates/` directory
2. Each candidate has a detailed PRD adapted for our stack
3. Pick a candidate to implement by moving to `active/`
4. Execute with `/build` command

## Adding New Candidates

Run the architecture exploration to identify new candidates:
```
/improve-codebase-architecture
```

## Progress

See `PROGRESS.md` in root directory for detailed module progress.
