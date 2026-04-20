# Phase 260410-kod Context

**Created:** 2026-04-10  
**Project:** MagicSync - Make Chat API More Transparent (Pass-Through)

---

## Feature Overview

Simplify the chat API to pass through Python response types directly without adding wrapper chunks, and use custom message types instead of UIMessage from ai package.

---

## Decisions Made

### 1. Chunk Types (LOCKED)
Python returns these SSE chunk types → pass through directly:
- `thinking` - Reasoning content
- `text` - Text content  
- `tool_call` - Tool invocation request
- `tool_result` - Tool execution result
- `error` - Error message
- `done` - Stream termination (REMOVE `finish`)

**Decision:** Remove `finish` chunk type. Use only `done` for stream termination.

### 2. Error Detection (LOCKED)
**Old approach:** Check for `[Tool Error:` prefix in result string
```typescript
const isError = resultStr?.includes('[Tool Error:')
```

**New approach:** Python service provides explicit `error` field in tool_result
```typescript
interface ToolResult {
  id: string
  tool_call?: { name: string; arguments: string }
  result: string
  error?: string  // NEW: dedicated error field
}
```

### 3. Frontend Message Types (LOCKED)
Custom `ChatMessage` type is already in place:
```typescript
interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoningContent?: string
  toolCalls?: Array<{
    id: string
    name: string
    args: Record<string, unknown>
    result?: string
    error?: string
  }>
}
```

### 4. ID Correlation (LOCKED)
- `tool_call` generates ID via `generateId()`
- `tool_result` uses ID from Python backend (`data.tool_result.id`)
- Frontend matches tool calls and results via ID

---

## Files to Modify

| File | Status | Changes |
|------|--------|---------|
| `packages/ai-tools/server/api/ai-tools/chat.post.ts` | Modified | Remove `finish` chunk, use `done` only |
| `packages/ai-tools/app/pages/app/ai-tools/chat/composables/useA2UIChat.ts` | To update | Handle dedicated error field, remove `finish` handling |

---

## Gray Areas (RESOLVED)

| Area | Decision | Rationale |
|------|----------|-----------|
| Error detection | Use dedicated `error` field | Cleaner than string parsing |
| Stream termination | Just `done` | Simpler than dual `done`/`finish` |
| ID correlation | Backend provides IDs | Maintains traceability |

---

## Out of Scope

- Changes to Python service (handled separately)
- UIMessage type usage (explicitly replaced with custom type)
- Additional chunk types (keep existing 6)

---

## Verification

1. Send chat message → verify response streams
2. Check browser console for type errors
3. Verify thread history loads correctly
4. Verify tool calls/results correlate via ID
5. Verify no `finish` chunk is sent

---

*Context created: 2026-04-10*