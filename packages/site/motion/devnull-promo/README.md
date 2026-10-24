# dev-null.sh promo video

A motion design clip promoting the new dev-null.sh connection on MagicSync.

## Files

| File | Role |
|------|------|
| `scene.html` | The animation. Fixed 1920×1080, all motion via paused Web Animations driven by `window.__seek(ms)`. |
| `capture.mjs` | Renders frames with Playwright and pipes them into ffmpeg → h264. |
| `audio.mjs` | Synthesises the soundtrack as 48 kHz stereo PCM (no samples, no network). |
| `build.mjs` | capture → audio → mux → 720p copy → poster frame. |
| `preview.mjs` | Renders still frames so the design can be reviewed without a full render. |
| `fonts/` | Local Inter + JetBrains Mono woff2 (the render must not depend on the network). |

Published output goes to `packages/doc/public/video/`.

## Commands

```bash
# design review (still frames, ~1 s each)
pnpm --filter @local-monorepo/site exec node motion/devnull-promo/preview.mjs 0 4 8 15 21 40

# full build (~3 min)
pnpm --filter @local-monorepo/site exec node motion/devnull-promo/build.mjs

# re-mux only (after editing audio.mjs)
pnpm --filter @local-monorepo/site exec node motion/devnull-promo/build.mjs --no-capture
```

## Rules

- The scene must stay **deterministic**: no `Date.now()`, no `Math.random()`,
  no `requestAnimationFrame` in anything that ends up in a frame. Seed any
  randomness and derive motion from `t`.
- `__seek` takes **milliseconds** (that is what `animation.currentTime`
  uses); convert to seconds once before calling the draw helpers.
- One animation per property per element — two animations touching the same
  `opacity`/`transform` do not blend, the later one wins.
- Keep the brand tokens from `.aiContext/DESIGN.md` and reuse the real logo
  and platform icons rather than redrawing them.

The full pattern (with the gotchas list) lives in
`.claude/patterns/motion-design-video.md`.
