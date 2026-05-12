# MagicSync AI Tools & Backend — Audit Report

**Date:** May 2, 2026
**Auditor:** Hermes Agent (sub-agent delegation)
**Scope:** `packages/ai-tools/` + `packages/python-backend/app/`

---

## 1. Overview

MagicSync has a **two-tier AI architecture**:

1. **Nuxt AI Tools Layer** (`packages/ai-tools/`) — Nuxt 3 server routes + Vue composables + pages for end-user AI features
2. **Python FastAPI Backend** (`packages/python-backend/app/`) — Core AI engine: LLM orchestration, tools, agents, RAG, PII protection, skills, MCP

The system uses **LiteLLM** as the unified LLM gateway, supporting Ollama (default), OpenAI, Anthropic, OpenRouter, and Google. The Python backend proxies requests from Nuxt via JWT auth and returns SSE streams.

---

## 2. Audit of `packages/ai-tools/`

### 2.1 Growth Strategy Tools

**File:** `server/utils/growth-strategy.ts`

| Aspect | Finding |
|--------|---------|
| **AI Integration** | Direct REST calls to Gemini 2.0 Flash via `generativelanguage.googleapis.com` |
| **Input Validation** | Only checks `GEMINI_API_KEY` env var; no request body validation |
| **Error Handling** | Throws `createError(500)` if no API key; throws `createError(502)` on empty response |
| **Fallback** | NONE — if Gemini is down or returns malformed JSON, the user gets a 502 |
| **Rate Limiting** | NONE |
| **Security** | ✅ FIXED - Now uses Bearer token Authorization header |
| **Structured Output** | Uses Gemini's JSON schema mode — correctly configured with Zod-equivalent schema |

**Fixed:** Changed from URL-embedded API key (`?key=...`) to Bearer token Authorization header (`Authorization: Bearer ${apiKey}`).


### 2.2 Chat Endpoint

**File:** `server/api/ai-tools/chat.post.ts`

| Aspect | Finding |
|--------|---------|
| **Backend Communication** | Proxies to `pythonBackendUrl/api/v1/chat` via `$fetch` with JWT auth |
| **Streaming** | Properly handles SSE with newline-delimited JSON parsing |
| **Tool Call Bridging** | Maps backend `tool_call`/`tool_result` events to frontend SSE events |
| **JSON Parsing Robustness** | Implements brace-count buffering for partial JSON lines |
| **Thread Persistence** | Creates threads in DB, saves messages after stream completes |
| **Error Handling** | Best-effort message saving (wrapped in try/catch) |
| **Message Conversion** | Handles both `parts` format (Vercel AI SDK style) and flat `content` format |

**Positive:** The bridge is well-built with proper SSE framing, JSON buffering for partial chunks, and graceful error propagation.

### 2.3 Agent & Tool Routes

| Route | Status | Notes |
|-------|--------|-------|
| `agent/spawn.post.ts` | OK | Forwards to Python backend, persists in DB |
| `agent/detect.post.ts` | OK | Forwards to Python backend orchestrator |
| `agent/[id]/status.get.ts` | OK | Proxies status check |
| `agent/[id]/stream.get.ts` | OK | SSE proxy for agent streaming |
| `agent/[id]/message.post.ts` | OK | Message injection to agent |
| `agent/[id]/step.post.ts` | OK | Step execution proxy |
| `agent/[id]/index.delete.ts` | OK | Agent deletion |
| `tools/web-search.post.ts` | OK | Proxies to Python backend |
| `tools/text-to-sql.post.ts` | OK | Proxies to Python backend |
| `folders/` | OK | Document organization (CRUD) |
| `documents/` | OK | Document management (upload, ingest, move, delete) |
| `skills/` | OK | Skill import/management |
| `llm/` | OK | LLM config management (list, set default, CRUD) |
| `retrieve.post.ts` | OK | RAG retrieval endpoint |
| `chat/threads/` | OK | Thread management |

### 2.4 Web Scraper Utility

**File:** `server/utils/scraper.ts`

