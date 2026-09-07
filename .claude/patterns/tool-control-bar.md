# Tool Control Bar (camera-style)

Inspired by https://ui.camera bottom bar — one floating camera control bar for tool menus. Use for all `/tools/*` editors.

## When to use
Any interactive tool page with a stage/canvas and 3+ control clusters (mode, transforms, style, export). Replaces: top tabs + multiple floating docks + separate action pills.

## Structure
```
[ Mode segmented (pill-in-pill) ]  [ dial  dial  dial ]  |  [ icon cluster w/ popovers ]  |  [ ghost export icons  yellow primary pill ]
```
Placed `sticky bottom-4 z-30` centered below the stage (never `fixed` over content). Wraps on mobile.

## Pieces
- **Segmented mode**: `DECK | AI` (or `PHOTO | VIDEO`) — pill container `border bg-elevated/70`, active `bg-neutral-200 text-neutral-900`.
- **Scrubbable dials** (`DialKnob.vue`): circular knob with tick ring, center value label, drag vertically / wheel to scrub, ←→ nudge, dblclick reset. `role=slider`, `aria-valuenow`. Sizes ~48px. Use for: rotate°, zoom%, pattern%. Prefer deck-level or per-slide transform values.
- **Icon cluster**: 6–8 quick actions, each a ghost `UButton` + `UTooltip`, most open a `UPopover`:
  - Layout (popover list), Palette (swatch grid popover), Pattern (cycle), Guides toggle (`data-active`), Aspect (`4:5`/`1:1` label, cycles), Flow (`off→plane→pan` icon), Frame preset (popover `portrait`/`square`), Randomize.
  - Icons use `i-lucide-*` from Nuxt UI.
- **Primary**: one `bg-yellow-400 text-neutral-950` pill for the main CTA (`Use in post` / shutter). Preceded by ghost download/save icons keeping `pill-*` testids.

## Effects to consider (from ui.camera)
- **Dials**: X/Y/Z → rotate / scale / dim/opacity. Scrubbable is the gesture (`pointerdown→pointermove`, `wheel`).
- **Safe-area guides**: overlay on preview only (grid + dashed inset rect + crosshair), toggled from bar, never exported.
- **Aspect presets**: `portrait 1080×1350` / `square 1080×1080` (and `16:9` if needed). One bar button cycles, one popover selects with `bar-frame-*` testids.
- **Reset**: dblclick on any dial.
- **Presets row**: (future) style presets like `+15/−45/0` in ui.camera.
- **Keyboard**: arrows for dial-step, arrows for slide nav.

## i18n
Bar keys live under `bar.*` in `carousel-creator.json`. Placeholder strings must escape vue-i18n linked syntax — literal `@` → `{'@'}`.

## Testids
`control-bar`, `bar-mode`, `dial-rotate|zoom|pattern`, `bar-layout`, `bar-layout-*`, `bar-aspect`, `bar-frame-*`, `bar-guides`, `bar-flow`, `bar-pattern`, `bar-randomize`, `stage-guides`, `pill-download|save-all|use-in-post`.

## Gotchas
- Keep `pill-*` testids on export buttons even after moving them into the bar (E2E contract).
- Guides overlay is preview-only; assert `not.toContainText('grid-cols-3')` on `#carousel-export-stage`.
- Frame switch changes `CarouselStage` props + export-stage size + `fx` var — all three.
