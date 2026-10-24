---
name: motion-design-video
description: Produce a deterministic motion-design video (MP4) in the repo — HTML/CSS/WAAPI scene, Playwright frame capture piped to ffmpeg, synthesised audio bed. Use when asked for a promo/launch/explainer video, an animated social clip, or to re-render an existing video asset.
triggers:
  - "make a promo video"
  - "motion design video"
  - "launch video"
  - "animated explainer"
  - "social clip for the new integration"
  - "re-render the video"
edges:
  - target: context/design.md
    condition: "when picking brand colors, type scale, or logo treatment for the scene"
  - target: context/conventions.md
    condition: "when checking the repo conventions that also apply to generated assets"
last_updated: 2026-10-20
---

# Motion Design Video (deterministic HTML → MP4)

## Context

MagicSync needs promo/launch clips for new integrations. There is no video
tooling in the repo, so a clip is built as a **self-contained HTML scene that
renders itself frame by frame** — no headless screen recording, no
timeline editor, no external service.

Two existing assets carry the brand:

| Asset | Where | Use |
|-------|-------|-----|
| Octopus mascot (orange, ninja headband, visor) | `packages/doc/public/logo.svg` | The "hub" — MagicSync, the scheduler, the CTA lockup |
| Platform orbs (FB / Instagram / LinkedIn / X) | same file, `<circle>` group | The "everywhere" — orbiting platform icons |

Brand tokens live in `.aiContext/DESIGN.md`: orange `#F97316` on `#0A0A0A`,
green `#22C55E` for dev-null.sh, Inter for UI text, JetBrains Mono for
terminal/code.

## Steps

1. **Write the scene** as one HTML file (`packages/site/motion/<slug>/scene.html`):
   - Fixed `1920×1080` canvas. Absolute pixel positions only — no
     percentage/flow layout, so every frame is pixel-identical.
   - **Every animation is a Web Animation created with `element.animate()` and
     immediately paused.** Register them in an array. Expose
     `window.__seek(ms)` that sets `anim.currentTime = ms` on all of them and
     recomputes every JS-driven value as a pure function of `t`.
   - JS-driven motion (typed text, orbiting icons, a travelling card) must be
     a pure function of `t`. Never use `Date.now()`, `Math.random()`, or
     `requestAnimationFrame` for anything that lands in a frame.
   - Background grain: pre-render one 256×256 noise tile and blit it with an
     offset derived from `t`. Per-pixel noise per frame is far too slow.
   - Seed any randomness (`mulberry32`) so the particle field is stable.

2. **Preview stills** before rendering the whole thing:

   ```bash
   pnpm --filter @local-monorepo/site exec node motion/<slug>/preview.mjs 0 4 8 15 21 40
   ```

   Read the PNGs in `motion/<slug>/.preview/` and fix the design. This loop is
   ~1 s per frame — iterate here, never on the full render.

3. **Capture frames and pipe them into ffmpeg** (`capture.mjs`):
   - `page.screenshot({ type: 'jpeg', quality: 95, chromaSubsampling: '4:4:4' })`
     → ~70 ms/frame. PNG is ~340 ms/frame; only use `--png` when the content
     has hard gradients that JPEG banding would ruin.
   - Pipe into `ffmpeg -f image2pipe -vcodec mjpeg -framerate 30 -i -` with
     `libx264 -crf 19 -pix_fmt yuv420p -movflags +faststart`. Never write
     thousands of PNGs to disk.
   - Handle `stdin.write()` backpressure — await `'drain'`.

4. **Synthesise the audio bed** (`audio.mjs`): plain PCM, no samples. A drone
   plus cues placed on the same timeline as the picture (keystroke clicks,
   whooshes on scene changes, a bell when the payload lands).

5. **Mux** the audio into the video and also emit a 720p copy for the web.

6. **Publish** the MP4 under `packages/doc/public/video/` and embed it in the
   wiki page.

## Gotchas

- **Units.** `anim.currentTime` is in **milliseconds**; your timeline helpers
  are in **seconds**. Convert once, at the top of `__seek`, and pass seconds
  to every draw function. Getting this wrong silently freezes every
  JS-driven element at its end state — the picture still renders, so it looks
  like a design bug, not a units bug.
- **One animation per property per element.** Two animations on the same
  element that both touch `opacity` or `transform` do not compose — the later
  one wins outright. If an element needs both an entrance and a float, put
  them on two nested elements, or merge the entrance and exit into a single
  animation with `offset` keyframes.
- **CSS animations override the `style` attribute.** An `element.animate()`
  beats an inline `style.opacity` — but only while it is active. `fill:
  'both'` + a `delay` keeps the "before" value applied, which is how the
  entrance/exit trick works.
- **`fill: 'backwards'` on a late animation wins from frame 0.** If a second
  animation on the same element has a delay, its first keyframe applies
  immediately — that is why a "pulse" that animates `opacity` will kill an
  entrance that also animates `opacity`. Pulse a different property
  (`filter: brightness()`) instead.
- **Absolute children are relative to their positioned ancestor.** An SVG
  placed inside a `position:absolute` wrapper is positioned against that
  wrapper, not the viewport. Check the offsets against the parent, not the
  page.
- **Canvas layers sit behind the DOM.** `background`/`fx` canvases are
  siblings of `#stage`, so anything drawn on them is *under* the cards. Put
  effects that must appear on top into a DOM SVG layered after the content.
- **Font loading.** Wait for `document.fonts.ready` before the first frame or
  the capture renders in a fallback face.
- **Web fonts must be local files.** Fetch the woff2 once into the project
  folder and reference it with `@font-face`; a Google Fonts `<link>` makes the
  render depend on the network at capture time.
- **Local preview servers need Range support.** A throwaway static server
  that ignores `Range` headers lets the browser play the video but not seek
  it — `currentTime = 29.5` silently stays `0`, so the screenshot ends up
  with a black player. Answer `206 Partial Content` with a `content-range`
  header and seeking works.
- **Headless Chromium does not paint the poster attribute.** `<video
  poster="…">` renders black in a headless screenshot; the video frame only
  appears once a frame has been decoded.

## Verify

- [ ] `ffprobe` reports the expected duration, 1920×1080, 30 fps, h264 + aac.
- [ ] Extracted frames from the *final MP4* (not the preview PNGs) look right
      — JPEG banding and ffmpeg colour conversion can differ from the browser.
- [ ] The audio has a bed plus accents; check the waveform
      (`ffmpeg -i audio.wav -filter_complex showwavespic ... -frames:v 1 wave.png`).
- [ ] No frame is blank or duplicated at a scene boundary.
- [ ] The wiki page embeds the published asset and the poster frame.

## Update Scaffold

- [ ] Wiki: `/guide/<slug>-video`
- [ ] Skill: `packages/doc/skills/motion-design-video/SKILL.md`
- [ ] Pattern: `.claude/patterns/motion-design-video.md` + `INDEX.md` row