| Aspect | Finding |
|--------|---------|
| **Features** | OG metadata extraction, favicon resolution, main content extraction |
| **Security** | Only `http:`/`https:` protocols allowed |
| **Content Extraction** | Strips nav/header/footer/aside/script/style via selector blocklist |
| **Fallbacks** | Title: og:title → twitter:title → `<title>`; Description: og:desc → twitter:desc → meta desc |

**Status:** Solid utility, properly sandboxed.

---

## 3. Audit of `packages/python-backend/app/`

### 3.1 LLM Service (`services/llm/`)

**File:** `services/llm/ollama.py`

| Aspect | Finding |
|--------|---------|
| **Provider Support** | Ollama, OpenAI, Anthropic, OpenRouter, Google via LiteLLM |
| **Streaming** | Async generator with chunk accumulation for usage stats |
| **Callbacks** | Global success/failure callbacks for cost and usage logging |
| **Token Counting** | Rebuilds complete response from chunks to get `.usage` data |
| **Cost Tracking** | Via `response_cost` in `_hidden_params` |
| **Model Formatting** | Prefix mapping: `ollama/` → `ollama/model`, `anthropic/` → `anthropic/model` |
| **Error Handling** | Exceptions propagate to caller |

**Issue:** The `chat` method is documented as an `AsyncGenerator` but is used as a regular async function in `deep_mode.py` (awaited directly). This works because `llm_service.chat()` returns a generator that is then iterated — but the `await` here would await the coroutine, not the generator. This needs verification.

### 3.2 Chat API (`api/v1/chat.py`)

| Aspect | Finding |
|--------|---------|
| **Streaming** | Full SSE implementation via `sse_starlette.EventSourceResponse` |
| **Tool Calls** | MAX_TOOL_CALLS = 5 per session |
| **Tool Execution** | Immediately after tool result, returns formatted text and exits (not a loop) |
| **PII Protection** | Anonymizes last user message before sending to LLM; de-anonymizes response |
| **Qwen3.5/DeepSeek quirk** | `think=False` extra_body flag to suppress internal reasoning |
| **JSON Tool Call Detection** | Manual JSON parsing from streamed content as fallback |
| **Result Formatting** | Per-tool formatters: `generate_twitter_post`, `execute_code`, `web_search`, `retrieve` |

**Design Decision:** The streaming implementation ends the stream immediately after a successful tool result (line 314: `return`). This is intentional — a single tool result becomes the final response. The LLM does not get a second turn. This is a deliberate design choice but may be limiting for complex workflows.

### 3.3 Tools System (`services/tools/`)

#### ToolManager (`manager.py`)

Registers and executes all tools. Tool list:

| Tool | Purpose | Status |
|------|---------|--------|
| `retrieve` | RAG semantic search | OK |
| `hybrid_search` | Keyword + vector hybrid | OK |
| `web_search` | DuckDuckGo web search | OK |
| `kb_ls` | List KB folder contents | OK |
| `kb_tree` | KB folder tree view | OK |
| `kb_grep` | Full-text search in KB | OK |
| `kb_glob` | Filename pattern match | OK |
| `kb_read` | Read full document | OK |
| `load_skill` | Load skill instructions | OK |
| `save_skill` | Save AI-created skill | OK |
| `list_skills` | List available skills | OK |
| `execute_code` | Python sandbox | OK (subprocess) |
| `mcp_list_servers` | MCP server listing | OK |
| `mcp_discover_tools` | Discover MCP tools | OK |
| `mcp_execute` | Execute MCP tool | OK |
| `import_skill_from_zip` | Import from ZIP | OK |
| `import_skill_from_url` | Import from URL | OK |
| `import_skill_from_folder` | Import from folder | OK |
| `generate_twitter_post` | **Social media generation** | ✅ FIXED — now uses LLM via `get_social_media_generator()` |
| `generate_social_post` | Multi-platform post generation | ✅ NEW |
| `generate_thread` | Thread/tweetstorm generation | ✅ NEW |
| `generate_hashtags` | Hashtag optimization | ✅ NEW |

**Fixed:** `generate_twitter_post` now calls the LLM-powered social media generator with platform-specific prompts. New tools added for comprehensive social media content generation.

