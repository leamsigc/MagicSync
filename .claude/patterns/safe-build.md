---
name: safe-build
description: Building the site without freezing the machine — heap caps, concurrency limits, correct script
triggers:
  - "build freeze"
  - "site build OOM"
  - "pnpm build"
  - "JavaScript heap out of memory"
edges:
  - target: "context/setup.md"
    condition: "when setting up the dev environment or running the project for the first time"
last_updated: 2026-09-08
---

# Safe Build

## Context

- The site is a Nuxt 4 app with 12 layer extends, `@nuxtjs/seo`, i18n (4 locales),
  Nuxt Content, and a 479 MB `public/` dir (ONNX/WASM TTS assets). A single site
  build needs ~6 GB of V8 heap at the Nitro server-bundle step — a 4 GB cap OOMs.
- Root `pnpm build` builds ~14 workspace packages (12 layer `.playground` apps +
  site + docs). Unbounded `pnpm -r` runs them all in parallel and exhausts RAM,
  freezing the whole machine (only 2 GB swap).
- Local, Docker builder/runtime (`Dockerfile`), and dev container (`Dockerfile.dev`)
  are all pinned to Node 26 (`node:26-alpine`, matching local v26.7.0). If a
  failure mentions another Node major, something drifted — re-align first.

## Steps

1. For local site work, always use the single-package build — never `pnpm build`:
   `pnpm site:build` (= `dotenv -- pnpm --filter @local-monorepo/site build`)
2. Only use `pnpm build` when you really need every playground; it is capped at
   `--workspace-concurrency=2` with `NODE_OPTIONS=--max-old-space-size=3072`.
3. The heap cap lives in `packages/site/package.json` (`--max-old-space-size=8192`)
   so every caller (local, `pnpm site`, Docker `RUN pnpm site`) is protected.
   Do not remove it; do not lower it below 8192 without a successful test build.
4. Keep `devtools.enabled` gated to non-production in
   `packages/site/nuxt.config.ts` — devtools adds build-time memory overhead.

## Gotchas

- `NITRO_PRERENDER_CONCURRENCY=1` as an env var does NOT limit Nitro — the
  concurrency must live in `nuxt.config.ts` (`nitro.prerender.concurrency`).
  Same for crawl: only `nitro.prerender.crawlLinks: false` stops the
  259-pages-x-4-locales + ogImage crawl. Env-only attempts still freeze.
- Do NOT lower the heap below 8192 to "save RAM" — the Nitro server-bundle
  step needs ~6 GB; a 6144 cap GC-thrashes (100% CPU, swap freeze) instead
  of helping. Free RAM/swap/disk instead.
- Disk full (<10 GB free) and swap full (check `free -h`, `swapon --show`)
  turn a slow build into a full-system freeze. Reclaim first:
  `docker system prune`, `pnpm store prune`, `rm -rf packages/site/.output
  packages/site/.nuxt`. The repo itself is only ~6 GB — the hog is usually
  Docker images/volumes/build-cache.
- `/app/**` must carry `prerender: false` in `routeRules` (not just
  `swr: false`) or the crawler prerenders the authenticated dashboard and
  hits Turso/auth during build.

- `pnpm site` (no `:build`) is the legacy script used by `Dockerfile`. Prefer
  `pnpm site:build` locally; both run the same capped build.
- `pnpm build` output showing many `nuxt build .playground` lines means you are
  building all layers — cancel and use `pnpm site:build` if you only need site.
- A heap-cap OOM (`Ineffective mark-compacts near heap limit`) is the protection
  working: fast failure instead of a full-system freeze. Raise the cap only if
  the machine has headroom (`free -h`), never remove it.
- `packages/site/public/assets` (~470 MB, gitignored, from `pnpm tts:assets`) is
  copied verbatim into `.output/public` — a slow/large build step is expected.
- CI (`RUN pnpm site` in `Dockerfile`) picks up the heap cap automatically — it
  lives in `packages/site/package.json`, not in CI config. Tell from the log:
  `$ NODE_OPTIONS=--max-old-space-size=8192 nuxt build` = fix active;
  bare `$ nuxt build` = run predates the fix, OOM at ~4 GB is expected.
- The peak-memory phase is Nitro **prerendering** (`Initializing prerenderer`,
  after client + SSR bundles finish). An OOM there with the cap active means
  the 16 GB GitHub runner itself is the ceiling — next lever is prerender
  tuning (`nitro.prerender` concurrency/routes), not a higher cap.

## Verify

- [ ] `pnpm site:build` completes with `✨ Build complete!` and the machine stays responsive
- [ ] `node -e` shows root `build` contains `--workspace-concurrency=2`
- [ ] `packages/site/package.json` `build` contains `--max-old-space-size=8192`
- [ ] `nuxt.config.ts` `devtools.enabled` is gated, not hardcoded `true`

## Debug

- Freeze during build → you ran uncapped parallel builds; check `package.json`
  `build` still has `--workspace-concurrency=2` and each build has a heap cap.
- OOM at `Building Nuxt Nitro server` → heap cap too low for this app; needs 8 GB.
- OOM at `vite:build` (client) → close browsers/IDEs to free RAM, retry single build.
- `Cannot verify identity of @pnpm/exe` / musl binding errors → see `docker-build.md`.

## Update Scaffold

- [ ] Update `.claude/ROUTER.md` "Current Project State" if what's working/not built has changed
- [ ] Update any `.claude/context/` files that are now out of date
- [ ] If this is a new task type without a pattern, create one in `.claude/patterns/` and add to `INDEX.md`
