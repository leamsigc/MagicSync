# Quick Task 260410-kod: Make Chat API More Transparent

**Date:** 2026-04-10  
**Status:** Completed

## Summary

Simplified the chat API to pass through Python response directly and replaced UIMessage from the `ai` package with custom message types in the frontend.

## Changes Made

### 1. API Changes (`packages/ai-tools/server/api/ai-tools/chat.post.ts`)

- Removed wrapper chunks (`reasoning-start`, `reasoning-delta`, `reasoning-end`, `text-start`, `text-delta`, `text-end`)
- Simplified chunk types to match Python response directly:
  - `thinking` - reasoning content from the model
  - `text` - text content from the model  
  - `tool` - tool call request
  - `tool_result` - tool execution result
  - `error` - error messages
  - `done` - stream completed
- **Removed `finish` chunk** - only `done` used for stream termination
- Each chunk now includes an `id` field for correlation instead of start/delta/end pattern

### 2. Frontend Changes (`packages/ai-tools/app/pages/app/ai-tools/chat/composables/useA2UIChat.ts`)

- Removed dependency on `@ai-sdk/vue` and `Chat` class from `ai` package
- Created custom `ChatMessage` interface with fields:
  - `id`, `role`, `content`, `parts`, `reasoningContent`, `toolCalls`
- Implemented custom SSE stream handling with `fetch` + `ReadableStream`
- Handles only `done` for stream termination (not `finish`)
- Returns `messages`, `isStreaming`, and `sendMessage` instead of `chat` object

### 3. Template Changes (`packages/ai-tools/app/pages/app/ai-tools/chat/index.vue`)

- Updated to use new composable API (`messages`, `isStreaming`, `sendMessage`)
- Custom rendering for message parts using `isReasoningPart`, `isToolPart`, `isTextPart` helpers
- Removed `UChatMessages`, `UChatPrompt` components that depend on `ai` package types

## Benefits

1. **More transparent** - API now passes through chunk types that match the Python backend directly
2. **More control** - Custom message types give full control over rendering
3. **Simpler** - Removed unnecessary wrapper chunks (start/delta/end pattern)
4. **Single termination** - Only `done` used for stream end (removed redundant `finish`)
5. **No UIMessage dependency** - Frontend no longer relies on rigid `UIMessage` type from `ai` package

## Files Modified

- `packages/ai-tools/server/api/ai-tools/chat.post.ts` (~220 lines)
- `packages/ai-tools/app/pages/app/ai-tools/chat/composables/useA2UIChat.ts` (~357 lines)
- `packages/ai-tools/app/pages/app/ai-tools/chat/index.vue` (~160 lines)