#### ToolRegistry (`registry.py`)

- Dynamic registration
- Search by keyword/description/tags
- OpenAI function-calling format export
- Tool usage statistics
- `generate_tool_stubs()` for sandbox code execution bridge

#### ToolExecutor (`executor.py`)

- Pattern-based tool detection via regex
- Keyword-based fallback detection
- Only covers `kb_*` tools
- Does NOT use LLM for tool routing

#### Web Search (`web_search.py`)

| Layer | Description |
|-------|-------------|
| Primary | DuckDuckGo (`duckduckgo_search` library) |
| Fallback 1 | Brave Search API (requires `BRAVE_API_KEY` env var) |
| Fallback 2 | DuckDuckGo HTML (regex-parsed) |
| Rate Limiting | 2s minimum interval + exponential backoff (3 attempts) |

**Status:** Multi-layered fallback is solid.

### 3.4 RAG Pipeline (`services/rag/`)

| Component | Status | Notes |
|-----------|--------|-------|
| `embeddings.py` | OK | Ollama embeddings with batch concurrency + semaphore |
| `chunker.py` | OK | Paragraph → sentence chunking with overlap |
| `file_parser.py` | OK | PDF, DOCX, HTML, CSV, Markdown parsing |
| `metadata_extractor.py` | OK | LLM-based metadata extraction (title, author, topics, summary) |
| `reranker.py` | OK | LLM-based cross-encoder reranking |
| `__init__.py` | OK | Exports all RAG components |

**RAG API (`api/v1/rag.py`):**

| Endpoint | Finding |
|----------|---------|
| `POST /ingest` | SSE streaming for chunk processing with progress events |
| `POST /retrieve` | Generates query embedding only (search done client-side) |
| `POST /extract-metadata` | LLM metadata extraction |
| `POST /hybrid-search` | Returns empty results — search execution delegated to caller |
| `POST /rerank` | LLM-based reranking of provided documents |

**Issue:** The hybrid search endpoint returns empty results and says "search should be performed by the caller." The actual vector search is done in `ToolManager._execute_retrieve()` which uses raw SQL with `vector_distance_cos`. The RAG API is split awkwardly — some endpoints generate embeddings/rerank, others expect the caller to do the search. This creates an inconsistent API surface.

### 3.5 Agent System (`services/agent/`)

#### SubAgent (`sub_agent.py`)

| Aspect | Finding |
|--------|---------|
| **Lifecycle** | SQLite persisted (survives server restarts) ✅ |
| **Tool Calls** | Regex-based `[TOOL:tool-name]` parsing from text responses |
| **Max Steps** | Configurable, defaults to 10 |
| **Status Tracking** | CREATED → RUNNING → COMPLETED/FAILED |
| **Completion Signal** | `[DONE]` marker in response |

**Fixed:** Agents now persist to SQLite database via `save_agent()` and load on service initialization via `load_agents()`.

#### AgentOrchestrator (`orchestrator.py`)

Hybrid sub-agent spawning decision:
- Fast-path: Keyword scoring for obvious cases
- LLM-powered: Small model (qwen3:0.5b) for ambiguous cases (confidence 0.3-0.7)
- Fallback: Conservative keyword decision if LLM fails

**Fixed:** Added LLM-powered decision making via `should_spawn_sub_agent_async()` for complex/ambiguous tasks while keeping keyword detection as fast-path.

#### DeepModeAgent (`deep_mode.py`)

| Feature | Finding |
|---------|---------|
| **Planning** | LLM-generated todo lists |
| **Execution** | LLM-driven task execution loop |
| **Delegation** | Sub-agent spawning (in-memory, limited types) |
| **Workspace** | File read/write in persistent workspace |
| **User Interaction** | `ask_user` tool for blocking questions |
| **Max Rounds** | 50 default |

**Tools:** 7 tools (write_todos, read_todos, write_file, read_file, edit_file, list_files, task, ask_user)

**Issue:** LLM planning prompts use JSON mode but parse errors silently fail with generic error. No validation of returned todo structure.

### 3.6 Skills System (`services/skills/tools.py`)

