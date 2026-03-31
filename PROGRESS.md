# Progress - Agentic RAG Layer

Track your progress through the implementation. Claude Code reads this to understand where you are in the project.

## Convention
- `[ ]` = Not started
- `[-]` = In progress
- `[x]` = Completed

## Modules

### Module 1: App Shell + Observability
- [x] Auth integration with existing Better Auth
- [x] Chat UI component (sidebar, streaming, thread management)
- [x] Basic LLM integration (Ollama)
- [x] Streaming responses via SSE
- [x] LangSmith tracing setup
- [x] Chat thread CRUD wired to frontend
- [x] Chat message persistence (user + assistant)

### Module 2: BYO Retrieval + Memory
- [x] Document ingestion endpoint (SSE streaming)
- [x] File storage (local via assets pattern)
- [x] Chunking → embedding → Turso vector storage
- [x] Retrieval tool (vector similarity search)
- [x] Chat history storage (threads + messages with pagination)
- [x] Realtime ingestion status (SSE)
- [x] DB indexes for all RAG tables
- [x] FTS5 virtual table with sync triggers

### Module 3: Record Manager
- [x] Content hashing (SHA-256 per chunk via Python backend)
- [x] Change detection (compare file hash against stored hash)
- [x] Incremental processing (diff chunk hashes, insert/delete only changed)

### Module 4: Metadata Extraction
- [x] LLM metadata extraction (Python service)
- [x] Metadata schema (documents.metadata enriched with extracted fields)
- [x] Filtered retrieval (documentId and metadata key/value filters)
- [x] Structured metadata from file parser (page count, author, headings, etc.)

### Module 5: Multi-Format Support
- [x] PDF parsing (pypdf — per-page extraction with page numbers)
- [x] DOCX parsing (python-docx — heading-based section extraction)
- [x] HTML parsing (beautifulsoup4 + lxml — heading-based sections)
- [x] Markdown parsing (heading structure preservation, frontmatter extraction)
- [x] CSV parsing (row-based natural language conversion, header extraction)
- [x] JSON parsing (structured flattening, array-of-objects support)
- [x] Structured extraction API (ParsedDocument with per-page metadata)
- [x] Format-aware chunking (page numbers, section titles in chunk metadata)

### Module 6: Hybrid Search & Reranking
- [x] Keyword search (BM25 via FTS5 with sync triggers)
- [x] Vector search (cosine similarity via Turso vector_distance_cos)
- [x] RRF fusion (reciprocal rank fusion combining keyword + vector results)
- [x] Reranking (LLM-based via Python backend with local fallback)
- [x] Hybrid search endpoint (returns embedding for caller-side execution)
- [x] Concurrent batch embeddings (asyncio.gather with semaphore)

### Module 7: Additional Tools
- [x] Text-to-SQL tool (LLM generates SELECT queries with schema context, SQL validation blocks dangerous keywords)
- [x] Web search fallback (DuckDuckGo integration, returns structured results)
- [x] Tools API endpoints (/tools/text-to-sql, /tools/web-search)
- [x] Tools frontend page (Text-to-SQL and Web Search tabs with copy-to-clipboard)
- [x] A2UI action endpoint (/api/a2ui/action — forwards component clicks to LLM)
- [x] 110 Python tests passing (28 new tests for Module 7)

### Module 8: Sub-Agents
- [ ] Sub-agent detection
- [ ] Isolated context
- [ ] Nested tool display

---

## Production Upgrades Applied
- [x] Python httpx client lifecycle management (lifespan cleanup)
- [x] Auth enforcement on all Python endpoints (require_user)
- [x] Service layer consistency (all methods return ServiceResponse<T>)
- [x] Schema validation (Pydantic model validators on IngestRequest, ExtractMetadataRequest)
- [x] Frontend thread management (load, create, select, delete)
- [x] SSE stream parsing with buffering and A2UI component support
- [x] Upload accepts CSV and JSON file types
- [x] Document metadata includes structured extraction data

## Pre-RAG Work Completed
- [x] Social Publishing Module
- [x] Post Creation Flow Consolidation
- [x] Auth/Account Type Consolidation
- [x] API Route → Service Layer Boundary
