---
name: route-action-screenshots
description: Capture Playwright screenshots of each route and action you actually work on, one folder per route and one file per action, replacing the previous shot of that action. Use at the end of any task that changes a user-facing route or interaction ("take screenshots of what I changed", "capture this route", "screenshot the new action", "add visuals to the wiki", "prove the UI changed"), and whenever AGENTS.md's per-task screenshot requirement applies. For a full walkthrough of every interaction in a feature, use the capture-feature-interactions skill instead.
---

# Route / action screenshots

Turn "what an agent changed" into reviewable images, without accumulating junk.
One folder per route, one canonical file per action, and a re-run **replaces**
the old shot instead of adding `-2`, `-3` copies.

```
packages/doc/public/img/screenshots/
  app-posts-new/
    page.png              # the route's landing state
    post-created.png      # one action you worked on
  tools-image-editor/
    page.png
    export-png.png
```

`page.png` comes from the full-route sweep
(`packages/doc/skills/capture-all-routes-screenshots/SKILL.md`). This skill adds
and refreshes the **action** shots — the states a user reaches by doing
something.

> **Capturing a whole sequence of interactions rather than one or two?** Use
> `packages/doc/skills/capture-feature-interactions/SKILL.md` — it authors a
> numbered *journey* per feature (one image per step) and is the right tool when
> the ask is "all the interactions" or "the step by step of this feature".

## When to use

- A task touched a user-facing route or an interaction on one.
- You need visual proof for a wiki page, a PR, or yourself.
- A route's UI changed and its existing screenshot is now stale.

**Not** for: API-only changes, migrations, or anything with no rendered surface
— say so instead of screenshotting an unrelated page.

## Ground truth (read first)

| Thing | Where |
|---|---|
| Capture helper | `packages/site/tests/e2e/helpers/route-screenshots.ts` |
| Output root | `packages/doc/public/img/screenshots/` (override: `SCREENSHOT_ROOT`) |
| Auth/business fixtures | `packages/site/tests/e2e/helpers/e2e-utils.ts` |
| Playwright config (default suite) | `packages/site/playwright.config.ts` (`testDir: tests/e2e`) |
| Full-route sweep | `packages/site/tests/screenshots/` + `playwright.screenshots.config.ts` |

The helper is the only place that decides a path. Do not hand-roll
`page.screenshot({ path })` — you would skip the replace step and leave stale
files behind.

## Steps

1. **Identify the route(s) and the action(s).** An action is a user-meaningful
   state on that route, not a click: `post-created`, `export-png`,
   `business-saved`. One file per action.

2. **Write a spec under `packages/site/tests/e2e/`.** The default config's
   `testDir` finds nothing else. Copy the shape of an existing drive and use the
   real fixtures — never mock auth or the app's own routes:

   ```ts
   import { test } from '@playwright/test'
   import { createActiveBusiness, createTestUser, loginWith, waitForHydration } from './helpers/e2e-utils'
   import { captureRouteAction } from './helpers/route-screenshots'

   const ROUTE = '/app/posts/new'

   test('posts: create a post', async ({ page, playwright }) => {
     test.setTimeout(300000) // first hit on a cold route can exceed 3 minutes in dev

     const authed = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
     const user = await createTestUser(authed)
     await loginWith(page, user)
     await createActiveBusiness(authed, user) // most /app routes need one

     await page.goto(ROUTE)
     await waitForHydration(page)
     await captureRouteAction(page, { route: ROUTE, action: 'page' })

     // ...drive the real interaction a user would perform...
     await captureRouteAction(page, { route: ROUTE, action: 'post-created' })
   })
   ```

   Capture the **action and its result**: the filled form before submit, the
   outcome after. A single "everything looks fine" shot cannot show whether the
   save worked.

3. **Run exactly that spec.** The `exec` form is required — the `test:e2e --`
   form ignores your filename and runs the whole suite:

   ```bash
   pnpm --filter @local-monorepo/site exec playwright test posts-create.spec.ts --reporter=list
   ```

4. **Check the folder.** Confirm one file per action and that re-running did not
   multiply files:

   ```bash
   ls packages/doc/public/img/screenshots/<route-slug>/
   ```

5. **Reference the images** from the wiki page (`![](/img/screenshots/<route-slug>/<action>.png)`),
   then delete the throwaway spec (`rm packages/site/tests/e2e/posts-create.spec.ts`)
   — keep the screenshots, drop the scaffolding. Re-capture later with the same
   spec content.

## Multi-step sequences on one route

When a single action is not the story — a user opens, fills, submits, edits —
capture the sequence with `journey()`, which numbers each step automatically:

```ts
import { journey } from './helpers/route-screenshots'

const w = journey(page, { route: '/app/posts/new' })
await w.step('post-form-open')
await w.step('post-form-filled', async () => {
  await page.getByTestId('post-title').fill('Hello')
})
await w.step('post-created', async () => {
  await page.getByTestId('post-save').click()
  await expect(page).toHaveURL(/\/app\/posts$/)
})
```

Writes `01-post-form-open.png`, `02-post-form-filled.png`,
`03-post-created.png`. Because replacement ignores the `NN-` prefix, re-running
overwrites each step in place.

For a **complete** feature walkthrough, register the journey in
`packages/site/tests/screenshots/journeys/` instead of a throwaway spec — see
`packages/doc/skills/capture-feature-interactions/SKILL.md`. Step IDs there come
from the feature map's sub-feature list, so the images match the documented
interaction inventory.

## How replacing works

`captureRouteAction` calls `removeActionScreenshots(route, action)` before
writing. Matching ignores a leading `NN-` step number, so
`02-post-created.png` and `post-created.png` are the same action and the older
one is removed. Two different steps that slugify to the same action are also
treated as one — that is the point: **the folder holds the latest state of each
action, not a scrollback.**

## Gotchas

- **Never write into `packages/site/test-results/`** — Playwright wipes it at
  the start of every run.
- **Route slug, not URL.** Query strings and hashes are dropped: `/app/calendar?view=month`
  and `/app/calendar?view=week` share one folder. Give those genuinely different
  states different **action** names (`month-view`, `week-view`), or they will
  overwrite each other.
- **Dynamic routes need params.** `/app/posts/feeds/:id` cannot be swept
  automatically — visit it with a real id (from `createActiveBusiness` or the
  DB) and a route string you choose, e.g. `captureRouteAction(page, { route: '/app/posts/feeds/123', action: 'page' })`.
- **One browser, one dev server.** More than one or two concurrent browsers
  against the single Nuxt dev process causes `net::ERR_ABORTED`. Keep `workers: 1`.
- **Cold routes are slow, not broken.** First hit on a never-compiled route can
  exceed three minutes. Set a large `test.setTimeout`, then re-run.
- Screenshots are **committed** here (unlike `verify-magicsync/evidence/`, which
  is gitignored). Keep them small in number and meaningful — one per action.

## Verify

1. `ls packages/doc/public/img/screenshots/<route-slug>/` shows exactly one file
   per action you captured.
2. Re-running the spec leaves the same file count (replace, not accumulate).
3. Each image shows the replaced state, not a loading skeleton — if it shows a
   spinner, raise `settleMs` or wait for a real signal before capturing.

## Update Scaffold

- [ ] Wiki: `/guide/route-screenshots`
- [ ] `.claude/patterns/` entry if you introduced a reusable capture helper
