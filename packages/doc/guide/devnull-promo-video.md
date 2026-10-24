# dev-null.sh promo video

A 47-second motion design clip that promotes the new
[dev-null.sh integration](/guide/devnull-integration) — posted to
`packages/doc/public/video/magicsync-dev-null-sh.mp4`.

![MagicSync × dev-null.sh promo video](/video/magicsync-dev-null-sh.poster.png)

<video controls preload="metadata" poster="/video/magicsync-dev-null-sh.poster.png" style="width:100%;border-radius:16px">
  <source src="/video/magicsync-dev-null-sh-720p.mp4" type="video/mp4" />
</video>

## What was done

The clip is a **self-contained HTML scene that renders itself frame by
frame**. There is no video editor, no screen recording, and no external
service — the source of truth is one HTML file plus a small build script, so
the video can be re-rendered whenever the copy or the design changes.

```
packages/site/motion/devnull-promo/
  scene.html    the animation (HTML + CSS + Web Animations API)
  capture.mjs   Playwright → ffmpeg → h264
  audio.mjs     synthesised soundtrack (plain PCM, no samples)
  build.mjs     the whole pipeline in one command
  preview.mjs   still frames, for reviewing the design
  fonts/        local Inter + JetBrains Mono woff2
```

Outputs land in `packages/doc/public/video/`:

| File | Size | Use |
|------|------|-----|
| `magicsync-dev-null-sh.mp4` | ~5.7 MB | 1920×1080 master, h264 + AAC 48 kHz stereo |
| `magicsync-dev-null-sh-720p.mp4` | ~2.5 MB | web-sized copy embedded in the docs |
| `magicsync-dev-null-sh.poster.png` | — | poster frame / social preview |

## Why it works this way

**Determinism.** Every animation in the scene is a Web Animation created with
`element.animate()` and immediately paused. The scene exposes
`window.__seek(ms)`, which sets `currentTime` on all of them and recomputes
every JS-driven value (typed text, orbiting icons, the travelling post) as a
pure function of `t`. Frame *N* is therefore always the same image — no
`Date.now()`, no `Math.random()`, no `requestAnimationFrame` in the render
path. The same command always produces the same MP4.

**One renderer, one timeline.** Picture and sound come from the same
timeline: the keystroke clicks sit exactly on the typed characters, the
whooshes sit on the scene changes, and the bell lands when the commit hits
the feed. The soundtrack is synthesised in `audio.mjs` from the cue list —
drone, filtered-noise sweeps, soft bells — so it can be re-timed with the
picture by editing one file.

**Brand assets, not redraws.** The octopus mascot is the real
`packages/doc/public/logo.svg`; the platform icons are the real
`simple-icons` paths. The palette comes from `.aiContext/DESIGN.md`
(`#F97316` orange on `#0A0A0A`, `#22C55E` for dev-null.sh).

## The storyboard

| Beat | Time | What happens |
|------|------|--------------|
| The command | 0–6.2 s | A terminal opens and types `magicsync publish --to /dev/null`, then prints `signed with ed25519 · verified via GitHub` and `commit published to /dev/null`. A light streak wipes to the next scene. |
| The connection | 6.2–12.8 s | The MagicSync mark and a `/dev/null` terminal card slide in; a glowing tether draws between them with a pulse that travels from orange to green. Chips: *SSH-signed · GitHub-verified · no token stored*. |
| Three steps | 12.8–24.2 s | *Connect GitHub → MagicSync signs → Commit lands.* An ed25519 signature draws itself, an ember hops the rail, and step 3 lights green. |
| One post, everywhere | 24.2–34.2 s | A post is composed and scheduled; the commit card lifts out of the composer, travels through the orbiting platform icons, and lands in a dev-null.sh feed with a green `signed · ed25519 · verified via GitHub` line. |
| Call to action | 34.2–47 s | The mark, `MagicSync × dev-null.sh`, *Your commits deserve a feed.*, `magicsync.dev`, and a **Connect dev-null.sh** button. |

## How it was built

```bash
# preview stills while designing (~1 s per frame)
pnpm --filter @local-monorepo/site exec node motion/devnull-promo/preview.mjs 0 4 8 15 21 40

# full render: capture → audio → mux → 720p copy → poster
pnpm --filter @local-monorepo/site exec node motion/devnull-promo/build.mjs
```

`capture.mjs` pipes JPEG frames straight into ffmpeg — no thousands of PNGs
on disk:

```
ffmpeg -f image2pipe -vcodec mjpeg -framerate 30 -i - \
       -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -movflags +faststart
```

The audio is muxed with `-c:v copy`, so the video is never re-encoded.

## Gotchas worth knowing

- **Milliseconds vs seconds.** `animation.currentTime` is milliseconds; the
  timeline helpers in the scene are seconds. Convert once at the top of
  `__seek`. A mismatch silently freezes every JS-driven element at its final
  value, and the render still succeeds — it looks like a design bug.
- **Two animations on one element do not blend.** If both touch `opacity` or
  `transform`, the later one wins outright. The scene nests an inner wrapper
  so the block entrance and the idle float can coexist.
- **Canvases sit behind the DOM.** The particle field is drawn on a canvas
  that is a sibling of `#stage`, so anything drawn there is *under* the
  cards. Effects that must appear on top live in a DOM SVG layered after the
  content.
- **Absolute children anchor to their positioned ancestor.** The tether SVG
  lives inside the block wrapper, so its `top` is relative to that wrapper.
- **Fonts must be local files**, and `document.fonts.ready` has to resolve
  before the first frame — otherwise the capture renders in a fallback face.

## Files

- `packages/site/motion/devnull-promo/scene.html` — the animation
- `packages/site/motion/devnull-promo/capture.mjs` — frame capture
- `packages/site/motion/devnull-promo/audio.mjs` — soundtrack
- `packages/site/motion/devnull-promo/build.mjs` — pipeline
- `packages/site/motion/devnull-promo/preview.mjs` — still-frame review
- `packages/doc/public/video/` — published assets

## Related

- [dev-null.sh integration](/guide/devnull-integration) — how the connection actually works
- [Snapchat integration](/guide/snapchat-integration) — the other recent platform addition
