---
name: dev-hints-triage
description: Triaging @nuxt/hints console noise — telling real hydration/markup bugs apart from dev-only diagnostics (motion styles, embla transforms, DevTools overlays)
triggers:
  - "hints:hydration"
  - "different html pre and post-hydration"
  - "hints:htmlValidate"
  - "hints:lazyLoad"
  - "hints:performance"
  - "@nuxt/hints"
  - "hydration warning still showing"
edges:
  - target: "patterns/color-mode-assets.md"
    condition: "when a hint coincides with a real `[Vue warn]: Hydration attribute mismatch` on an asset/attribute"
  - target: "patterns/ssr-safe-state.md"
    condition: "when the real mismatch is module-scope ref/reactive instead of an attribute"
  - target: "patterns/playwright-golden-oracles.md"
    condition: "when the DevTools overlays behind these hints also pollute screenshots"
last_updated: 2026-09-15
---

# Triage @nuxt/hints Console Noise

## Context

`@nuxt/hints` (1.1.4, pinned in `pnpm-workspace.yaml`) is registered in
`packages/site/nuxt.config.ts` and runs with **default features and logging** — there is
no `hints:` key in the config. Per its README it "compares the server-rendered DOM with
the client-side DOM. When a mismatch is detected, it captures the pre- and
post-hydration HTML for inspection." Because it diffs the **DOM after mount** rather
than vnodes, it also fires for DOM changes that are perfectly legal.

Separate the signals before touching code:

| Signal (console) | Meaning |
|---|---|
| `[Vue warn]: Hydration attribute mismatch` / `Hydration completed but contains mismatches` | **Real bug.** Server and client vnodes diverge and the DOM is never rectified in production |
| `hints:hydration:warn [hydration] Component X ... different html pre and post-hydration` | Dev-only hint. DOM vs SSR HTML *after* mount — benign causes exist |
| `hints:htmlValidate:warn` | Real HTML validity problem in the SSR output — follow it |
| `hints:lazyLoad:info` | Suggestion: component statically imported but never rendered → `Lazy*` |
| `hints:performance` | Suggestion, e.g. LCP element carrying `loading="lazy"` |

## Steps

1. **Look for the real error first.** Filter the console for
   `Hydration .* mismatch|\[Vue warn\]`. Empty ⇒ nothing is broken; every remaining line
   is a hint and needs a cause, not a fix (steps 2-4).
2. **Attribute each hint by diffing SSR HTML against the live DOM** in the browser (same
   origin, so `swr` rules and cookies match):
   ```js
   const ssr = new DOMParser().parseFromString(
     await (await fetch(location.href, { cache: 'no-store' })).text(), 'text/html')
   // (a) per selector: compare every attribute of ssr.querySelector(sel) vs
   //     document.querySelector(sel) — including `style`
   // (b) count elements that gained an inline `style`, keyed by tag+class signature,
   //     to find who writes styles after mount
   ```
3. **Match against the known-benign inventory** measured on `/` (2026-09-15):
   - `@vueuse/motion` `v-motion` writes `opacity`/`transform` on mount and leaves the
     bound `initial`/`enter` objects as DOM attributes (`initial="[object Object]"`) —
     `.streak` divs in `BaseTyndallEffect`, hence also `BaseHero`
     (`v-motion-fade-visible`) and `BaseTestimonials` (`v-motion-fade-visible-once`).
   - embla (`UCarousel`) measures on mount and writes `transform: translate3d(...)` on
     the track and slides — 4 elements inside `#testimonials`.
   - Dev-only tooling injects its own styled nodes on **every** route: Nuxt DevTools'
     Vue Tracer (`#vue-tracer-overlay` plus inner `svg`/`rect`),
     `nuxt-devtools-inspect-panel`, a `canvas`, and `@nuxt/hints`' own measurement
     wrapper (a `div` inside `#__nuxt`) plus its panel stack (`ol.fixed.flex...` with
     `--scale-factor` et al).
4. **Expect ancestor propagation.** A hint is reported for the component that owns the
   change *and* its ancestors: on `/` that yields `default.vue` (layout) →
   `[...slug].vue` (page) → `BaseTyndallEffect` / `BaseHero` / `BaseTestimonials`. The
   layout is flagged on `/login` too, where no hero exists — proof those container
   entries are inherited, not independent.
5. **Silence logs without losing the panel** (README: each feature takes a boolean or
   `{ logs, devtools, options }`):
   ```ts
   // packages/site/nuxt.config.ts
   hints: {
     features: {
       hydration: { logs: false }
     }
   }
   ```

## Gotchas

- **Never disable a feature to make a hint disappear before checking step 1** — a real
  `Hydration attribute mismatch` hides behind the same module and looks similar.
- `hints:hydration` names the *nearest component* of a plain element, so grep the subtree
  for the changed attribute instead of trusting the name in the trace.
- `htmlValidate` hints are genuine bugs. On 2026-09-15 it flagged
  `<img> is missing required "src"` (inline:1640/1714/1788) on `/`: `BaseTestimonials`
  rendered a slot `<img :src="review.image">` while
  `packages/content/content/{en,es}/index.md` frontmatter supplies `avatar:` — every
  testimonial avatar was an empty circle. Fixed by using `UAvatar`'s own props
  (`:src="review.image || review.avatar" :alt="review.name"`) and dropping the stray
  `rounded` attribute (not a Nuxt UI 4 Avatar prop, so it leaked into the DOM).
  **MDC frontmatter keys are not type-checked against component props** — verify them by
  hand whenever a content page renders blank values or component defaults.
- A stale SSR response (`routeRules: { "/": { swr: 1200 } }`) can make the diff look
  wrong; always bust it with a query string.
- Don't chase motion/embla hints with code changes — they vanish when logs are muted and
  their cause is a legitimate post-mount DOM mutation.

## Verify

- [ ] Console on a cold dark-mode load (`localStorage['nuxt-color-mode'] = 'dark'`) has
      **zero** `Hydration ... mismatch` / `[Vue warn]`
- [ ] Every `hints:hydration` line is attributed to motion/embla/devtool DOM in the diff
- [ ] Every `hints:htmlValidate` line is either fixed or explicitly explained
- [ ] SSR HTML has no `<img>` without `src` (`grep -o '<img[^>]*>' f | grep -v 'src='`)
- [ ] Complexity gate per AGENTS.md if code changed

## Debug

- Hint list identical before and after a fix → the fix wasn't the cause; the hint is
  inherited from a descendant (step 4) or comes from devtool DOM.
- Hint mentions a route with no motion/carousel at all (`/login`) → you are looking at an
  *ancestor* entry; find the leaf component further down the same list.
- Real mismatch but no hint → the module diffs the DOM after mount, so `ClientOnly`/lazy
  boundaries can hide it; trust `[Vue warn]` over the absence of hints.

## Update Scaffold
- [ ] Add newly measured benign sources to the step 3 inventory
- [ ] Update `.claude/context/conventions.md` if a rule follows from it
- [ ] Keep `patterns/color-mode-assets.md` cross-linked when a real attribute mismatch resurfaces