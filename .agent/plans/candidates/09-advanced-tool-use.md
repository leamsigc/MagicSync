# Candidate: Advanced Tool Calling & MCP Integration

## Status
`pending`

## Priority
Medium

## Episode
Episode 5 of the [Claude Code Agentic RAG Series](https://github.com/theaiautomators/claude-code-agentic-rag-series)

## Cluster

- `packages/python-backend/app/services/tools/` — Dynamic tool registry
- `packages/python-backend/app/services/mcp/` — MCP client
- `packages/python-backend/app/api/v1/` — Tool registry endpoints
- `packages/ai-tools/app/pages/app/ai-tools/` — Tool management UI

## Problem Statement

The current tool system is static — all tools are hardcoded and injected into every LLM request. This wastes tokens, doesn't scale, and prevents connecting to external tool servers.

### Current Friction
- All 14+ tools sent in every request (~7K tokens overhead)
- No way to discover tools dynamically
- Cannot connect to external services (GitHub, Slack, databases)
- Multi-tool workflows require N sequential round-trips
- No context window usage indicator

## Why Coupled

1. Tool registry replaces the static tool injection system
2. MCP client needs to connect to external stdio/HTTP servers
3. Code sandbox bridge lets generated Python call platform tools
4. Context window indicator needs real-time token counting
5. Chat history rendering must preserve rich component state

## Dependency Category

- Cross-cutting: Affects all tool-using interactions

## Test Impact

**Currently:**
- 171 Python tests, static tool usage

**After consolidation:**
- Tests for dynamic tool registry (search, load, execute)
- Tests for MCP client connection and tool discovery
- Tests for sandbox bridge (Python → platform tools)
- Tests for context window usage calculation
- Tests for chat history rich rendering

## Proposed Solution

Transform the static tool system into a dynamic, scalable architecture:

### Modules

#### Module 1: Context Window Indicator
- Real-time token counting per message
- Visual progress bar with color-coded thresholds (green/yellow/red)
- Warning when approaching context limit
- Model-aware context window sizes

#### Module 2: Dynamic Tool Registry
- `tool_search(query)` — Search compact tool catalog by keyword/regex
- On-demand tool schema loading (~500 tokens vs ~7K)
- Tool categorization and tagging
- Tool usage analytics

#### Module 3: Code Mode via Sandbox Bridge
- Generated Python code can call platform tools via typed stubs
- Single sandbox round-trip replaces N sequential tool calls
- Up to 98% token reduction for multi-tool workflows
- Auto-generated Python stubs from tool schemas

#### Module 4: MCP Client Integration
- Connect to external MCP servers (stdio transport)
- Auto-discover tools from MCP servers
- MCP tool execution with error handling
- Configuration for MCP server definitions
- Support for GitHub, Slack, database MCP servers

#### Module 5: Chat History Interleaved Rendering
- Preserve rich component state (sub-agents, code execution) across reloads
- Store component state in message metadata
- Re-render A2UI components from persisted state
- Scroll position and expansion state persistence

## Tech Stack Adaptation

| Reference | Our Stack |
|-----------|-----------|
| Supabase | Turso (libSQL) |
| React | Nuxt 4 + Vue 3 |
| MCP Python SDK | Same |
| FastAPI | Same |

## Next Steps

1. Implement token counter and context window indicator
2. Design tool registry schema (compact catalog + on-demand loading)
3. Write TDD tests for tool_search
4. Implement sandbox bridge for Python → tool calls
5. Integrate MCP Python SDK
6. Build tool management UI
