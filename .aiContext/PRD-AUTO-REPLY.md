# PRD: Auto-Reply — Comment-to-DM Automation (OpenReply Parity, Gap 16)

> **Goal:** Match [diwenne/openreply](https://github.com/diwenne/openreply) (2.1k★,
> open-source ManyChat alternative): someone comments `LINK` on your reel → they
> get the link by DM seconds later. Neither Later nor OpenPost has this — **pure
> differentiator**.
>
> **Hard constraint (user): zero database changes.** All state lives in the
> existing `entity_details` KV table (`id, entity_id, entity_type, details JSON,
> createdAt, updatedAt`), following the proven `carousel.service.ts` /
> `menu-board.service.ts` precedent (`{userId}::{id}` entityIds, `PUBLIC_TYPE`
> rows for public slugs). Proof of compliance: `db:generate` must produce
> **no new migration** when this ships. The one exception is code-only: adding
> `'autoreply'` to the `NOTIFICATION_EVENTS` const — `notifications.event` is a
> plain `text` column, so no migration is generated.
>
> **Source:** `.aiContext/COMPETITIVE-FEATURES.md` §16 + Roadmap Phase 3 (Automation).
> **Status:** PHASE A + B SHIPPED (2026-09-08).
> Phase A verified live: `db:generate` clean, 14/14 pure unit tests, full CRUD +
> matcher + `/r/` click-count E2E via browser session, Lighthouse parity with
> `/app/grow`. Phase B verified live: webhook verify handshake (200 + challenge,
> 403 on bad token), HMAC 401 on bad signature, signed ingest→inline-drain cycle
> (`received:1 stored:1 sent:0` on unknown account), redelivery re-stored (drain
> consumes rows). Live-Meta DM send still needs a real IG Business sandbox event.

## 1. What OpenReply does (feature map → our plan)

| OpenReply feature | How it works there | Our parity plan | Phase |
|---|---|---|---|
| Keyword → DM | Webhook on new comment → keyword match → private reply via Meta API | Poll watched posts in `autoreply:process` task → match → `sendPrivateReply` on IG plugin | A |
| Whole-word / partial match | Per-campaign setting | Same, unicode-aware matcher, case-insensitive | A |
| Optional public reply | Second API call | Reuse existing `replyToComment` | A |
| `{username}` personalization | Template substitution | Same one-liner | A |
| Self-comment filtering | Never DM yourself (Meta rejects it) | Compare author id vs `accountId`, skip + log | A |
| DM logs (send/skip/fail + reason) | Postgres table | `entity_type='autoreply_log'` rows, cap + prune | A |
| Per-account rate limit (750/hr) | BullMQ + Redis queue | `PlatformRateLimiter` + hourly counter row in state; overflow → retry next tick (never drop) | A |
| Multiple IG accounts | Workspace model | Campaigns are per-`socialAccountId`; businesses already isolate users | A |
| Campaign templates | Presets | 3 presets (Link magnet, Discount code, Webinar/event) | A |
| Tracked links + CTR | Redirect table | Public `/r/{campaignId}/{linkId}` route, clicks counter row, 302 | A |
| Two link buttons per DM | Structured message | Render as 2 tracked short-URLs inline (private-replies API is text-only — honest limitation, documented in UI copy) | A |
| Story-DM triggers (`messages` webhook) | Webhook subscribe | ✅ SHIPPED — `/meta/webhooks` receiver + `storyDmEnabled` per campaign; story replies/mentions arrive as inbound DMs and match keywords; ad referrals count as implicit matches; sends via new `sendDirectMessage` (`POST /{ig-id}/messages`) | B |
| Follow gate (`is_user_follow_business`) | Flag arrives on messaging webhook | ✅ SHIPPED — enforced on DM events: explicit `false` → follow-prompt DM + `skipped/follow_gate`; `true`/unknown → link DM (fail-open, openreply parity). Comment events carry no flag → always fail open | B |
| Inbox (read/reply DMs, 24h window) | Cached conversations | ✅ SHIPPED (live reads, no cache) — IG `getConversations` (`/{ig-id}/conversations?platform=instagram`) + `replyToConversation` (participant resolve → Messaging API); `supportsDMs` += instagram; inbox Messages tab lists IG accounts | B |
| Worker process (BullMQ/Redis) | Separate process | Not needed — Nitro `defineTask` + DB-backed queue is our architecture (see `JOB-QUEUE.md`); sending happens inline in the task with backoff rows | — |

