---
name: directory-views
description: Collection pages with Grid / List / Table views, one shared toolbar (search, status, sort, view switcher) and one derived-metrics helper
triggers:
  - "grid list table"
  - "view switcher"
  - "directory"
  - "projects ui"
  - "collection views"
edges:
  - target: "theme-tokens.md"
    condition: "when styling cards, table cells or badges"
  - target: "admin-data-views.md"
    condition: "when the collection is an admin CRUD view instead of a directory"
last_updated: 2026-10-16
---

# Directory views (Grid / List / Table)

## Context

Turning a flat collection page into a directory: one toolbar drives three view
modes, and every per-item fact comes from a single derived helper so the views
never disagree. Worked examples: `/app/business`
(`packages/connect/app/components/connect/business/components/BusinessDirectory.vue`
+ `packages/connect/app/composables/useBusinessDirectory.ts`) and
`/app/integrations` providers (`ConnectDirectory.vue` +
`useIntegrationDirectory.ts`).

## Steps

1. **Metrics helper first** (`app/composables/use<Thing>Directory.ts`) — derive
   status, progress/completeness, initials, human dates and sorting from the raw
   row. A `use...()` composable if any label is translated.
2. **One `Directory` component** owns `view / search / statusFilter / sort`, the
   `filtered` computed and all three view blocks. Props: collection + current id.
   Emits: `edit`, `delete`, `select`. The page keeps fetching and modals.
3. **Toolbar** — `UInput` search + `USelect` status/sort + `UButton` view
   switcher (`ms-auto`, solid when active).
4. **Grid** — `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`; card = tile, name,
   badge, 2-line description, `UProgress` + %, compact footer.
5. **List** — tile, name + description, badge, progress, created, actions; hide
   wide columns below their breakpoints.
6. **Table** — a **plain `<table>`**, not `UTable` (its `h()` cells can't take
   directives), so badges/progress/menus stay in the template.
7. **Motion + i18n** — `v-motion-fade` with `:key="view"`; every label under
   `directory.*` in every locale.

## Gotchas

- Four columns truncate names to `Ac…` once a badge + action share the row; use
  three at `xl`.
- Compact footers wrap `Oct 16, 2026` mid-token — short date format + `whitespace-nowrap`.
- To move a create trigger into the header, drive the modal's `open` model and
  render the original component in a `hidden` wrapper (`UModal` teleports) — or
  give the trigger a `variant` prop (`tile` / `button`).
- Grep for the old card component before deleting — other pages may reuse it.
- Keep a domain-rich card (reconnect banner, page picker) in **grid only**; list
  and table call the same composable actions instead of rebuilding it.
- Nested `composables/<group>/<sub>/` files are **not** auto-imported — import
  explicitly or the page 500s with `useX is not defined`.
- A null access in a sibling section aborts the whole patch, so the directory
  shows empty with data present — guard optional chains (`entityDetail?.details?.picture`).
- Give every view one status vocabulary (e.g. "connected, health unknown" →
  "Connected") so the table never disagrees with the grid.

## Verify

- `pnpm audit:layers` passes.
- Capture `page` / `list` / `table` with the Playwright spec.

## Update Scaffold

- [ ] Wiki: `/guide/business-directory-views`
- [ ] Skill: `packages/doc/skills/directory-views/SKILL.md`
