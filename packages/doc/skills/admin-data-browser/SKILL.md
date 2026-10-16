---
name: admin-data-browser
description: Expose any DB table as an admin CRUD page (view/edit/delete + multiselect bulk delete). Use when asked to "add an admin page for table X", "admin data browser", "admin CRUD", "register a table", "admin bulk delete", or "system-wide posts view".
---

# Admin Data Browser

## When to use

A new table needs an admin page, or the generic browser needs a behavior
change. Reference run: this repo (MagicSync), 2026-10-16 — 62 tables, one
generic page, 25 API + 18 browser checks green.

## Ground truth (check first)

- Registry: `packages/db/server/utils/admin-tables.ts` (`adminTableRegistry`).
- Service: `packages/db/server/services/admin-data.service.ts`
  (`AdminDataService implements AdminDataServiceType` — the type lives in
  `services/interfaces.ts`, structural/inline to avoid import cycles).
- Routes: `packages/site/server/api/v1/admin/data/` (catalog `index.get.ts`,
  `[table]/index.get.ts`, `[table]/index.put.ts`,
  `[table]/bulk-delete.post.ts`).
- Client: `useAdminDataTable` composable, `~/utils/admin-data.ts`,
  `app/components/admin/` (RowEdit/RowDetail/BulkDelete modals),
  `app/pages/app/admin/data/` (catalog `index.vue`, generic `[table].vue`),
  curated example `app/pages/app/admin/posts.vue`.

## Steps

1. **Register the table** with `entry(key, label, group, table, extra)`:
   `pk` only when the PK isn't `['id']`; `hidden` for secrets/tokens/blobs
   (never listed, never editable); `readOnly` for listed-but-locked columns.
   `AUTO_READ_ONLY` already covers `id/createdAt/updatedAt`.
2. **Column types are derived** from Drizzle via `getTableColumns` +
   `inferEditorType` (data-type map + `LONG_TEXT_KEYS` set for textareas +
   enum detection). Touch `inferEditorType` only if a new editor kind is
   needed — keep it ≤ 5 branches.
3. **No route changes needed** — `[table].vue` renders columns, editors,
   filters and identity purely from `GET .../data/<key>` metadata.
4. **Keep keys in bodies.** Row identity is the server-computed `_key`
   (composite PKs joined with `ROW_KEY_SEPARATOR = '\u001f'`); clients hand
   it back verbatim in PUT/bulk-delete bodies. Never move keys into the URL
   — h3 `getRouterParam` doesn't decode and `/` breaks text keys.
5. **Admin gate on every route:** `checkUserIsLogin` + `role === 'admin'` →
   403 otherwise. Ownership scoping stays bypassed (documented in the service
   header); never reuse this service outside `/admin`.
6. **Audit writes:** `ADMIN_DATA_UPDATE` / `ADMIN_DATA_DELETE_ROWS` via
   `logAuditService` — field names only, never values.
7. **Client selection:** `:get-row-id="getRowKey"` (the `_key`) +
   `v-model:row-selection`; resolve selection by intersecting keys with
   visible rows; optimistic patch/delete with rollback; toasts live in pages,
   never in `useAdminDataTable`.

## Verify (no unit tests)

- Mint an admin session: sign the newest `session.token` with
  HMAC-SHA256/base64 keyed by `BETTER_AUTH_SECRET`, send as
  `better-auth.session_token=<token>.<sig>` cookie.
- `GET /api/v1/admin/data` → 200 with all tables; list/search (`search=`,
  miss → 0 rows) / `filter.<col>` / sort round-trip on the new table.
- PUT unknown column → 400, unknown table → 404, non-admin → 403.
- Insert a throwaway row, update it, bulk-delete it, confirm in DB + audit
  log, then delete the fixture.
- Browser (Playwright + signed cookie): catalog lists the table, search
  narrows, edit modal saves (DB reflects), select → bulk bar → confirm →
  delete toast, no `Failed to resolve component` warnings, no pageerrors.

## Gotchas

- `.gitignore`'s `data/` pattern hides any directory named `data` — the
  `!...` negations in `.gitignore` cover these two routes; extend them if a
  new `data/` route dir appears elsewhere.
- Nuxt UI `USelect` items reject empty-string values — the "All" filter uses
  the `__all__` sentinel (`FILTER_ALL_VALUE` in `[table].vue`).
- New tables must be registered manually — the registry can't derive labels,
  groups, or hidden-column policy.

## Update Scaffold

- [ ] Wiki: `/guide/admin-data-browser`
- [ ] `.claude/patterns/admin-data-views.md` for generic-browser deviations
