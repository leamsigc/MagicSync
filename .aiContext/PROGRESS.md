# Progress — Critical Gaps Implementation

Track progress through the competitive feature implementation.

## Convention
- `[ ]` = Not started
- `[-]` = In progress
- `[x]` = Completed

---

## Critical Gap 1 — Analytics Parity ✅ COMPLETE

### Phase A — collector & sync-state
- [x] `packages/db/db/stats/stats.ts` — `account_metrics`, `post_metrics`, `stats_sync_state` tables
- [x] `packages/scheduler/server/services/stats-normalizer.ts` — `NormalizedPostMetrics` mapping
- [x] `packages/scheduler/server/services/StatsCollector.service.ts` — sync-state, due computation, collection, backoff, prune
- [x] `packages/scheduler/server/tasks/stats/collect.ts` — `defineTask('stats:collect')`
- [x] `packages/scheduler/nuxt.config.ts` — scheduled task registration

### Phase B — reads & API
- [x] `packages/scheduler/server/services/Analytics.service.ts` — all query methods
- [x] `GET /api/v1/stats` — multi-mode endpoint
- [x] `GET /api/v1/stats/export` — CSV export
- [x] `POST /api/v1/stats/collect` — due-gated + force
- [x] `GET /api/v1/stats/dashboard` — summary + graph series
- [x] `GET /api/v1/posts/[id]/stats` — post metrics history

### Phase C — frontend
- [x] `usePlatformStats.ts` — range presets, comparison, postMetrics, topPosts, exportCsv
- [x] `app/pages/app/index.vue` — range selector, export button, top-posts table w/ Repurpose CTA
- [x] `DashboardOverviewCards.json` — new keys (en/es/de/fr)

### Phase D — migration & cleanup
- [x] Migration `0008_account-oauth-stats-inbox-auto-repost.sql` — stats tables + inbox + oauth + repost columns, squashed into one clean migration (was `0008_account-oauth-stats-inbox.sql` + hand-written `0009_auto_repost.sql`; see `db-migration-squash` pattern)
- [x] Remove `SNAPSHOT_DAYS = 30` dead constant in `PlatformStats.service.ts`
- [x] Delete legacy `PostStatsCache` utils
- [x] Refactor `PlatformStats.service.ts` to delegate reads to Analytics.service
- [x] Update `COMPETITIVE-FEATURES.md` row status
- [ ] backfill: legacy `entity_details` → `account_metrics` one-time copy (optional — new collection is live)

---

## Critical Gap 2 — Social Inbox ✅ COMMENTS COMPLETE (DMs → Gap 2b, Notifications → Gap 5)

### Phase A — Comment Moderation Backend
- [x] `SchedulerPost.service.ts` — `likeComment`, `hideComment`, `deleteComment` delegation methods
- [x] `AutoPostService.ts` — `likeComment`, `hideComment`, `deleteComment` with platform routing
- [x] `POST /api/v1/posts/[id]/comments/[platform]/like` — like a comment
- [x] `POST /api/v1/posts/[id]/comments/[platform]/hide` — hide/unhide a comment
- [x] `POST /api/v1/posts/[id]/comments/[platform]/delete` — delete a comment

### Phase B — Unified Inbox Backend
- [x] `packages/db/db/inbox/inbox.ts` — `inbox_items` table schema with indexes
- [x] `packages/scheduler/server/services/Inbox.service.ts` — `getUnifiedInbox`, `getUnreadCount`, `markAsRead`, `archiveItem`
- [x] `GET /api/v1/inbox` — unified inbox with filters (platform, type, post, read, archived, cursor)
- [x] `GET /api/v1/inbox/count` — unread count for badge
- [x] `POST /api/v1/inbox/read` — mark items as read
- [x] `POST /api/v1/inbox/archive` — archive items
- [x] `POST /api/v1/inbox/mark-all-read` — mark all as read

### Phase C — Unified Inbox Frontend
- [x] `packages/site/app/composables/useInbox.ts` — fetch inbox, mark as read, moderation actions
- [x] `packages/site/app/pages/app/inbox/index.vue` — unified inbox page with tabs, filters, comment cards
- [x] `packages/site/app/pages/app/inbox/index.json` — translations (en/es/de/fr)

### Phase D — Migration
- [x] Migration `0008_account-oauth-stats-inbox-auto-repost.sql` — `inbox_items` table with indexes (squashed; was wrongly documented as `0012_inbox-items.sql`)

---

## High-Priority Gaps (Next)