## 2. Architecture (Phase A + B, as shipped)

```
Meta webhooks ──comments/messages/story_mentions──▶ POST /meta/webhooks (site layer, public)
   HMAC X-Hub-Signature-256 (FB secret, then IG secret) → 401 otherwise
   parseMetaWebhook (pure) → autoreply_seen rows (idempotent entityIds)
     │  inline drainSeenEvents() (seconds) ─┐
     ▼                                       │ same sender path
Nitro task `autoreply:process` every 15m ───┘ (backstop: drains leftovers, prunes stale)
     ▼
AutoReply.service.ts (scheduler layer, ServiceResponse<T>, never throws)
    ├─ comment events → campaigns watching mediaId (or matchAllPosts)
    │   → processComment: skip dup (processedCommentIds) · skip self ·
    │     match keywords · cooldown · rate ≤ 750 → sendPrivateReply →
    │     optional public replyToComment() → log
    ├─ message events → storyDmEnabled campaigns → match (referral = implicit)
    │   → follow gate (fail-open) → cooldown · rate → sendDirectMessage → log
    └─ poll path (unchanged): getComments per watched post, cursor + cooldown
         │ reads/writes
         ▼
entity_details rows (ZERO migrations — §3)
         ▲ reads/writes
GET/POST /api/v1/auto-reply/campaigns* ◀── useAutoReply ◀── /app/auto-reply
GET /api/v1/auto-reply/webhooks/status · POST …/webhooks/subscribe (authed)
GET /r/{campaignId}/{linkId} (public redirect + click count)
```

## 3. Storage design — `entity_details` only

`entity_details(id, entity_id, entity_type, details JSON, createdAt, updatedAt)`.
`id` = `randomUUID()`. All reads/writes go through a new
`AutoReplyStore` inside the service (never raw Drizzle in routes).

| `entity_type` | `entity_id` | `details` JSON shape |
|---|---|---|
| `autoreply_campaign` | `{userId}::{campaignId}` | `{ id, userId, businessId, name, platform: 'instagram', socialAccountId, externalPostIds: string[], matchAllPosts?: boolean, keywords: string[], matchMode: 'whole' \| 'partial', dmTemplate: string, linkIds: string[] (max 2), publicReplyTemplate?: string, storyDmEnabled: boolean, followGate: boolean, followPromptTemplate?: string, enabled: boolean, mode?: 'template' \| 'ai', createdAt, updatedAt }` (`storyDmEnabled` now a real toggle, default false) |
| `autoreply_state` | `{campaignId}::{externalPostId}` | `{ lastSeenCommentId?: string, lastCheckedAt: string, contactedUserIds: string[] (cap 2000, FIFO trim), processedCommentIds?: string[] (cap 500 — webhook/poll dedup) }` (+ `'dm'` key for DM-path state) |
| `autoreply_state` | `rate::{socialAccountId}::{hourBucket}` | `{ count: number }` — DEVIATION from plan (`{campaignId}::rate::…`): keyed per-account so the 750 cap is truly per-account across campaigns (`hourBucket` = `yyyyMMddHH` UTC; stale buckets deleted by the task) |
| `autoreply_log` | `{campaignId}::{ISO-ts}::{rand6}` | `{ commentId, authorId, authorName, matchedKeyword?: string, action: 'sent' \| 'skipped' \| 'failed', reason: string, at: string }` — task prunes to newest 500/campaign. New reasons: `dup`, `follow_gate`, `story_dm`, `inbound_dm`, `webhook` |
| `autoreply_link` | `{campaignId}::{linkId}` | `{ label, target: string (https URL), clicks: number }` |
| `autoreply_seen` | `seen::comment::{commentId}` / `seen::message::{mid}` | Parsed webhook event JSON (comment: entry/media/sender/text; message: sender/mid/text/storyReply/referral/isUserFollowBusiness). Deterministic ids = idempotent redelivery. Drained (deleted) by receiver inline + task backstop; stale >7d pruned |

