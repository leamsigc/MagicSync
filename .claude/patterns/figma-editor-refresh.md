# Figma-Style Editor Refresh

Figma-like refresh of a `/tools/*` canvas editor: top bar, left icon rail +
contextual panel, canvas stage, right properties panel.

## When to use

Any canvas/stage tool page (image editor, carousel creator, OG generator)
that still uses hardcoded gray classes, raw `<button>`/`<input type="color">`
hacks, or dead plugin calls.

## Steps

1. **Audit plugin surface first** — read each plugin's `exposedMethods` and
   diff against what the UI actually calls. Fix dead calls before restyling
   (e.g. `flipObjects` never existed — the method is `flip`; rotate called
   `flipObjects` instead of `rotateObject`). `FabricEditor` has a
   `[key: string]: any` index signature, so dynamic calls typecheck with NO
   `@ts-ignore` / `@ts-expect-error` (the latter ERRORS when unused).
2. **Layout shell** — `index.vue` stays a dumb shell:
   `bg-default text-highlighted`, header / rail+panel / canvas / properties.
3. **Header** — back + doc title, center history/zoom/selection actions
   (duplicate via `clone`, delete via `deleteLayer`), right save/export
   actions. AI worker state gets a `UBadge` (warning/info/success/error) with
   tooltip + retry button on error.
4. **Left rail** — `UButton` + `UTooltip` icon rail, one panel per tab.
   Uploads use `UFileUpload` (validate `file.type.startsWith('image/')`,
   toast + skip rejects). Brush/draw settings (`UColorPicker` + `USlider`)
   live in the shapes panel. Preserve existing `data-testid`s (`tab-*` may
   be dynamic `` :data-testid="`tab-${tab.id}`" `` — e2e still matches).
5. **Right panel** — one `<section>` per plugin group with
   `text-[11px] font-semibold text-dimmed uppercase tracking-wider` headers:
   Arrange (`arrangeFront`/`arrangeBack`/`group`/`ungroup`/`clone`/
   `deleteLayer`), Align (all 6 dirs + distribute), Transform, Text, Fill,
   Stroke, Shadow, AI tools, Filters, Canvas (size presets, rulers/guides,
   background). Labels via `UFormField`, selects via `USelect :items`
   with `{label, value}` + `value-key="value"` so machine values survive
   i18n (e2e `selectOption` keeps working).
6. **AI worker UX (the original bug class)** — `run()` must `await`
   model-load completion (shared `loadPromise`), never fire-and-forget;
   `start()` must be idempotent. Surface state in three places: header
   badge, right-panel block (`UButton :loading` + `UProgress` + status line
   + `UAlert` + retry), floating canvas pill with `v-motion-fade-visible`.
   Toast every outcome; map worker codes to locale keys, never raw English
   from the composable (export a `*_CODE` const and translate at display).
7. **Tokens, not colors** — `bg-default`/`bg-muted`/`bg-elevated`,
   `border-default`, `text-dimmed`/`text-muted`/`text-toned`. No
   `gray-*`/`white`/`dark:` pairs. Dotted stage background via
   `color-mix(in srgb, currentColor …)` + `var(--ui-text-dimmed, <hex>)`.
8. **i18n + handlers** — every new string gets en/es/de/fr keys in the
   page JSON (including `aria-label`s and dynamic `t(key)` maps); event
   handlers are named functions (arrow wrappers only to forward args).
   Max 5 branches per function — split with lookup maps
   (`Record<kind, i18nKey>`).

## Gotchas

- `USelect` in v4 renders a native `<select>` — e2e `selectOption` works,
   but only if option **values** stay machine-readable.
- `USeparator`, not `UDivider`, in this repo's Nuxt UI v4.
- Module-scope composable state (`useImageTransformer`) is shared across
   pages — watchers must guard empty/initial values to avoid stray toasts.
- `cropLayer`/`eraseLayer` are backend stubs — don't build UI for them.
- ESLint may be broken repo-wide (TS version skew) — still run it; a
   tooling failure is not a code pass, note it in the summary.

## Verify

- [ ] `grep console\.` on touched files: empty
- [ ] `grep` for `text-gray-|bg-gray-|bg-white|dark:bg-|dark:text-` on
      touched files: empty
- [ ] Every literal `t('…')` key exists in all 4 locales
- [ ] All e2e `data-testid`s still rendered
- [ ] AI model loading → button spinner + progress; click-while-loading
      queues instead of `Model not loaded`
