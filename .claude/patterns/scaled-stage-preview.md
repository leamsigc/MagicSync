---
name: scaled-stage-preview
description: Rendering tool output at a fixed target device resolution (TVs, OG images) and scaling down for in-app previews.
last_updated: 2026-08-25
---

# Scaled Stage Preview

When a tool's final output targets a fixed-size device (e.g. a menu board on a 4K TV), never rely on viewport units at render time.

## Steps

1. Define named size presets in the feature's `types.ts` (see `TV_DISPLAY_SIZES` in `packages/tools/app/pages/tools/menu-board/types.ts`) with `key/label/width/height`.
2. Persist the chosen preset as part of the saved document settings.
3. In the renderer component (`BoardDisplay.vue`), accept optional `displayWidth/displayHeight`. When set, wrap content in a fixed-size stage and apply `transform: scale(min(vw/width, vh/height))`, centered on black. When unset, fall back to `100%/100%`.
4. For in-app previews, reuse the same scale trick inside a modal frame (`TvPreviewModal.vue`) — render the exact same HTML, just smaller, so what you see equals what the TV shows.
5. Layer/visual editors that emit HTML must generate **inline styles** only (no classes, no vw/vh) so output is portable to display pages, shared links, and screenshot exporters (`useMenuBoardExport.ts` converts vh/vw to px for capture — inline px avoids this entirely).
