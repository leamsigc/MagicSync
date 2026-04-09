# Advanced Tool Calling & MCP Integration

## Status
`done`

## Priority
Medium

## Episode
Episode 9 (Advanced Tool Use)

## Source
Adapted from [PRD-Tool-Calls-v2.md](https://github.com/theaiautomators/claude-code-agentic-rag-series/blob/main/ep5-advanced-tool-use/PRD-Tool-Calls-v2.md)

## What It Is

Transforms the static tool system into a dynamic, scalable architecture with on-demand tool discovery, multi-tool code execution, and MCP integration.

### Before vs After

| Feature | Before | After |
|---------|--------|-------|
| Tool injection | All tools sent every request (~7K tokens) | Compact catalog + on-demand loading (~500 tokens) |
| Multi-tool workflows | N sequential tool calls (N round-trips) | Single Python script in sandbox |
| External tools | Hardcoded only | MCP servers auto-discovered |
| History reload | Tool calls grouped, panels lost | Full interleaved rendering preserved |

## Feature 1: Context Window Usage Indicator

Visual progress bar showing token consumption with color-coded thresholds.

- Real-time token counting per message
- Green (<50%), Yellow (50-80%), Red (>80%)
- Warning when approaching context limit
- Model-aware context window sizes (configurable via `LLM_CONTEXT_WINDOW`)

## Feature 2: Dynamic Tool Registry

Replace static tool injection with `tool_search`:
- Compact catalog in system prompt (~500 tokens)
- `tool_search(query)` searches by keyword/regex
- Full schema loaded on demand
- Tool categorization and tagging
- Usage analytics

**Token savings**: ~7K → ~500 tokens per request

## Feature 3: Code Mode via Sandbox Bridge

Generated Python code can call platform tools via typed stubs:
- Auto-generated Python stubs from tool schemas
- Single sandbox round-trip replaces N sequential tool calls
- Up to 98% token reduction for multi-tool workflows
- `execute_code` gains bridge access

## Feature 4: MCP Client Integration

Connect to external MCP servers:
- MCP Python SDK for stdio transport
- Auto-discover tools from MCP servers
- MCP tool execution with error handling
- Configuration: `MCP_SERVERS` env var (`name:command:args`)
- Support for GitHub, Slack, database MCP servers

## Feature 5: Chat History Interleaved Rendering

Preserve rich component state across page reloads:
- Store component state in message metadata
- Re-render A2UI components from persisted state
- Sub-agent panels, code execution state preserved
- Scroll position and expansion state persistence

## Cluster

- `packages/python-backend/app/services/tools/registry.py` — Dynamic tool registry
- `packages/python-backend/app/services/mcp/` — MCP client
- `packages/python-backend/app/api/v1/tools.py` — Extended with tool_search
- `packages/ai-tools/app/composables/` — Context window indicator
- `packages/ai-tools/app/pages/app/ai-tools/chat/` — History rendering

## Stack Adaptation

| Reference | Our Stack |
|-----------|-----------|
| Supabase | Turso (libSQL) |
| React | Nuxt 4 + Vue 3 |
| FastAPI | FastAPI (same) |
| MCP SDK | MCP Python SDK (same) |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `TOOL_REGISTRY_ENABLED` | `false` | Enable dynamic tool registry |
| `LLM_CONTEXT_WINDOW` | `128000` | Context window limit |
| `MCP_SERVERS` | — | MCP server definitions |

## New LLM Tools

| Tool | Purpose |
|------|---------|
| `tool_search` | Search tool catalog by keyword/regex, load full schemas |

## Modified Tools

| Tool | Change |
|------|--------|
| `execute_code` | Gains bridge access — sandbox code can call platform tools |

## Implementation Phases

### Phase 1: Context Window Indicator
- Token counter per message
- Visual progress bar component
- Model-aware limits

### Phase 2: Dynamic Tool Registry
- Compact tool catalog schema
- tool_search tool definition
- On-demand schema loading
- Tool categorization

### Phase 3: Sandbox Bridge
- Auto-generate Python stubs from tool schemas
- execute_code bridge access
- Security: sandboxed tool calls

### Phase 4: MCP Client
- MCP Python SDK integration
- stdio transport connection
- Tool discovery from MCP servers
- Configuration UI

### Phase 5: History Rendering
- Persist component state in message metadata
- Re-render A2UI from saved state
- Sub-agent and code execution state preservation

## Reference Links

- **Episode 5 PRD:** https://github.com/theaiautomators/claude-code-agentic-rag-series/blob/main/ep5-advanced-tool-use/PRD-Tool-Calls-v2.md
- **Episode 5 README:** https://github.com/theaiautomators/claude-code-agentic-rag-series/tree/main/ep5-advanced-tool-use
- **MCP Python SDK:** https://github.com/modelcontextprotocol/python-sdk
- **Full Series:** https://github.com/theaiautomators/claude-code-agentic-rag-series

## Python Backend Dependencies

Add to `packages/python-backend/pyproject.toml`:
```toml
[project.optional-dependencies]
mcp = [
    "mcp>=1.0.0",
    "tiktoken>=0.7.0",
]
```

## Tool Registry Service Structure (Python)

```
packages/python-backend/app/services/tools/
├── __init__.py
├── registry.py         # Dynamic tool registry with search
├── catalog.py          # Compact tool catalog generation
└── mcp_client.py       # MCP server connection and tool discovery
```

## Token Counting Implementation

```python
import tiktoken

def count_tokens(text: str, model: str = "gpt-4o") -> int:
    enc = tiktoken.encoding_for_model(model)
    return len(enc.encode(text))

def calculate_context_usage(messages: list, max_tokens: int) -> dict:
    total = sum(count_tokens(msg["content"]) for msg in messages)
    return {
        "used": total,
        "max": max_tokens,
        "remaining": max_tokens - total,
        "percentage": (total / max_tokens) * 100
    }
```

## Optimized System Prompt (for Dynamic Tools)

```
TOOLS (compact catalog — load full schemas on demand):
- retrieval: Search knowledge base (vector + keyword)
- text_to_sql: Query database with natural language
- web_search: Search the web for current info
- sub_agent: Delegate specialized tasks
- kb_ls, kb_tree, kb_grep, kb_glob, kb_read: Browse knowledge base
- tool_search: Search this tool catalog by keyword/regex

When you need a tool, call tool_search(query) first to get the full schema.
Do NOT assume tool parameters — always load the schema first.
```

---
*Adapted: 2026-03-31*
