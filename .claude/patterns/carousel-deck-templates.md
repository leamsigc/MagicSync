# Carousel Deck Templates & Gallery

Multi-page deck templates with per-deck palette, font and pattern, plus a bottom-of-page gallery that lays out every page of every deck. Lives in `packages/tools/app/pages/tools/carousel-creator/`.

## When to use
Adding deck (multi-slide) template styles to the carousel creator, adding new slide layouts, or any "show all pages" preview surface.

## Architecture
- `templates.ts` — single-slide layouts (`CAROUSEL_TEMPLATES`). Each `render(d, p, i, t, bg)` returns inline-style HTML string; `renderSlideHtml` post-processes every content div by replacing the literal `position:relative;height:100%` to inject `--slide-fx` transform **and** `font-family` from `palette.font`. Fonts resolve through `FONT_STACKS` / `fontFamilyStack()` (system stacks only — safe for modern-screenshot PNG export, no webfont fetching).
- `deckTemplates.ts` — `DeckTemplate { key, title, description, palette, pattern?, slides[] }`. `palette.font` is a display name ('Comic Sans MS'…), not a CSS stack. `pattern` keys into `patterns.ts`.
- `useCarouselDeck.applyDeckTemplate` maps specs → slides, copying `deck.pattern ?? 'dots'` and spreading palette (font flows via ref).
- Multi-image layouts read `data.images: string[]` (`photo-grid` uses up to 4, `polaroid` uses `[0]`, falls back to `bgImage.url`). Media panel shows an append-picker + removable thumbs only when `templateKey === 'photo-grid' | 'polaroid'`.
- `CarouselDeckShowcase.vue` — bottom gallery: one strip per deck rendering ALL pages at scale 200/1080 via the same `previewHtml` approach as the side panel (static, no composable state), plus confirm-modal apply.

## Gotchas
- Font injection rides the same literal-replace trick as `--slide-fx`; a layout whose root div doesn't start with `position:relative;height:100%` gets no font — keep the convention.
- `pageFooter` needs `palette.font` handled separately (it's absolutely positioned, missed by the replace).
- Gallery previews must build their own pattern HTML per deck (`deck.pattern`), not assume `dots`.
- Vue SFCs here need a single template root when a `UModal` accompanies the section — wrap both in one `<div>`.
- v-html warnings are accepted in this folder (sanitised by construction; data is user-authored).

## Testids
`deck-showcase`, `showcase-deck-*`, `btn-showcase-use-*`, `showcase-strip`, `grid-images`, `btn-remove-image-*`, `font-select`.
