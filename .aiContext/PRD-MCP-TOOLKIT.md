# PRD: Nuxt MCP Toolkit Integration

> **Status (verified 2026-09-07 against codebase):** The entire foundation this PRD
> builds on is **already implemented** — post CRUD, scheduling, per-platform
> publishing, stats collection, social accounts, API keys, AI generation, media
> library. What does **NOT** exist is the MCP layer itself: `@nuxtjs/mcp-toolkit`
> is not installed, there is no `server/mcp/` directory, no `defineMcpTool` /
> `defineMcpResource` usage, and no `/api/mcp` endpoint. MCP is Nuxt-only —
> the python service has no role in it and is explicitly out of scope.
> This PRD v2 rewrites v1 so every tool maps to a
> real service method instead of the hypothetical APIs v1 invented
> (`postService.createPost`, `analyticsService.getAnalytics`,
> `aiService.generateCaption`, `platformService.*` — none of these exist).
>
> **Web-client compat (added 2026-09-07, corrected same day):** ChatGPT web works with the current
> Bearer-key server (Token auth) — verification tasks below. Claude.ai web is
> **OAuth-only** (no custom headers — open upstream issue
> `anthropics/claude-ai-mcp#10`) and our server has no OAuth, so Claude web
> sees zero tools today. The OAuth workstream below unlocks it via the
> **`@better-auth/mcp` plugin** (read in full — it supersedes the earlier
> `@better-auth/oauth-provider` plan; see Wave 2a-B). Verified:
> toolkit 0.19.0 has NO OAuth support (its well-known endpoints intentionally
> return 404+JSON); better-auth 1.7.2 has no AS plugin in-tree.

## Implementation Tracker

Legend: `[ ]` not started · `[~]` in progress · `[x]` done (only with evidence:
typecheck pass, dev-boot route visible, or inspector listing).

### Step 0 — Module setup (DONE — heading kept for history)
- [x] Deps installed: `@nuxtjs/mcp-toolkit@0.19.0` + `zod@4.5.4` in site layer (catalog + package.json, `pnpm install` clean)
- [x] `nuxt.config.ts`: module registered, `mcp: { name, route: '/mcp' }`, `nitro.experimental.asyncContext: true`
- [x] Dev boot: `[@nuxtjs/mcp-toolkit] ✔ /mcp enabled with 9 tools`; `GET /mcp` returns MCP JSON-RPC (not 404/500)
- [x] Anonymous `tools/list` → `[]` (enabled guards hide everything); anonymous `tools/call` → "Tool not found" (correct MCP semantics)

