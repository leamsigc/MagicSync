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
> **Status:** NOT STARTED.

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
| Story-DM triggers (`messages` webhook) | Webhook subscribe | **Phase B** — needs Meta webhook infra (we have none; grep `webhook` = 0 hits) | B |
| Follow gate (`is_user_follow_business`) | Flag arrives on messaging webhook | **Phase B** — flag only exists on webhook payloads. Phase A ships the `followGate` schema flag + follow-prompt template; enforcement lands with webhooks | B |
| Inbox (read/reply DMs, 24h window) | Cached conversations | IG `/{ig-user-id}/conversations` read + reply; extends Gap 2b (FB done) | B |
| Worker process (BullMQ/Redis) | Separate process | Not needed — Nitro `defineTask` + DB-backed queue is our architecture (see `JOB-QUEUE.md`); sending happens inline in the task with backoff rows | — |

## 2. Architecture (Phase A)

```
Meta IG comments (poll, no webhooks yet)
    │  Nitro task `autoreply:process` every 15m (same cron as social:post)
    ▼
AutoReply.service.ts (scheduler layer, ServiceResponse<T>, never throws)
    ├─ due campaigns ← entityDetails (type=autoreply_campaign, enabled)
    ├─ for each: fetch comments via IG plugin getComments() (watched post IDs)
    ├─ skip seen (autoreply_state cursor) · skip self · match keywords
    ├─ per-commenter cooldown (one DM per user per campaign)
    ├─ rate check (PlatformRateLimiter + hourly counter ≤ 750)
    ├─ send DM: NEW igPlugin.sendPrivateReply(commentId, text)
    ├─ optional public replyToComment()
    └─ write autoreply_log row (sent|skipped|failed + reason)
         │ reads/writes
         ▼
entity_details rows (ZERO migrations — §3)
         ▲ reads/writes
GET/POST /api/v1/auto-reply/campaigns* ◀── useAutoReply ◀── /app/auto-reply
GET /r/{campaignId}/{linkId} (public redirect + click count)
```

## 3. Storage design — `entity_details` only

`entity_details(id, entity_id, entity_type, details JSON, createdAt, updatedAt)`.
`id` = `randomUUID()`. All reads/writes go through a new
`AutoReplyStore` inside the service (never raw Drizzle in routes).

| `entity_type` | `entity_id` | `details` JSON shape |
|---|---|---|
| `autoreply_campaign` | `{userId}::{campaignId}` | `{ id, userId, businessId, name, platform: 'instagram', socialAccountId, externalPostIds: string[], matchAllPosts?: boolean, keywords: string[], matchMode: 'whole' \| 'partial', dmTemplate: string, linkIds: string[] (max 2), publicReplyTemplate?: string, storyDmEnabled?: false, followGate: boolean, followPromptTemplate?: string, enabled: boolean, createdAt, updatedAt }` |
| `autoreply_state` | `{campaignId}::{externalPostId}` | `{ lastSeenCommentId?: string, lastCheckedAt: string, contactedUserIds: string[] (cap 2000, FIFO trim) }` |
| `autoreply_state` | `{campaignId}::rate::{hourBucket}` | `{ count: number }` (`hourBucket` = `yyyyMMddHH` UTC; stale buckets deleted by the task) |
| `autoreply_log` | `{campaignId}::{ISO-ts}::{rand6}` | `{ commentId, authorId, authorName, matchedKeyword?: string, action: 'sent' \| 'skipped' \| 'failed', reason: string, at: string }` — task prunes to newest 500/campaign |
| `autoreply_link` | `{campaignId}::{linkId}` | `{ label, target: string (https URL), clicks: number }` |

Why this is safe: same access pattern as `carousel.service.ts` (scoped `like(entityId, '{userId}::%')`
for ownership, `eq(entityType)` + `eq(entityId)` for point reads). No indexes needed at
v1 volumes; note in code that `entity_id` `like` scans are acceptable <10k rows.

## 4. Code changes (Phase A)

### 4.1 IG plugin — one new method (no other plugin touched)
`packages/scheduler/server/services/plugins/instagram.plugin.ts`
- `sendPrivateReply(commentId, message): Promise<{ success, messageId?, error? }>`
  → `POST /{comment-id}/private_replies?message={text}` via `_getGraphApiUrl` +
  `this.fetch` (same helpers as `getComments`). Returns `{ success:false }`
  (never throws) on Meta errors incl. 24h-window / self-comment rejections.
