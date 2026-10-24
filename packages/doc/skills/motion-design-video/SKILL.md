---
name: motion-design-video
description: Build or re-render a motion design video (MP4) for MagicSync — a deterministic HTML/WAAPI scene, Playwright frame capture piped into ffmpeg, and a synthesised audio bed. Use when the user asks for a promo/launch/explainer video, an animated social clip for a new integration or feature, or wants an existing video asset re-rendered.
---

# Motion Design Video

Produce a real, watchable MP4 in the repo without a video editor, a paid
service, or a screen recorder. The clip is an HTML scene that renders
itself frame by frame, so the output is deterministic and re-renderable.

## When to use

- "Make a promo video for the new dev-null.sh integration."
- "I need a launch clip / animated explainer / social clip."
- "Re-render the video with a different headline / timing / CTA."
- Any request for a motion-design, animated, or video asset for a feature.

Not for: recording a real app session (use the Playwright screencast
approach) or editing an existing footage file (use ffmpeg directly).

## Steps

### 1. Scope the story before touching code

Write down, in one short brief:

- **Audience** — who is watching (developers? marketers? existing users?).
- **One sentence** — what the viewer must remember afterwards.
- **Beats** — 3–5 scenes, each with a time window and a single job.
- **CTA** — the exact final frame (headline + URL).

Read `.aiContext/DESIGN.md` for the palette and type scale, and
`packages/doc/guide/<feature>.md` for the *accurate* product facts. The copy
in the video must match the real integration — a promo that lies about how the
feature works is worse than no promo.

### 2. Create the motion project

```
packages/site/motion/<slug>/
  scene.html      # the animation source (self-contained)
  capture.mjs     # Playwright → ffmpeg → mp4
  audio.mjs       # synthesised soundtrack → wav
  preview.mjs     # still frames for design review
  fonts/          # local woff2 (Inter, JetBrains Mono)
```

`packages/site` is the home because `@playwright/test` is a devDependency
there — `import { chromium } from '@playwright/test'` resolves with no
install step. Publish the finished MP4 to `packages/doc/public/video/`.

### 3. Build the scene

Copy the structure of `packages/site/motion/devnull-promo/scene.html`:

- Fixed `1920×1080`, absolute pixel positions, no flow layout.
- All motion via `element.animate()` + `animation.pause()`, registered in an
  array, driven by `window.__seek(ms)`.
- JS-driven values (typing, orbits, travelling cards) are pure functions of
  `t` — no `Date.now()`, no `Math.random()`, no `requestAnimationFrame`.
- Inline the brand assets: the octopus mascot from
  `packages/doc/public/logo.svg`, platform icons from
  `@iconify-json/simple-icons` (read `icons.json`, copy the `body` path).

### 4. Review stills, not the video

```bash
pnpm --filter @local-monorepo/site exec node motion/<slug>/preview.mjs 0 4 8 15 21 40
```

Open `motion/<slug>/.preview/*.png` and fix the design. Iterate here — it is
~1 s per frame. Do not render 1400 frames to find out the layout is wrong.

### 5. Render

```bash
pnpm --filter @local-monorepo/site exec node motion/<slug>/capture.mjs
node motion/<slug>/audio.mjs
ffmpeg -i video.mp4 -i audio.wav -c:v copy -c:a aac -b:a 192k -shortest final.mp4
```

### 6. Publish

- MP4 → `packages/doc/public/video/`
- Poster frame → `packages/doc/public/video/<slug>.poster.png`
- Wiki page → `packages/doc/guide/<slug>-video.md` + sidebar entry in
  `packages/doc/.vitepress/config.mts`
- Skill → `packages/doc/skills/motion-design-video/SKILL.md` (update this file
  instead of creating a duplicate)

## Gotchas

- **Milliseconds vs seconds.** `animation.currentTime` is ms; timeline
  helpers are seconds. Convert once inside `__seek`. A mismatch silently
  freezes every JS-driven element at its final value — the render still
  succeeds, so it looks like a design bug.
- **One animation per property per element.** Two animations touching the
  same `opacity`/`transform` on one element do not blend — the later one
  wins outright. Split across nested elements, or merge into one animation
  with `offset` keyframes.
- **Animations beat inline styles.** `element.animate()` overrides
  `style.opacity` while active; `fill: 'both'` keeps the value applied
  before the delay.
- **Canvases sit behind the DOM.** Effects that must appear on top of cards
  belong in a DOM SVG layered after the content, not on the canvas.
- **Absolute children anchor to their positioned ancestor**, not the
  viewport.
- **Fonts must be local files** and you must await `document.fonts.ready`
  before the first frame.
- **JPEG banding.** `quality: 95, chromaSubsampling: '4:4:4'` is safe for
  these dark gradients; use `--png` if the art has wide smooth ramps.
- **A local preview server needs Range support.** Without `206 Partial
  Content` responses the browser can play the video but not seek it, so a
  screenshot of the embedded player comes out black.

## Verify

- [ ] `ffprobe`: expected duration, 1920×1080, 30 fps, h264 video + aac audio.
- [ ] Frames extracted **from the final MP4** look right (not just the
      preview PNGs).
- [ ] Audio waveform shows a bed plus accents; no clipping (peak ≈ -1 dBFS).
- [ ] Every scene boundary has no blank or duplicated frame.
- [ ] The copy in the video matches the real feature behaviour.
- [ ] Wiki page embeds the published asset and the poster frame.