### Gap 3 — Auto-Reposting ✅ COMPLETE (2026-09-07 — see PRD-AUTO-REPOST.md)
- [x] Backend: `PostBatch` repost methods (`getDueReposts`/`createRepost`/`updateAutoRepostConfig`/`incrementRepostCount`, `ServiceResponse<T>`), `AutoRepost.service` (due/execute/process), `repost:process` task on `*/15` cron, `POST configure` + `GET [id]/config` endpoints
- [x] Frontend: `useAutoRepost` composable + `/app/posts/auto-repost` config page (postId, interval, max, enable; currentCount/nextRepostAt display)
- [x] Migration: squashed `0008_account-oauth-stats-inbox-auto-repost.sql` (check clean, fresh-DB 46 tables verified)

### Gap 4 — Grow Feature ✅ BLUESKY COMPLETE (2026-09-07)
- [x] Bluesky plugin: `getGrowFollowbacks` (followers-minus-following), `getGrowSuggestions` (`getSuggestedFollowsByActor` + `getProfiles` enrichment, excludes already-followed), `followAccount` (manual only)
- [x] `Grow.service` (scoring: follow-back 90, suggested 50+10, merged/deduped) + `GET /api/v1/accounts/[accountId]/grow` + `POST .../grow/follow` (zod DID, ownership check)
- [x] Frontend: `useGrow` + `/app/grow` page (account picker, recommendation cards, Follow buttons, i18n en/es/de/fr) + sidebar nav (Daily, after Inbox)
- [ ] Next slice: Mastodon (needs a plugin first — none exists; not in platform enum)

### Gap 5 — Notification System (see PRD-NOTIFICATIONS.md)
- [x] Slice 1: service hardened (`ServiceResponse<T>`, never throws), 4 routes unwrap, basic list UI + header badge
- [x] Slices 2–4: `event` taxonomy + triggers, `notification_preferences` + CRUD + UI prefs, immediate email + digest + mute-with-expiry — single migration `0009_notifications-events-prefs.sql` (squashed from 0009+0010+0011 per `db-migration-squash`; fresh-DB 47 tables verified; dev DB applied + bookkeeping recorded), esbuild clean

### Gap 2b — DM management ✅ FACEBOOK VERTICAL SLICE COMPLETE (2026-09-07)
- [x] Base: `PlatformConversation`/`GetConversationsResponse` types + `getConversations`/`replyToConversation` defaults + `SchedulerPost` delegation
- [x] Facebook plugin: `getConversations`/`replyToConversation` overrides (raw helpers renamed `*Raw`, 24h-window errors surfaced)
- [x] `AutoPostService`: `getConversations`/`replyToConversation` + explicit `supportsDMs()` gate (facebook-only for now)
- [x] Endpoints: `GET /api/v1/accounts/[accountId]/conversations` + `POST .../reply` (zod, ownership check, thin handlers)
- [x] Frontend: `useInbox` conversations + `/app/inbox` Messages tab (FB account picker, conversation cards, reply box, 24h-window note, i18n en/es/de/fr)
- [ ] Next slice: X/Bluesky/IG/Mastodon plugins + unified cross-account DM list

### Gap 7 — Best Time to Post ✅ COMPLETE (2026-09-07)
- [x] `Analytics.service.getBestTimes` (per-platform hour/day buckets from `post_metrics`, top-5 slots with ≥2 posts)
- [x] `GET /api/v1/stats?mode=best-times` + `usePlatformStats.fetchBestTimes` + dashboard card (i18n en/es/de/fr)

### Gate 0 — UI access (2026-09-07)
- [x] Inbox in sidebar Daily section (`useDashboardNavigation.ts` + `Menu.json` en/es/de/fr)
- [x] Inbox quick-action on `/app` dashboard (`quickInbox` en/es/de/fr)

### Gap 6 — MCP Server ✅ WAVE 1 COMPLETE (see PRD-MCP-TOOLKIT.md; verified live 2026-09-07)
- [x] Nuxt MCP Toolkit integration (`@nuxtjs/mcp-toolkit@0.19.0`, route `/mcp`, 18 tools + 4 resources, Bearer `org_` keys + OAuth via `@better-auth/mcp`)
- [x] MCP tools: create-post, list/get/update/delete-post, publish-now, retry-post, preview-post, post-platform-status, platforms, analytics, AI, media
- [x] Live e2e 2026-09-07: anon `tools/list` → `[]`; keyed `tools/list` → 18; create → get → status → retry(clean error) → calendar resource → delete; audit rows written
- [ ] Wave 2+: scoped-key issuance UI, DB rate-limit tuning, Wave 4 tools (inbox/RAG/templates), ChatGPT-Token web e2e, `publish-now` live-fire (needs real platform credentials)
