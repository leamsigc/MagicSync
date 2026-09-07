# PRD: Auto-Repost — Same-Platform Repost Scheduling (Gap 3)

> **Goal:** Close `COMPETITIVE-FEATURES.md` High-Priority Gap 3.
> OpenPost: X, Mastodon, Bluesky, LinkedIn — auto-repost same platform.
> Target: configure repost rules (timing, count) per published post, background
> execution via existing Nitro `defineTask` infra, config UI, repost performance
> tracking via `repostCount` / `repostParentId`.
>
> **Source:** `.aiContext/COMPETITIVE-FEATURES.md` §3 + Roadmap Phase 3.1.
> **Status:** IMPLEMENTED 2026-09-07 (this session — fixed partial work from prior model).

## Architecture

```
Nitro scheduled task (every 15m) ──▶ tasks/repost/process.ts
                    │
                    ▼
         AutoRepost.service.ts (scheduler layer)
   - getDueReposts: published + autoRepost JSON, enabled,
     currentCount < maxReposts, nextRepostAt <= now
   - executeRepost: clone post as pending child (repostParentId),
     roll config forward (currentCount+1, nextRepostAt+interval,
     disable when max reached), incrementRepostCount
                    │ uses
                    ▼
   PostBatch.service.ts (db layer, ServiceResponse<T>, never throws)
   - getDueReposts / createRepost / updateAutoRepostConfig / incrementRepostCount
                    ▲ writes
   posts.auto_repost (JSON) · posts.repost_count · posts.repost_parent_id
                    ▲ reads/writes
   POST /api/v1/posts/auto-repost/configure (zod) ◀── useAutoRepost.configure()
   GET  /api/v1/posts/auto-repost/[id]/config      ◀── useAutoRepost.getConfig()
   Page /app/posts/auto-repost (postId + interval + max + enable)
```

**Cadence:** `repost:process` runs on the existing `*/15 * * * *` schedule
alongside `social:post` + `stats:collect` (no new cron needed).
**Constraint:** only `status='published'` parents are eligible; children are
created `pending` and flow through the normal publish pipeline.

## Data model

| column | type | purpose |
|---|---|---|
| `posts.auto_repost` | text (JSON) | `{ enabled, intervalHours, maxReposts, currentCount, nextRepostAt }` |
| `posts.repost_count` | integer default 0 | repost performance tracking |
| `posts.repost_parent_id` | text | child → parent link |

> Migration: squashed into `0008_account-oauth-stats-inbox-auto-repost.sql`
> (single clean migration from current schema — see `db-migration-squash` pattern).
> `drizzle-kit check` clean, fresh-DB migrate verified (46 tables).

## Implementation Tracker

Legend: `[ ]` not started · `[~]` in progress · `[x]` done (evidence required).

### Phase A — data model (db layer)
- [x] `packages/db/db/posts/posts.ts` — `autoRepost` / `repostCount` / `repostParentId` columns (fixed missing-comma build break `lastError` → `autoRepost`)
- [x] `packages/db/db/schema.ts` — re-exported via `export * from './posts/posts'` (no new relations needed)
- [x] `packages/db/server/services/post-batch.service.ts` — `getDueReposts` / `createRepost` / `updateAutoRepostConfig` / `incrementRepostCount` converted to `ServiceResponse<T>` (never throw, try/catch + NOT_FOUND codes)
- [x] `packages/db/server/services/interfaces.ts` — `PostBatchServiceType` extended with the 4 repost methods

### Phase B — execution & api (scheduler layer)
- [x] `packages/scheduler/server/services/AutoRepost.service.ts` — `getDueReposts` / `executeRepost` / `processDueReposts` return `ServiceResponse<T>`; import fixed to `#layers/BaseDB/server/services/post-batch.service` (was via `post.service` re-export); dead drizzle imports removed
- [x] `packages/scheduler/server/tasks/repost/process.ts` — `defineTask('repost:process')`, unwraps `ServiceResponse` (logs + returns `{ processed, errors }`)
- [x] `packages/scheduler/nuxt.config.ts` — `'*/15 * * * *': ['social:post', 'stats:collect', 'repost:process']`
- [x] `POST /api/v1/posts/auto-repost/configure` — zod (`postId`, `enabled`, `intervalHours 1-168`, `maxReposts 1-20`); was calling non-existent `postService.updateAutoRepost` → now `postBatchService.updateAutoRepostConfig` with error mapping; thin handler, no direct DB
- [x] `GET /api/v1/posts/auto-repost/[id]/config` — serves parsed `autoRepost` JSON; removed unused `autoRepostService` import

### Phase C — frontend (site layer)
- [x] `packages/site/app/composables/useAutoRepost.ts` — `configure(postId, { enabled, intervalHours, maxReposts })`, `getConfig(postId)` (pre-existing, syntax-validated, unchanged)
- [x] `packages/site/app/pages/app/posts/auto-repost/index.vue` — NEW: postId + interval + max + enable switch, load/save via composable, shows `currentCount`/`nextRepostAt`; `<script setup>`, handler lambdas (no `@click="x=y"`), `useHead` title
- [x] `packages/site/app/pages/app/posts/auto-repost/index.json` — translations en/es/de/fr (pre-existing)

### Phase D — migration (db-migration-squash pattern)
- [x] Removed hand-written `0009_auto_repost.sql` (no snapshot, hand-edited journal timestamp) + duplicate generated `0010_premium_plazm.sql`
- [x] Regenerated single `0008_account-oauth-stats-inbox-auto-repost.sql` + snapshot + journal from current schema
- [x] `drizzle-kit check` → `Everything's fine`; fresh-DB migrate → 46 tables, `posts` has all 3 repost columns, inbox + metrics present

## Success criteria

1. `pnpm build` / esbuild: all 8 touched files syntax-valid (verified this session)
2. `POST configure` with valid body returns `{ success: true, config }`; unknown post → 404; service error → 500 (no 500 from missing method)
3. Published post with `enabled` config spawns a `pending` child at `nextRepostAt`; parent `currentCount`+1, `nextRepostAt` rolled forward, disabled at max; `repost_count` increments
4. `repost:process` runs every 15m, logs `processed/errors`, never throws
5. `/app/posts/auto-repost?postId=…` loads config, saves without errors

## Out of scope (next gaps, one-by-one)

- Gap 4 Grow (Bluesky/Mastodon follow recommendations) — NOT_STARTED
- Gap 5 Notifications full system (email, digest, prefs, muting) — PARTIAL (basic in-app CRUD exists)
- Gap 7 Best Time to Post (ML timing) — NOT_STARTED
- Analytics polish: top-posts table field mismatch (`index.vue` L475-486 vs `{postId,metrics}`), timeseries `metric` param dropped — tracked, not in this PRD
- Inbox polish: `reply body text→replyText`, `authorHandle` field, 3× `@click` assignments, extract C3 components, `useInbox` moderation methods — tracked, not in this PRD
