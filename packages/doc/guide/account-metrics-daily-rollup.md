# Account metrics: one row per account per day

## What changed

`account_metrics` used to append a **new row on every successful collection**
(every 6h per account, plus every dashboard `?refresh=1`), and nothing pruned
successful rows. The table grew without bound and every row carried a fat
`raw_payload` JSON blob.

It is now **one row per account per day**, updated in place:

- `packages/db/db/stats/stats.ts` — new `snapshotDate` column (`YYYY-MM-DD`) and
  `uniqueIndex('account_metrics_account_day_unique')` on
  `(socialAccountId, snapshotDate)`.
- `packages/scheduler/server/services/StatsCollector.service.ts` — `collectAccount`
  now writes with `onConflictDoUpdate` on `(socialAccountId, snapshotDate)`
  (last-write-wins per day). `collectedAt` stays the day's **last** collection
  time so "last collected" stays truthful.
- `packages/scheduler/server/services/Analytics.service.ts` — `getStatsHistory`
  and `getComparison` filter on `snapshotDate` day strings instead of the
  `collectedAt` timestamp, so a day row can never drift across a window edge.
- Migration `packages/db/db/migrations/0011_wonderful_firebrand.sql` adds the
  column, backfills it, dedupes existing rows (keeps the newest per account/day),
  then creates the unique index.

## Why this loses nothing

The UI already collapsed to one point per day before this change:
`buildPlatformSnapshots` (dashboard route) keeps one snapshot per day label and
`getTimeSeriesData` keys points by `YYYY-MM-DD`. Reading only the latest row per
account (`getCurrentStats`, `getFreshness`, `getComparison`) is unaffected.

## How it works

A collection builds a single `metricFields` object and:
1. `insert().values({ id, socialAccountId, snapshotDate, ...metricFields })`
2. `.onConflictDoUpdate({ target: [socialAccountId, snapshotDate], set: metricFields })`

So the **second** collection of a day overwrites the first row instead of adding
one. The unique index is what makes the conflict target work — without migration
`0011` applied, the upsert target matches no constraint and rows append again.

## Gotchas

- `collected_at` is a Drizzle `mode: 'timestamp'` integer = **Unix seconds**, so
  the backfill must use `date(collected_at, 'unixepoch')`. Plain
  `date(collected_at)` returns `NULL`.
- `snapshot_date` is intentionally **nullable** so the migration is a plain
  `ADD COLUMN` (no SQLite table recreate). The writer always sets it.
- Already-mis-filed historical rows are collapsed by the migration; a day keeps
  the newest snapshot.

## Verify

```bash
# fresh-DB migrate (temp file, never the real local.db)
rm -f /tmp/test-0011.db
NUXT_TURSO_DATABASE_URL="file:/tmp/test-0011.db" \
  pnpm --filter @local-monorepo/db db:migrate
# then: run stats:collect twice for one account -> exactly one row for the day
```