### Shared layer (`packages/site/server/mcp/`)
- [x] `index.ts` — `defineMcpHandler` middleware: Bearer/x-api-key → `apiKeyService.verifyApiKey` → `event.context.mcp` + ALS wrap
- [x] `mcp.d.ts` — `H3EventContext.mcp: ApiKeyContext` typing
- [x] `utils/mcp-request.ts` — AsyncLocalStorage bridge (toolkit 0.19.0 does NOT forward H3 event to handlers; h3 v1 has no `useEvent()` — verified in toolkit dist + h3 exports)
- [x] `utils/mcp-context.ts` — `requireMcp` (non-401 friendly errors), `requireScope` (Wave-1 default-full, Wave-2 issuance), `resolveUserId` (key user → else first account owner), `resolveAccounts` (platform names → account IDs + connected-check + key allowlist)
- [x] `utils/mcp-validate.ts` — per-platform validation via scheduler `platformConfigurations` (mirrors `cli/post.post.ts`)
- [x] `utils/mcp-audit.ts` — audit every tool call via `logAuditService` (never throws)
- [x] `utils/platforms.ts` — canonical 17-value platform enum (from `socialMediaAccounts.platform`; PRD v1's 18-name list was wrong — no pinterest/mastodon in DB enum)


### Wave 1 — tools (dogfood: own agent only)
- [x] posts: `create-post`, `list-posts`, `get-post`, `update-post`, `delete-post` (written; reads use `findByIdFull` org-member path + key-binding check; writes owner-scoped by service)
- [x] posts: `publish-now` (create→trigger via `AutoPostService`, mirrors CLI route), `retry-post`, `preview-post` (advisory dry-run), `post-platform-status` (via `findByIdFull`, NOT unscoped `getPlatformPostsByPost`)
- [x] platforms: `list-platforms` (`getAccountsByBusinessIdWithOutActiveCheck`, token-safe shaping), `get-platform-health` (`getBusinessTokenHealth`)
- [x] analytics: `get-post-stats` (`PostStatsService.getPostStats`), `get-account-stats` (`PlatformStats.getCurrentStats` / `getStatsHistory`, `history` flag)
- [x] ai: `generate-caption`, `generate-ideas`, `suggest-hashtags` (server-to-server `$fetch` to python backend with `X-User-Id`, same pattern as the ai-tools route handlers; failures surface as `isError`, never crash)
- [x] media: `list-media` (`assetService.findByBusinessId` + mimeType filter), `search-media` (client-side filename scan over newest 100 — NO full-text index exists, documented in tool description)

### Wave 1 — resources
- [x] `calendar` (`magic-sync://calendar/{month}` template), `platform-status` (fixed), `post-details` (`magic-sync://posts/{postId}` template), `analytics-summary` (fixed)
- [x] URIs are key-bound: NO `businessId` param (deviation from v1 — a business param would only enable cross-business confusion; the key admits exactly one business)
- [x] Template resources require `ResourceTemplate` objects from `@modelcontextprotocol/sdk/server/mcp.js` (added as direct dep v1.30.0) — plain strings register as exact literals (verified: template read 404'd until fixed). Templates surface via `resources/templates/list`, NOT `resources/list` (SDK-intended).

### Wave 1 — verification
- [x] `nuxt prepare` + typecheck clean for `server/mcp/**` (prepare clean 2026-09-07; no vue-tsc in repo — verification via dev-boot Nitro build, which compiles all tools clean)
- [x] End-to-end with a real org key against docker sqld (2026-09-07): `tools/list` → 18 tools; `resources/list` → 2 fixed + `resources/templates/list` → 2 templates; anon `tools/list` → `[]`, anon calls → "not found" (all 18 tools + 4 resources hide via `enabled`)
- [x] Roundtrip 2026-09-07: create → `post-details` resource read → `calendar` shows 1 post → `retry-post` on pending returns clean "no failed attempts" `isError` → delete. Audit log confirms create/update/delete/preview successes + retry/suggest-hashtags failures.
- [x] AI tools: correctly return `isError` when python backend is down (verified `suggest-hashtags` with backend down — no crash, audit failure row written). Live generation untested — needs backend up.
- [~] `publish-now` live-fire needs real platform credentials (dummy account has fake token). Logic mirrors `cli/post.post.ts` 1:1 (find → update/retry → `ScheduleRefreshSocialMediaTokens` → `AutoPostService.trigger`).
- [ ] No double-publish under concurrent `publish-now` (scheduler is single-publisher; verify)

### Wave 2+ (not started)
- [ ] DB-backed rate limiting tuning (better-auth key limit is 50/day — verify enough for dogfood)
- [ ] Scoped-key issuance (`mcp:read`/`mcp:full` in key metadata) + key-management UI with platform allowlists
- [ ] Public docs, versioning, developer portal (Waves 2–3)
- [ ] Wave 4 tools: inbox/comments, RAG documents, templates, carousel/menu-board
- [ ] list-posts cross-user gap: `findByBusinessId` hard-filters by `userId`, so org-level keys only list the fallback owner's posts. v1 limitation (safe direction: under-exposure). Fix options: service-level business-scoped read for key auth, or resolve all member userIds.

### Wave 2a — Web-client compatibility (ChatGPT web + Claude.ai web)

Compatibility matrix (verified 2026-09-07 against vendor docs):

| Client | Auth it speaks | Our server today | Verdict |
|---|---|---|---|
| ChatGPT custom connector | Token (Bearer), OAuth, None; remote HTTPS only; Plus/Pro/Business/Enterprise/Edu | Bearer ✓, Streamable HTTP ✓ | **Compatible now** — needs e2e verification |
| Claude.ai custom connector | **OAuth only** (no custom headers — open upstream `anthropics/claude-ai-mcp#10`) | No OAuth | **Blocked** — sees zero tools until OAuth ships |
| Claude Code / Desktop / Cursor / VS Code | Custom headers | Bearer ✓ | Compatible now (verified e2e via raw client) |

#### A. ChatGPT verification (small — no new auth code)
- [ ] E2E with a real Plus/Pro connector (Token auth) against staging HTTPS: `tools/list` → create → preview → stats
- [ ] Confirm no OAuth-discovery breakage: protected-resource metadata is now REAL (user route), remaining toolkit stubs (AS metadata at root) still 404+JSON — verify ChatGPT discovers via our metadata + falls back to Token cleanly
- [ ] Confirm Streamable HTTP suffices (no SSE transport needed)
- [ ] Docs already cover setup (`packages/doc/guide/mcp.md`); update with verified plan tier + screenshots after e2e

#### B. OAuth 2.1 for MCP via `@better-auth/mcp` (the Claude.ai unlock — Wave 3)

**AS choice (decided, corrected): `@better-auth/mcp` (+ `jwt()` + `@better-auth/cimd`).**
This supersedes the earlier `@better-auth/oauth-provider` plan — the plugin docs
state `mcp()` IS the OAuth provider ("do not also register a separate
`oauthProvider()`") and it additionally serves RFC 9728 protected-resource
metadata plus the `requireMcpAuth` route wrapper. NOT the deprecated
`oidcProvider`, NOT hand-rolled, NOT an external IdP. Reasons, all evidenced:
- better-auth 1.7.2 (ours) ships no AS capability in-tree (only client-side `generic-oauth`/`oauth-proxy`) — verified in `node_modules`.
- The plugin is purpose-built for exactly this: OAuth 2.1 AS + MCP protected resource, `authorization_code` (PKCE) / `refresh_token` / `client_credentials` grants, `openid` scope → userinfo, RFC 7662 introspection, RFC 7009 revocation, DPoP (RFC 9449), step-up scope challenges (`403 insufficient_scope`).
- Security mandate: CVE-2026-53512 (refresh-token replay on the `mcp`/`oidc-provider` token endpoints, patched in ≥1.6.11). We are on 1.7.3 — stay current, never adopt the deprecated plugin.
- Toolkit 0.19.0 explicitly has no OAuth (verified in its `oauth-metadata` dist docs) — OAuth lives in our auth layer; the toolkit keeps owning tools/resources/transport.

**Composition with what exists (no rewrite):** the 18 tools + 4 resources stay on
`@nuxtjs/mcp-toolkit`. Only the auth branch grows: our `server/mcp/index.ts`
middleware gains an OAuth verification path (via `verifyAccessTokenRequest` from
`better-auth/oauth2`, JWT-vs-JWKS, no DB round trip for crypto) that resolves to
the **same `ApiKeyContext` shape** the Bearer path produces. `requireScope`,
`resolveUserId`, `resolveAccounts`, `enabled` guards, and audit logging are
untouched — they already funnel through that shape.

**Client-identity note (do not get wrong):** MCP 2026-07-28 deprecates Dynamic
Client Registration in favor of CIMD — hence the `@better-auth/cimd` companion
with the `mcp-2026-07-28` profile. But current Claude/ChatGPT clients register
dynamically, so ship with the explicit DCR fallback ON
(`allowDynamicClientRegistration: true, allowUnauthenticatedClientRegistration: true`)
until client support is re-verified. Registration endpoint stays absent from
discovery unless DCR is enabled — that's the switch.

**Required surface:**
- [x] Deps: `@better-auth/mcp@1.7.3` + `@better-auth/cimd@1.7.3` in catalog + auth package (better-auth core bumped 1.7.2→1.7.3 to satisfy the plugin's `^1.7.3` peer — patch, install clean)
- [x] Schema: `packages/db/db/oauth/oauth.ts` — 8 tables transcribed from `getAuthTables()` output (authoritative, not hand-guessed) + `businessId` extension on `oauthConsent`; migration `0010_oauth-mcp-tables.sql` (exactly 8 CREATEs, applied to docker dev DB)
- [x] `jwt()` + `mcp()` + `cimd()` configured in `packages/auth/lib/auth.ts` (resource from env, DCR fallback ON, consent `schema` extension for `businessId`)
- [x] Schema migration for the plugin's OAuth tables via existing drizzle workflow (`0010_oauth-mcp-tables.sql`, 8 tables)
- [ ] Custom **consent screen with business picker** (`consentPage`): OAuth grants bind **exactly one business**, chosen by the user at authorize time (extends decision #3). Store `businessId` on the grant; resolve it per-request from the stored grant (indexed lookup) — **never from client input**. Plain-language publish-power explanation on the consent screen. — DONE 2026-09-07 (`/consent` + `consent-business.post.ts`; plugin consent MUST be browser-direct, server-side `auth.api.oauth2Consent` dies without `ctx.request`)
- [ ] Scopes: `mcp:read` / `mcp:full` as real OAuth scopes (+ `openid profile email` for identity). Consent screen explains publish power in plain language. Enforcement reuses existing `requireScope` (all tools already funnel through it). Per-tool step-up (`createInsufficientScopeError`) only where re-authorizing actually helps — membership/ownership denials stay ordinary errors, never challenges. (Verified 2026-09-07: read token lists OK, writes denied with clear message.)
- [x] MCP middleware accepts **two credential types**, both resolving to `ApiKeyContext`: (1) `org_` API keys (unchanged path); (2) OAuth access tokens (JWKS verify → claims → grant lookup for `businessId` + scope→`mcpScope` + platform allowlist from grant). (`mcp-oauth.ts`; structural branch on JWT dots; `mcpScope` now a typed `ApiKeyContext` field.)
- [x] **401 semantics** (deliberate, document well): Bearer-key path keeps never-401 (avoids discovery loops); OAuth path returns `401 + WWW-Authenticate` + protected-resource metadata on missing/invalid tokens (this IS the discovery flow Claude needs). The middleware branches on credential type presented. (REVISED 2026-09-07: kept never-401 with evidence — metadata-driven discovery suffices; challenge deferred until a real client proves otherwise.)
- [x] Key-management UI shows OAuth grants (client name, scopes, business, issued/expiry) + revoke (RFC 7009); revocation must immediately invalidate introspection. (Connected Apps on `/app/keys`; revoke deletes consent+tokens; verified token dead immediately, other grants unaffected.)
- [x] At implementation time, re-verify against current Claude.ai/ChatGPT behavior: CIMD-only vs DCR-fallback, and whether `@modelcontextprotocol/server` v2 (which the plugin installs) coexists cleanly with our `@modelcontextprotocol/sdk` v1.30.0 transport (different package names — expected fine, verify at install). (DCR fallback confirmed needed + ON; SDK coexistence fine, no conflicts at install/boot.)
- [x] E2E protocol dance (Claude.ai/ChatGPT click-through still needs real accounts) → connect (OAuth dance) → `tools/list` shows 18 → create → stats; ChatGPT OAuth path as second client (alternative to Token). (Full dance verified 2026-09-07: refresh rotation, deny path, revoke.)

**Out of scope for this workstream:** OAuth for platform connect flows (unchanged — agents get status + connect URL); token exchange for third-party developers' own AS (we are the AS, not a client).

### Implementation log
- 2026-09-07: real toolkit API verified against mcp-toolkit.nuxt.dev (inputSchema/handler/route facts corrected in this doc).
- 2026-09-07: `targetPlatforms` takes social-ACCOUNT IDs (verified in PostService.create) → tools resolve platform names → account IDs.
- 2026-09-07: ALS bridge added — toolkit 0.19.0 never forwards H3 event to tool handlers; h3 v1 lacks `useEvent()` (first boot 500'd on the static import; fixed, `/mcp` live with 9 tools).
- 2026-09-07: pre-existing better-auth drift fixed to unblock e2e: `account.issuer` column missing → added to schema + migration `0008_add-account-issuer.sql` (single ALTER, applied to docker sqld).
- 2026-09-07: `.env` gotcha: `NUXT_TURSO_AUTH_TOKEN` has a leading space (161 vs 160 chars) — drizzle-kit migrate silently applies nothing with the raw value. Trim before use; fix the `.env` typo.
- 2026-09-07: correct dev boot is root `pnpm dev` (`dotenv -- pnpm -r dev`); booting site directly skips repo-root `.env` → falls back to `file:../../local.db`.
- 2026-09-07: posts CRUD verified e2e with real org key (`org_*`) vs docker sqld: 9/9 tools listed, preview/create/list/get/status/update/delete all green, audit rows present. Dogfood seed in dev DB: user `mcp2@example.com` + business "MCP Test Biz" + dummy twitter account (fake token — publishing against it will fail per-platform, as designed).
- 2026-09-07: Wave 1 complete — 18 tools + 4 resources, boot line `✔ /mcp enabled with 18 tools, 4 resources`. New FILES require dev restart (toolkit scans at startup, not per-request). Killing dev: `kill <pid of nuxt.mjs dev>` — `pkill -f "nuxt dev"` does NOT match.
- 2026-09-07: MCP SDK facts — `registerResource` with a string URI = exact match only; templates need `new ResourceTemplate(tpl, { list })` (`list` key required even when `undefined`); `resources/list` omits templates by design, use `resources/templates/list`.
- 2026-09-07: web-compat research — ChatGPT speaks Token/OAuth over remote HTTPS (compatible now, needs e2e); Claude.ai is OAuth-only with no custom headers (upstream `anthropics/claude-ai-mcp#10`), so blocked until OAuth ships. Toolkit 0.19.0 has no OAuth (404-JSON stubs by design). AS path read in full: `@better-auth/mcp` docs — `mcp()` IS the OAuth provider (doubles as protected resource, RFC 9728 metadata automatic), composes with `jwt()`+`@better-auth/cimd`; CIMD replaces DCR in 2026-07-28 profile but DCR fallback must stay ON for current clients; tools/transport stay on the toolkit, only auth gains an OAuth branch resolving to `ApiKeyContext`.
- 2026-09-07: docs `guide/mcp.md` published (18 tools + 4 resources, all harnesses, ChatGPT steps, Claude-web limitation notice, `org_` prefix callout). Sidebar-registered, `pnpm build` clean.
- 2026-09-07: Wave 2a-B implemented e2e — DCR (incl. correct https-redirect rejection) → authorize → browser-direct consent → attach business → PKCE exchange → JWT+refresh → MCP 18 tools business-bound → read-scope deny on writes → deny path → refresh rotation + 30s reuse → revoke kills token instantly. Fixed en route: `session.activeOrganizationId` fatal drift (`0011`), toolkit well-known stub overridden by user route, server-side `auth.api.oauth2Consent` unusable (no `ctx.request`), stale signed queries expire in 600s (curl replays beware).

## Overview

Integrate `@nuxtjs/mcp-toolkit` into the MagicSync site layer to expose the
already-implemented social media operations (get, create, schedule, publish,
stats, AI generation) as MCP (Model Context Protocol) tools. This enables AI
agents to programmatically interact with the platform via natural language or
API calls. The work is a **thin exposure layer** — no new business logic, only
MCP tool/resource wrappers around existing services. Out of scope: python-backend
(no MCP role), link-in-bio (feature doesn't exist), OAuth connect flows (require
a user browser — agents get status + connect URL instead).

## Goals

1. Expose all core social media operations as MCP tools (wrapping existing services)
2. Enable AI agents to create, schedule, and publish posts
3. Provide analytics and content retrieval via MCP resources
4. Maintain security with authentication (existing API keys) and rate limiting
5. Zero-config setup following MCP toolkit conventions

## Foundation Inventory — Already Implemented

Every row below was verified in the repo. MCP tools wrap these directly.

| Planned MCP capability | Real implementation | File | Status |
|---|---|---|---|
| Create post | `PostService.create(userId, data)` → `ServiceResponse<Post>` | `packages/db/server/services/post.service.ts` | ✅ Ready to wrap |
| Get post (full) | `PostService.findById` / `findByIdFull` | same | ✅ Ready to wrap |
| List posts (filter/status/date/platform) | `PostService.findByBusinessId(businessId, userId, options)` — filters: status, postFormat, startDate, endDate, platforms; paginated | same | ✅ Ready to wrap |
| Scheduled-posts feed | `PostService.findScheduledPosts(userId, beforeDate)` | same | ✅ Ready to wrap |
| Update post / reschedule | `PostService.update(id, userId, data)` (mediaAssets, targetPlatforms, scheduledAt) | same | ✅ Ready to wrap |
| Delete post | `PostService.delete(id, userId)` | same | ✅ Ready to wrap |
| Publish / retry | `PostService.updateStatus` (`pending`/`published`/`failed`), `retryFailedPost`, `updatePlatformPost`, `getPlatformPostsByPost` + scheduler task picks up due posts | same + `packages/scheduler/server/tasks/social/post.ts` | ✅ Ready to wrap |
| REST equivalents | `POST /api/v1/posts`, `GET/PUT/DELETE /api/v1/posts/[id]` | `packages/scheduler/server/api/v1/posts/` | ✅ Exists |
| Per-platform publish (18 platforms) | `SchedulerPost` + 18 plugins, each with `post/update/addComment/getStatistic/getPostInsights/getComments/replyToComment` | `packages/scheduler/server/services/` | ✅ Ready to wrap |
| Post analytics | `PostStatsService.getPostStats(businessId, userId, {startDate,endDate,timezone})`, `countPosts` | `packages/db/server/services/post-stats.service.ts` | ✅ Ready to wrap |
| Account stats (snapshot-based) | `PlatformStats.fetchAccountStats/collectAllStats/getCurrentStats/getStatsHistory` | `packages/scheduler/server/services/PlatformStats.service.ts` | ✅ Ready to wrap |
| Connected accounts | `SocialMediaAccountService.getAccountsByUserId/getAccountsByBusinessId/createOrUpdateAccount/deactivateAccount/deleteAccount` | `packages/db/server/services/social-media-account.service.ts` | ✅ Ready to wrap |
| Token health / validation | `getTokenHealth/getBusinessTokenHealth/validateAccountConnection/refreshTokens` | same | ✅ Ready to wrap |
| API-key auth (MCP auth base) | `ApiKeyService.verifyApiKey/verifyApiKeyForBusiness/verifyApiKeyForPlatforms/createApiKey/listApiKeys/deleteApiKey` | `packages/auth/server/services/api-key.service.ts` | ✅ Ready to reuse |
| AI caption / ideas / hashtags | `POST /api/ai-tools/social-media/generate`, `generate-hashtags`, `generate-hooks`, `generate-variations`, `generate-thread`, `generate-batch`, `GET platforms` | `packages/ai-tools/server/api/ai-tools/social-media/` | ✅ Ready to wrap |
| Agent sessions / RAG | agent CRUD + `retrieve.post.ts`, `chat.post.ts`, web-search, text-to-sql | `packages/ai-tools/server/api/ai-tools/` | ✅ Ready to wrap |
| Media library | assets index/search/usage/canva/pexel endpoints | `packages/assets/server/api/v1/assets/` | ✅ Ready to wrap |
| In-app notifications (for future MCP push) | `NotificationService` + `/api/v1/notifications/*` | `packages/auth/server/services/notification.service.ts` | ✅ Exists |
| Audit logging (for MCP call log) | `AuditLogService.logAuditEvent` | `packages/db/server/services/auditLog.service.ts` | ✅ Ready to reuse |

### Data-model facts MCP tools must respect

- Post `status` enum is **`pending` / `published` / `failed`** (`packages/db/db/posts/posts.ts`). There is no `draft`/`scheduled` status — a "scheduled" post is `pending` with a future `scheduledAt`. "Publish now" = set `scheduledAt` to now (scheduler task publishes) or `retryFailedPost`.
- Every post **requires `businessId`** — MCP tools must take `businessId` (or resolve the user's active business) on every post operation.
- `targetPlatforms` + per-account `platformPosts` rows track per-platform state; `publishDetail` JSON holds per-platform published IDs/URLs.
- `postFormat`: `post` / `reel` / `story` / `short`.

## Corrections to PRD v1 (do not reintroduce)

1. **Fake service APIs** — v1 called `postService.createPost/schedulePost/publishPost`, `analyticsService.getAnalytics`, `aiService.generateCaption`, `platformService.getConnectedPlatforms`. None exist. Use the real methods in the table above.
2. **Fake status enum** — v1 used `draft`/`scheduled`/`published`. Real: `pending`/`published`/`failed`.
3. **Platform list** — v1 listed 8 platforms. We support 18 (scheduler plugins). Tool schemas must accept all 18.
4. **Link-in-bio tools** — `rg` finds zero link-in-bio code in any layer. **Removed from scope** until the feature exists (carousel/menu-board public slugs are the closest analog, not a substitute).
5. **Python service** — has nothing to do with MCP and stays that way. No MCP
   client, server, or shared contracts in `python-backend/`; all MCP work lives
   in the Nuxt site layer.
6. **Module not installed** — `packages/site/nuxt.config.ts` modules are `seo, i18n, hints, umami, evlog, comark`. Adding `@nuxtjs/mcp-toolkit` is step 0.

## Architecture

### Step 0 — Module Installation (DONE — code block kept for history)

```typescript
// packages/site/nuxt.config.ts — add to modules array
export default defineNuxtConfig({
  modules: [
    // ...existing...
    '@nuxtjs/mcp-toolkit',
  ],

  mcp: {
    name: 'MagicSync MCP',
    route: '/mcp', // toolkit default; NOT /api/mcp
  },

  nitro: {
    experimental: {
      // ...existing openAPI/tasks...
      asyncContext: true, // REQUIRED: useEvent() inside tool handlers
    },
  },
})
```

Real toolkit API facts (verified against mcp-toolkit.nuxt.dev docs — v1 PRD
guessed these wrong): tools use `inputSchema: { field: z.schema }` (NOT
`input: z.object()`); `handler: async (args) => …` receives validated input
directly (NOT `(input, context)` — request access is via `useEvent()` from
`h3`); `defineMcpTool` is auto-imported (explicit: `@nuxtjs/mcp-toolkit/server`);
errors via h3 `createError`; auth via `server/mcp/index.ts` +
`defineMcpHandler({ middleware })` setting `event.context`; per-tool `enabled:
event => …` guard hides tools from anonymous callers; `annotations:
{ readOnlyHint, destructiveHint, … }` steer agents.

MCP tool files live in the **site layer** (`packages/site/server/mcp/`) so the
toolkit picks them up from the composed app, and they import services via the
existing layer aliases (same as current route handlers do).

### MCP Tools Directory Structure

```
packages/site/server/mcp/
├── tools/
│   ├── posts/
│   │   ├── create-post.ts        # → PostService.create
│   │   ├── list-posts.ts         # → PostService.findByBusinessId
│   │   ├── get-post.ts           # → PostService.findByIdFull
│   │   ├── update-post.ts        # → PostService.update (incl. reschedule)
│   │   ├── delete-post.ts        # → PostService.delete
│   │   ├── publish-now.ts        # → update scheduledAt=now / retryFailedPost
│   │   ├── retry-post.ts         # → PostService.retryFailedPost
│   │   ├── preview-post.ts         # dry-run render, no writes (advisory, not enforced)
│   │   └── post-platform-status.ts # → PostService.getPlatformPostsByPost
│   ├── platforms/
│   │   ├── list-platforms.ts     # → SocialMediaAccountService.getAccountsByBusinessId
│   │   └── get-platform-health.ts# → getBusinessTokenHealth / validateAccountConnection
│   ├── analytics/
│   │   ├── get-post-stats.ts     # → PostStatsService.getPostStats + countPosts
│   │   └── get-account-stats.ts  # → PlatformStats.getCurrentStats / getStatsHistory
│   ├── media/
│   │   ├── list-media.ts         # → assets index/search endpoints
│   │   └── search-media.ts       # → assets search (tag/hashtag)
│   └── ai/
│       ├── generate-caption.ts   # → POST /api/ai-tools/social-media/generate
│       ├── generate-ideas.ts     # → generate-hooks / generate-thread
│       └── suggest-hashtags.ts   # → generate-hashtags
├── resources/
│   ├── calendar.ts               # → findScheduledPosts / findByBusinessId (date range)
│   ├── platform-status.ts        # → getAccountsByBusinessId + token health
│   ├── post-details.ts           # → findByIdFull
│   └── analytics-summary.ts      # → getPostStats + getCurrentStats
└── utils/
    ├── auth.ts                   # → ApiKeyService.verifyApiKeyForBusiness
    └── rate-limit.ts             # new (does not exist yet)
```

> **Deliberately omitted vs v1:** `schedule-post.ts` (folded into `update-post`
> — scheduling is just setting `scheduledAt` on a `pending` post);
> `connect-platform.ts` / `disconnect-platform.ts` (OAuth requires a user
> browser session; an agent cannot complete OAuth — expose health + status, and
> return the connect URL for the user instead); all `link-in-bio/*` (feature
> doesn't exist).

## Tool Definitions (grounded in real services)

Conventions for all tools: Zod-validated input; call the singleton service
(e.g. `postService`, never raw Drizzle in the tool file — per
non-negotiables); return `ServiceResponse`-shaped errors as MCP tool errors;
`businessId` required on every post/account/stats tool; platforms validated
against the 18 scheduler plugins.

### 1. Create Post → `PostService.create`

```typescript
// packages/site/server/mcp/tools/posts/create-post.ts
import { z } from 'zod'
import { useEvent } from 'h3'
// defineMcpTool auto-imported by the toolkit; explicit import:
// import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { PLATFORMS } from '../../utils/platforms'
import { requireMcp, resolveAccounts } from '../../utils/mcp-context'

export default defineMcpTool({
  description: 'Create a social media post. businessId is taken from your API key — do not ask for it. Future scheduledAt => published later, omitted => due immediately.',
  inputSchema: {
    content: z.string().min(1).max(2000),
    platforms: z.array(PLATFORMS).min(1).describe('Target platforms (must be connected to the business)'),
    mediaAssetIds: z.array(z.string()).optional().describe('Asset library IDs (not URLs — use list-media first)'),
    scheduledAt: z.string().datetime().optional(),
    postFormat: z.enum(['post', 'reel', 'story', 'short']).default('post'),
    platformContent: z.record(z.string(), z.object({ content: z.string(), comments: z.array(z.string()).optional() })).optional()
      .describe('Per-platform content overrides'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: true },
  async handler(args) {
    const event = useEvent()
    const mcp = requireMcp(event) // valid ApiKeyContext or friendly auth error (never 401 — avoids OAuth discovery)
    const { accounts, userId } = await resolveAccounts(mcp, args.platforms)
    const scheduledAt = args.scheduledAt ? new Date(args.scheduledAt) : new Date()
    const result = await postService.create(userId, {
      businessId: mcp.businessId, // key-bound, NOT agent-supplied (cross-business leaks impossible)
      content: args.content,
      targetPlatforms: accounts.map(a => a.id), // service takes ACCOUNT IDs, not platform names
      mediaAssets: args.mediaAssetIds ?? [],
      scheduledAt,
      // Service coerces status to 'pending' on write; the non-'pending' label bypasses
      // the future-scheduledAt validation for immediate posts (same precedent as cli/post.post.ts).
      status: (scheduledAt > new Date() ? 'pending' : 'draft') as PostCreateBase['status'],
      postFormat: args.postFormat,
      platformContent: args.platformContent,
    })
    if (!result.success) throw createError({ statusCode: 400, message: result.error })
    return { postId: result.data.id, status: result.data.status, scheduledAt: result.data.scheduledAt }
  },
})
```

### 2. List Posts → `PostService.findByBusinessId`

Paginated; filters map 1:1 to existing options (`status: pending/published/failed`,
`postFormat`, `startDate/endDate`, `platforms`).

### 3. Get Post → `PostService.findByIdFull` (+ `getPlatformPostsByPost` for per-platform state)

### 4. Update / Reschedule → `PostService.update` (content, mediaAssets, targetPlatforms, scheduledAt)

### 5. Publish Now → set `scheduledAt: now` via `update`, or `retryFailedPost` if `failed`

Rationale: the scheduler task (`server/tasks/social/post.ts`) is the single
publisher. MCP must not duplicate publish logic — it just makes the post due.

### 6. Platform Health → `getBusinessTokenHealth` + `validateAccountConnection`

Returns per-account `healthy | expiring_soon | expired | unknown` with
`daysRemaining`. If expired, return the OAuth connect URL — the agent tells the
user to reconnect; it cannot do OAuth itself.

### 7. Analytics → `PostStatsService.getPostStats` + `PlatformStats.getStatsHistory`

`getPostStats(businessId, userId, { startDate, endDate, timezone })` for post
aggregates; `PlatformStats` snapshot history for follower/account trends.
(Note: analytics auto-collection is a known gap per COMPETITIVE-FEATURES.md —
MCP exposes what's collected, it doesn't fix collection.)

### 8. AI Generation → existing ai-tools REST endpoints

`generate` (caption), `generate-hashtags`, `generate-hooks` (ideas),
`generate-variations`, `generate-thread` — called server-to-server from the
tool handler so the user's LLM config (`user-llm-config.service.ts`) applies.

## MCP Resources

| Resource | URI | Source |
|---|---|---|
| Calendar | `magic-sync://calendar/{businessId}/{month}` | `findByBusinessId` with date range (not `findScheduledPosts` — calendar needs all statuses) |
| Platform status | `magic-sync://platforms/{businessId}/status` | accounts + token health |
| Post details | `magic-sync://posts/{postId}` | `findByIdFull` |
| Analytics summary | `magic-sync://analytics/{businessId}/summary` | `getPostStats` + `getCurrentStats` |

## Security

### Authentication — reuse ApiKeyService (exists)

```typescript
// packages/site/server/mcp/utils/auth.ts
// Resolve Bearer token via apiKeyService.verifyApiKeyForBusiness(token, businessId)
// → { userId, businessId, scopes }. Reject unknown/expired keys with 401.
// verifyApiKeyForPlatforms() additionally constrains which platforms a key may target.
```

Token scopes to introduce on the existing key model: `mcp:read` (list/get/stats/resources only),
`mcp:full` (everything incl. create/update/publish/delete). Enforce scope per tool.

### Platform allowlist per key (exists — reuse)

`ApiKeyService.verifyApiKeyForPlatforms()` already constrains which platforms a
key may target. Every `mcp:full` key MUST carry an explicit platform allowlist —
a leaked key can then only publish where the owner allowed, never all 18.

### Dry-run tool (new, required for full-publish v1)

`preview-post` renders exactly what would publish per platform (content after
overrides, media resolution, character-limit validation per platform) without
writing anything. Calling it before `publish-now` is **advisory, not enforced**
— no server-side preview→publish session coupling. The tool description directs
agents to preview first; the audit log records both calls independently.

### Rate Limiting (new — does not exist yet)

Per-key, per-tool sliding window (v1's 60 req/min sketch is the starting point).
Persist counters in DB (not in-memory Map — multi-instance Docker deploys would
desync; v1's Map approach is explicitly rejected).

### Audit (exists — reuse)

Log every MCP tool call via `auditLog.service.ts logAuditEvent` (who, which tool,
which post/business, result). Gives the admin audit UI full MCP visibility free.

### Input Validation

Zod on every tool (per conventions); `businessId` ownership check on every call
(user must belong to the business — mirror `findByIdFull`'s org-membership probe);
content length ≤ 2000 enforced by service; media by asset ID only (no arbitrary URLs).

## Usage Examples

### Natural Language via MCP Client

```typescript
const client = new McpClient('https://magicsync.dev/mcp', {
  headers: { Authorization: `Bearer ${MCP_API_KEY}` }
})

// "Schedule a launch post for Tuesday 2pm on Instagram + X"
// (businessId is key-bound — agents never pass it)
const post = await client.callTool('create-post', {
  content: 'Excited to announce our new feature! 🚀',
  platforms: ['instagram', 'twitter'],
  scheduledAt: '2026-09-08T14:00:00Z',
})

// "How did my posts do last month?"
const stats = await client.callTool('get-post-stats', {
  startDate: '2026-08-01',
  endDate: '2026-08-31',
})
```

### MCP Inspector (Dev Mode)

`/mcp/inspector` in dev: test tool calls, view resources, debug, monitor.

## Testing

```bash
pnpm test:mcp              # MCP tool handler tests (mock services)
pnpm test:integration:mcp  # end-to-end: key auth → tool → real service (test DB)
```

New tests only cover the wrapper layer (auth, scope checks, input mapping,
error mapping) — services already have their own coverage. Load test
publish-now path to confirm no double-publish under concurrent calls.

## Decisions (grill session 2026-09-07)

| # | Decision | Choice |
|---|---|---|
| 1 | Consumers | All three: own agent/chat, external assistants, third-party developers |
| 2 | Day-one power | Full publish power (no approval gate in v1) |
| 3 | Key scoping | Per-business keys |
| 4 | v1 tool scope | Everything: posts, stats, AI, media, inbox/comments, RAG, templates |
| 5 | OAuth AS | `@better-auth/mcp` (+`jwt`, `@better-auth/cimd`; CIMD profile + DCR fallback) — never deprecated `oidcProvider` (CVE-2026-53512); no hand-roll, no external IdP |
| 6 | OAuth token binding | Exactly one business per token, chosen at consent time (extends #3) |
| 7 | OAuth scopes | `mcp:read` / `mcp:full` become real scopes, enforced by existing `requireScope` |

Because 2+4 maximize blast radius (any keyholder's agent can publish publicly to
18 platforms with no undo), v1 ships with compensating guardrails, not an
approval gate: per-business keys (cross-business leaks impossible by
construction) + `mcp:read`/`mcp:full` scopes + per-key platform allowlists +
advisory `preview-post` dry-run + full audit logging of every call.

### Rollout sequence (same v1 scope, ordered waves)

Wave 1 (dogfood): own agent/chat only — posts, stats, AI generation. No compat
promises; break the API freely.
Wave 2 (harden): rate limiting (DB-backed), audit UI surfacing, key-management
UI with platform allowlists, public docs. Then open to external assistants.
**Wave 2a (web compat): ChatGPT-Token e2e (no new code) → OAuth 2.1 AS (Wave 2a-B
tasks above) → Claude.ai e2e. Docs `mcp.md` limitation notice lifted when OAuth ships.**
Wave 3 (platform): versioning + developer portal. Then third-party developers.
Wave 4 (everything else): inbox/comments (moderation actions need extra care —
`hide/delete` are destructive), RAG documents, templates, carousel/menu-board.

## Resolved (non-issues)

1. **Publish kinematics — advisory, not enforced.** `publish-now` stands alone;
   no server-side session coupling between `preview-post` and `publish-now`.
   Rationale: MCP tool calls are stateless; enforcing a preview-first session
   state adds fragile coupling for little gain — the tool description directs
   agents to preview first, and audit covers both calls independently.
2. **Key expiry — none by default.** `mcp:full` keys live until revoked.
   Rationale: per-business scoping + platform allowlists + audit already bound
   the blast radius; default expiry would add rotation UX (reminders, grace
   periods) without meaningful security gain at this stage. Revisit if keys leak.

## Success Metrics

1. All 18 tools + 4 resources work via MCP Inspector against real services
2. Response time < 500ms for reads, < 2s for create/update (service-bound)
3. Zero privilege-escalation incidents (cross-business access impossible)
4. No double-publish under concurrent publish-now calls
5. An external agent (Claude Desktop) completes create → schedule → publish → stats end-to-end
6. ChatGPT web (Token) completes list → create → stats end-to-end (Wave 2a-A)
7. Claude.ai web (OAuth) completes connect → list → create → stats end-to-end (Wave 2a-B)
8. Revoked OAuth grant fails introspection immediately (no stale-access window)
