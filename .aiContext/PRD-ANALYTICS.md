# PRD: Analytics Parity — Beat OpenPost & Later (Critical Gap 1)

> **Goal:** Close the analytics gap from `COMPETITIVE-FEATURES.md` Critical Gap 1.
> Current state: **manual-only collection**, single overwrite cache row for post
> stats (`social_media_post_stats`), no time ranges (7/30/90), no cross-platform
> view, no export, no analytics→repurpose, and a *dead* `SNAPSHOT_DAYS = 30`
> constant that never actually prunes anything.
>
> Target (mirrors OpenPost): **adaptive background collection**, durable
> per-collection time-series for accounts **and** posts, explicit sync state,
> 7/30/90 comparison windows, CSV export, and analytics→repurpose flow.

## Reference implementations (read before coding)

- **[Mixpost]** `mixpost_metrics(account_id, data JSON, date)` + unique
  `(account_id, date)` — per-account daily snapshot table. `mixpost_imported_posts`
  holds external posts. (inovector/mixpost)
- **[OpenPost]** durable adaptive jobs + explicit sync state (last attempt / next
  due / permission / rate-limit / stale) + canonical normalized metric keys with
  "missing" ≠ zero. (docs/research/trypost-analytics-ai-comparison-2026-08-31.md)
- **[Postiz]** job-worker background collection (Temporal). Our equivalent is
  the existing Nitro `defineTask` infra.
- **[Mixpost/Postiz]** dashboards = per-platform cards + time-series charts, CSV
  export from the metrics tables.

## Architecture

```
Nitro scheduled task (every 6 hour) ──▶ tasks/stats/collect.ts
                    │
                    ▼
         StatsCollector.service.ts      ◀─── stats/collect.post.ts ("refresh now")
   - due gating via stats_sync_state     ◀─── stats/dashboard?refresh=1
   - adaptive cadence per post age
   - canonical metric normalization
                    │ writes
                    ▼
   ┌────────────────────────────────────────────────────────┐
   │ account_metrics  (per-account time series)             │
   │ post_metrics     (per-post   time series)              │
   │ stats_sync_state (when to collect next, backoff)       │
   └────────────────────────────────────────────────────────┘
                    ▲ reads
   Analytics.service ── GET /api/v1/stats (current|aggregated|timeseries|history|comparison|top-posts)
                        GET /api/v1/stats/dashboard (ranges 7/30/90 + freshness + top posts)
                        GET /api/v1/stats/export  (CSV)
   Dashboard page ─── range selector · freshness chips · export · top-posts→Repurpose
```

**Retention policy:** indefinite (no 30-day cap). `stats:collect` runs a prune
for failed rows only (optional env `STATS_RETENTION_DAYS=365`) to avoid garbage
growth — successful time-series rows are kept forever (matches OpenPost).

## Data model (db layer — `packages/db/db/stats/stats.ts`)

| table | purpose | key columns |
|---|---|---|
| `account_metrics` | snapshot row per collection | `socialAccountId, platform, followers, following, posts, engagement JSON, rawPayload, source(auto/manual), status, error, collectedAt` + idx `(socialAccountId, collectedAt)` |
| `post_metrics` | snapshot row per collection | `postId, platformPostId, socialAccountId, platform, externalPostId, metrics JSON, rawPayload, status, error, collectedAt` + idx `(postId, collectedAt)` |
| `stats_sync_state` | collector heartbeat | `socialAccountId UNIQUE, lastAttemptAt, lastSuccessAt, nextDueAt, status (idle/running/error/rate_limited), consecutiveFailures, lastError, backoffUntil` |

> **Migration is the LAST step.** Code is written against these tables; the
> Drizzle migration (`pnpm --filter @local-monorepo/db db:generate`) is generated
> and applied at the end of the milestone (per decision).

## Adaptive cadence (OpenPost-style)

| entity | age / rule | cadence |
|---|---|---|
| account stats | default | every 6h (env `STATS_ACCOUNT_INTERVAL_HOURS=6`) |
| post | < 6h old | 1h |
| post | 6–24h old | 3h |
| post | 1–3d old | 12h |
| post | 3–7d old | 24h |
| post | > 7d old | 168h (weekly) |
| failure backoff | exponential | 15m → 30m → … cap 6h |

## Implementation Tracker

Legend: `[ ]` not started · `[~]` in progress · `[x]` done (evidence required).

