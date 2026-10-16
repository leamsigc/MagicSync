---
name: audit-mobile-layout
description: Find and prove mobile layout breakage across every route at a phone viewport, then capture mobile screenshots for routes and interactions. Use when asked to "check mobile", "mobile views are broken", "does X work on a phone", "make it responsive", or before claiming a mobile-fix is complete.
---

# Audit mobile layout

A phone viewport is 390x844. Most mobile breakage is **invisible at a glance** and
does not show up as a page-level horizontal scrollbar, because the app's `<main>`
is `overflow-x: hidden` — the broken thing is silently *clipped*.

## The tool

```bash
SCREENSHOT_VIEWPORT=mobile pnpm screenshots:audit                    # every route
SCREENSHOT_ROUTE_PREFIX=/app SCREENSHOT_VIEWPORT=mobile pnpm screenshots:audit
SCREENSHOT_AUDIT_STRICT=1 ... pnpm screenshots:audit                 # fail on any finding
```

Writes `<SCREENSHOT_ROOT>/mobile-audit.json` and prints one line per route. It
flags two things:

- **document overflow** — the page is wider than the screen.
- **clipped content** — an element's box crosses the viewport edge even though the
  page does not scroll, i.e. `overflow: hidden` is hiding it. This is the one that
  catches fixed-width modals and over-full toolbars.

It deliberately ignores: children of a genuinely scrollable container (`overflow-x:
auto` that scrolls — how wide tables are meant to work), dev overlays, decorative
absolutely-positioned flourishes, and elements under 8px tall (progress bars).

## Why the detector is the hard part

Three traps, all of which produce a **silently passing audit** if you get them
wrong — worse than no audit:

1. **Never call a module-scope helper inside `page.evaluate`.** Playwright
   serialises the function source; anything not defined inside it is `undefined`
   in the browser, the evaluate throws, and a `catch` turns every route into
   "ok". Inline every helper.
2. **Do not swallow a measurement error.** A failed measurement is reported as a
   finding with an `error`, never as "ok".
3. **Check the audit can fail.** Before trusting a clean run, verify it reports a
   known-bad case (the `min-w-5xl` add-business modal was the calibration case).

## The five breakage patterns to look for by hand

The automated pass finds geometry; these are the causes. Grep for them.

1. **Unprefixed fixed widths in overlays.** `min-w-5xl` (1024px) on a modal makes
   it unreachable on a phone. Grep `min-w-5xl\|min-w-4xl\|min-w-3xl` and require
   `md:`/`sm:` prefixes or `w-full max-w-*`.
2. **`col-span-N` inside a one-column grid.** `grid-cols-1 md:grid-cols-2` with a
   `col-span-2` child forces an **implicit second track** on mobile, collapsing
   every other field to a sliver. Use `col-span-full`, or prefix the span to match
   the grid. Grep `col-span-[2-9]` and check the parent grid.
3. **Flex children that cannot shrink.** A CSS grid/flex item defaults to
   `min-width: auto`, so it will not shrink below its content — a 5-tab strip
   forces the whole page wider than the phone. Add `min-w-0` to the item.
4. **Negative margins that exceed the parent padding.** `-mx-6` inside a `p-4`
   body bleeds 8px per side at mobile; make it `-mx-4 px-4 sm:-mx-6 sm:px-6`.
5. **Header/toolbar control clusters.** A sticky header with 6 controls overflows
   every page it renders on. Move the secondary controls into the existing mobile
   drawer rather than hiding them — the feature stays reachable.

## Capture the evidence

Mobile screenshots go to their own tree so they can never overwrite desktop
images (`packages/doc/public/img/screenshots-mobile/`):

```bash
SCREENSHOT_VIEWPORT=mobile pnpm screenshots:mobile                  # one page.png per route
SCREENSHOT_VIEWPORT=mobile pnpm screenshots:interactions            # every journey, step by step
SCREENSHOT_VIEWPORT=mobile SCREENSHOT_FEATURE=business-create pnpm screenshots:interactions
```

Add a journey for any flow you fix — an audit only checks landing states, so an
overlay bug is only proven fixed by driving it (`journeys/business-create.ts` is
the model).

## Verify

1. `mobile-audit.json` → `withOverflow` is 0, or every remaining finding is a
   documented off-canvas canvas.
2. `pnpm screenshots:interactions` passes **at both viewports** — the desktop run
   is the regression check for the responsive classes you added.
3. Spot-check the new mobile images; a clean audit does not prove a modal is
   usable, only that nothing is clipped.
