# @nuxtjs/seo v5 → v6 Migration

_2026-10-13 — what changed in `nuxt.config.ts` / `pnpm-workspace.yaml`, why, and the two traps the upgrade sprung._

## Why

`@nuxtjs/seo` v6 absorbs two modules that used to be opt-in (`nuxt-ai-ready`,
`nuxt-skew-protection`), bumps every bundled sub-module a major, and pins a
hard `nuxt >= 4.6.1` peer. The upgrade itself is mostly version arithmetic; the
interesting part is that **v6 now refuses to boot if you get the versions
wrong**, and one bundled default assumes a database this app does not have.

## What changed

### 1. One pin, one dedupe (the version guard)

v6 added a runtime check: every bundled module must satisfy a named minimum or
`nuxt prepare` dies with `Module <name> version (x) does not satisfy >=y`.
Bumping `@nuxtjs/seo` alone is not enough — the four modules this repo pinned
directly (`@nuxtjs/robots`, `@nuxtjs/sitemap`, `nuxt-og-image`,
`nuxt-schema-org`) had to move too, in `pnpm-workspace.yaml`:

| Package | was | now |
|---|---|---|
| `@nuxtjs/seo` | 5.3.16 | 6.0.1 |
| `@nuxtjs/robots` | 6.2.4 | 7.0.2 |
| `@nuxtjs/sitemap` | 8.6.1 | 9.0.2 |
| `nuxt-og-image` | 6.10.3 | 7.0.3 |
| `nuxt-schema-org` | 6.4.3 | 7.0.1 |
| `@nuxt/fonts` | 0.14.0 | 1.0.1 |
| `@takumi-rs/core` | 2.14.0 | 2.15.2 |
| `nuxt` / `@nuxt/vite-builder` | 4.6.0 | 4.6.1 |
| `zod` | 4.6.5 | 4.6.7 |

`nuxt-seo-utils`, `nuxt-link-checker`, `nuxt-site-config`, `nuxt-ai-ready` and
`nuxt-skew-protection` are pulled in transitively by `@nuxtjs/seo`, so they are
**not** catalog entries — only `nuxt-site-config` needed a pin, see below.

### 2. `nuxt-site-config` needed an `overrides` entry, not a catalog bump

The guard fired on `nuxt-site-config` specifically. The bundled sub-modules
declare `^5.0.0`, `@nuxtjs/seo` demands `>=5.0.1`, and pnpm resolved a **5.0.0
instance** for the sub-modules while giving `@nuxtjs/seo` its own 5.0.1 — so two
copies coexisted and the app loaded the too-old one. A direct `catalog:` pin
alone fixes the message but leaves dead 5.0.0 copies in peer-scoped sub-graphs.
The repo already forces single resolutions with `overrides` (for the pi
packages), so the fix is the same shape:

```yaml
overrides:
  '@earendil-works/pi-agent-core': 0.85.1
  '@earendil-works/pi-ai': 0.85.1
  nuxt-site-config: 5.0.1   # one deduped copy for the whole repo
```

> Rule of thumb: when a Nuxt SEO sub-module is pinned by a range below what
> `@nuxtjs/seo` requires, reach for `overrides`, not the catalog.

### 3. Bundled modules are **on by default**

v6 registers `nuxt-ai-ready` (v3) and `nuxt-skew-protection` (v2) without a
`modules` entry. Decisions taken here:

- **AI Ready — kept on, database sub-feature off.** v3's optional DB-backed MCP
  "site tools" want `drizzle-orm ^1.0.0-rc.4`; this repo pins drizzle-orm
  `0.45.x` (`packages/db`) and serves MCP through `@nuxtjs/mcp-toolkit`. Without
  the opt-out, `nuxt prepare` fails:
  ```
  [nuxt-ai-ready] These features need the database: MCP site tools.
  Install it: npx nypm add drizzle-orm@1.0.0-rc.4
  If you do not need the site tools, set aiReady.database: false.
  ```
  ```ts
  aiReady: { database: false }   // llms.txt + bot negotiation stay on
  ```