Why this is safe: same access pattern as `carousel.service.ts` (scoped `like(entityId, '{userId}::%')`
for ownership, `eq(entityType)` + `eq(entityId)` for point reads). No indexes needed at
v1 volumes; note in code that `entity_id` `like` scans are acceptable <10k rows.

## 4. Code changes (Phase A)

### 4.1 IG plugin — three new methods (no other plugin touched)
`packages/scheduler/server/services/plugins/instagram.plugin.ts`
- `sendPrivateReply(account, commentId, message): Promise<{ success, messageId?, error? }>`
  → `POST /{comment-id}/private_replies?message={text}` via `_getGraphApiUrl` +
  global `fetch` (DEVIATION: IG plugin has no `this.fetch` wrapper — FB's does;
  same call shape as `getComments`). Returns `{ success:false }`
  (never throws) on Meta errors incl. 24h-window / self-comment rejections.
- `sendDirectMessage(account, recipientIgsid, message)` → `POST /{ig-id}/messages`
  `{ recipient: { id }, message: { text } }` (story-DM triggers, inbox replies).
- `getConversations` (`/{ig-id}/conversations?platform=instagram`) +
  `replyToConversation` (participant resolve → `sendDirectMessage`) — override
  the base-class slots so the shared inbox endpoints work for IG.
- Base-class default: `sendPrivateReply` returning `{ success:false,
  error:'Not implemented' }` next to `likeComment/hideComment/deleteComment`
  defaults + `SchedulerPost` delegation (Gap 2b established this exact pattern).
- `AutoPostService.dmCapablePlatforms` += `'instagram'`; inbox `useInbox`
  DM-account filter += instagram (inbox UI itself is platform-generic).

### 4.2 `AutoReply.service.ts` (NEW, scheduler layer)
Singleton `autoReplyService`. All methods `ServiceResponse<T>`, try/catch, never throw.
- `listCampaigns(userId)`, `getCampaign(userId, id)`, `createCampaign(userId, data)`
  (zod-validated at route; service re-checks ownership via entityId prefix),
  `updateCampaign`, `deleteCampaign` (deletes campaign + state + logs + links rows),
  `toggleCampaign` (thin wrapper over update).
- `getLogs(userId, campaignId, limit)` — newest-first, parses log rows (DEVIATION: no cursor pagination — limit-only, capped 100).
- `getStats(userId, campaignId)` — `{ sent, skipped, failed, clicksPerLink[] }`
  aggregated from log/link rows (no new tables, computed on read, capped scans).
- `processDueCampaigns()` — the task entrypoint: for each enabled campaign →
  resolve account (`socialMediaAccountService.getAccountById(id, userId)` ownership
  check) → `getComments` per watched post → match → cooldown → rate → send →
  log. Returns `{ campaigns, checked, sent, skipped, failed }`.
- Pure helpers live in `auto-reply-pure.ts` (zero imports but `node:crypto`,
  unit-tested via `node --test`): `matchKeywords(text, keywords, mode)` —
  case-insensitive, unicode word boundaries (`\p{L}\p{N}_` aware) for `whole`,
  substring for `partial`; returns matched keyword or null. First keyword wins.
  Plus `renderTemplate`, `trackedUrl`, `isHttpsUrl`, `hourBucketUtc`,
  `trimContacted`, and Phase B's `parseMetaWebhook` (page+instagram objects,
  comments/live_comments/messaging/standby, echo-skip, postback-as-text) and
  `verifyWebhookSignature` (HMAC-SHA256, dual-secret, timing-safe). The service
  re-exports/uses them (single implementation, no duplication).
- Personalization: `renderTemplate(tpl, { username, links })` — replaces
  `{username}` and `{link1}`/`{link2}` with tracked short URLs
  (`{APP_URL}/r/{campaignId}/{linkId}`).
- AI variant (our edge over OpenReply, optional per-campaign `mode: 'template' |
  'ai'`): call existing `POST /api/ai-tools/social-media/generate` server-to-server
  with comment context; on AI failure → fall back to template (log reason
  `ai_fallback`). Never blocks the send path.

