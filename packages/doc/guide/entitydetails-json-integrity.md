# entity_details JSON integrity

## The bug

Every business keeps a `business_details` row in the `entity_details` KV table.
Its `details` column is declared as `text('details', { mode: 'json' })`
(`packages/db/db/entityDetails/entityDetails.ts`), so Drizzle serializes any
value it is given. The create route broke that contract:

```ts
// packages/connect/server/api/v1/business/index.post.ts (before)
details: JSON.stringify(body.entityDetails) as any,
```

`JSON.stringify` + `mode: 'json'` = a **double-encoded** row: the column holds a
JSON string whose value is itself JSON. Reads then hand back a *string*, not an
object.

That string then met a spread in the org service:

```ts
// packages/auth/server/services/business-org.service.ts (before)
const orgMetadata = (business.details ?? {}) as Record<string, unknown>
await entityDetailsService.updateDetails(business.id, {
  details: { ...orgMetadata, organizationId: org.id },
})
```

`{ ...someString }` produces one digit key per character —
`{ 0: "{", 1: "\"", 2: "c", … }`. That object was written back, so the row was
**permanently corrupted** (the "Company info" tab in `/app/business/[id]/edit`
rendered exactly that shape). A local workaround in `edit.vue` already
reconstructed the string from numeric keys, which confirmed the shape.

Third defect: `PUT /api/v1/business/[id]` only updated profile columns and never
touched `entity_details`, so edits to company info / brand details were silently
dropped.

## The fix

1. **One tolerant codec** — `coerceJsonObject` in `packages/shared/utils/json.ts`.
   It normalizes all four shapes the column accumulated in the wild: a parsed
   object, a single-encoded string, a double-encoded string, and the
   character-indexed object. It recurses until it lands on a plain object.
2. **Stop double-encoding on write** — the create route now passes the object
   straight to Drizzle (`mode: 'json'` stringifies once).
3. **Normalize every read** — `EntityDetailsService` wraps all four read/write
   returns in `withNormalizedDetails`, so no consumer sees a corrupt shape.
4. **Stop spreading raw** — the three `{ ...details }` sites now build from
   `coerceJsonObject(...)`.
5. **Merge on update** — `EntityDetailsService.updateByEntity(entityId,
   entityType, patch)` merges a patch into the existing row; `PUT
   /api/v1/business/[id]` accepts an optional `entityDetails` object and calls it;
   `edit.vue` now round-trips company info / brand (and preserves channels,
   competitors, targetAudience) instead of dropping them.

The corruption is self-healing: the first write through `updateByEntity` (or any
normalized update) rewrites the row correctly.

## Why not a migration

The `entitydetails-kv` pattern is deliberately migration-free. Normalizing on
read removes the need for a data migration, and normalizing on write prevents
recurrence.

## Gotchas

- Brand details are edited as JSON **text**; parse them back to an object before
  storing (`toBrandObject` in `edit.vue`).
- `brand-playbook.service.ts` reads `business_details` directly (not through the
  service). Its `findLegacyDetails` passes a raw string through unchanged, because
  a non-JSON string may be legacy markdown treated as company info — only objects
  are re-encoded.
- `entity_details` rows for other `entity_type`s (feedback, social accounts) were
  never part of this bug; the codec is shared but each family parses its own shape.

## Verify

1. Create a business with entity details → `details` is an object on read (no
   nested string).
2. Open `/app/business/[id]/edit`, change company info, save → value persists and
   re-renders as plain text (never digit-keyed JSON).
3. `pnpm audit:layers` passes; DB service tests pass.
