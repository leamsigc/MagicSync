---
name: add-feature-layer
description: Add a new Nuxt feature layer (components, composables, server routes) plus its product page, sidebar entry and wiki page, wired the way this monorepo expects. Use when a feature is big enough to own components and server code (billing, teams, analytics), when asked to "create a new layer", or when a page needs more than one layer's worth of code.
---

# Add a feature layer

## When to use
A feature needs its own components, composables, server routes and translations,
and should not be dumped into `packages/connect` or `packages/site`.

## The rules this repo enforces
- `packages/site` is the **only route owner** for product pages.
- A feature layer never imports another feature layer; it extends the layers it
  depends on (`db`, `ui`, `auth`, `shared`).
- `pnpm audit:layers` fails on any new cross-layer import, so only import from
  layers listed in your `extends`.

## Steps

1. **Scaffold the package** — copy `packages/templates` and adapt:
   `package.json` (`"name": "@local-monorepo/<name>"`), `nuxt.config.ts`
   (`$meta: { name: 'Base<Name>' }`, `extends: [...]`), `tsconfig.json`
   (`{ "extends": "../site/.nuxt/tsconfig.json" }`), `eslint.config.js`,
   `translations/{global.json,i18n.config.ts}`.

2. **Component namespace** — put components under
   `packages/<name>/app/components/<name>/`. The `$meta.name` gives the layer the
   `#layers/Base<Name>` alias. Backend code goes under
   `packages/<name>/server/{services,api}`; a service returns
   `ServiceResponse<T>` and never throws.

3. **Register the layer** — add it to `extends` in `packages/site/nuxt.config.ts`
   **and** to `dependencies` in `packages/site/package.json`
   (`"@local-monorepo/<name>": "workspace:*"`). Run `pnpm install`.

4. **Add the page** — `packages/site/app/pages/app/<route>/index.vue` with
   `<i18n src="./index.json">` on the first line, then the matching
   `index.json` for **all four locales** (`en`, `es`, `de`, `fr`). Layer
   components read the page's copy with
   `<i18n src="#site/app/pages/app/<route>/index.json">`.

5. **Add it to navigation** — `packages/auth/app/composables/useDashboardNavigation.ts`.
   Prefer an existing key in `packages/auth/app/layouts/dashboard/Menu.json`;
   adding a new key means adding it to every locale.

6. **Document it** — `packages/doc/guide/<name>.md` and register it in the
   **Wiki** group of `packages/doc/.vitepress/config.mts`.

7. **Verify** — `node scripts/layer-import-audit.mjs`,
   `node scripts/i18n-audit.mjs`, then boot the app.

## Pitfalls
- A `.json` is not a route, but a `.vue`/`.ts` anywhere under an `app/pages/`
  tree becomes one. Never put stray files there — move shared JSON into
  `app/components/...` (see how `account.json` moved in this repo).
- `NuxtPage` filtering in a layer's `pages:extend` hook may strip your route if
  its path contains an excluded token; check the site config, not just yours.
- `?>/?.` do not count toward cyclomatic complexity, `&&`/`||`/ternary do. Keep
  each new function at five branches or fewer.