- **Skew Protection — off.** v2 persists assets under
  `node_modules/.cache/nuxt-seo/skew-protection` and is aimed at rolling/push
  deploys; this app ships a single Docker image, so `skewProtection: false` (in
  both `packages/site` and `packages/content`, which both register
  `@nuxtjs/seo`).

### 4. AI Ready wants the SWR cache key to vary on `Accept`

With AI Ready on, v3 warns for every cached route:

```
[nuxt-ai-ready] WARN "/": response caching disables automatic Markdown negotiation.
  Add to this route rule: cache: { varies: ['accept'] }
```

The fix preserves the existing caching and only widens the key:

```ts
"/": { swr: 1200, cache: { varies: ['accept'] } },
"/blog": { swr: true, cache: { varies: ['accept'] } },
"/blog/**": { swr: 1200, cache: { varies: ['accept'] } },
```

### 5. OG Image secret moved from `NUXT_OG_IMAGE_SECRET` to `NUXT_APP_SECRET`

v7 signs OG URLs with Nuxt's app secret. `NUXT_OG_IMAGE_SECRET` is gone; the
v6 "auto-generated secret" warning is replaced by Nuxt's own
`NUXT_B5028 appSecret` warning until `NUXT_APP_SECRET` is set (32+ chars).
Renamed in `.env` and `.env-example`:

```diff
-NUXT_OG_IMAGE_SECRET=<openssl rand -hex 32>
+NUXT_APP_SECRET=<openssl rand -hex 32>
```

The OG component was already `BlogOgImage.takumi.vue` (Takumi renderer) and its
root already carried `flex flex-col`, so no template change was needed.

### 6. Nodes and tooling

- Root `engines.node` = `^22.22.3 || ^24.15.0 || >=26.0.0` + `.nvmrc` = `26`.
- `nuxtseo-layer-devtools@5` → **`nuxtseo-devtools-host@1.0.2`** (it pulls
  layer-devtools 6 transitively).
- `sharp` added to the site's devDependencies (OG rendering / `nuxt-seo-utils
  icons`).

## How it works, in one line

`@nuxtjs/seo` v6 is a thin aggregator: it declares the whole SEO family as
dependencies and, at module-setup time, verifies each loaded copy against a
minimum. That is why the fix is always "pin one deduped version of the offender"
rather than "delete code" — the code that broke was a duplicate install, not an
API.

## How to verify

```bash
pnpm install                                   # resyncs the lockfile
pnpm --filter @local-monorepo/site exec nuxt prepare   # module guards + config
NUXT_IGNORE_LOCK=1 pnpm --filter @local-monorepo/site exec nuxt dev   # if a dev server is already up
# then:
curl -s localhost:3000/robots.txt      # nuxt-robots v7 output
curl -s localhost:3000/sitemap.xml     # 307 → /sitemap_index.xml (4 locale sitemaps)
curl -s localhost:3000/llms.txt        # static public/llms.txt wins over the generated one
# one og:image URL from / should return image/png 1200x600
```

## Follow-ups (not done here)

- Set `NUXT_APP_SECRET` in the **deploy** environment (Coolify) — the old
  `NUXT_OG_IMAGE_SECRET` there does nothing in v7.
- `packages/site/public/llms.txt` is hand-written and shadows AI Ready's
  generated `/llms.txt`. Delete the file if you ever want the generated one.
- `packages/auth/lib/auth.ts:580` trips `vite-doctor` TS0001 (chained type
  assertion) — pre-existing, untouched by this migration.

## Related

- [Nuxt SEO OG Image v7 migration guide](https://nuxtseo.com/docs/og-image/migration-guide/v7)
- [Layers & version constraints](/guide/layers)
- Skill: `.claude/skills` → `packages/doc/skills/nuxtjs-seo-v6-migration/SKILL.md`
