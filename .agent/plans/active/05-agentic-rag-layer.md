# Agentic RAG Layer - Implementation Plan

## Overview

Build an Agentic RAG layer for MagicSync that enables users to chat with AI, generate social media posts, conduct platform research, and extract target audiences from business documents.

## Target Users

MagicSync users who want AI-assisted social media management with:
- Natural language chat interface
- AI-powered post generation
- Document-aware audience targeting
- Full offline control (local embeddings)

---

## Architecture

### Stack
| Layer | Choice |
|-------|--------|
| Frontend | Nuxt 4 + Vue 3 Composition API |
| Backend | Python FastAPI + Nuxt server routes |
| Database | Turso (libSQL) with native vector support |
| LLM | Ollama (local) |
| Embeddings | Ollama mxbai-embed-large (local) |

### Data Flow
```
User Chat → Nuxt API → Python FastAPI → Ollama
    ↓              ↓
  Turso       RAG Pipeline
(chunks)    (parse→chunk→embed)
```

---

## Modules

### Module 1: App Shell + Observability
- [x] Auth integration with existing Better Auth (require_user enforced on all Python endpoints)
- [x] Chat UI component (sidebar, streaming, thread management, A2UI renderer)
- [x] Basic LLM integration (Ollama via httpx)
- [x] Streaming responses (SSE via sse-starlette)
- [x] LangSmith tracing setup
- [x] Chat thread CRUD wired to frontend (load, create, select, delete)
- [x] Chat message persistence (user + assistant saved via chatService)
- [x] A2UI action endpoint (`/api/a2ui/action` — forwards component button clicks to LLM)

### Module 2: BYO Retrieval + Memory
- [x] Document ingestion endpoint (SSE streaming with real-time progress)
- [x] File storage (local disk via assets pattern)
- [x] Chunking → embedding → Turso vector storage (vector32 + vector_distance_cos)
- [x] Retrieval tool (cosine similarity search)
- [x] Chat history storage (chat_threads + chat_messages tables)
- [x] Realtime ingestion status (SSE)
- [x] DB indexes for all RAG tables (migration 0006: documents, chunks, threads, messages)
- [x] FTS5 virtual table with INSERT/UPDATE/DELETE sync triggers (migration 0006)

### Module 3: Record Manager
- [x] Content hashing (SHA-256 per chunk via Python chunker)
- [x] Change detection (compare file hash against stored hash, skip if unchanged)
- [x] Incremental processing (diff chunk hashes, insert/delete only changed)

### Module 4: Metadata Extraction
- [x] LLM metadata extraction (Python extract_metadata via chat_complete())
- [x] Metadata schema (documents.metadata enriched with extracted fields)
- [x] Filtered retrieval (documentId + metadata key/value filters via json_extract)
- [x] Structured metadata from file parser (page count, author, headings, PDF metadata)

### Module 5: Multi-Format Support (Production-Grade)
- [x] PDF parsing (pypdf — per-page extraction with page numbers and PDF metadata)
- [x] DOCX parsing (python-docx — heading-based section extraction)
- [x] HTML parsing (beautifulsoup4 + lxml — heading-based sections, noise removal)
- [x] Markdown parsing (heading structure preservation, YAML frontmatter extraction)
- [x] CSV parsing (row-based natural language conversion, header extraction)
- [x] JSON parsing (structured flattening, array-of-objects support)
- [x] Structured extraction API (ParsedDocument with per-page metadata)
- [x] Format-aware chunking (page numbers, section titles preserved in chunk metadata)

### Module 6: Hybrid Search & Reranking
- [x] Keyword search (BM25 via FTS5 with sync triggers)
- [x] Vector search (cosine similarity via Turso vector_distance_cos)
- [x] RRF fusion (reciprocal rank fusion combining keyword + vector results)
- [x] Reranking (LLM-based via Python /rerank endpoint with local fallback)
- [x] Concurrent batch embeddings (asyncio.gather with semaphore, sequential retry)
- [x] Hybrid search endpoint (generates query embedding for caller-side execution)

### Module 7: Additional Tools
- [x] Text-to-SQL tool (LLM generates SELECT queries from natural language, full MagicSync schema context, SQL safety validation)
- [x] Web search fallback (DuckDuckGo integration, returns structured results)
- [x] Tools API endpoints (/tools/text-to-sql, /tools/web-search, /tools/text-to-sql/validate)
- [x] Tools frontend page (Text-to-SQL and Web Search tabs)
- [x] A2UI action endpoint (/api/a2ui/action)
- [x] 110 Python tests passing (all previous + 28 new Module 7 tests)

### Module 8: Sub-Agents
- [x] Sub-agent detection (orchestrator with keyword/confidence scoring)
- [x] Isolated context (SubAgentService with per-agent message history)
- [x] Nested tool display (SubAgentRenderer component with expandable steps)
- [x] Sub-agent API endpoints (spawn, step, stream, message, status, delete, detect)
- [x] Agent sessions DB schema and service layer
- [x] 171 Python tests passing (61 new Module 8 tests)

---

## Production Quality Applied

### Python Backend
- [x] httpx client lifecycle management (lifespan cleanup on shutdown)
- [x] Auth enforcement on all endpoints (require_user dependency)
- [x] Schema validation (Pydantic model validators)
- [x] Concurrent batch embeddings (semaphore-limited with retry)
- [x] Structured extraction returns ParsedDocument with page metadata
- [x] All 171 tests passing

### Database Layer
- [x] All service methods return ServiceResponse<T> (no void returns)
- [x] Chat message pagination support (limit parameter)
- [x] SearchService.rerank supports LLM-based reranking via Python backend
- [x] Indexes on all foreign keys and common query patterns
- [x] FTS5 virtual table with automatic sync triggers

### Frontend
- [x] Thread management fully wired (load, create, select, delete)
- [x] Messages persisted to database (user + assistant)
- [x] A2UI action endpoint created (/api/a2ui/action)
- [x] SSE stream parsing with buffering
- [x] Upload accepts CSV and JSON file types
- [x] Real-time ingestion progress display

---

## Dependencies

- Existing MagicSync codebase
- Turso (libSQL) with vector support
- Ollama (local inference)
- Python FastAPI

---

## Out of Scope

- Knowledge graphs
- Code execution
- Image/audio/video processing
- Automated ingestion pipelines
- Admin UI
- Billing/payments
