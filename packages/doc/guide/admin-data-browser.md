# Admin Data Browser

Every database table got its own admin page: `/app/admin/data` lists all
62 tables grouped by area, and `/app/admin/data/<table>` opens a generic
view/edit/delete grid with multiselect bulk delete. `/app/admin/posts` is a
curated read/edit/delete view over the same plumbing for all posts
system-wide. Verified end-to-end against the real dev server: 25 API checks
plus 18 browser checks, all passing.

## What landed

| File | Job |
|---|---|
| `packages/db/server/utils/admin-tables.ts` | 62-table registry: labels, groups, PKs, hidden/read-only column policy, `_key` encode/decode |
| `packages/db/server/services/admin-data.service.ts` | `AdminDataService implements AdminDataServiceType`: listTables / listRows / updateRow / deleteRows, all `ServiceResponse<T>`, never throws |
| `packages/site/server/api/v1/admin/data/index.get.ts` | `GET /api/v1/admin/data` — catalog with row counts |
| `packages/site/server/api/v1/admin/data/[table]/index.get.ts` | list rows: `page/limit/search/sort/direction` + `filter.<column>=<value>` |
| `packages/site/server/api/v1/admin/data/[table]/index.put.ts` | update one row, body `{key, values}`; audited as `ADMIN_DATA_UPDATE` |
| `packages/site/server/api/v1/admin/data/[table]/bulk-delete.post.ts` | delete rows, body `{keys}` (max 500); audited as `ADMIN_DATA_DELETE_ROWS` |
| `packages/site/app/composables/useAdminDataTable.ts` | data/selection/optimistic update+delete, no toasts (pages own feedback) |
| `packages/site/app/utils/admin-data.ts` | cell formatters + edit/submit value converters |
| `packages/site/app/components/admin/RowEditModal.vue` | dynamic typed editor from server column metadata |
| `packages/site/app/components/admin/RowDetailModal.vue` | full-row read view with edit/delete handoff |
| `packages/site/app/components/admin/BulkDeleteModal.vue` | delete confirmation |
| `packages/site/app/pages/app/admin/data/index.vue` | catalog page |
| `packages/site/app/pages/app/admin/data/[table].vue` | generic CRUD page (one file serves all 62 tables) |
| `packages/site/app/pages/app/admin/posts.vue` | curated all-posts view with status tabs |

## Why it looks this way

**One generic page, not 62 files.** Columns, labels, editability and row
identity all come from the server, so registering a table in
`admin-tables.ts` is enough to get a full admin page. The table/column labels
are server-driven *data*; only the page chrome (buttons, toasts, empty
states) goes through vue-i18n JSON.

**Row keys travel in request bodies, not the URL.** Composite primary keys
are joined with `\u001f` (`ROW_KEY_SEPARATOR`) and text keys may contain `/`;
neither survives a path segment intact in this h3 version (`getRouterParam`
doesn't decode). The server returns a per-row `_key` field
(`ADMIN_ROW_KEY_FIELD`) so clients never encode identity — they hand the key
back verbatim. `socialMediaAccountManagers` has no `id`; its composite PK
`['socialMediaAccountId', 'userId']` round-trips through the same `_key`.

**Admin-only by construction.** Every route verifies `checkUserIsLogin` +
`role === 'admin'`; ownership scoping is deliberately bypassed and documented
in the service header — do not reuse this service outside `/admin`.
Sensitive columns (passwords, tokens, client secrets, embedding blobs,
publish secrets, apiKey) are hidden from list responses and rejected on
write (`Field not editable: <column>` → 400).

**Selection is key-based, not index-based.** The table passes
`:get-row-id="getRowKey"` (the server `_key`) and intersects `rowSelection`
keys with visible rows, so filtering and mutation can't desync selection.

## The API shape

```
GET  /api/v1/admin/data
  → { tables: [{ key, label, group, rowCount }] }

GET  /api/v1/admin/data/posts?page=1&limit=25&search=draft&sort=createdAt&direction=desc&filter.status=published
  → { table, columns: [{ key, label, type, editable, pk, notNull, enumValues? }], rows: [{ ..., _key }], pagination }

PUT  /api/v1/admin/data/posts        body { key: "<_key>", values: { content: "..." } }
  → { row: { ..., _key } }

POST /api/v1/admin/data/posts/bulk-delete   body { keys: ["<_key>", ...] }
  → { deleted: n }
```

Unknown table → 404, unknown/non-editable field → 400, non-admin → 403,
unauthenticated → 401. Updates and deletes are audited via
`logAuditService.logAuditEvent` (field names only, never values).

## Gotchas found while verifying

1. **`.gitignore` eats `data/` directories.** The root `data/` ignore pattern
   matches *any* directory named `data`, including the Nuxt file-based routes
   `packages/site/server/api/v1/admin/data/` and
   `packages/site/app/pages/app/admin/data/`. They exist on disk but stay
   invisible to git until negated — see the `!...` exceptions after the
   `data/` line in `.gitignore`.
2. **Nuxt UI forbids empty-string `SelectItem` values.** The "All" filter
   option used `{ value: '' }`, which throws a runtime error overlay in dev
   ("must have a value prop that is not an empty string"). The page uses a
   `__all__` sentinel (`FILTER_ALL_VALUE`) mapped back to `''` on change.
3. **Toast text matches twice.** `getByText('Row updated')` hits both the
   toast title and the aria-live region; assert on
   `[data-slot="title"]` instead.
4. **better-auth session cookies are signed.** `get-session` reads
   `token.signature` (HMAC-SHA256 base64 over the raw token, keyed by
   `BETTER_AUTH_SECRET`). A raw `session.token` value from the DB returns
   `null` — sign it first when minting test sessions.
