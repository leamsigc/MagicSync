---
name: purge-dependency
description: Purging a dependency across the monorepo — prove it is unused, delete the package/catalog/sidecar CSS, sync the lockfile, and prove nothing else references it
triggers:
  - "remove a dependency"
  - "purge package"
  - "delete sidecar css"
  - "catalog entry"
  - "purge fullcalendar"
edges:
  - target: patterns/safe-build.md
    condition: when a build is needed to prove the removal compiles
  - target: context/conventions.md
    condition: when checking naming or import conventions for the replacement
  - target: patterns/fullcalendar-nuxt.md
    condition: when the dependency being purged is FullCalendar
last_updated: 2026-10-09
---

# Purge a Dependency

## Context

A dependency dies in more places than `package.json`: the workspace `catalog:`
pins it, a layer registers its stylesheet in its own `nuxt.config.ts`, a stale
copy of that stylesheet survives in `assets/css/`, and prose in
`packages/doc/guide/layers.md` still advertises it. W0 of
`.aiContext/PRD-CALENDAR-NUXT-UI.md` (FullCalendar) is the reference run.

## Steps

1. **Prove it is unused before deleting anything.** For each package:
   `rg -n "<package-name>" --glob '!node_modules' --glob '!pnpm-lock.yaml' .`
   The only acceptable hits are `package.json` declarations and files that a
   later wave explicitly deletes. Anything else means the package stays.
   A mention inside a comment (`@fullcalendar/vue3` in the
   `ScheduleCalendar.vue` header comment) is **not** an import — it is prose
   referring to something the code deliberately no longer does.

2. **Delete the sidecar assets**, then the registration that loads them:
   `packages/ui/app/assets/css/full-calendar.css` (the `--fc-*` token bridge)
   and `packages/ui/app/assets/css/main-copy.css` (a byte-identical dead copy).
   Remove the `css: []` entry in the owning layer's `nuxt.config.ts`, keeping
   `main.css` as the only entry.

3. **Sweep the survivors' stylesheet for orphans.** `rg -n "<prefix>-"` the
   main stylesheet (`.fc-daygrid-day-bg` was sitting between asset-card rules).
   Delete only the rule; do not "tidy" the surrounding blocks.

4. **Port replacements as a single appended block**, unlayered. See the glass
   / view-transition block at the bottom of
   `packages/ui/app/assets/css/main.css` for the shape:
   - An unlayered `:root`/`.dark` block — unlayered is what beats Nuxt UI's
     `theme` layer, because layer order is resolved before specificity.
   - `@utility` for anything a component will opt into (`glass-material`).
   - `@layer base` for global element resets (`::selection`, button cursors).
   - Preserve the source template's comments; they explain *why* each value
     is what it is, which is the only thing you cannot re-derive later.
   - Two gotchas: do **not** re-add `@import "tailwindcss"` /
     `@import "@nuxt/ui"` in the appended block, and **never** duplicate a
     token the file already declares. `--ui-radius` was already `1rem` in the
     `:root, .light, [data-theme]` token block — the merge is to change the
     value there, not to add a second declaration that wins by source order.
   - `@utility` rules only emit when a class uses them, so their absence from
     a build is expected until the consuming component lands.

5. **Merge `experimental` blocks, never clobber them.** `packages/site/nuxt.config.ts`
   already had `viteEnvironmentApi` / `typescriptPlugin` / `nitroAutoImports` —
   add `viewTransition: true` inside that object.

6. **Remove the pin and shorten its story.** Delete the four package
   `catalog:` entries from `pnpm-workspace.yaml` along with the four
   `dependencies`/`devDependencies` lines, then rewrite the version-pinning
   comment so it explains the four that remain and when the block goes away.
   A comment describing packages that no longer exist is worse than none.

7. **Fix the prose that advertises it.** `packages/doc/guide/layers.md` had both
   a bullet ("Uses **FullCalendar** for the visual calendar") and a tech-stack
   table row. Historical gap reports (`.aiContext/FEATURE-GAPS.md`) are notes
   from the past — adjust them only where the old line is now actively wrong.

8. **`pnpm install`** to resync the lockfile, then prove the removal.

## Gotchas

- A dependency can be unused yet *styling-critical*: `PostCalendarPreview.vue`
  still carries a scoped `.fc-h-event { background: transparent }` rule that
  strips the background of the FullCalendar container it renders inside. Leave
  rules that the surviving component still depends on, and let the wave that
  deletes that component delete its style too.
- Deleting the CSS bridge changes the *interim* look of the surviving
  FullCalendar chrome (toolbar buttons, event colours) back to its library
  defaults. That is the intended W0 end state, not a regression to chase.
- `pnpm audit:layers` must not grow. It counts `#layers/*` imports across 1600+
  files and a baseline of known violations; a style-only change cannot add one,
  but a moved component can, so run it after the sweep rather than before.

## Verify

- [ ] `pnpm audit:layers` — `0 new unresolved #layers imports`, violations ≤ baseline
- [ ] `rg -n "<dep>|-<prefix>-" packages --glob '!node_modules' -i` — the only
      hits are the files a later wave deletes, plus their declarations
- [ ] `pnpm --filter @local-monorepo/ui build` (the layer playground) — never
      `pnpm site:build`; see `patterns/safe-build.md`
- [ ] `pnpm dlx vite-doctor .` — 0 errors, 0 warnings
- [ ] `git status` clean of build artefacts, and no pre-existing dirty file touched

## Debug

- Build fails on an unresolvable import → grep the package name across
  `packages/` rather than trusting the lockfile diff; a layer usually imports a
  package its own `package.json` never declared.
- Styling collapses after the CSS bridge is deleted → the surviving component
  was relying on `--fc-*` variables, not on the deleted rules. Either re-declare
  the variable or accept the library default until the component is deleted.

## Update Scaffold

- [ ] Update `.claude/context/stack.md` if the library list changed
- [ ] Mark the retired integration pattern deprecated rather than deleting it,
      so its crash history stays searchable (see `patterns/fullcalendar-nuxt.md`)
- [ ] Add any newly-stale prose file to this pattern's steps
