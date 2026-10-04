---
name: color-mode-assets
description: Fixing hydration mismatches caused by color-mode-driven DOM attributes — light/dark images (or any src/class/value) chosen with useColorMode in the template
triggers:
  - "Hydration attribute mismatch"
  - "rendered on server: src"
  - "expected on client"
  - "hydration mismatch on img"
  - "wrong hero image"
  - "useColorMode in template"
edges:
  - target: "patterns/ssr-safe-state.md"
    condition: "when the mismatch is not color-mode related (module-scope ref/reactive)"
  - target: "patterns/theme-tokens.md"
    condition: "when the fix needs light/dark tokens instead of separate assets"
  - target: "context/conventions.md"
    condition: "when writing the component code"
last_updated: 2026-09-15
---

# Color-Mode-Driven Assets (Hydration Mismatch)

## Context

`@nuxtjs/color-mode` ships a **blocking inline script** that sets `<html class="dark">`
from the stored preference (`localStorage`, key `nuxt-color-mode`; `storage` defaults
to `localStorage`) **before the app hydrates**. SSR can never see `localStorage` — and
`packages/site/nuxt.config.ts` pins `colorMode: { preference: 'light', fallback:
'light', classSuffix: '' }` — so the server renders the light branch while the client's
first render takes the dark branch. Vue only compares vnode attributes; it does **not**
rectify the DOM in production ("check-only ... due to performance overhead"), so the
wrong image ships to users permanently.

Symptom (real incident, 2026-09-15, `BaseHero` on `/`):

```
[Vue warn]: Hydration attribute mismatch on <img>
  - rendered on server: src="/img/home-light.png"
  - expected on client: src="/img/home-dark.png"
  at <BaseTyndallEffect>  at <BaseHero>  at <MDCRenderer> ...
```

Rule: **any value that comes from `useColorMode()` and lands in an attribute, class, or
text node is a hydration bug.** Color mode may only drive things invisible to hydration
(JS option objects — e.g. the ECharts option built in
`packages/site/app/pages/app/index.vue` — or `ClientOnly` subtrees).

## Steps

1. Find the candidates — anything color-mode-derived inside a template:
   ```
   grep -rn 'mode.value\|colorMode.value\|colorMode.preference' packages/*/app \
     --include='*.vue'
   ```
   (`useColorMode()` reads that feed `getChartOptions()`-style option objects are fine —
   they never reach the DOM.)
2. Replace the JS branch with **both variants + CSS visibility**. Tailwind's `dark`
   variant is class-based here — Nuxt UI 4.11 ships
   `@variant dark (&:where(.dark, .dark *))` — and variant utilities are emitted *after*
   base utilities in the compiled CSS, so the dark rules win:
   ```vue
   <img
     class="w-full ... flex items-center ... img-border-animation dark:hidden"
     :src="heroImage.light" :alt="heroImage.alt" width="1300" height="900" loading="lazy" />

   <img
     class="hidden dark:flex w-full ... items-center ... img-border-animation"
     :src="heroImage.dark" :alt="heroImage.alt" width="1300" height="900" loading="lazy" />
   ```
   Keep both class lists inline (never assembled from a JS constant) so the Tailwind v4
   scanner sees every candidate.
3. Drop the now-unused `useColorMode()` call so nothing in the component can diverge
   again.

## Gotchas

- **Do not "fix" this with `storage: 'cookie'`.** The server can then read the
  preference, but it still cannot resolve `preference: 'system'` (the dashboard sets
  `colorMode.preference = 'system'`), so system-preference users keep the mismatch.
  Switching storage also silently discards every existing `localStorage` preference.
- **Do not wrap the asset in `<ClientOnly>`.** That removes the hero `<img>` from the
  SSR HTML — LCP and image SEO regression.
- Only the **visible** variant is downloaded: a `<img loading="lazy">` that is
  `display:none` has no layout box, so Chromium never fetches it. Measured on a cold
  context booting into dark: only `home-dark.png` was requested, the hidden light
  variant had `naturalWidth === 0`. Toggling lazy-loads the other variant on demand.
- Give both variants the same `alt`; the hidden one is `display:none` and therefore is
  not announced by assistive tech.
- `packages/site/nuxt.config.ts` sets `routeRules: { "/": { swr: 1200 } }` — dev
  `curl`/reloads can serve **stale SSR HTML** after an edit. Bust it with a query
  string (`/?fresh=1`) before trusting a curl result.
- The dev-only `@nuxt/hints` warnings (`[hydration] Component X ... different html pre
  and post-hydration`) are **not** this bug: they diff the DOM *after mount*, so they
  fire for components whose DOM legitimately changes (`v-motion` inline styles, embla
  `translate3d`) and they list every ancestor component too. Expect `default.vue`,
  `[...slug].vue`, `BaseTyndallEffect`, `BaseHero`, `BaseTestimonials` on `/` regardless
  of this fix — measured 2026-09-15 with **zero** `[Vue warn]` alongside them. Triage
  them with `patterns/dev-hints-triage.md`; only a `[Vue warn]: Hydration attribute
  mismatch` means this pattern applies.

## Verify

- [ ] Fresh browser context with `localStorage['nuxt-color-mode'] = 'dark'` → console has
      **no** `Hydration attribute mismatch` and no
      `Hydration completed but contains mismatches`
- [ ] Live DOM markup for the image is **byte-identical** to the SSR HTML
      (`curl -s 'http://localhost:3001/?fresh=1' | grep -o '<img[^>]*img-border-animation[^>]*>'`)
- [ ] Dark: `document.documentElement.className === 'dark'`, dark img `display:flex`,
      light img `display:none`; light mode is the mirror image
- [ ] Clicking `UColorModeButton` swaps instantly and lazy-loads the newly visible
      variant (`performance.getEntriesByType('resource')`)
- [ ] Complexity gate per AGENTS.md

## Debug

- Mismatch names a parent (`BaseTyndallEffect` above) — Vue walks up to the first
  component when the offender is a plain element; grep the subtree for color-mode
  conditionals instead of trusting the component name in the trace.
- Wrong image *permanently* in production but only a console warning in dev → this is
  the expected outcome of a check-only mismatch; the DOM keeps the SSR attribute.
- Image never appears after toggling → the variant is still `display:none` (the `dark:`
  variant did not compile: confirm `.dark\:flex:where(.dark,.dark *)` exists in the
  built CSS and that `<html>` really carries the `dark` class).

## Update Scaffold
- [ ] Update `.claude/ROUTER.md` "Current Project State" if what's working/not built has changed
- [ ] Update any `.claude/context/` files that are now out of date
- [ ] If this is a new task type without a pattern, create one in `.claude/patterns/` and add to `INDEX.md`