---
name: directory-views
description: Add or rework a collection page as a Grid / List / Table directory with a shared toolbar (search, status filter, sort, view switcher). Use when asked to make a list page "look like Projects", add grid/list/table views, a view switcher, sort/filter/search over a collection, or to restyle a flat card grid.
---

# Directory views (Grid / List / Table)

Turn a flat collection page into a directory: one toolbar drives three view
modes, and every per-item fact comes from a single derived-metrics helper so the
views never disagree.

## When to use

- "Make `/app/<thing>` match this Projects UI" (grid / list / table)
- Add a view switcher, sort, status filter or search to a collection page
- Restyle a flat card grid into cards + rows + a table

## Ground truth

| Thing | Where |
|---|---|
| Worked example (businesses) | `packages/connect/app/components/connect/business/components/BusinessDirectory.vue` |
| Derived metrics helper | `packages/connect/app/composables/useBusinessDirectory.ts` |
| Page that hosts it | `packages/site/app/pages/app/business/index.vue` |
| Second example (integrations providers) | `packages/connect/app/components/connect/integrations/ConnectDirectory.vue` + `packages/connect/app/composables/connect/integrations/useIntegrationDirectory.ts` |

## Steps

1. **Write the metrics helper first** (`app/composables/use<Thing>Directory.ts`).
   Derive *status*, *progress/completeness*, *initials*, *human dates* and
   *sorting* from the raw row. Keep it a `use...()` composable if any label is
   translated. Never compute these inside a template — three views would drift.

2. **Build one `Directory` component** in the feature layer. It owns
   `view / search / statusFilter / sort` state, the `filtered` computed, and all
   three view blocks. Props: the collection + any "current" id. Emits:
   `edit`, `delete`, `select`. The **page** keeps fetching and modals.

3. **Toolbar** — `UInput` (search) + `USelect` (status, sort) + a view switcher
   of `UButton`s (`:variant="view === x ? 'solid' : 'ghost'"`). Let the switcher
   sit `ms-auto`.

4. **Grid** — `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`. Each card: initials
   tile, name, status badge, 2-line description (`line-clamp-2`), a `UProgress`
   bar + %, and a compact footer (`fields · created · updated`). Plan for icon +
   title + badge competing on one row: 3 columns, not 4.

5. **List** — one row per item: tile, name + description, badge, progress,
   created, actions. Hide the wide columns below their breakpoints
   (`hidden sm:inline-flex`, `hidden md:flex`, …).

6. **Table** — use a plain `<table>`, **not** `UTable`. `UTable` cells built with
   `h()` cannot take template directives, so badges/progress/menus get awkward.
   A plain table keeps `v-for`, `v-if` and `t()` in the template.

7. **Motion + empty state.** Wrap each view in `v-motion-fade` with
   `:key="view"` so switching animates. Give the filtered-empty case its own icon
   + message.

8. **i18n** — put every label under a `directory.*` object plus any new
   `actions.*` key, in **every** locale of the page's JSON. Column headings,
   statuses, sort labels, view labels, subtitle and empty state included.

## Gotchas

- **Card header squeeze** — a four-column grid truncates long names to `Ac…`
  once the status badge and an action icon share the row. Use three columns at
  `xl`.
- **Compact footers wrap mid-token** (`Oct 16, 2026`). Use a short date format on
  cards and `whitespace-nowrap` on chips and table cells.
- **`UModal` triggers** — to move an existing "create" trigger into the header,
  drive the modal's `open` model from a button and render the original component
  inside a `hidden` wrapper; `UModal` teleports its content, so only the trigger
  is hidden. (Cleaner: give the trigger component a `variant` prop —
  `ConnectAddAccount` in the integrations example renders a `tile` or a `button`.)
- **Don't delete the old card component** without checking other pages — it may
  be reused elsewhere (grep for its name).
- **Keep a domain-rich card in the grid.** When the existing card carries real
  behaviour (reconnect banner, page picker, menu), reuse it for **grid only** and
  give list/table compact rows that call the same composable actions. Rebuilding
  the card loses the behaviour.
- **Nested composable folders are not auto-imported.** A helper beside
  `composables/<group>/<sub>/useX.ts` needs an explicit
  `#layers/<Layer>/app/composables/...` import or the page 500s with
  `useX is not defined`.
- **One render error empties the whole page.** A null access in a *sibling*
  section aborts the component's patch, so the directory shows its empty state
  with real data present. Guard optional chains on relation data
  (`entityDetail?.details?.picture`).
- **One status vocabulary for every view.** Map "connected but health unknown"
  to the same label the grid badge shows, or the table will read "Unknown" while
  the grid reads "Connected".
- **Menus must match across views.** If the grid card's menu has an action the
  list/table menus lack, switching views silently loses a feature. Extract the
  shared part (e.g. the page-picker modal in
  `ConnectPagesModal.vue`) so every view offers the same items, and drop
  view-specific extras from the card with a prop (`:show-edit="false"`).

## Verify

- `pnpm audit:layers` passes (the helper/component stay in the feature layer).
- The page compiles and each view renders with seeded data.
- Capture the three states:
  `pnpm --filter @local-monorepo/site exec playwright test <spec>.spec.ts --reporter=list`
  → `screenshots/<route>/{page,list,table}.png`.
