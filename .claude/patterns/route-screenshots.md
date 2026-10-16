---
name: route-screenshots
description: Capturing route/action screenshots as evidence of UI work — folder per route, file per action, replace on re-run, and the full-route sweep
triggers:
  - "screenshot the route"
  - "capture screenshots"
  - "screenshot all routes"
  - "visual proof"
  - "screenshots for the wiki"
edges:
  - target: "packages/doc/skills/route-action-screenshots/SKILL.md"
    condition: "when capturing the specific routes/actions a task changed"
  - target: "packages/doc/skills/capture-all-routes-screenshots/SKILL.md"
    condition: "when sweeping every route"
  - target: "packages/doc/skills/capture-feature-interactions/SKILL.md"
    condition: "when capturing a feature's interactions step by step (a full journey) rather than one action"
  - target: "patterns/playwright-golden-oracles.md"
    condition: "when you need a deterministic toHaveScreenshot golden instead of a reviewable evidence image; also the source of the dev-overlay suppression CSS this pattern reuses"
  - target: "context/conventions.md"
    condition: "for the general per-task verification gate"
last_updated: 2026-10-16
---

# Route Screenshots

## Context

- Playwright is the only browser harness. Config at
  `packages/site/playwright.config.ts` (`testDir: tests/e2e`). Do not add a
  second tool.
- Real auth fixtures already exist in
  `packages/site/tests/e2e/helpers/e2e-utils.ts` (`createTestUser`,
  `loginWith`, `createActiveBusiness`). Never mock auth or the app's own routes.
- The single helper that decides screenshot paths is
  `packages/site/tests/e2e/helpers/route-screenshots.ts`. Do not hand-roll
  `page.screenshot({ path })` — you would skip the replace step.
- Output: `packages/doc/public/img/screenshots/<route-slug>/<action>.png`, plus
  `manifest.json` from the sweep. Committed to git (unlike
  `verify-magicsync/evidence/`, which is gitignored).
- Route list comes from `nuxt-link-checker`'s
  `packages/site/.nuxt/link-checker/routes.json` (136 static, 23 dynamic), read
  via `helpers/route-list.ts`. It already knows routes from every layer.
- This is **evidence** capture (addressable by route+action, for humans), not a
  deterministic golden. For `toHaveScreenshot` diffs see
  `patterns/playwright-golden-oracles.md`; the dev-overlay suppression CSS used
  here comes from that pattern.

## Steps

1. Decide the route(s) and the user-meaningful action(s) (`post-created`,
   `export-png`) — an action is a resulting state, not a click.
2. Write a spec under `packages/site/tests/e2e/`, authenticate with the real
   fixtures, drive the real interaction, and call
   `captureRouteAction(page, { route, action })` before and after the action.
   For an ordered sequence on one route use `journey(page, { route })` and
   `journey.step(id, run)` — it numbers the steps and replaces in place.
3. Run exactly that spec:
   `pnpm --filter @local-monorepo/site exec playwright test <spec> --reporter=list`.
   The `test:e2e -- <file>` form ignores the filename and runs the whole suite.
4. For a whole-route pass: `pnpm screenshots:routes` (scope with
   `SCREENSHOT_ROUTE_PREFIX=/tools`).
5. For a feature's full interaction walkthrough: register a journey in
   `packages/site/tests/screenshots/journeys/` and run
   `SCREENSHOT_FEATURE=<key> pnpm screenshots:interactions`. Step IDs come from
   `.cursor/skills/verify-magicsync/features/`.

## Gotchas

- Re-running an action **must** replace, not accumulate. `captureRouteAction`
  deletes prior shots for the same action first, ignoring a leading `NN-`.
- **Preconditions are the main failure mode, not bugs.** Branded-AI capabilities
  (`content.update/delete/move/write/scan`) return **500 `BRAND_CONTEXT_REQUIRED`
  — "Publish a Brand Playbook to enable branded AI"** until the business has a
  published playbook. Call `publishBrandPlaybook()` (`helpers/content-fixtures.ts`)
  in a journey's `setup`. Journeys declare `preconditions` so a red run is
  diagnosable.
- **Dynamic routes need a stable route string.** Pass the `:id` pattern
  (`/app/business/:id/content`) so the folder slug does not change every run; the
  drive replaces `:id` with the real id when navigating.
- **Dev overlays are shadow-DOM.** The Nuxt DevTools timing pill cannot be hidden
  by page CSS; `suppressDevOverlays()` (called inside `captureRouteAction`)
  removes the host element. Do not re-add CSS-only hiding in specs.
- Never write into `packages/site/test-results/` — Playwright wipes it every run.
- First hit on a never-compiled route can exceed three minutes in dev. Set a
  large `test.setTimeout`, run the sweep twice.
- One browser at a time (`workers: 1`) — concurrent browsers cause
  `net::ERR_ABORTED` against the single dev server.
- Query strings are dropped from the route slug; give genuinely different query
  states distinct action names or they overwrite each other.
- The sweep creates real throwaway users/businesses. Never point it at prod.

## Verify

- One file per action; re-running leaves the file count unchanged.
- Images show the settled page, not a spinner (raise `settleMs` if not).
- `manifest.json` `finalUrl` matches `route` except where a redirect is expected
  (anonymous `/app/*`, authenticated `/login`).
- `pnpm doc:build` still passes after adding images/pages.

## Debug

- Empty sweep → the route manifest does not exist; start the dev server once.
- All routes "fail" → check the dev server: `.cursor/skills/verify-magicsync/scripts/doctor.sh`.
- Screenshot is a login page → `loginWith` did not run, or no business was
  seeded for an `/app` route.

## Update Scaffold

- [ ] Wiki: `/guide/route-screenshots`
- [ ] Skills: `packages/doc/skills/route-action-screenshots/`,
      `packages/doc/skills/capture-all-routes-screenshots/`
