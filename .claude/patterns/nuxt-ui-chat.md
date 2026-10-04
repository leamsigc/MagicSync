---
name: nuxt-ui-chat
description: Migrate a bespoke chat UI onto the Nuxt UI chat kit while keeping a custom streaming backend (no AI SDK adoption)
triggers:
  - "nuxt ui chat"
  - "chat components"
  - "chatmessages"
  - "chatprompt"
edges:
  - target: context/conventions.md
    condition: when checking motion, toast, and i18n rules
last_updated: 2026-09-14
---

# Nuxt UI Chat Kit Migration

## Context

`UChatMessages`, `UChatMessage`, `UChatPrompt`, `UChatPromptSubmit`,
`UChatReasoning`, `UChatTool` work without the Vercel AI SDK: keep the
existing SSE state machine and map its messages to real `UIMessage` parts.
Precedent: `packages/site/app/pages/app/chat/index.vue`
against `useA2UIChat` (custom `/api/v1/agent/chat` SSE protocol).

## Steps

1. Map state to `UIMessage[]` in a `chatMessages` computed — never pass the
   internal model directly, it will not satisfy the `T extends UIMessage[]`
   generic and the `#content` slot loses its types:
   - text → `{ type: 'text', text, state }`
   - reasoning string → `{ type: 'reasoning', text, state }`
   - tool call records → `{ type: 'dynamic-tool', toolName, toolCallId,
     state, input, output?, errorText? }` with state from result/error
     (`input-available` while running, `output-available`,
     `output-error` when done)
2. Render with `UChatMessages :messages :status` + `#content` slot exactly
   like the docs (`isTextUIPart` / `isReasoningUIPart` /
   `isDynamicToolUIPart` from `ai`, streaming flags from
   `@nuxt/ui/utils/ai` `isPartStreaming` / `isToolStreaming`). Keep `MDC`
   for markdown — do not add `@comark/nuxt`.
3. Status is `'streaming' | 'ready'` from the local streaming flag. The
   built-in dots indicator shows while the trailing assistant message has
   no parts yet — no custom thinking row needed.
4. Prompt is `UChatPrompt v-model :placeholder :disabled @submit` with
   `UChatPromptSubmit :status @stop` in the default slot. `:disabled` only
   dims the textarea; Stop stays clickable. There is no regenerate without
   backend support — omit `@reload`.
5. `UChatMessages` is not a scroll container: it finds the nearest
   scrollable ancestor (`getScrollParent`), so keep the outer
   `overflow-y-auto` div.
6. Delete replaced bespoke components (e.g. `ToolCallCard.vue`) and update
   e2e selectors that targeted removed markup (loading dots are now
   `[data-slot="indicator"]`).

## Gotchas

- `state: 'streaming'` must apply to the trailing message only — bake it in
  during the map (`streaming && index === last`), otherwise old reasoning
  shimmers forever.
- `UChatMessage` renders `text` parts itself when no `#content` slot is
  given; providing the slot replaces that path completely (no double
  render), and user bubbles come from the kit's `user` variant (`side:
  right`, `soft`), not custom divs.
- `part.output` is `unknown`: expose it through a string-returning helper
  (`toolOutputText`) instead of interpolating directly.
- Each mapper stays ≤ 5 branches: one ternary for stream state, one loop,
  one if/else for tool-vs-text.

## Verify

- [ ] SFC parses + template compiles (vue/compiler-sfc check when eslint
      is unavailable)
- [ ] New `toolCall.*` keys exist in every locale present in `chat.json`
- [ ] No `console.*`, no dead components, no hardcoded UI strings
- [ ] Empty chat still shows welcome + suggestions; stop aborts the stream;
      tool input/output/error expand inside `UChatTool`
