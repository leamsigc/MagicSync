---
name: db-daily-rollup
description: Collapse an append-only per-collection time-series table (metrics/snapshots) into one row per entity per day with an upsert, then migrate existing rows. Use when asked "table is growing too fast", "one row per day", "dedupe metrics rows", "upsert instead of insert", or when a stats/snapshot table appends a row on every poll.
---

# Collapse a time-series table to a daily upsert row

## When to use
A table that stores one row per collection (metrics, snapshots, stats) is
growing without bound, and readers only ever want the latest value per day.

## Steps
1. **Prove daily granularity is enough.** Grep every reader of the table. If the
   UI/service already dedupes to a day (day-formatted labels, `YYYY-MM-DD` map
   keys) or only reads the latest row, intra-day rows are dead weight.
2. **Add a day column + unique index.**
   - `snapshotDate: text('snapshot_date', { length: 10 })` — keep it **nullable**
     so the migration stays a plain `ADD COLUMN` (a SQLite `NOT NULL` add would
     force a table recreate). The writer always sets it.
   - `uniqueIndex('<table>_<entity>_day_unique').on(table.<entityId>, table.snapshotDate)`.
3. **Swap insert → upsert** at the single write site. Build the mutable fields
   once and reuse them:
   ```ts
   const metricFields = { platform, followers, following, posts, engagement, rawPayload, source, status: 'success' as const, error: null, collectedAt: now }
   await db.insert(table)
     .values({ id: crypto.randomUUID(), <entityId>, snapshotDate: dayjs(now).format('YYYY-MM-DD'), ...metricFields })
     .onConflictDoUpdate({ target: [table.<entityId>, table.snapshotDate], set: metricFields })
   ```
   Keep the timestamp column as the day's **last** collection time.
4. **Move window filters to the day column.** `gte/lte` on the day string, not
   the timestamp, so a late-in-day row can't drift across a window edge. Order by
   the day column.
5. **Write a new migration** (never rewrite pushed history). Generate with
   `drizzle-kit generate`, then hand-insert the backfill + dedupe **between** the
   `ADD COLUMN` and the `CREATE UNIQUE INDEX`:
   ```sql
   UPDATE <table> SET <day_col> = date(<ts_col>, 'unixepoch');
   DELETE FROM <table> WHERE id NOT IN (
     SELECT id FROM (
       SELECT id, ROW_NUMBER() OVER (PARTITION BY <entityId>, <day_col> ORDER BY <ts_col> DESC) rn
       FROM <table>
     ) WHERE rn = 1
   );
   ```

## Gotchas
- Drizzle sqlite `mode: 'timestamp'` stores **Unix seconds** → `date(col, 'unixepoch')`.
  Plain `date(col)` yields NULL.
- The unique index is what makes `onConflictDoUpdate` work. Between the schema
  change and applying the migration, writes append again — apply it immediately.
- Keep the pre-existing `(entity, timestamp)` index if other queries still order
  by the timestamp.

## Verify (no unit tests)
```bash
rm -f /tmp/test-rollup.db
NUXT_TURSO_DATABASE_URL="file:/tmp/test-rollup.db" pnpm --filter @local-monorepo/db db:migrate
sqlite3 /tmp/test-rollup.db ".schema <table>"   # day col + unique index present
# insert two same-day rows, run the backfill/dedupe SQL, assert one row survives
```
Then run the real collector twice for one entity and assert a single row for the
day.