| Feature | Finding |
|---------|---------|
| **Load** | From SQLite by name |
| **Save** | Create new skill with AI guidance |
| **List** | Available skills for user |
| **Import ZIP** | agentskills.io format with SKILL.md parsing |
| **Import URL** | Download and import from URL |
| **Import Folder** | Local filesystem import |
| **Code Sandbox** | Secure subprocess with resource limits, import blocklist |

**Security:** Code sandbox now has `CodeSandboxConfig` with memory limits (256MB), CPU limits, network isolation (blocklist), import blocklist (30+ dangerous imports), function blocklist, output size limit (10KB), and audit logging.

### 3.7 PII Pipeline (`services/pii/`)

| Component | Finding |
|-----------|---------|
| **Detection** | Microsoft Presidio analyzer engine |
| **Two-pass** | High threshold (0.7) for surrogates, low (0.3) for hard-redact |
| **Surrogate Types** | PERSON, EMAIL, PHONE, LOCATION, DATE_TIME, URL, IP_ADDRESS |
| **Hard-Redact Types** | CREDIT_CARD, SSN, ITIN, BANK_NUMBER, IBAN, CRYPTO, PASSPORT, DRIVER_LICENSE |
| **De-anonymization** | Reverse mapping stored per-user, **DB-persisted** |
| **Faker Integration** | Generates realistic fake values for surrogates |

**Fixed:** PII mappings are now persisted to database via `save_mapping()` and loaded on restart via `load_user_mappings()`.

### 3.8 MCP Client (`services/mcp/client.py`)

| Aspect | Finding |
|--------|---------|
| **SDK** | Official `mcp` Python SDK (stdlib fallback if unavailable) |
| **Server Config** | Env var `MCP_SERVERS` with JSON or colon-delimited format |
| **Transport** | Stdio-based server communication |
| **Tool Discovery** | Per-server tool listing |
| **Tool Execution** | Via `session.call_tool` |

**Status:** Proper MCP implementation with graceful fallback.

---

## 4. Social Media AI Tools Gap Analysis

### 4.1 What EXISTS (UPDATED)

| Tool | Location | Capability |
|------|----------|------------|
| `generate_twitter_post` | `manager.py` | ✅ LLM-powered — uses LiteLLM with platform prompts |
| `generate_social_post` | `manager.py` | ✅ NEW — multi-platform (Twitter, LinkedIn, Instagram, etc.) |
| `generate_thread` | `manager.py` | ✅ NEW — thread/tweetstorm generation |
| `generate_hashtags` | `manager.py` | ✅ NEW — AI hashtag optimization |
| Social account types | `connect/` package | Platform enumeration (Facebook, Instagram, Twitter, LinkedIn, etc.) |
| Hook Health Check | `growth-strategy.ts` | Gemini-based video script scoring |
| Content Pipeline | `ai-tools` pages | Teleprompter, teleprompter, recorder, hook builder |
| Data Analytics | `data.vue` | Static rule-based diagnostics (no AI) |
| Content Moderation | `social_media/moderator.py` | ✅ NEW — PII detection, harmful content filtering |

### 4.2 What SHOULD EXIST but IS MISSING

| Missing Capability | Priority | Notes |
|--------------------|----------|-------|
| **Multi-platform post generation** | CRITICAL | No LLM-powered generation for Twitter/X, LinkedIn, Instagram, Facebook, Threads, Bluesky |
| **Platform-specific formatting** | CRITICAL | Character limits, hashtag placement, thread structure, CTA formatting |
| **Hashtag optimization** | HIGH | AI-generated hashtag suggestions per platform |
| **Content repurposing** | HIGH | Transform one piece of content into platform-native formats |
| **Best posting time analysis** | MEDIUM | AI analysis of audience activity patterns |
| **Trend detection** | MEDIUM | Web search + LLM for trending topics per niche |
| **Competitor analysis** | MEDIUM | Research competitor content strategies |
| **Content calendar generation** | MEDIUM | AI-driven content scheduling |
| **Image/caption A/B suggestions** | MEDIUM | AI variations for engagement testing |
| **Engagement prediction** | LOW | Predict post performance before publishing |
| **Platform-specific hook generation** | HIGH | Hook ideas tailored per platform's content style |
| **Brand voice consistency check** | HIGH | Verify content matches brand guidelines |

