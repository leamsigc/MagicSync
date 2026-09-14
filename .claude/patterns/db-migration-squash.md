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

1. Confirm scope: compare against what production actually runs (`git show origin/main:packages/db/db/migrations/meta/_journal.json | tail`), not just HEAD — local commits may already contain migrations production has never seen. Everything at or below production's last `idx` stays untouched.
2. Prune dead schema first (do this before regenerating so the squashed migration also drops them): find tables with no runtime references and remove them from `db/**` plus any dead services/types/routes. Quick audit:
   ```bash
   rg -l "<tableName>" packages --glob '!**/node_modules/**' --glob '!**/tests/**' --glob '!**/migrations/**'
   ```
   Zero/self-only hits are candidates — verify the owning service has no live route/UI importers before deleting. Framework-managed tables (better-auth `oauth_*`, `session`, `account`, `verification`, `jwks`, `apikey`) have no app references but must stay.
3. Verify no schema drift: every `CREATE TABLE` in the removed SQL must have a matching `sqliteTable` definition reachable from `db/schema.ts`, and every removed `ALTER TABLE ... ADD` column must exist in the current schema files. If the schema is missing something, regeneration silently drops it. Also capture the table list for the post-check:
   ```bash
   rg -o "CREATE TABLE \`[a-z_]+\`" <removed files> | sed 's/.*CREATE TABLE //' | tr -d '`' | sort -u
   ```
4. Remove the out-of-scope migration files (`git rm -f` for tracked, `rm` for untracked), then restore the journal to production's version: `git checkout origin/main -- meta/_journal.json`.
5. Regenerate one migration from current schema: `pnpm exec drizzle-kit generate --config ./config/drizzle.config.ts --name <scope-slug>` (e.g. `agent-content-platform`). This produces a single `0010_<slug>.sql`, one snapshot, and one journal entry.
6. Stage the result: `git add` the new `.sql`, the new snapshot, and `_journal.json`.

## Gotchas

- **Rename prompts need a TTY.** When the diff contains new + dropped tables, `drizzle-kit generate` opens an interactive "created or renamed?" select for each new table. In a non-TTY shell it aborts with `Interactive prompts require a TTY terminal`. Run it through `script` and send `\r` to accept the default (`create table`) for every prompt:
  ```bash
  yes $'\r' | timeout 120 script -qec "cd packages/db && pnpm exec drizzle-kit generate --config ./config/drizzle.config.ts --name <slug>" /tmp/drizzle-gen.log
  ```
  `yes ''` (LF) does **not** advance the prompt — the TTY expects CR. The `script` wrapper may keep the pipeline alive after generation finishes; check for the new file instead of trusting the exit code, and clean up with `pkill -f "[d]rizzle-kit"` (bracket trick so pkill does not match its own command line).
- Hand-written migration SQL bypasses `drizzle-kit` validation: a past `0012_inbox-items.sql` had a mismatched quote in an index name (`` `inbox_user_read_idx" ``), missing `statement-breakpoint` separators, and no `meta/` snapshot with a hand-edited journal timestamp. Regenerating from schema fixes all three — prefer `db:generate` over hand-writing SQL.
- Dropping a table that production already has produces `DROP TABLE` in the squashed migration (correct for upgrade) — confirm the dropped names are intended and that no kept table references them via FK.
- In a single squashed migration, columns that were added via `ALTER TABLE` in the old chain appear inside `CREATE TABLE` instead; zero `ALTER TABLE` statements is normal when every touched table is new.
- A missing `meta/*_snapshot.json` for a SQL file means the journal was edited by hand. After squashing, journal entries must be exactly `0..N` with real `when` timestamps (drizzle writes these).
- `drizzle.config.ts` defaults to `file:../../local.db` when `NUXT_TURSO_DATABASE_URL` is unset, so `generate`/`check` work offline with no env.

## Verify

- [ ] `pnpm exec drizzle-kit check --config ./config/drizzle.config.ts` reports `Everything's fine`.
- [ ] Fresh-DB migrate succeeds: `rm -f /tmp/test-squash.db && NUXT_TURSO_DATABASE_URL="file:/tmp/test-squash.db" pnpm exec drizzle-kit migrate --config ./config/drizzle.config.ts` (uses a temp file so the real `local.db` is untouched).
- [ ] New SQL contains every table/alter from the removed staged files (compare the captured `CREATE TABLE` list) and drops only the intended dead tables.
- [ ] Fresh DB table count matches `main tables − dropped + created`; dropped tables absent, new tables present.
- [ ] `pnpm --filter @local-monorepo/db test:services` and `pnpm --filter @local-monorepo/agent test` green (both harnesses apply migrations on a fresh file DB).
- [ ] `git status --short -- packages/db/db/migrations/` shows exactly one new `.sql`, one new snapshot, a modified `_journal.json`, and deletions of the superseded migrations — nothing else.

## Debug

- `drizzle-kit migrate` hangs against sqld (localhost:8080) with no error: apply the generated statements directly via the pipeline instead, then record bookkeeping manually — `INSERT INTO __drizzle_migrations (hash, created_at)` with `hash = sha256(sql file)` and `when` from the journal entry. The migrator only compares max `created_at` vs journal `when`, so this is equivalent. Seen 2026-09-07.
- `__drizzle_migrations` rows exist but schema objects are missing (recorded-but-not-applied, seen on dev after a hung migrate): verify ground truth with `sqlite_master`/`pragma_table_info` before trusting bookkeeping, delete the phantom rows, apply the real statements, then record.
- `generate` reports "No changes": the base snapshot already matches schema — check that step 3 actually restored the journal and removed the new snapshots.
- `migrate` fails on fresh DB: the generated SQL references a table created later in the same file — reorder or check FK targets in schema files.
- Journal has gaps/duplicates after manual edits: restore from HEAD and regenerate instead of hand-editing.

## Update Scaffold

- [ ] Update `.claude/ROUTER.md` "Current Project State" if what's working/not built has changed
- [ ] Update any `.claude/context/` files that are now out of date
- [ ] If this is a new task type without a pattern, create one in `.claude/patterns/` and add to `INDEX.md`
