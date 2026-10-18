---
name: debug-content-pipeline
description: Diagnose and fix content-pipeline bugs across publishing and the agent chat — multi-image/carousel publish failures, empty drafts that report success, "agent found no ideas", and per-platform media limits. Use when asked to "carousel post failed", "post failed on twitter/bluesky", "write now returns nothing", "no ideas found", "too many images", or when a plugin/tool refuses to run in chat.
---

# Debug the content pipeline (publish + agent chat)

## When to use
A user reports a content bug that spans the composer, the scheduler, the agent
chat, or the content board. These all share one shape: a capability returns
`success: true` (or a plugin writes a row) while the user sees nothing, or a
whole publish fails on one platform's limit.

## Ground truth — read before editing
1. **Where the media limit lives:** `packages/shared/shared/platformConstants.ts`
   → `platformConfigurations[p].maxImages`. It is single-sourced; never hardcode
   a cap in a plugin. `maxImages: 0` means "images not applicable" (YouTube).
2. **Where assets arrive:** `AutoPostService.triggerSocialMediaPost` →
   `publishPlatformPost` → `SchedulerPost.publish` → `plugin.post(postDetails,…)`.
   `postDetails.assets` is the full array — clip it on a **copy**, per platform.
3. **Empty-success trap:** `content-chain.service.ts` normalisers
   (`normalizeDraft`, `stripFences`) return empty strings happily, and the
   artifact contract (`db/content/contracts.ts`) defaults `caption`/`article` to
   `''`. "Success" is protocol-level, not content-level.
4. **Agent tool mounts are budgeted:** `CHAT_AGENT_MOUNT` + framework tools =
   `MAX_TOOLS_PER_TURN` (8). Hard-to-reach tools (e.g. `revise_carousel`) are
   reached through a **single-tool harness**, not by widening the mount.

## Steps
1. **Reproduce the layer.** Publish failure → `packages/scheduler`. "Nothing in
   the card" → `packages/agent/server/capabilities/content.ts` +
   `content-chain.service.ts`. "Tool not available" → `chat.post.ts` routing +
   `agent/tools/mounts.ts`.
2. **Media caps.** Confirm the failing platform's `maxImages`; check the plugin
   does not slice itself (or slices to a different number). Fix by clipping in
   `AutoPostService.clipAssetsForPlatform` (images only, videos untouched) and
   raising a `type: 'warning'` notification — never mutate the shared `post`.
3. **Empty drafts.** Put the guard at the **composed-draft boundary**, not in a
   single step: a legitimately empty caption is fine when the article or a
   platform variant has content. Add a `draftHasContent`-style check and return
   a coded failure (`EMPTY_OUTPUT`); verify the composable does not toast
   success on an empty result.
4. **"No ideas".** `generateContentIdeas` must always return cards. Keep the
   brief-derived angles when the brief has any; only when it has none, top up to
   `MIN_IDEAS` with business-grounded angles. **Do not** swallow a provider
   error — a downed model must fail loud (`slice-b` asserts `CONTENT_INCOMPLETE`).
5. **Chat tool refusal.** If the model says a tool is unavailable, the turn was
   not routed to the harness. Add intent detection + resolve the target
   (e.g. latest carousel artifact) server-side; keep the mount at budget.
6. **Verify (no unit tests — repo rule).**
   ```bash
   pnpm --filter @local-monorepo/agent test
   cd packages/site && pnpm exec tsc --noEmit -p tsconfig.json
   pnpm site:build   # the ONLY check that compiles Vue templates
   ```
   Existing tests encode intent (fail-loud on provider outage, brief-derived
   counts). If a change breaks one, reconcile the behaviour — do not edit the
   test.
7. **Document** in `packages/doc/guide/` and register in the Wiki sidebar.

## Anti-patterns
- Clipping images inside every plugin (drift). Clip once, from `maxImages`.
- Returning `success` for an empty model reply "so the UI keeps working".
- Catching a provider error to return generic template ideas — masks outages.
- Adding a hard-to-reach tool to `CHAT_AGENT_MOUNT` instead of routing to it.
- Putting an empty-output guard in `writePost` (breaks article/variant-only
  cards).
