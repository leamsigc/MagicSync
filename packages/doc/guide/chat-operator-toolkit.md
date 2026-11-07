# Chat operator toolkit

## What changed

The chat is the operator for the whole product. It now reaches **every MCP
feature** (63 tools), can force a skill with `@name`, renders tool results as
product UI instead of raw JSON, and can create several posts from one preview.

![Chat operator](/img/screenshots/app-chat/chat-batch-preview-real.png)

### 1. Chat ↔ MCP feature bridge

The chat cannot mount 60+ schemas in one turn (`MAX_TOOLS_PER_TURN` and the
small-model schema budget). It mounts two dispatcher tools instead:

| Tool | What it does |
|------|--------------|
| `list_features` | Lists every MCP tool by group, with search; `feature=<name>` returns its exact fields. |
| `use_feature` | Runs one MCP tool by name with validated arguments. |

The server side lives in the site layer:

- `packages/site/server/mcp/utils/tool-registry.ts` imports the toolkit's
  build-time virtual module `#nuxt-mcp-toolkit/tools.mjs`. That is the same
  resolved tool array `/mcp` serves, so the catalog can never drift from the
  MCP server.
- `GET /api/v1/agent/features?businessId=…` returns the grouped catalog and a
  single feature's field list (generated with `z.toJSONSchema`).
- `POST /api/v1/agent/features/invoke` runs the real MCP handler under
  `runWithMcpContext`, with a synthetic `ApiKeyContext` built from the signed-in
  session. The context uses the **business owner id** for `userId`/`ownerUserId`
  (shared posts, assets and playbooks are written under it) and carries the
  acting member in `metadata.actorUserId`. Authorization is still
  `requireBusinessAccess`, so team-member access rules are unchanged.

The agent tools (`packages/agent/server/agent/tools/features.tools.ts`) call
those routes over HTTP with the chat request's cookies. The agent layer must not
import site modules (layer rule).

### 2. Skills from the composer with `@`

Typing `@` in the composer opens a skill picker; typing filters it. Selecting a
skill produces a chip and sends the id structurally:

- One bundled skill and no chosen agent → the server uses that skill as the run
  profile, so its instruction body **and tool scope** are forced.
- Several skills → their bodies are loaded into the system prompt.
- `packages/agent/server/api/v1/agent/chat.post.ts` now accepts a bundled skill
  name as `agentName`; `resolveRunAgent` already turns it into a skill profile.

![Skill picker](/img/screenshots/app-chat/chat-skill-picker.png)

### 3. Embedded result cards

`RunCard` groups tool calls into sections and auto-opens when a result is
something the owner must look at.

| Section | What it renders |
|---------|-----------------|
| `DraftSection` / `DraftCard` | One card per draft, platform tabs per connected account, claims, edit/schedule actions. |
| `ImageSection` | The rendered design inline, with download and “Open in editor”. |
| `ScheduleSection` | Each created post with platform, time, post id and rejected reasons. |

![Image result](/img/screenshots/app-chat/chat-image-result.png)

### 4. Several posts in one action

- `write_posts_batch` drafts N distinct posts in one model call. The UI expands
  `drafts[]` into one preview card per post and shows **Create all N posts**.
- `create_posts_batch` creates several posts from the **exact approved captions**
  (`content`), so a follow-up “create them” never re-drafts the copy.
- The UI create-all path posts one row per draft, targeted to every connected
  account for that draft's platforms (`/api/v1/posts`).

![Agent-created posts](/img/screenshots/app-chat/chat-agent-created-posts.png)

## Model provider settings

- Local runners (`ollama`, `llama.cpp`) accept **any** http(s) base URL: LAN,
  VPN, tunnel, or a public `sslip.io` host. Only cloud-metadata hosts and
  credentials in the URL are refused. `NUXT_LOCAL_LLM_HOSTS` is no longer a gate.
- The API key field is shown for local providers too. It is optional; when set it
  is forwarded to the provider and stored encrypted.
- `opencode` (OpenCode Zen) is a provider option. Base URL:
  `https://opencode.ai/inference/openai/v1`, key env: `OPENCODE_API_KEY`.

![Local provider with optional key](/img/screenshots/app-profile/ai-model-local.png)

![OpenCode Zen provider](/img/screenshots/app-profile/ai-model-opencode.png)

The older `/app/ai-tools/settings` page carries the same provider list and optional
local key:

![AI tools settings — OpenCode Zen](/img/screenshots/app-ai-tools-settings/opencode.png)

## Gotchas

- **Forwarding request headers needs care.** The feature bridge posts to the app
  with the chat request's cookies. Copying `content-length`, `host`,
  `connection`, `transfer-encoding` or `accept-encoding` makes the internal POST
  fail before the route runs. `app-api.ts` drops them.
- **A stale thread id must not fail the message.** `resolveThread` now falls back
  to a new thread when the client's `threadId` is gone (deleted thread, previous
  business, or a run that failed before the row was written).
- **Tool descriptions stay ≤ 140 chars** (`MAX_DESCRIPTION_CHARS`), and every
  mount must fit `MAX_TOOLS_PER_TURN` (now 14: 12 ours + `task` +
  `activate_skill`).
- **`@` is special in vue-i18n.** Write it as `{'@'}` in message strings, or the
  compiler treats it as a linked-message token.
- **`workflow.schedule` is an existing string** (the carousel Schedule label).
  Do not replace it with an object; use `workflow.scheduleResult` for the card.
- **The agent layer cannot import site services.** Call the feature's own
  `/api/v1/*` route with `ctx.event` cookies instead.
- **`use_feature` audit rows are real MCP audit rows.** They use
  `keyId: 'chat-session'` and the same `logMcpCall` path.

## Verify

1. `pnpm --filter @local-monorepo/agent test` — 319 pass, 1 skipped.
2. `pnpm audit:layers` — PASS, 0 new unresolved imports.
3. `pnpm audit:i18n` — clean.
4. `pnpm dlx vite-doctor .` — no diagnostics in the changed files; the runner
   stops on a pre-existing `vitest.config.ts` parse gap.
5. In `/app/chat`: type `@image`, force `image-designer`, get an inline image;
   force `content-writer`, call `write_posts_batch`, get platform tabs and
   **Create all**; say “create them” and get the scheduled-result card.