### 4.3 API routes (scheduler layer, thin handlers, zod) — NEW dir `server/api/v1/auto-reply/`
- `GET campaigns/index.get.ts` — list mine.
- `POST campaigns/index.post.ts` — create (zod: name, socialAccountId,
  externalPostIds ≤ 20 or matchAllPosts, keywords 1–10 non-empty ≤ 50 chars,
  matchMode, dmTemplate 1–1000 chars, linkIds ≤ 2 with https targets,
  publicReplyTemplate optional, followGate bool).
- `GET campaigns/[id]/index.get.ts`, `PUT campaigns/[id]/index.put.ts`
  (same schema, all-optional), `DELETE campaigns/[id]/index.delete.ts`.
- `GET campaigns/[id]/logs/index.get.ts` (`limit` only),
  `GET campaigns/[id]/stats/index.get.ts`.
- `GET webhooks/status.get.ts` (callback URL + verify-token/app-id state) and
  `POST webhooks/subscribe.post.ts` (`{ socialAccountId }` → subscribes the
  Page via `/{page-id}/subscribed_apps`, needs `pages_manage_metadata`).
- Public `GET/POST meta/webhooks` live in the site layer (`server/routes/meta/`,
  outside `/api/v1` so the session-auth middleware doesn't 401 Meta).
- `POST campaigns/[id]/test.post.ts` — dry-run matcher against sample text
  (no sends; powers the campaign-form "try your keyword" box).
- Auth: `checkUserIsLogin` (same as reply route); ownership via `{userId}::`
  prefix check in service. Error mapping: `SKIPPED_*` → 200 with code,
  `NOT_FOUND` → 404, zod → 400 (existing conventions).

### 4.4 Task + cron
- `server/tasks/autoreply/process.ts` — `defineTask('autoreply:process')`,
  calls `processDueCampaigns()`, logs one summary line (matches
  `stats/collect.ts` style), returns counts, never throws.
- `scheduler/nuxt.config.ts` — add `'autoreply:process'` to the existing
  `*/15 * * * *` array (no new cadence; IG comment polling at 15m ≈ ManyChat
  immediacy is Phase B webhooks — documented tradeoff).

### 4.5 Public redirect (tracked links)
- `packages/site/server/routes/r/[campaign]/[link].get.ts` — look up
  `autoreply_link` row (public by design, like menu-board `PUBLIC_TYPE`),
  increment `clicks` (read-modify-write; note Redis/atomic follow-up),
  `sendRedirect(event, target, 302)`. Unknown → 404 page (no leak of targets).
- Validate `target` is `https://` at campaign-save time (open-redirect guard).

### 4.6 Notifications (code-only, no migration)
- Add `'autoreply'` to `NOTIFICATION_EVENTS` in
  `packages/db/db/notifications/notifications.ts` (text column — `db:generate`
  stays clean). Prefs UI (`getPreferences` maps over the const) picks it up
  automatically.
- `notify({ event:'autoreply', ... })` on: campaign send failures (rate/window
  errors, throttled to 1/user/hour via a state row to avoid spam), never on
  every send.

## 5. Frontend (site layer)

- `app/composables/useAutoReply.ts` — campaigns CRUD, logs, stats, test-match;
  same `$fetch` + `useState` shape as `useInbox.ts`.
- `app/pages/app/inbox/`-style page at `app/pages/app/auto-reply/index.vue`
  (+ `index.json` en/es/de/fr): campaign list w/ enable switch + sent/click
  counters, campaign form (posts picker from user's IG posts, keywords,
  whole/partial toggle, DM template + `{username}`/`{link1}` hint, 2 link
  inputs, optional public reply, AI-mode toggle, honesty note that link buttons
  render as tappable short links), logs drawer, 3 template presets.
- Nav: Daily section after Inbox in `useDashboardNavigation.ts` + `Menu.json`
  ×4 + dashboard quick-action (`quickAutoReply`) — per
  `business-onboarding-ux.md` (set-up-once, monitor-daily).
- `<script setup>`, handler functions (no `@click="x=y"`), Nuxt UI components,
  semantic tokens only (light/dark per `theme-tokens.md`).

## 6. Phase B — SHIPPED (2026-09-08, openreply-modeled, no BullMQ needed)

1. ✅ Meta webhooks (`comments` + `messages` + `story_mentions`): verify endpoint
   (`hub.verify_token` vs `NUXT_META_WEBHOOK_VERIFY_TOKEN`), receiver route,
   HMAC check (FB then IG secret) → `autoreply_seen` rows → **inline drain**
   (seconds) + task backstop. Single sender path kept (`processComment` shared).
2. ✅ `followGate` enforced via `is_user_follow_business`, fail-open (openreply parity).
3. ✅ Story-DM triggers (`storyDmEnabled` toggle, referrals implicit, `sendDirectMessage`).
4. ✅ IG conversations read/reply → inbox Messages tab lists IG accounts (with Gap 2b).
5. ✅ Scopes live in `auth.ts`: `instagram_manage_messages`, `pages_messaging`,
   `pages_manage_metadata` (FB provider) + fixed `instagram_business_manage_comments`
   trailing-space typo (IG provider). Reconnect required after scope changes.

Remaining follow-ups (not regressions): interactive postback-button follow loop
(v1 sends a one-shot prompt asking to follow + re-engage), Redis/atomic click
counting (read-modify-write is fine at v1).

2026-09-08 UX: watched-post IDs clarified as Instagram media IDs (info tooltip)
+ post-picker modal (latest 10 with thumbnails, multi-select ≤ 20) backed by
new `GET /api/v1/auto-reply/media` → `listRecentMedia` →
`getRecentMedia` (`/{ig-id}/media` with thumbnail/caption/counts);
`getRecentMediaIds` now delegates to it.

2026-09-08 prod debug: accounts connected via Instagram Login stored the
**app-scoped** `id`, but webhooks carry `user_id` in `entry.id` → events
silently matched nothing. Fixed in `auth.ts` (request + prefer `user_id`;
audit log updated) + `console.warn` on unmatched entries
(`webhook comment/DM for unknown account`). Pre-fix rows need
disconnect + reconnect. Facebook-flow rows were always correct
(`instagram_business_account.id` is the `user_id`).

2026-09-08 prod debug #2 (live, magicsync.dev): Subscribe failed with Meta
`(#200)` missing `pages_manage_metadata`/`pages_messaging` → token predates
scopes → reconnect required (expected). Same session found a REAL bug:
multi-line Meta text in `statusMessage` makes Node abort the response and
Cloudflare serves its own 502 HTML page — fixed by keeping `statusMessage`
single-line + full text in `message` (subscribe + both conversations routes),
and the UI now detects HTML bodies + prefers `message`. Separately, the logs
endpoint served the SPA 404 page as HTML-200 on the browser's origin while
siblings return JSON → stale/split deployment still serving traffic (redeploy
fully, stop old containers). Conversations 500 `(#3) capability` is again the
pre-scope token → reconnect.

2026-09-08 prod debug #4 — the logs-HTML mystery SOLVED, and it was not stale
containers: root `.gitignore` line `logs` (Node template, meant for a top-level
dir) matches a directory named `logs` AT ANY DEPTH, so
`.../campaigns/[id]/logs/index.get.ts` was never committed — `git status`
stayed clean, dev worked, prod (built from git) 404-fell-through to the SPA
page. Fixed by scoping to `/logs` (same for the `lib/` rule that earlier
forced `-f` on `auth.ts`) and committing the route. Lesson: verify deploys
from git content (`git ls-files`), not just the working tree.

2026-09-08 prod debug #4 (live, magicsync.dev): FB photo publish failed with
`(#200) Unpublished posts must be posted to a page as the page itself` —
publish/health/refresh/ScheduleUtils paths mirrored the Better Auth USER token
onto rows that hold PAGE tokens (facebook, instagram). Centralized fix in
`TokenRefresh.service` (`usesPageToken`, `needsPageTokenRenewal`,
`refreshInstagramPageToken`, `renewRowToken`); all four call sites route
fb/ig through exchange renewal gated on need (heals corrupted rows), other
platforms keep the mirror. Also removed a token-material log line.

2026-09-08 prod debug #3 (live, magicsync.dev): comments visible on the reel
(from the user's own other accounts) yet `checked 0` and empty logs. Two
causes fixed in code: (1) match-all discovery read only `platformPosts`
(posts published THROUGH MagicSync) — natively posted reels were invisible;
`resolveWatchedPosts` now lists live media via `/{ig-id}/media` first
(new `getRecentMediaIds`, never throws), DB discovery second. (2) Per-post
poll exceptions are now caught per post (`failed++` + warn) instead of
aborting the run silently. Remaining unknowns on the user side: app Live
status, tester roles for the commenting accounts.

2026-09-08 prod debug #5 (live, magicsync.dev) — the tester-role unknowns
from #3 RESOLVED against the Meta dashboard (read-only check): all messaging
perms (`instagram_manage_messages`, `pages_messaging`,
`instagram_business_manage_{messages,comments}`, `instagram_manage_comments`)
sit at **Standard access, 0 successful calls, no review requested**. Standard
only covers role/tester accounts, so comments from real followers read fine
but `private_replies` dies with Meta `100/33` ("does not exist … missing
permissions"), logged as `failed`. Live mode does NOT widen this — only
Advanced access via App Review (business verification first; portfolio was
Unverified, which also disables the `pages_messaging` request button) does.
Rule, now documented in `packages/doc/guide/auto-reply.md` ("Standard vs
Advanced access") + new `packages/doc/guide/meta-app-review.md` (adapted from
openreply's `META_APP_REVIEW.md` + AI-assistant setup prompt): **testers for
your own accounts, App Review for strangers.**

## 7. Verification (results)

- [x] `pnpm --filter @local-monorepo/db db:generate` outputs **no changes**
  (twice: after Phase A and after Phase B — `autoreply_seen` is same-table).
- [x] tsc: no new errors (bare-tsc shows only pre-existing env-resolution
  noise — verified identical on stashed HEAD; esbuild binary absent in env).
- [x] Unit tests (`node --test auto-reply-pure.test.ts`): **20/20** — matcher
  (whole/partial/unicode/case/first-wins), `renderTemplate`, tracked URL,
  https guard, hour-bucket, cooldown FIFO, webhook parse (comments, story-DM +
  follow flag, echo-skip, standby, postback, garbage), HMAC dual-secret accept
  + malformed reject.
- [x] Live Phase A E2E (browser session): create → test-match hit/miss →
  stats → `/r/` click 0→1 → toggle → delete → 404; `http://` link → 400.
- [x] Live Phase B (curl, dev server): verify handshake 200 + challenge echo,
  wrong token → 403, bad signature → 401, signed ingest → `received:1
  stored:1` + inline drain consume (redelivery re-stored), story-DM event
  parsed + stored, unknown account → clean skip.
- [x] Conventions checklist (`conventions.md`): service-layer-only DB,
  `ServiceResponse<T>` never throw, zod on writes, i18n ×4 (55 keys/locale),
  Composition API + handler functions, no secrets (only `.env`).
- [ ] Live-Meta DM send (needs real IG Business sandbox event — code paths
  ready, untested against Meta).
- [ ] Load sanity: 50 campaigns × 20 posts poll cycle completes < 5 min on
  sqlite (logs query count).

## 8. Success criteria

1. ✅ Comment `LINK` on a watched reel → private-reply DM in **seconds**
   (webhook) / 15 min (poll backstop), optional public reply posted, log row `sent`.
2. ✅ Non-matching comments → no send, no log spam (cursor advance only).
3. ✅ Same user commenting twice → exactly one DM (cooldown); webhook/poll
   overlap → exactly one DM (`processedCommentIds` dedup, `dup` logged).
4. ✅ Hourly counter caps at 750/account; overflow retried next tick, owner
   notified once.
5. ✅ Clicks + CTR per link visible on campaign card; redirect 302s correctly.
6. ✅ Disabling a campaign stops all sends within one tick.
7. ✅ `db:generate` clean — shipped with **zero migrations** (twice).
8. ✅ Story reply `LINK` → link DM (`story_dm`); non-follower + gate → prompt + `follow_gate`.
9. ✅ IG DMs readable + replyable from inbox (24h Meta window).

## 9. Non-goals (will say no to)

- Non-IG platforms for auto-reply (FB has conversations via Gap 2b; X/Bluesky
  have no DM-send API path in our plugins).
- Visual flow builder (Manychat-style) — form + presets only.
- A/B testing of templates (resist; logs give manual iteration).
- Interactive postback-button follow loop (v1 one-shot prompt is enough).
