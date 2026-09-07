---
name: db-migration-squash
description: Squash unpushed Drizzle migrations into a single clean migration
triggers:
  - "squash migration"
  - "combine migration"
  - "clean up migrations"
edges:
  - target: "context/conventions.md"
    condition: "when verifying schema and migration changes"
last_updated: 2026-09-07
---

# DB Migration Squash

## Context

- Migrations live in `packages/db/db/migrations/` (SQL + `meta/` snapshots + `meta/_journal.json`).
- Drizzle config: `packages/db/config/drizzle.config.ts`, schema entry: `packages/db/db/schema.ts`.
- Scripts (run from `packages/db/`): `pnpm db:generate`, `pnpm db:migrate`.
- Only squash migrations **not yet in the remote** (`git ls-tree HEAD --name-only packages/db/db/migrations/` shows what's pushed). Never rewrite pushed migration history — existing Turso DBs track applied migrations.

## Steps

1. Confirm scope: `git diff --cached --name-only -- packages/db/db/migrations/` lists the staged (unpushed) migration files. Everything else stays untouched.
2. Verify no schema drift: every `CREATE TABLE` in the staged SQL must have a matching `sqliteTable` definition reachable from `db/schema.ts`, and every staged `ALTER TABLE ... ADD` column must exist in the current schema files. If the schema is missing something, the regenerate in step 4 will silently drop it.
3. Remove the staged migration files: `git rm -f <sql files> <snapshot files>`, then restore the journal: `git restore --staged <journal> && git restore <journal>`. Working tree must show no changes under `db/migrations/`.
4. Regenerate one migration from current schema: `pnpm exec drizzle-kit generate --config ./config/drizzle.config.ts --name <scope-slug>` (e.g. `account-oauth-stats-inbox`). This produces a single `000N_<slug>.sql`, one snapshot, and one journal entry.
5. Stage the result: `git add` the new `.sql`, the new snapshot, and `_journal.json`.

## Gotchas

- Hand-written migration SQL bypasses `drizzle-kit` validation: a past `0012_inbox-items.sql` had a mismatched quote in an index name (`` `inbox_user_read_idx" ``), missing `statement-breakpoint` separators, and no `meta/` snapshot with a hand-edited journal timestamp. Regenerating from schema fixes all three — prefer `db:generate` over hand-writing SQL.
- A missing `meta/*_snapshot.json` for a SQL file means the journal was edited by hand. After squashing, journal entries must be exactly `0..N` with real `when` timestamps (drizzle writes these).
- `drizzle.config.ts` defaults to `file:../../local.db` when `NUXT_TURSO_DATABASE_URL` is unset, so `generate`/`check` work offline with no env.

## Verify

- [ ] `pnpm exec drizzle-kit check --config ./config/drizzle.config.ts` reports `Everything's fine`.
- [ ] Fresh-DB migrate succeeds: `rm -f /tmp/test-squash.db && NUXT_TURSO_DATABASE_URL="file:/tmp/test-squash.db" pnpm exec drizzle-kit migrate --config ./config/drizzle.config.ts` (uses a temp file so the real `local.db` is untouched), then confirm table count and delete the temp file.
- [ ] New SQL contains every table/alter from the removed staged files.
- [ ] `git status --short -- packages/db/db/migrations/` shows exactly one new `.sql`, one new snapshot, and a modified `_journal.json` — nothing else.

## Debug

- `generate` reports "No changes": the base snapshot already matches schema — check that step 3 actually restored the journal and removed the new snapshots.
- `migrate` fails on fresh DB: the generated SQL references a table created later in the same file — reorder or check FK targets in schema files.
- Journal has gaps/duplicates after manual edits: restore from HEAD and regenerate instead of hand-editing.

## Update Scaffold

- [ ] Update `.claude/ROUTER.md` "Current Project State" if what's working/not built has changed
- [ ] Update any `.claude/context/` files that are now out of date
- [ ] If this is a new task type without a pattern, create one in `.claude/patterns/` and add to `INDEX.md`
