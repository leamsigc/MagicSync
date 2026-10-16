---
name: entitydetails-json-integrity
description: Keep the entity_details.details JSON column sane — one tolerant codec on read, never double-encode on write, never spread a string. Use when entity_details data renders as digit-keyed JSON ({0:"{",1:'"'}), when company info / brand details refuse to save, when a details column holds a string where an object is expected, or when touching business create/update routes.
---

# entity_details JSON integrity

## When to use
A `details` value renders as `{ 0: "{", 1: "\"", ... }`, or a JSON column
surfaces a string instead of an object, or an edit to company info / brand details
does not persist. Applies to any `entity_details`-backed feature.

## Root-cause pattern
`details: text('details', { mode: 'json' })` stringifies on write. Two mistakes
corrupt it:

1. Calling `JSON.stringify` before passing to Drizzle → **double-encoded** row.
2. Casting a possibly-string value and spreading it:
   `{ ...(row.details ?? {}) }` → one key per **character**.

Both then feed the next write, making the corruption permanent.

## Steps
1. `pnpm --filter @local-monorepo/db db:generate` → expect **no changes** (no migration).
2. Write the value as an **object**, never a pre-stringified string:
   ```ts
   await entityDetailsService.createDetails({ entityType, entityId, details: objectValue })
   ```
3. Read through the codec — never `JSON.parse` by hand:
   ```ts
   import { coerceJsonObject } from '#layers/BaseShared/utils/json'
   const details = coerceJsonObject(row.details) // object | string | double | digit-keyed
   ```
4. Build merged writes from the codec, not a spread of raw:
   ```ts
   const merged = { ...coerceJsonObject(existing.details), ...patch }
   ```
5. Use `EntityDetailsService.updateByEntity(entityId, entityType, patch)` to merge
   a patch into the single row for an entity.

## Gotchas
- A raw **string** may be legacy markdown (not JSON) — when a consumer falls back
  to "treat as prose", pass plain strings through unchanged (see
  `findLegacyDetails` in `brand-playbook.service.ts`).
- `EntityDetails['details']` is typed for the Facebook-page shape; cast the
  normalized object at the boundary, don't widen the schema.
- Corruption is self-healing: the next normalized write rewrites the row. No data
  migration is needed.

## Verify
1. Create then read a business → `details` is an object (no nested string).
2. Edit company info in `/app/business/[id]/edit`, save, reload → persists as text.
3. `pnpm audit:layers` passes; DB service tests pass.