- Base-class default: add `sendPrivateReply` returning `{ success:false,
  error:'Not implemented' }` next to `likeComment/hideComment/deleteComment`
  defaults + `SchedulerPost` delegation (Gap 2b established this exact pattern).

### 4.2 `AutoReply.service.ts` (NEW, scheduler layer)
Singleton `autoReplyService`. All methods `ServiceResponse<T>`, try/catch, never throw.
- `listCampaigns(userId)`, `getCampaign(userId, id)`, `createCampaign(userId, data)`
  (zod-validated at route; service re-checks ownership via entityId prefix),
  `updateCampaign`, `deleteCampaign` (deletes campaign + state + logs + links rows),
  `toggleCampaign` (thin wrapper over update).
- `getLogs(userId, campaignId, { limit, cursor })` — newest-first, parses log rows.
- `getStats(userId, campaignId)` — `{ sent, skipped, failed, clicksPerLink[] }`
  aggregated from log/link rows (no new tables, computed on read, capped scans).
- `processDueCampaigns()` — the task entrypoint: for each enabled campaign →
  resolve account (`socialMediaAccountService.getAccountById(id, userId)` ownership
  check) → `getComments` per watched post → match → cooldown → rate → send →
  log. Returns `{ campaigns, checked, sent, skipped, failed }`.
- Matcher (pure, unit-tested): `matchKeywords(text, keywords, mode)` —
  case-insensitive, unicode word boundaries (`\p{L}\p{N}_` aware) for `whole`,
  substring for `partial`; returns matched keyword or null. First keyword wins.
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
- `GET campaigns/[id]/logs/index.get.ts` (`limit`/`cursor`), 
  `GET campaigns/[id]/stats/index.get.ts`.
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

## 6. Phase B (explicitly out of v1, tracked here so it isn't forgotten)

1. Meta webhook subscribe (`comments` + `messages` fields): verify endpoint
   (`hub.verify_token`), receiver route, HMAC check → enqueue by writing a
   `autoreply_seen` row; task picks it up within the minute (keeps single
   sender path, no BullMQ needed).
2. Enforce `followGate` via `is_user_follow_business` from messaging payloads.
3. Story-DM triggers (same webhook, `story_mentions`/`messages`).
4. IG conversations read/reply → completes inbox Messages tab (with Gap 2b).

## 7. Verification (must all pass before merge)

- [ ] `pnpm --filter @local-monorepo/db db:generate` outputs **no changes**
  (zero-migration proof — paste output in PR).
- [ ] esbuild clean on all touched/added TS files.
- [ ] Unit tests: matcher (whole/partial/unicode/case), `renderTemplate`
  (username + link slots + escaping), cooldown trim, hour-bucket math.
- [ ] Dry-run: `test` endpoint + task against a real IG Business account in
  sandbox mode — comment `LINK` → log row `sent`, no duplicate on re-run
  (cursor + cooldown), self-comment → `skipped/self`.
- [ ] Conventions checklist (`conventions.md`): service-layer-only DB,
  `ServiceResponse<T>` never throw, zod on writes, i18n ×4, no secrets.
- [ ] Load sanity: 50 campaigns × 20 posts poll cycle completes < 5 min on
  sqlite (logs query count).

## 8. Success criteria

1. Comment `LINK` on a watched reel → private-reply DM within 15 min (poll
   cadence), optional public reply posted, log row `sent`.
2. Non-matching comments → no send, no log spam (only cursor advance).
3. Same user commenting twice → exactly one DM (cooldown).
4. Hourly counter caps at 750/account; overflow retried next tick, owner
   notified once.
5. Clicks + CTR per link visible on campaign card; redirect 302s correctly.
6. Disabling a campaign stops all sends within one tick.
7. `db:generate` clean — the feature ships with **zero migrations**.

## 9. Non-goals (will say no to)

- Webhooks, story triggers, follow-gate enforcement (Phase B).
- Non-IG platforms in v1 (FB already has conversations via Gap 2b; X/Bluesky
  have no DM-send API path in our plugins).
- Visual flow builder (Manychat-style) — form + presets only.
- A/B testing of templates (resist; logs give manual iteration).