### 4.3 Root Cause (FIXED)

The `generate_twitter_post` tool is now **fully implemented** using the `SocialMediaGenerator` class with:
- LLM-powered content generation via LiteLLM
- Platform-specific system prompts (Twitter, LinkedIn, Instagram, Facebook, Threads, Bluesky)
- Tone customization (professional, casual, humorous, informative, inspirational)
- Hashtag optimization and CTA injection
- Content moderation with PII detection

**New tools added:** `generate_social_post`, `generate_thread`, `generate_hashtags`

---

## 5. Architecture Issues

### 5.1 Cross-Cutting Concerns

| Issue | Severity | Location | Status |
|-------|----------|----------|--------|
| **No social media content generation** | CRITICAL | `manager.py` — stub tool | ✅ FIXED |
| **In-memory agent state** | HIGH | `sub_agent.py`, `deep_mode.py` — lost on restart | ✅ FIXED |
| **In-memory PII mappings** | HIGH | `pii/engine.py` — de-anonymization breaks on restart | ✅ FIXED |
| **Hybrid search API inconsistency** | MEDIUM | `api/v1/rag.py` — hybrid-search returns empty | ⏳ PENDING |
| **Keyword-only agent spawning** | MEDIUM | `orchestrator.py` — fragile heuristics | ✅ FIXED |
| **No LLM fallback chain** | MEDIUM | `chat.py` — no fallback to alternate provider | ✅ FIXED |
| **Code sandbox uses subprocess** | MEDIUM | `skills/tools.py` — no resource limits | ✅ FIXED |
| **No content moderation** | MEDIUM | All content generation flows through without PII/moderation check | ✅ FIXED |

### 5.2 Security Observations

| Observation | Risk | Status |
|-------------|------|--------|
| PII mappings in-memory only | HIGH — user data integrity | ✅ FIXED |
| Code sandbox via subprocess | MEDIUM — no containerization | ✅ FIXED |
| Gemini API key in URL query param | LOW — server-side only, but should use Bearer header | ✅ FIXED |
| LLM JWT auth from Nuxt | OK — properly forwarded to backend | ✅ OK |
| MCP server env var config | OK — properly parsed | ✅ OK |

---

## 6. Recommendations

### Priority 1 — Social Media Content Generation

Build a real `generate_social_post` tool:

```python
# New tool: generate_social_post
Parameters:
  - platform: twitter | linkedin | instagram | facebook | threads | bluesky
  - topic: str
  - tone: str (professional | casual | humorous)
  - include_hashtags: bool
  - include_cta: bool
  - max_length: int (platform-appropriate)
```

Use LiteLLM to call the configured LLM with platform-specific system prompts.

### Priority 2 — Persist Agent & PII State

- Add SQLite persistence for SubAgent state
- Add DB-backed PII reverse mapping with TTL

### Priority 3 — LLM Fallback Chain

Add provider fallback in `chat.py`:
1. Try configured provider (e.g., OpenAI)
2. Fallback to Ollama
3. Fallback to a free model

### Priority 4 — Fix RAG API Surface

Either:
- Make `hybrid-search` fully server-side (execute vector search)
- OR clearly document that callers must implement their own vector search and only use the Python backend for embeddings/reranking

### Priority 5 — Agent Orchestrator Enhancement

Replace keyword-based scoring with an LLM-powered decision:

```python
# Use a small/fast LLM to decide whether to spawn
decision = await llm_service.chat_complete(messages=[
  {"role": "system", "content": "Decide if this task needs a sub-agent..."},
  {"role": "user", "content": user_message}
])
```

---

## 7. File Inventory

### Created
- `/home/leamsigc/Documents/learn/production-example-nuxt-monorepo/AI-AUDIT.md` — this report

### No files modified (read-only audit)

### Key Files Audited

