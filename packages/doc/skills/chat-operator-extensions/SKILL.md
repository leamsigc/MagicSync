---
name: chat-operator-extensions
description: Extend or debug the /app/chat operator — expose any MCP tool through the feature bridge, force a skill with @name, render a new tool result as an embedded card, add batch post creation, or change chat model-provider settings. Trigger on "chat tool", "MCP tool in chat", "chat output card", "@skill in chat", "create posts from chat", "chat operator", or changes under packages/agent/server/agent/tools, packages/site/server/mcp, packages/ai-tools/app/components/ai-tools/chat, or the chat page.
---

# Chat operator extensions

## Read first

| File | Why |
|---|---|
| `packages/site/server/mcp/utils/tool-registry.ts` | MCP catalog + `invokeFeature` execution |
| `packages/site/server/api/v1/agent/features.get.ts` | Catalog route |
| `packages/site/server/api/v1/agent/features/invoke.post.ts` | Feature execution + synthetic session context |
| `packages/agent/server/agent/tools/features.tools.ts` | `list_features` / `use_feature` |
| `packages/agent/server/agent/tools/app-api.ts` | Forwarded-cookie HTTP calls (drop body headers) |
| `packages/agent/server/agent/tools/mounts.ts` | `MAX_TOOLS_PER_TURN` + per-agent mounts |
| `packages/agent/server/flue/skills.ts` | Single skill registry |
| `packages/ai-tools/app/composables/ai-tools/chat/runSections.ts` | Tool-call → section mapper |
| `packages/ai-tools/app/components/ai-tools/chat/RunCard.vue` | Section renderer |
| `packages/site/app/pages/app/chat/index.vue` | Composer, `@` picker, submit payload |

## Golden rules

1. **Never mount 60 tools.** A new product action is either a curated agent tool
   in a small mount, or a feature reached through `use_feature`. Raise
   `MAX_TOOLS_PER_TURN` only when the curated tool must be on every turn, and
   update the mount tests.
2. **The MCP catalog is the source of truth.** Do not hand-copy tool names into
   the chat. `#nuxt-mcp-toolkit/tools.mjs` is generated from
   `server/mcp/tools/**`; the feature route reads it.
3. **The chat is not an MCP client with a key.** `invokeFeature` runs the real
   handler with a synthetic `ApiKeyContext` built from the signed-in session.
   Authorization stays `requireBusinessAccess` (owner **and** team member).
4. **Forward cookies, not framing headers.** `app-api.ts` drops `content-length`,
   `host`, `connection`, `transfer-encoding`, `accept-encoding`. Copying them
   fails the internal POST before the route runs.
5. **A tool result is only useful if it renders.** Add a section kind + component
   (or extend `DraftSection`) and map the tool name/shape in `runSections.ts`.
   Handle `use_feature` via `effectiveCall(call)`.
6. **Batch is one tool call.** `write_posts_batch` returns `drafts[]`; the UI
   expands one card per draft. `create_posts_batch` takes the exact approved
   captions, never the brief.
7. **Skills are structural.** `@name` sends a chip payload (`skillSlugs`,
   `registeredSkillIds`, or a skill `agentName`), never parsed from prose.

## Add an MCP tool to chat

1. Create `packages/site/server/mcp/tools/<group>/<name>.ts`.
2. The tool appears in the feature catalog automatically (next request).
3. If the model needs guidance, add a bundled skill under
   `packages/agent/server/agent/skills/<skill>/SKILL.md` and register it in
   `packages/agent/server/flue/skills.ts` with its tool scope.
4. If the result needs a card, add a `SectionKind` in `runSections.ts` and a
   component under `tool-results/sections/`; render it in `RunCard.vue`.
5. Add the result fields to the section component. Do not render raw JSON for
   posts, images or schedules.

## Add a curated agent tool

1. Add the tool to the owning `*.tools.ts` module.
2. Add its name to `CHAT_AGENT_MOUNT` (or a skill's `tools` list).
3. Add a `tool-catalog.ts` entry so capabilities/oversight lists it.
4. Raise `MAX_TOOLS_PER_TURN` only if necessary; add the name to the existing
   test list, do not create a new test file.
5. Update `orchestrator.md` with when to call it.

## Add an embedded section

1. `SectionKind` in `runSections.ts` + `SECTION_ORDER`.
2. `nameKindOf` / `payloadKindOf` detection (payload shape first).
3. Component: `<i18n src="#site/app/pages/app/chat/chat.json">`, `useI18n`,
   tokens only, `rounded-xl border border-default bg-default`.
4. Import + `v-else-if` in `RunCard.vue`.
5. Auto-open the card in `hasEmbeddedResult`.
6. Add the keys to **all four** locales in `chat.json`. Escape `@` as `{'@'}`.

## Provider settings

- `packages/db/server/utils/llm-base-url.ts`: local providers accept any http(s)
  host (metadata + credentials still blocked). Public providers keep the public
  URL rule.
- Local API keys are optional but must be shown and forwarded: UI in
  `AiModelSettings.vue`, runtime in `pi-runtime.ts` / `schedulerUnifiedAI.ts` /
  `toolsUnifiedAI.ts`.
- To add a provider: `models.json`, `SupportedProvider`, `PROVIDERS` + `MODELS`,
  `override.post.ts` / `test.post.ts`, facade unions, `providers.get.ts`, and the
  `unifiedAI` switches.

## Verify

1. `pnpm audit:i18n` — clean (watch for `workflow.schedule` collisions).
2. `pnpm audit:layers` — PASS.
3. `pnpm --filter @local-monorepo/agent test` — all pass.
4. `pnpm dlx vite-doctor .` — no new diagnostics in changed files.
5. Browser: `/app/chat` → type `@`, filter, force a skill; run
   `list_features`; render an image; `write_posts_batch` → platform tabs →
   **Create all**; “create them” → scheduled-result card.
6. Screenshot each flow into
   `packages/doc/public/img/screenshots/app-chat/<action>.png` (chmod 644).
