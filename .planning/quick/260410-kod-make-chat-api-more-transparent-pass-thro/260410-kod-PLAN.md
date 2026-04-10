---
phase: 260410-kod
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/ai-tools/server/api/ai-tools/chat.post.ts
  - packages/ai-tools/app/pages/app/ai-tools/chat/composables/useA2UIChat.ts
autonomous: true
requirements: []
user_setup: []
must_haves:
  truths:
    - "API passes through Python response types directly without adding wrapper chunks (reasoning-start/end, text-start/end)"
    - "Frontend uses custom message types instead of UIMessage from ai package"
  artifacts:
    - path: "packages/ai-tools/server/api/ai-tools/chat.post.ts"
      provides: "Chat API with transparent pass-through"
      min_lines: 180
    - path: "packages/ai-tools/app/pages/app/ai-tools/chat/composables/useA2UIChat.ts"
      provides: "Frontend chat with custom message types"
      min_lines: 140
  key_links:
    - from: "chat.post.ts (API)"
      to: "useA2UIChat.ts (Frontend)"
      via: "SSE response"
      pattern: "data:.*type.*\n"
---

<objective>
Make chat API more transparent by passing through Python response directly and using custom message types instead of UIMessage from ai package.

Purpose: Reduce transformation complexity in the API layer and give frontend more control over message rendering by using custom types instead of the rigid UIMessage structure.
Output: Simplified chat API + frontend using custom message types
</objective>

<execution_context>
@$HOME/.config/opencode/get-shit-done/workflows/quick-plan.md
</execution_context>

<context>
# Current flow:
# 1. Python returns SSE: {type: 'thinking'|'text'|'tool_call'|'tool_result'|'error'|'done', content/data}
# 2. API transforms to: {type: 'reasoning-start|reasoning-delta|text-start|text-delta|tool-call|tool-result|error|finish', ...}
# 3. Frontend uses UIMessage (ai package) with strict typing

# Desired flow:
# 1. Python returns SSE (keep as is)
# 2. API passes through with MINIMAL to NO transformation - just forward the chunk directly
# 3. Frontend uses custom message types
</context>

<tasks>

<task type="auto">
  <name>Task 1: Simplify chat API to pass through Python response directly</name>
  <files>packages/ai-tools/server/api/ai-tools/chat.post.ts</files>
  <action>
    Simplify the SSE transformation in chat.post.ts to pass through Python chunks directly:
    
    1. Remove reasoning-start/reasoning-delta/reasoning-end wrapper chunks - just emit 'thinking' chunk directly
    2. Remove text-start/text-delta/text-end wrapper chunks - just emit 'text' chunk directly  
    3. Keep tool-call, tool-result, error, and done types but simplify to pass through
    4. The key insight: remove the start/delta/end chunk pattern and just emit chunks as-is with 'id' for tracing
    
    Current transformation to remove:
    - reasoning-start → just emit thinking with id
    - reasoning-delta → merge into single thinking chunk
    - reasoning-end → remove, not needed
    - text-start/text-delta/text-end → just emit text with id
    
    New simplified approach:
    - For each chunk type, emit directly with id field for correlation: {type: 'thinking'|'text'|'tool'|'tool_result'|'error'|'done', id, content/data}
    - This keeps the same chunk types from Python but removes the unnecessary start/delta/end wrapper pattern
  </action>
  <verify>
    <automated>TypeScript syntax check: npx tsc --noEmit --skipLibCheck packages/ai-tools/server/api/ai-tools/chat.post.ts 2>&1 | head -20</automated>
  </verify>
  <done>API emits chunks with types directly matching Python response types (thinking, text, tool, tool_result, error, done) without wrapper chunks</done>
</task>

<task type="auto">
  <name>Task 2: Update frontend to use custom message types instead of UIMessage</name>
  <files>packages/ai-tools/app/pages/app/ai-tools/chat/composables/useA2UIChat.ts</files>
  <action>
    Update useA2UIChat.ts to use custom message types:
    
    1. Create custom message type interface that mirrors the SSE chunk structure:
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
    
    2. Replace UIMessage import with custom type definition in the composable
    3. Update DefaultChatTransport<ChatMessage> instead of DefaultChatTransport<UIMessage>
    4. Update Chat<ChatMessage> instead of Chat<UIMessage>
    5. Update loadThreadMessages to construct ChatMessage instead of UIMessage
    
    Key: The custom type should be simpler and more flexibile than UIMessage - just capture what's needed for rendering
  </action>
  <verify>
    <automated>TypeScript syntax check: npx tsc --noEmit --skipLibCheck packages/ai-tools/app/pages/app/ai-tools/chat/composables/useA2UIChat.ts 2>&1 | head -20</automated>
  </verify>
  <done>Frontend uses custom ChatMessage type instead of UIMessage from ai package</done>
</task>

</tasks>

<verification>
[Manual verification after implementation]
- Send a chat message and verify response streams correctly
- Check browser console for any type errors
- Verify thread history loads correctly
</verification>

<success_criteria>
- API passes through Python chunks with minimal transformation (same types, no wrapper chunks)
- Frontend uses custom message types that are simpler than UIMessage
- Chat functionality works end-to-end
</success_criteria>

<output>
After completion, create `.planning/quick/260410-kod-make-chat-api-more-transparent-pass-thro/260410-kod-SUMMARY.md`
</output>