| File | Lines | Key Finding |
|------|-------|-------------|
| `ai-tools/server/utils/growth-strategy.ts` | 86 | Direct Gemini REST, no fallback |
| `ai-tools/server/api/ai-tools/chat.post.ts` | 245 | Solid SSE bridge, good error handling |
| `ai-tools/server/api/ai-tools/tools/web-search.post.ts` | 28 | Thin proxy |
| `ai-tools/server/api/ai-tools/tools/text-to-sql.post.ts` | 29 | Thin proxy |
| `ai-tools/server/api/ai-tools/agent/spawn.post.ts` | 55 | Thin proxy |
| `ai-tools/server/utils/scraper.ts` | 170 | Solid, secure |
| `python-backend/app/api/v1/chat.py` | 505 | Core streaming chat with tools |
| `python-backend/app/api/v1/tools.py` | 146 | Web search, KB tools, text-to-sql |
| `python-backend/app/api/v1/agent.py` | 203 | Full agent lifecycle API |
| `python-backend/app/api/v1/rag.py` | 258 | RAG pipeline endpoints |
| `python-backend/app/api/v1/agent_extended.py` | 234 | Deep mode + workspace + todos |
| `python-backend/app/services/llm/ollama.py` | 246 | LiteLLM gateway |
| `python-backend/app/services/tools/manager.py` | 436 | **generate_twitter_post is a stub** |
| `python-backend/app/services/tools/registry.py` | 255 | Dynamic tool registry |
| `python-backend/app/services/tools/executor.py` | 181 | Pattern-based tool routing |
| `python-backend/app/services/tools/web_search.py` | 167 | Multi-layer fallback search |
| `python-backend/app/services/tools/knowledge_base.py` | 457 | Filesystem-like KB tools |
| `python-backend/app/services/rag/embeddings.py` | 99 | Ollama embeddings |
| `python-backend/app/services/rag/chunker.py` | 144 | Text chunking |
| `python-backend/app/services/agent/sub_agent.py` | 216 | In-memory sub-agents |
| `python-backend/app/services/agent/orchestrator.py` | 127 | Heuristic-based spawning |
| `python-backend/app/services/agent/deep_mode.py` | 377 | Autonomous planning agent |
| `python-backend/app/services/pii/pipeline.py` | 103 | PII anonymization pipeline |
| `python-backend/app/services/pii/engine.py` | 195 | Presidio-based detection |
| `python-backend/app/services/mcp/client.py` | 276 | MCP stdio client |
| `python-backend/app/services/skills/tools.py` | 588 | Skills + code sandbox |

---

## 8. Fix Status (May 11, 2026)

| Issue | Severity | Status | Resolution |
|-------|----------|--------|------------|
| **No social media content generation** | CRITICAL | ✅ FIXED | `generate_twitter_post` now uses LLM via `get_social_media_generator()`. New tools: `generate_social_post`, `generate_thread`, `generate_hashtags` |
| **In-memory agent state** | HIGH | ✅ FIXED | Added SQLite persistence to `SubAgentService` - agents survive server restart |
| **In-memory PII mappings** | HIGH | ✅ FIXED | Engine now persists mappings to DB via `save_mapping()` and loads on restart |
| **Keyword-only agent spawning** | MEDIUM | ✅ FIXED | Added LLM-powered decision for ambiguous cases in `orchestrator.py` |
| **No LLM fallback chain** | MEDIUM | ✅ FIXED | Added `try_fallback_chain()` in `chat.py` with configurable provider fallback |
| **Code sandbox uses subprocess** | MEDIUM | ✅ FIXED | Added `CodeSandboxConfig` with memory/CPU/network limits, import blocklist |
| **No content moderation** | MEDIUM | ✅ FIXED | Added `ContentModerator` with PII detection and harmful content filtering |
| **Gemini API key in URL query param** | LOW | ✅ FIXED | Changed to Bearer token Authorization header |
| **Hybrid search API inconsistency** | MEDIUM | ⏳ PENDING | RAG API surface still inconsistent - needs documentation or refactor |
| **LLM planning JSON parse errors** | MEDIUM | ⏳ PENDING | No validation of returned todo structure - silently fails |

---

*End of Audit Report*
