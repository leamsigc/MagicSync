# MagicSync - Agentic RAG PRD

## What We're Building

A social media scheduling platform with an **Agentic RAG layer** that enables:
1. **Chat with AI** - Natural language interface to interact with the AI agent
2. **AI-powered post generation** - Generate social media posts using AI skills
3. **Platform research** - Research specific platforms for audience engagement
4. **Document-aware AI** - AI that understands business documents to extract target audience
5. **Dynamic AI Skills** - Pluggable AI tools that can be discovered and executed at runtime

## Target Users

Social media managers, marketers, and businesses who want AI-assisted social media management with full control over their data (offline-first, BYO embeddings).

---

## Scope

### In Scope
- ✅ Agentic chat interface with streaming responses
- ✅ Document ingestion and processing (PDF, DOCX, HTML, Markdown)
- ✅ Vector search with Turso (libSQL native vectors)
- ✅ Hybrid search (keyword + vector)
- ✅ Reranking
- ✅ Metadata extraction from documents
- ✅ Record management (content hashing, deduplication)
- ✅ Multi-format support via Python backend
- ✅ Text-to-SQL tool for querying user data
- ✅ Web search fallback
- ✅ Sub-agents with isolated context
- ✅ Chat with threads and memory
- ✅ Social media post creation from chat
- ✅ Per-user data isolation (RLS)

### Out of Scope
- ❌ Knowledge graphs / GraphRAG
- ❌ Code execution / sandboxing
- ❌ Image/audio/video processing
- ❌ Fine-tuning
- ❌ Multi-tenant admin features
- ❌ Billing/payments
- ❌ Data connectors (Google Drive, SFTP, APIs, webhooks)
- ❌ Scheduled/automated ingestion (manual upload only)
- ❌ Admin UI (config via env vars)

---

## Stack

| Layer | Choice |
|-------|--------|
| Frontend | Nuxt 4 (Vue 3) + TypeScript + Tailwind + shadcn-vue |
| Backend | Python + FastAPI (for ML/RAG) |
| Database | Turso (libSQL) - single database for all data + vectors |
| Auth | Better Auth |
| LLM | Ollama (local) + OpenAI-compatible endpoints (cloud fallback) |
| AI SDK | TanStack AI |
| Embeddings | Local (Ollama) + Cloud fallback |
| Observability | LangSmith (optional) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Nuxt 4 Frontend (Port 3000)                  │
│  Chat UI │ Document Upload │ Post Composer │ Dashboard          │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP + SSE
┌────────────────────────────▼────────────────────────────────────┐
│                   Python Backend (Port 8000)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │
│  │ Ollama      │  │ RAG Engine  │  │ Skill Executor         │   │
│  │ (local)     │  │ - Chunking  │  │ - Function definitions │   │
│  │ OpenAI      │  │ - Multi-hop│  │ - Subagents            │   │
│  │ (cloud)     │  │ - Rerank   │  │ - Dynamic discovery    │   │
│  └─────────────┘  └──────┬──────┘  └─────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                        Data Layer                                │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Turso (libSQL) - SINGLE DATABASE FOR ALL                   │ │
│  │  - posts, users, business (existing)                        │ │
│  │  - document chunks + embeddings (vectors)                  │ │
│  │  - metadata, chat history                                   │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Python FS (raw documents for reference)                    │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Modules

### Module 1: App Shell + Observability
**Build:** Auth, chat UI, basic LLM integration, streaming responses, LangSmith tracing

**Learn:** Basic agent setup, streaming chat, observability basics

---

### Module 2: BYO Retrieval + Memory
**Build:** Document ingestion, file storage, chunking → embedding → Turso vectors, retrieval tool, chat history storage (stateless), realtime ingestion status

**Learn:** Chunking strategies, embeddings, vector search, tool calling, managing conversation history

---

### Module 3: Record Manager
**Build:** Content hashing, detect changes, only process what's new/modified

**Learn:** Deduplication, incremental updates, content versioning

---

### Module 4: Metadata Extraction
**Build:** LLM extracts structured metadata from documents, filter retrieval by metadata

**Learn:** Structured extraction, schema design, metadata-enhanced retrieval

---

### Module 5: Multi-Format Support
**Build:** PDF/DOCX/HTML/Markdown parsing (via Python), cascade deletes

**Learn:** Document parsing challenges, format considerations

---

### Module 6: Hybrid Search & Reranking
**Build:** Keyword + vector search, RRF combination, reranking

**Learn:** Why vector alone isn't enough, hybrid strategies, reranking

---

### Module 7: Additional Tools
**Build:** Text-to-SQL tool (query structured user data), web search fallback (when docs don't have the answer)

**Learn:** Multi-tool agents, routing between structured/unstructured data, graceful fallbacks

---

### Module 8: Sub-Agents
**Build:** Detect full-document scenarios, spawn isolated sub-agent with its own tools, nested tool call display in UI

**Learn:** Context management, agent delegation, hierarchical agent display

---

## Success Criteria

By the end, we should have:
- ✅ A working Agentic RAG application integrated with MagicSync
- ✅ Deep understanding of RAG concepts (chunking, embedding, retrieval, reranking)
- ✅ AI that understands business documents to extract target audience
- ✅ Dynamic AI skills system that can be extended
- ✅ Social media post generation from chat interface
- ✅ Platform research capabilities
- ✅ Full offline capability with local embeddings
- ✅ Observability set up from day one

---

## Current Status

See [PROGRESS.md](./PROGRESS.md) for current module status.
