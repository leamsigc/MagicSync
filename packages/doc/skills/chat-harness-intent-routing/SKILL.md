---
name: chat-harness-intent-routing
description: Route a high-confidence chat intent (create vs revise carousel, schedule, bulk) to exactly one tool by narrowing the allowlist and carrying ids structurally, never as prose. Use when a chat action calls the wrong tool, regenerates instead of editing, loses the requested target, or when adding a new bounded single-workflow intent to POST /api/v1/agent/chat.
---

# Chat harness intent routing

## When to use
A high-confidence artifact intent in chat must run through a bounded workflow
instead of the full agent catalog — and the target ids must survive. Triggers:
"regenerates instead of editing", "wrong tool", "lost the artifact", "made a new
one", or adding a new intent.

## Root-cause pattern
Two failure modes recur:

1. **One classifier for two intents.** A regex that matched both creation and
   revision verbs forced one tool (`generate_carousel`) for both — the revision
   tool was never mounted.
2. **Ids in prose.** Encoding `artifactId`/`slideIds` into the message text forces
   regex parsing and, worse, makes the model treat the id sentence as the topic.

## Steps
1. **Add a structural field to the request schema** (`ChatRequestSchema`):
   ```ts
   carouselRevision: z.object({ artifactId: z.string(), slideIds: z.array(z.string()).nullish() }).nullish()
   ```
2. **Split the classifier.** Separate creation verbs from revision signals; a
   revision is identified by the structured field, not by the word "revise" in
   free text. Keep creation detection conservative.
3. **Resolve intent to one tool** in a small pure function (`resolveCarousel`):
   revision → `['revise_carousel']`; creation → `['generate_carousel']`; else the
   caller's tools. Return the harness system prompt + the tool-context payload.
4. **Carry ids through tool context**, not the prompt: add `carouselTarget` to
   `AgentToolContext`, thread it from `chat.post.ts` → `agentRunnerService.run` →
   `createAgentToolContext`. Tools read `ctx.*`, never `toolCtx.data` for identity.
5. **Prefer the structural target in the tool** and only fall back to the model's
   own ids when the harness supplied none.
6. **Respect the budget.** `MAX_TOOLS_PER_TURN` is 7 — a harnessed tool is mounted
   through its own narrow allowlist, so don't widen `CHAT_AGENT_MOUNT`.
7. **Never silently widen scope.** If a request names a target but resolves none,
   error and ask — do not fall back to a destructive whole-object rewrite.

## Gotchas
- The client must send the structural field (`useAgentChat.sendMessage` →
  `carouselRevision`); the message text is the user's feedback only.
- `singleToolCall: true` + `maxToolCalls` bound the run; the harness prompt still
  carries `Original user request` / `Requested changes` for the model to read.
- Removing prose-only i18n keys (`revisionMessage*`) is part of the change — leave
  no dead keys.

## Verify
1. Revision targeting one slide changes only that slide (others byte-identical),
   same artifact id, version advances.
2. A whole-object request still replaces when no target is named (legitimate).
3. An ambiguous "change the slide about pricing" errors clearly.
4. `pnpm --filter @local-monorepo/agent test` passes.
