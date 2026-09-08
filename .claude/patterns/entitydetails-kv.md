# entitydetails-kv

Storing a whole small feature in the existing `entity_details` KV table instead
of adding tables/migrations. Used by carousel, menu-board, and auto-reply PRD.

## Table shape

`entity_details(id, entity_id, entity_type, details JSON, createdAt, updatedAt)`.
No indexes beyond the PK — point reads by `(entity_type, entity_id)` and
ownership scans via `like(entity_id, '{userId}::%')` are fine under ~10k rows.

## Steps

1. Pick one `entity_type` per concern (`myfeature_item`, `myfeature_state`,
   `myfeature_log`). Never pile unrelated shapes under one type.
2. `entity_id` scheme: `{userId}::{objectId}` for owned rows (ownership =
   prefix check, no joins). Public/slug rows use a `PUBLIC_TYPE` constant and
   the bare slug as `entity_id` (see menu-board precedent).
3. Wrap all access in a `*Store` class inside the service file — never raw
   Drizzle in routes. Store methods return `ServiceResponse<T>`, never throw.
4. Cap unbounded row families (logs, events): prune to newest N inside the
   writer task, not via cron SQL.
5. Timestamps live inside `details` JSON too (portable ordering without
   relying on column semantics).

## Gotchas

- `like()` scans are acceptable at v1 volumes; note the 10k-row revisit
  threshold in code comments when you add a new family.
- Public rows must not embed secrets (they're readable by slug).
- Open-redirect guard: validate `https://` targets at write time, not at
  redirect time.

## Verify

- [ ] `pnpm --filter @local-monorepo/db db:generate` outputs **no changes**
- [ ] esbuild clean on touched files
- [ ] Ownership enforced by entityId prefix on every read/write path
