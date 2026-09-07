---
name: theme-tokens
description: Fixing UI elements that break in light/dark mode — replace hardcoded colors with Nuxt UI semantic tokens
triggers:
  - "dark mode broken"
  - "light mode broken"
  - "theme not supported"
  - "text invisible"
  - "hardcoded color"
edges:
  - target: "../.aiContext/DESIGN.md"
    condition: "always — source of truth for tokens and the light/dark palettes"
  - target: "context/conventions.md"
    condition: "when writing or reviewing Vue component code"
last_updated: 2026-08-24
---

# Theme Tokens (Light/Dark Support)

## Context

All UI must render correctly in both light and dark mode (DESIGN.md: "All components and pages MUST support both light and dark themes"). The app is Nuxt UI v4 + Tailwind v4. Semantic color utilities (`text-highlighted`, `text-dimmed`, `text-muted`, `bg-default`, `bg-elevated`, `border-default`, `border-accented`, `text-primary`) automatically resolve per active color mode.

## Steps

1. Find violations — grep for hardcoded colors in the affected layer/package:
   ```
   text-white|text-gray-|bg-gray-|bg-white|border-white|text-zinc-|bg-black(?!/)|text-black
   ```
   (`bg-black/5`, `dark:bg-white/5` opacity pairs are acceptable — they are mode-aware overlays used in app.config variants.)
2. Map each violation to its semantic token:

   | Hardcoded | Replace with |
   |-----------|--------------|
   | `text-white` (body text) | `text-highlighted` |
   | `text-gray-400` / `text-gray-500` | `text-dimmed` or `text-muted` |
   | `text-gray-300` | `text-muted` |
   | `bg-gray-800` / `bg-gray-900` | `bg-elevated` |
   | `bg-gray-100` / `bg-gray-50` | `bg-accented` or `bg-elevated` |
   | `border-white/0` / `border-gray-*` | `border-default` or `border-accented` |
   | `bg-white` | `bg-default` |

3. If a `dark:` variant pair exists (e.g. `bg-white dark:bg-gray-900`), it can collapse to a single token (`bg-default`).
4. JS-driven colors (canvas, WaveSurfer `waveColor`, chart libs) cannot use utility classes — read the CSS var at runtime with `getComputedStyle(el).getPropertyValue('--ui-primary')` or pick a mid-tone that works on both backgrounds. Do not leave near-white/near-black hex values.

## Gotchas

- `text-white` is only correct inside elements with a guaranteed dark/primary background (e.g. badge on `bg-primary`). On a token background it disappears in light mode.
- Third-party canvas libs (WaveSurfer) take hex strings, not classes — hardcoded emerald/orange mid-tones survive both modes, but document the choice.
- `BaseShinyCard` and `UCard` (via `packages/ui/app/app.config.ts`) already use tokens — violations are usually in the page or its local components, not the shared card wrappers.
- Components shared across pages (e.g. `packages/tools/app/components/AudioPlayer.vue`) affect every page that imports them — fix once, verify all consumers.

## Verify

- [ ] `grep` for the violation pattern in the touched files returns nothing (excluding allowed `black/5`-style overlays)
- [ ] Toggle light and dark mode in the browser on every page that uses the component — text readable, borders visible in both
- [ ] ESLint passes on touched files (`pnpm --filter <pkg> lint`)

## Debug

- Element invisible in one mode: inspect computed `color`/`background-color`; if it resolves to a literal `rgb(255 255 255)` or `rgb(0 0 0)`-family value, a hardcoded class is winning — search the component tree upward for the source.
- If a token utility has no effect, check that the token is defined for the active mode in the main CSS (`--ui-text-highlighted` etc. under `.dark`).

## Update Scaffold

- [ ] Update ROUTER.md "Current Project State" if what's working/not built has changed
- [ ] Update any `context/` files that are now out of date
- [ ] If this is a new task type without a pattern, create one in `patterns/` and add to `INDEX.md`
