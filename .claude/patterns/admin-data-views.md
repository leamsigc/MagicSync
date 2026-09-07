---
name: admin-data-views
description: Admin CRUD views (users, businesses, integrations, audit log) in packages/site/app/pages/app/admin — borderless cards, Nuxt UI tables, service-backed endpoints
triggers:
  - "admin view"
  - "admin table"
  - "admin crud"
  - "admin dashboard"
  - "audit log"
edges:
  - target: "context/conventions.md"
    condition: when writing any new code
  - target: "patterns/add-endpoint.md"
    condition: when adding admin API endpoints
last_updated: 2026-08-16
---

# Admin Data Views

## Context

Admin pages live flat in `packages/site/app/pages/app/admin/*.vue` (not directories). All admin pages use `definePageMeta({ layout: 'dashboard-layout' })`. Server endpoints live under `packages/site/server/api/v1/admin/` and admin-check every request via `checkUserIsLogin(event)` plus `if (currentUser.role !== 'admin') throw createError(403)`.

## Steps

1. **Cards** — use the project's borderless card style: `rounded` (see `PostsTableView.vue`). Never `UCard` with default border. Hover feedback via `hover:shadow-lg transition-shadow`.
2. **Tables** — use `UTable` from `@nuxt/ui` v4.
   - Build columns with `TableColumn<T>[]` and `h()` render functions (`resolveComponent('UButton'|'UBadge'|'UCheckbox'|'UDropdownMenu'|...')`).
   - Row selection: `const rowSelection = ref<Record<string, boolean>>({})` + `v-model:row-selection` + `useTemplateRef('table')`; read counts via `table?.tableApi?.getFilteredSelectedRowModel().rows.length`.
   - Row actions: `UDropdownMenu` with `content: { align: 'end' }` + `items` array (label/separator entries with `onSelect`).
3. **User CRUD** — use `authClient.admin.*` (`createUser`, `setRole`, `banUser`, `unbanUser`, `removeUser`) from `#layers/BaseAuth/lib/auth-client`. No `updateUser` exists in better-auth 1.6 — edit = setRole + ban/unban.
4. **Business/audit endpoints** — business logic must live in the service layer (`packages/db/server/services/`). Add admin helpers there (e.g. `deleteRaw(id)` on `business-profile.service.ts`, `deleteById/deleteMany/deleteAll` on `auditLog.service.ts`) and extend the type in `services/interfaces.ts`. Route handlers only validate + delegate.
5. **Recipes** — list endpoint `GET /api/v1/admin/<x>`; detail update `PUT /api/v1/admin/businesses/[id]`; deletes use `DELETE`; audit deletion `logAuditService.logAuditEvent(...)` the action itself.

## Verify Checklist

- [ ] imports are the first statements in `<script setup>` (eslint `import/first`)
- [ ] `definePageMeta` comes after imports
- [ ] No `UCard` with visible border in admin cards
- [ ] Tables use `UTable` + `TableColumn`, not raw `<table>`
- [ ] DB access through services only, never direct `useDrizzle` in new route handlers
- [ ] ESLint clean: `npx eslint packages/site/app/pages/app/admin/`