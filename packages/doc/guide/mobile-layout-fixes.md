# Mobile layout fixes

A pass over every route at a 390x844 phone viewport: what was broken, what was
fixed, and how to keep it from coming back.

## The tool

`pnpm screenshots:audit` (see
[audit-mobile-layout](/guide/mobile-layout-audit) skill) visits every route at a
phone viewport and reports two failures: the page being wider than the screen, and
**clipped content** — an element crossing the viewport edge while the page does not
scroll. The second one matters most: `<main>` is `overflow-x: hidden`, so a
too-wide modal or toolbar is silently *cut off*, never scrollable.

| Before | After |
|---|---|
| 52 of 136 routes reported broken | **4**, all off-canvas by design (see below) |

Screenshots: `packages/doc/public/img/screenshots-mobile/` — one `page.png` per
route, plus `NN-<step>.png` per interaction journey. Produced with
`SCREENSHOT_VIEWPORT=mobile pnpm screenshots:mobile` and
`SCREENSHOT_VIEWPORT=mobile pnpm screenshots:interactions`.

## What was broken, and the fix

The top three are cause-and-effect, not independent: an unprefixed `min-w-` makes
a modal unreachable, and a `col-span` inside a one-column grid crushes every field.

| Symptom | Cause | Fix |
|---|---|---|
| Add-business wizard unusable on a phone (the reported bug) | `min-w-5xl` (1024px) on the modal and its card — unprefixed, so it applied at every width | `w-full max-w-4xl` + internal `max-h-[90dvh] overflow-auto` |
| Same wizard's loading step off-screen | `min-w-5xl min-h-[90vh]` on the extraction modal | `w-full max-w-2xl max-h-[90dvh] overflow-y-auto` |
| Every form field crushed to ~30px in the wizard's manual step | `col-span-2` inside `grid-cols-1 md:grid-cols-2` — the span creates an **implicit second column** on mobile | `col-span-full` |
| Wizard's Cancel/Save buttons cut off | `-mx-6` action bar inside a `p-4` card body (8px bleed each side) | `-mx-4 px-4 sm:-mx-6 sm:px-6` |
| **Every `/app` page**: header controls cut off (bell, language, avatar) | header's right cluster was 362px; the row is 358px | colour mode + language moved to the sidebar drawer footer on mobile; business switcher capped at `max-w-[8rem]`; collapse control hidden |
| `/app/posts` view toggle (Grid/Feed/Board/Table) cut off | 4 labelled buttons + filters in a non-wrapping row | row wraps; labels hidden below `sm` |
| `/app/posts/feeds` cut off | `BaseTwitterLayout` rail (`w-20`) + `gap-4` stole 96px | rail `w-16 sm:w-20`, `gap-2 sm:gap-4`, `min-w-0` on main |
| `/app/profile` cut off (introduced by the merged profile page) | 5-tab strip cannot shrink: grid items default to `min-width: auto` | `min-w-0` on both columns and the stat cards |
| `/app/tools` and other public pages | `UHeader` right slot = 6 controls (226px) | secondary controls hidden below `sm`, mirrored into the header drawer |
| 44 marketing/content routes | `BaseBannerPromo`: `fixed left-5` + `w-full max-w-sm` (384px) = 404px | `left-4 right-4 w-auto sm:left-5 sm:right-auto sm:w-full` |
| Blog code blocks | long inline `code` never wrapped | `overflow-wrap: anywhere` on content `code`, `max-width` + `overflow-x` on `pre` |
| `/twitter-mock` (512px) | bottom action bar with 4 buttons | `flex-wrap`, spacer `hidden sm:block` |
| `/tools/og-image-generator` floating pill | 3 labelled buttons, 471px | capped to `w-[calc(100%-2rem)] max-w-fit` with internal scroll |
| Content board column titles invisible on a phone | 4 columns squeezed into 81px each left 0px for the `<h2>` | columns are `w-[17rem] shrink-0` below `sm` — a kanban scrolls sideways on a phone |

Also hardened: `PostModalContent`'s pre-hydration fallback used a hard
`w-[433px]`, now `w-full max-w-[433px]` with a `aspect-[433/882]` box.

## The four remaining findings (accepted)

`mobile-audit.json` still lists four routes. None has document overflow; each is a
fixed-size surface that is *meant* to sit outside the viewport, or a canvas:

- `/home` — the two off-screen items are carousel slides on a transform-based
  track (Embla), reachable by swiping.
- `/tools/carousel-creator` — `#carousel-export-stage` is parked at `left:
  -99999px` so it can be rendered and exported at full size.
- `/tools/image-editor` — the Figma-style editor canvas and properties panel are a
  desktop tool; making it usable on a phone is its own project.
- `/tools/og-image-generator` — a downward-transformed fixed pill after the cap
  (resolved for the toolbar itself; the remaining node is the transform wrapper).

## How to keep it fixed

1. Never write an unprefixed `min-w-*` on a modal or a `col-span-N` inside a
   single-column grid.
2. Always prefix a multi-column grid: `grid-cols-1 sm:grid-cols-2`.
3. Add `min-w-0` to any grid/flex item that contains a tab strip, table or long
   string.
4. Run `pnpm screenshots:audit` before calling a UI change done, and
   `pnpm screenshots:interactions` at **both** viewports — the desktop run is the
   regression check for whatever responsive class you added.
