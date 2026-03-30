# Agentic RAG Layer - PRD

## Overview

Build an Agentic RAG layer for MagicSync that enables users to chat with AI, generate social media posts, conduct platform research, and extract target audiences from business documents.

## Target Users

MagicSync users who want AI-assisted social media management with:
- Natural language chat interface
- AI-powered post generation
- Document-aware audience targeting
- Full offline control (local embeddings)

---

## Requirements

### Core Features

1. **Chat Interface**
   - Threaded conversations with retrieval-augmented responses
   - Streaming responses via SSE
   - Per-user chat history (isolated)
   - Memory/facts extraction from conversations

2. **Document Ingestion**
   - Manual file upload (drag-and-drop)
   - Multi-format support: PDF, DOCX, HTML, Markdown
   - Document processing status via realtime
   - Content hashing for deduplication
   - Metadata extraction (LLM-powered)

3. **RAG Pipeline**
   - Chunking strategies (semantic, fixed-size)
   - Embedding generation (local Ollama + cloud fallback)
   - Vector storage (pgvector)
   - Hybrid search (keyword + vector + RRF)
   - Reranking
   - Multi-hop retrieval

4. **AI Skills System**
   - Dynamic skill discovery
   - Skill registry (stored in DB)
   - Pluggable tools
   - Sub-agents with isolated context

5. **Tools**
   - Generate social media post
   - Schedule post
   - Fetch trending topics (platform research)
   - Analyze target audience from documents
   - Text-to-SQL (query user data)
   - Web search fallback

6. **Social Media Integration**
   - Post creation from chat
   - Multi-platform support (existing)
   - Draft/Schedule workflow

---

## Architecture

### Stack
| Layer | Choice |
|-------|--------|
| Frontend | Nuxt 4 + TanStack AI |
| Backend | Python + FastAPI |
| Database | Turso (existing) + PostgreSQL + pgvector |
| LLM | Ollama (local) + OpenAI-compatible (cloud) |
| Embeddings | Ollama + Cloud fallback |

### Data Flow
```
User Chat → TanStack AI → Python API → Ollama/OpenAI
                                    ↓
                              RAG Pipeline
                                    ↓
                              pgvector + Postgres
```

---

## Modules

### Module 1: App Shell + Observability
- [x] Auth integration with existing Better Auth (security module with session validation)
- [x] Chat UI component (sidebar, streaming, A2UI, i18n)
- [x] Basic LLM integration (Ollama)
- [x] Streaming responses (SSE via sse-starlette)
- [x] LangSmith tracing setup

### Module 2: BYO Retrieval + Memory
- [ ] Document ingestion endpoint
- [ ] File storage (local/Postgres)
- [ ] Chunking → embedding → pgvector
- [ ] Retrieval tool
- [ ] Chat history storage (stateless)
- [ ] Realtime ingestion status

### Module 3: Record Manager
- [ ] Content hashing
- [ ] Change detection
- [ ] Incremental processing

### Module 4: Metadata Extraction
- [ ] LLM metadata extraction
- [ ] Metadata schema
- [ ] Filtered retrieval

### Module 5: Multi-Format Support
- [ ] PDF parsing
- [ ] DOCX parsing
- [ ] HTML parsing
- [ ] Markdown parsing

### Module 6: Hybrid Search & Reranking
- [ ] Keyword search (BM25)
- [ ] Vector search
- [ ] RRF fusion
- [ ] Reranking

### Module 7: Additional Tools
- [ ] Text-to-SQL tool
- [ ] Web search fallback

### Module 8: Sub-Agents
- [ ] Sub-agent detection
- [ ] Isolated context
- [ ] Nested tool display

---

## Complexity

🔴 **Complex** - This is a multi-module implementation that requires:
- Python backend development
- Vector database setup
- Multi-hop RAG implementation
- Dynamic skill system

Should be broken into sub-plans for each module.

---

## Dependencies

- Existing MagicSync codebase
- PostgreSQL with pgvector
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
