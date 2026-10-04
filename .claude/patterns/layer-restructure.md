---
name: layer-restructure
description: Composition-root architecture — how to move files between layers without breaking imports, routes or locale references
triggers:
  - "move a service to db layer"
  - "promote a component out of pages"
  - "layers are libraries"
  - "pages go in site"
  - "layer restructure"
edges:
  - target: patterns/add-page.md
    condition: when adding or moving a route
  - target: context/conventions.md
    condition: when checking imports, aliases and auto-import rules
last_updated: 2026-10-01
---

# Layer restructure (PRD-LAYER-RESTRUCTURE)

## Context

`site` is the composition root; feature layers should be libraries. The plan
(`.aiContext/PRD-LAYER-RESTRUCTURE.md`) has two halves:

1. **Foundation sinks — DONE** (Phases 0–4 on `refactor/layer-restructure`):
   scheduler's publishing core moved to `packages/db/server/services/`
   (`SchedulerPost.service`, `TokenRefresh.service`, `plugins/*`), shared data
   to `packages/shared/shared/` (`platformConstants`, `platformSettings`,
   `threadSplitter`), page-local components to
   `packages/<layer>/app/components/<layer>/…`, page-local composables to
   `packages/<layer>/app/composables/…`, and the carousel template data to
   `packages/ui/app/utils/` (`carouselTemplates`, `deckTemplates`,
   `slideTemplates`, `layers/*`, `patterns`, `designAssets`). Feature layers
   now `extends` foundations only.

2. **Move every product page into `site/app/pages/` — DONE** (commit `db94bd5`).
   All 110 product routes now live under `packages/site/app/pages/`, at the same
   relative path they had in their layer, so route parity holds by construction.
   Only three layers keep an `app/pages/` tree: `auth` (identity flows),
   `ui` (`ui-preview/` gallery), `content` (the CMS catch-all).

   A first attempt failed because it *flattened* the destination path
   (`business/[id]/content/[itemId].vue` → `business/[id]/[itemId].vue`,
   `tools/<tool>/components/X.vue` → `tools/X.vue`) and kept the page-local
   `components/`, `composables/` and `utils/` directories next to the page: 59
   phantom routes, 30 shadowed routes, 89 broken relative imports. The retry kept
   the path verbatim and promoted the page-local code into the layer first.

## Steps

1. Move files with `git mv` so history and the deletion list stay intact.
2. **Never leave a relative import pointing at a moved file.** Phase 4 rewrote
   some `#layers/...` specs eagerly and wrongly (`#layers/BaseScheduler/...AutoReply.service`
   → `#layers/BaseDB/...` for services that never moved). Rewrite only what the
   move map says, and re-check every alias after.
3. When a moved file's own relative imports break, resolve them against the
   file's **previous** directory: the target usually did not move, only the
   importer did.
4. Moving a page one directory deeper is safe only if its page-local
   `components/`, `composables/` and locale JSON move with it, or the imports
   are rewritten to the promoted locations.
5. Promote page-local code **before** moving pages. Page-local `.vue` go to
   `<layer>/app/components/<layer>/<group>/`, composables to
   `<layer>/app/composables/<layer>/<group>/`, other modules to
   `<layer>/app/utils/<layer>/<group>/`. Keep the local identifier and change
   only the import specifier — no template edits, so no auto-import rename risk.
6. Treat a page move as done only when: route parity is 0 lost / 0 added,
   import resolution is clean, `<i18n src>` all resolve, and the app builds.
7. Route collision order, if you ever hit one again: Nuxt builds `_layers` as
   `[root, ...extends DFS]` and `unrouting` keeps the **lowest priority number**,
   i.e. the **earliest** layer in that order. `scheduler` (9) comes before
   `templates` (11), so the scheduler's `/app/templates` page was already the one
   being served. Dump the route list before touching anything.

## Gotchas

- **Nuxt auto-imports already cover most sinks.** Composables under
  `app/composables/` and utils under `app/utils/` need no import at all; an
  explicit `#layers/...` import is still fine but must resolve.
- **`~` is per-layer.** `~/composables/x` resolves inside the *importing*
  package's `app/`, so a file that changes package must change that spec too.
- **Type-only shared imports need `import type`.** After aliases changed,
  `import { FacebookPage } from '#layers/BaseShared/server/types/facebook-pages'`
  threw at runtime (`does not provide an export named`); the interface must be
  imported with `import type`.
- **`templates.ts` → `carouselTemplates.ts`.** The carousel data was renamed on
  the way into `ui/app/utils/`; old `../templates` specs must point at
  `#layers/BaseUI/app/utils/carouselTemplates`.
- **`content.vue` next to a `content/` folder is a nested route.** See
  `patterns/add-page.md` — that trap is why the board page must live at
  `content/index.vue`, not `content.vue`.
- **`~` and `@` are per-layer, not global.** Nuxt 4's `LayerAliasingPlugin`
  rewrites them against the *importing* layer's own `srcDir` (`<pkg>/app`). A
  `~/assets/...` in a `tools` file means `packages/tools/app/assets/...`, and
  after a file moves into `site` the same spec silently means something else.
- **`~`/`@`/`#layers/Base*` inside `splitQuery`-style helpers:** a naive
  `spec.search(/[?#]/)` strips the leading `#` off `#layers/...` and every layer
  alias reference then resolves to "empty" and goes silently unrepaired.
- **`<i18n src="...">` is not an import specifier.** An import rewriter will not
  touch it, and a page-local component pointing at its page's locale JSON breaks
  the moment the page moves. Audit `src="..."` attributes separately.
- **The root project has no `#layers/*` alias.** When a library file has to read
  something that moved into `packages/site` (e.g. a page's locale JSON), the only
  option is a plain relative path.

## Verify

- [ ] Import audit: every relative spec resolves from the current file, and
      every `#layers/...` / `~/...` spec resolves to a file on disk.
- [ ] Route parity: dump `route → package` for the branch base and for the
      working tree; expect 0 lost (except paths under `components/`, which the
      `pages:extend` hook filters), 0 added, and only pre-existing duplicates.
- [ ] `pnpm --filter @local-monorepo/agent test` and
      `pnpm --filter @local-monorepo/db test:services` green.
- [ ] `pnpm site:build` exits 0 (the only check that compiles every moved page
      and component).
