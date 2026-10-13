---
name: nuxtjs-seo-v6-migration
description: Migrate a Nuxt app from @nuxtjs/seo v5 to v6 (or repair a broken v6 upgrade). Handles the bundled nuxt-ai-ready v3 / nuxt-skew-protection v2 defaults, bumps of the whole SEO module family, the named "module version does not satisfy" guard, the OG Image v7 secret rename (NUXT_APP_SECRET) and Takumi renderer, Zod 4, Node floor, and the devtools-host swap. Use when asked to "upgrade nuxt seo", "@nuxtjs/seo v6", "nuxt-ai-ready", "nuxt-skew-protection", "nuxt-site-config version does not satisfy", "og-image migration", "NUXT_OG_IMAGE_SECRET", or "nuxtseo-devtools-host".
---

# @nuxtjs/seo v5 → v6 migration

## When to use

Any change to how `@nuxtjs/seo` is versioned, configured, or bundled — bumping
it, fixing a failed v6 upgrade, or adopting the bundled AI Ready / Skew
Protection modules. Reference run: this repo (MagicSync), 2026-10-13.

## Ground truth (check first)

- The **installed manifest is the spec**: `@nuxtjs/seo@<v>`'s `dependencies` and
  `peerDependencies` list exact minimums. Read it, don't guess:
  `curl -s https://registry.npmjs.org/@nuxtjs%2Fseo/<version> | jq '.peerDependencies, .dependencies'`.
- v6 peers `nuxt: ^4.6.1 || ^5.0.0`. v5's modules (`robots 6`, `sitemap 8`,
  `og-image 6`, `schema-org 6`, `seo-utils 8`, `link-checker 5`,
  `site-config 4`) are all one major behind v6's floors.
- `nuxt-ai-ready` and `nuxt-skew-protection` are **transitive** in v6 — do not
  add them as modules or direct deps.

## Steps

1. **Node floor.** Root `engines.node = ^22.22.3 || ^24.15.0 || >=26.0.0`, add
   `.nvmrc`. Check `Dockerfile` and `.github/workflows/*` base images.
2. **Bump the pinned family in the workspace catalog** (or `package.json`s):
   `seo 6`, `robots 7`, `sitemap 9`, `og-image 7`, `schema-org 7`,
   `@nuxt/fonts >=1.0.0`, `@takumi-rs/core ^2.15.0`, `zod ^4.6.6`,
   `nuxt >=4.6.1`. Drop `nuxtseo-layer-devtools`; add `nuxtseo-devtools-host`.
3. **Run `pnpm install` and `nuxt prepare`.** The guard names the offender:
   `Module nuxt-site-config version (5.0.0) does not satisfy >=5.0.1`.
4. **Fix a sub-module mismatch with `overrides`, not the catalog.** A range like
   `^5.0.0` keeps an old copy in peer-scoped sub-graphs; `overrides:` forces one
   deduped copy (`nuxt-site-config: 5.0.1`). Re-run `pnpm install`.
5. **Decide the bundled defaults.** Set `aiReady.database: false` unless the app
   really has `drizzle-orm ^1.0.0-rc.4`; set `skewProtection: false` for
   single-image/self-hosted deploys. Both live in **every** layer that registers
   `@nuxtjs/seo`, not just the composition root.
6. **If AI Ready stays on, widen cached route rules**:
   `cache: { varies: ['accept'] }` on each `swr` route, or the module warns that
   Markdown negotiation is skipped.
7. **OG Image v7.** Rename `NUXT_OG_IMAGE_SECRET` → `NUXT_APP_SECRET` (32+ chars)
   in `.env`, `.env-example`, and the deploy env. Components already named
   `*.takumi.vue` are fine; `*.satori.vue` needs `flex flex-col` on elements that
   relied on forced flex.
8. **Re-sync the lockfile** (`pnpm install`) — the catalog changed.

## Verify (no unit tests)

```bash
pnpm install
pnpm --filter <site-pkg> exec nuxt prepare        # module version guards + config
pnpm dlx vite-doctor .                            # 0 new diagnostics
# dev server, then the four SEO endpoints:
curl -s localhost:3000/robots.txt                 # nuxt-robots v7 output
curl -s localhost:3000/sitemap.xml                # 307 → /sitemap_index.xml
curl -s localhost:3000/llms.txt                   # 200 text/plain
# one og:image URL from / → image/png 1200x600
```
Count every changed function ≤ 5 branches (config-only changes should be 0).

## Gotchas

- The guard fires on the **loaded** module, so a duplicate old copy is the cause
  even when a newer one is in the lockfile. Check
  `grep -E "^  <pkg>@" pnpm-lock.yaml` shows one version.
- `pnpm install` auto-appends to `minimumReleaseAgeExclude` when a pin sits
  inside the release-age window; that is expected, not a mistake.
- Never add `nuxt-ai-ready` / `nuxt-skew-protection` to `modules` — v6 bundles
  them and a duplicate module entry double-registers routes.
- A hand-written `public/llms.txt` **shadows** AI Ready's generated route; the
  static file wins. Delete it to use the generated one.
- `nuxt typecheck` needs `vue-tsc` (this repo has none); `nuxt prepare` is the
  cheapest real signal that module wiring is valid.

## Update Scaffold

- [ ] Wiki: `/guide/nuxtjs-seo-v6-migration`
- [ ] `.claude/context/stack.md` + `setup.md` Node-floor line