### Phase A — data model & collection
- [x] `packages/db/db/stats/stats.ts` — 3 tables + exports (`account_metrics`, `post_metrics`, `stats_sync_state` with indexes)
- [x] `packages/db/db/schema.ts` — export tables + relations (`postMetrics.post`/`socialMediaAccount`, `accountMetrics.socialMediaAccount`, `statsSyncState.socialMediaAccount`)
- [x] `packages/scheduler/server/services/stats-normalizer.ts` — canonical PostInsight → `NormalizedPostMetrics` mapping (label aliases, "missing" ≠ 0, `total` aggregation)
- [x] `packages/scheduler/server/services/StatsCollector.service.ts` — sync-state (ensure/get/update), due computation (`getDueAccounts`, `getDuePosts`), account+post collection, exponential backoff (15m→6h cap), `pruneFailed` retention cleanup
- [x] `packages/scheduler/server/tasks/stats/collect.ts` — `defineTask('stats:collect')`
- [x] `packages/scheduler/nuxt.config.ts` — `'*/15 * * * *': ['social:post', 'stats:collect']`

### Phase B — reads & api (all syntax-validated via esbuild)
- [x] `packages/scheduler/server/services/Analytics.service.ts` — `getCurrentStats`, `getStatsHistory`, `getAggregatedByPlatform`, `getTimeSeriesData` (deltas), `getComparison`, `getPostMetricsHistory` (**user-scoped**: resolves caller's accounts via `resolveAccounts` before filtering), `getTopPosts` (with `post` relation join), `getFreshness`, `exportCsv`
- [x] `GET /api/v1/stats` — `mode`: current/aggregated/timeseries/history/comparison/post-metrics/top-posts, `days` (7/30/90), `limit`/`offset`
- [x] `GET /api/v1/stats/export` — CSV (range + platform + business filter)
- [x] `POST /api/v1/stats/collect` — due-gated + `force` option, returns collected/skipped/failed counts
- [x] `GET /api/v1/stats/dashboard` — summary (posts in range, total followers/engagement/posts) + currentStats with growth deltas + per-platform graph series from `account_metrics`; falls back to `buildConnectedPlatforms` placeholders until first collection; `?refresh=1` forces collection
- [x] `GET /api/v1/posts/[id]/stats` — serves from `post_metrics` history grouped per platform post; `?refresh=1` forces live collection via `StatsCollector.collectPostMetric`; legacy `entityDetails` cache path removed from this endpoint
- [x] Syntax fixes applied: duplicate `getTopPosts` block removed (Analytics.service), class brace restored so `getLatestPostMetric`/`isPostDue`/`getDuePosts`/`collectPostMetric`/`collectAllDue`/`pruneFailed` are back inside `StatsCollectorService`, `stats-normalizer` reduce paren fix
- [x] `GET /api/v1/posts/[id]/stats/[platform]` — serves from `post_metrics` history + `?refresh=1` live collection (verified 2026-09-07; no `PostStatsCache`/`entityDetails` references)

### Phase C — frontend (✅ COMPLETE)
- [x] `usePlatformStats.ts` — `range` presets, `comparison`, `postMetrics`, `topPosts`, freshness, `exportCsv` (blob download)
- [x] `app/pages/app/index.vue` — 7/30/90 segmented control; export button; per-platform freshness chip; top-post metric table w/ **Repurpose** CTA (`/app/tools/content-split`)
- [x] `DashboardOverviewCards.json` — new keys (en/es/de/fr)

### Phase D — migration + patches (✅ COMPLETE)
- [x] Migration `0008_account-oauth-stats-inbox-auto-repost.sql` — stats tables squashed into the single clean migration (see `db-migration-squash` pattern; earlier `0009_quick_blink.sql` reference was stale)
- [x] Remove `SNAPSHOT_DAYS = 30` dead constant in `PlatformStats.service.ts`
- [x] Delete legacy `PostStatsCache` utils
- [x] Refactor `PlatformStats.service.ts` to delegate reads to Analytics.service
- [x] Update `COMPETITIVE-FEATURES.md` row status for analytics
- [x] backfill dropped (2026-09-07): legacy `entity_details` path removed, new time-series collection is live — no copy needed

> **Polish fixes applied 2026-09-07 (verified):** `GET /api/v1/stats`
> forwards whitelisted `metric` (followers/posts/engagement) to
> `getTimeSeriesData` (was parsed but dropped); dashboard top-posts table now
> reads `post.postId` + `post.metrics.{likes,comments,shares,views,total}`
> (was flat `post.id/likes/...` → `undefined`).

## Success criteria

1. `stats:collect` task runs every 15m; API calls only fire for due entities (sync-state gating) — **no API hammering at scale**
2. Account & post metrics accumulate as time-series (multiple rows per entity over time)
3. Dashboard supports 7/30/90 with absolute + % deltas and comparison window
4. CSV export downloads from the dashboard
5. Top posts table → Repurpose opens content-split with the post content
6. `platformStatsService` legacy `entityDetails` path no longer the source of truth for dashboard