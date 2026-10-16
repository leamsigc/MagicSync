---
name: capture-all-routes-screenshots
description: Trigger a full Playwright sweep that screenshots every route of the site into one folder per route. Use when asked to "screenshot all routes", "capture every page", "take screenshots of the whole app", "refresh the route screenshots", "generate the visual route inventory", or before a design/UX review that needs current images of every page.
---

# Capture all routes

One command visits every static route of the running site and writes the landing
state of each into its own folder:

```
packages/doc/public/img/screenshots/<route-slug>/page.png
packages/doc/public/img/screenshots/manifest.json
```

Re-running **replaces** each route's `page.png`. It never accumulates copies.
`manifest.json` records, per route, the file, the final URL after redirects, the
HTTP status, and whether it captured — so a redirect or 403 is visible instead
of silently mistaken for a good page.

## Why a separate config

The sweep is minutes long and visits ~136 routes. It lives in
`packages/site/tests/screenshots/` with its own
`packages/site/playwright.screenshots.config.ts` (`testDir: './tests/screenshots'`)
so `pnpm test:e2e` — the 413-test suite — never picks it up. Same harness, same
helpers, same baseURL. Do not add a second browser tool.

## Preconditions

- A dev server reachable at `http://localhost:3000` (or `SCREENSHOT_BASE_URL`).
  The config starts one (`pnpm --dir ../.. site:dev`) if none is running, and
  adopts an existing one (`reuseExistingServer: true`) — the repo has **one**
  database shared with the developer, so adopting is correct.
- The route manifest `.nuxt/link-checker/routes.json` must exist. `nuxt-link-checker`
  writes it on dev startup; if the sweep reports no routes, start the dev server
  once.
- One browser at a time. `workers: 1` is deliberate — concurrent browsers cause
  `net::ERR_ABORTED` against the single dev process.

## Steps

1. **Run the sweep.**

   ```bash
   pnpm screenshots:routes
   ```

   Run it **twice**. The first pass cold-compiles every route (the first hit on a
   never-visited route can exceed three minutes); the second pass captures them
   cleanly. Per-route failures are recorded, not fatal — the run only fails if
   *every* route fails.

2. **Scope it when you don't need everything** (much faster):

   ```bash
   SCREENSHOT_ROUTE_PREFIX=/tools pnpm screenshots:routes
   SCREENSHOT_ROUTE_PREFIX=/app/bulk-scheduler pnpm screenshots:routes
   ```

3. **Raise the per-route timeout** for slow, asset-heavy tool pages (they fetch
   ONNX models and large media on mount):

   ```bash
   SCREENSHOT_ROUTE_TIMEOUT=90000 SCREENSHOT_ROUTE_PREFIX=/tools pnpm screenshots:routes
   ```

4. **Read the manifest**, don't assume:

   ```bash
   cat packages/doc/public/img/screenshots/manifest.json
   ```

   A route whose `finalUrl` differs from `route` redirected (expected for
   `/app/*` when anonymous, for `/login` when authenticated). `/app/admin/*`
   renders for a non-admin test user as a redirect or 403 — that is honest, not
   a bug in the sweep.

5. **Spot-check a few images** before committing. A folder-per-route tree is
   easy to trust blindly; open three or four and confirm they show pages, not
   spinners.

## Coverage

`selectStaticRoutes()` reads `nuxt-link-checker`'s manifest, so it includes
routes contributed by **every** layer — `site` (`/app/*`, `/tools/*`), `auth`
(`/login`, `/register`), `content`, `connect`, and `ui` (`/ui-preview/*`). It
excludes the 23 parameterised routes (`/app/business/:id()`, `/app/posts/feeds/:id()`),
which cannot be visited without a concrete id. For those, use
`route-action-screenshots` with a real id.

## Mobile

Set `SCREENSHOT_VIEWPORT=mobile` to sweep at 390x844 instead of 1440x900:

```bash
SCREENSHOT_VIEWPORT=mobile pnpm screenshots:mobile
SCREENSHOT_VIEWPORT=mobile SCREENSHOT_ROUTE_PREFIX=/app pnpm screenshots:mobile
```

The viewport switches to an iPhone-class device (`isMobile`, `hasTouch`,
`deviceScaleFactor: 2`) **and** redirects output to
`packages/doc/public/img/screenshots-mobile/`, so a mobile pass can never
overwrite a desktop image. `SCREENSHOT_ROOT` still wins if you set it yourself.

For **interaction** coverage on mobile the same variable applies:

```bash
SCREENSHOT_VIEWPORT=mobile pnpm screenshots:interactions
```

Desktop landing states prove nothing about a modal, so any flow you fix needs a
journey (`tests/screenshots/journeys/`). See the `audit-mobile-layout` skill for
finding the breakage in the first place.

## Gotchas

- **Auth is real.** The sweep signs up a throwaway `e2e-*@test.magicsync.dev`
  user and creates a business, so `/app/*` renders its authenticated state. This
  leaves fixture rows behind — the `verify-magicsync` skill's
  `scripts/purge-fixtures.mjs` cleans them up (it is dry-run unless `--yes`).
- **`/ui-preview/*` is not product UI.** ~70 route-folder entries are component
  previews. `SCREENSHOT_ROUTE_PREFIX` lets you skip them.
- **Heavy assets are not blocked** by default, so the images are truthful. That
  is why tools are slow; scope to `/tools` when that matters.
- **Never point the sweep at production.** It creates users and businesses.
- Don't run the default suite and the sweep at once — both drive the same dev
  server.

## Verify

1. `manifest.json` exists and `captured` is close to `total`.
2. `ls packages/doc/public/img/screenshots | wc -l` is roughly the route count —
   one folder per route, plus `manifest.json`.
3. Re-running yields the same folder count (replace, not accumulate).
4. `git status packages/doc/public/img/screenshots` shows modified files, not a
   growing pile of new ones.

## Update Scaffold

- [ ] Wiki: `/guide/route-screenshots`
- [ ] Update this skill if the route manifest path or config changes
