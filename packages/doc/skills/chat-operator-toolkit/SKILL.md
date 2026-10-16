---
name: chat-operator-toolkit
description: Add a new capability to the chat operator toolkit — write the tool, register it in the bag and catalog, and mount it where the turn budget allows. Use when the chat should be able to do something it currently cannot (media, templates, stats, calendar, business edits, bulk actions), or when a new tool "is not reachable".
---

# Chat operator toolkit

## When to use
The chat should operate a backend capability it currently cannot, or a newly
added tool is not reachable by any model turn.

## Steps
1. **Wrap a service, never a query.** New tool modules live in
   `packages/agent/server/agent/tools/*.tools.ts`. Import the existing service
   (`assetService`, `businessProfileService`, `postService`, `analyticsService`,
   `templateService`, `directScheduleService`). Identity comes from `ctx`, not
   `toolCtx.data`.
2. **Return through the shared envelope.** `toolResult(payload)` on success,
   `toolError(code, message)` on failure — one `toolFailure` binding per module
   with a domain prefix.
3. **Keep descriptions ≤ 140 chars** (`MAX_DESCRIPTION_CHARS`).
4. **Register in three places**: the module's `create*Tools`, `tools/index.ts`
   (the bag), and `tool-catalog.ts` (discovery). Bag entry alone mounts nothing.
5. **Mount it** — the budget (`MAX_TOOLS_PER_TURN`, currently 8) is the real
   constraint:
   - chat mount `CHAT_AGENT_MOUNT` for chat-first actions (bulk delivery);
   - a **skill** `tools` list for everything else (`skills.ts`) — skills are the
     main mount surface for the catalog.
   - Do **not** grow `research-agent` (pinned exactly in `subagent-tool.test.mjs`)
     or the `business-agent`/`strategy-agent` mounts (goal skills delegate to them
     and the slice byte budget is measured).
   - Raising `MAX_TOOLS_PER_TURN` is allowed; every mount must still fit it.

## Gotchas
- A tool in the bag but in no mount is dead code reachable by nothing.
- Business-scoped deletes must re-check ownership (`asset.businessId === ctx.businessId`).
- Services that `private db = useDrizzle()` need the **explicit import** —
  Nuxt auto-imports hide a missing import that breaks the node test harness.
- Consequential actions keep the preview-then-user-approves shape; the tool does
  not silently write what the user did not approve.

## Verify
1. `pnpm --filter @local-monorepo/agent test` — bag > 30, every mount ≤ budget.
2. `pnpm audit:layers` passes.
3. A live chat request reaches the new tool.
