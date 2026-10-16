# Route action screenshots

Screenshots of the app, organised so that "what does this route look like now"
and "what happened when I did this" both have a stable, guessable path — and so
that re-capturing never leaves a pile of stale images.

## Why

When an agent changes a route or an interaction, the change is invisible in a
diff. Reviewers re-run the app by hand, and the agent's own evidence is a
throwaway file whose name (`screenshot.png`, `test-1.png`) says nothing about
what it shows. Two problems follow: nobody can find the previous image to
compare against, and every run adds another indistinguishable copy.

This puts every screenshot at a path derived from **route + action**:

```
packages/doc/public/img/screenshots/
  app-posts-new/
    page.png                 # the route's landing state (from the full sweep)
    post-created.png         # an action: what the route looks like afterwards
  tools-image-editor/
    page.png
    export-png.png
  manifest.json              # per-route result of the last full sweep
```

The path is the contract. `app-posts-new` is `/app/posts/new`; `post-created` is
the "post was created" state. Anyone — human or agent — can find, compare, and
re-capture an image without asking where it lives.

## The three skills

| Skill | Does | Command |
|---|---|---|
| `route-action-screenshots` | Captures the routes/actions a task actually changed | `pnpm --filter @local-monorepo/site exec playwright test <spec> --reporter=list` |
| `capture-feature-interactions` | Captures a feature's interactions **step by step**, one image per step | `SCREENSHOT_FEATURE=<key> pnpm screenshots:interactions` |
| `capture-all-routes-screenshots` | Sweeps every static route into `page.png` | `pnpm screenshots:routes` |

`page.png` per route comes from the sweep. Action shots are added by the first
skill as work happens. A full numbered walkthrough of a feature's interactions
comes from the second. All three share one folder per route, so a route's entry
point, its one-off actions and its step-by-step flows sit together.

## Step-by-step journeys

A **journey** is one feature's interactions, in user order, captured as
`NN-<step>.png`:

```
app-business-id-content/
  01-board-open.png
  02-board-empty-column.png
  03-board-new-card.png
  ...
  09-board-card-deleted.png
```

Re-running overwrites each step in place, and numbering makes the folder read as
the flow a user performs.

Two decisions make this work:

**Step IDs come from the feature map.** `.cursor/skills/verify-magicsync/features/`
already documents every sub-feature (`board-new-card`, `board-move-left`, …) with
exact selectors and the observable result. Those IDs are used verbatim as step
IDs, so the images line up with the maintained inventory of what the feature does
— one answer to "what does this feature do?", not two.

**Journeys are authored, not auto-discovered.** No tool can infer that clicking
New card *should* produce `Planned (1)`. A journey is written code; the registry
(`packages/site/tests/screenshots/journeys/`) exists so coverage is enumerable,
filterable (`SCREENSHOT_FEATURE=content-board`) and reportable. Coverage grows by
authoring, and `interactions.json` records what each journey covered, what it
required, and what it deliberately did not cover.

The first journey is `content-board` — the manual card lifecycle: open, empty
column, new card, persists across reload, row controls, card menu, edit, delete
dialog, deleted. It captures nine steps and passes.

### Preconditions are where the real work is

The interesting finding from authoring that journey: `POST /api/v1/content/update`
returns **500 `BRAND_CONTEXT_REQUIRED` — "Publish a Brand Playbook to enable
branded AI"** for a business with no published playbook. Editing a card is
therefore not reachable from `createActiveBusiness()` alone, no matter how correct
the drive is.

`publishBrandPlaybook()` (`packages/site/tests/e2e/helpers/content-fixtures.ts`)
fixes it: `BrandPlaybookSchema` is fully defaulted, so an empty draft validates
and publishing needs no AI provider. Journeys declare this in `preconditions`, so
a red run says *what was missing* rather than sending you hunting for a bug that
is not there.

## How replacement works

The capture helper (`packages/site/tests/e2e/helpers/route-screenshots.ts`)
calls `removeActionScreenshots(route, action)` **before** writing the new file.
Matching ignores a leading `NN-` step number:

- `02-post-created.png` and `post-created.png` are the same action; the older is
  deleted.
- The folder keeps the **latest state of each action**, not a history. Git is
  the history.

That is the whole trick: a deterministic filename plus a delete-before-write
step. No timestamps, no suffixes, no cleanup job.

## Route discovery

The full sweep does not glob page files. It reads
`packages/site/.nuxt/link-checker/routes.json`, written by `nuxt-link-checker` (a
dependency of `packages/site`). That manifest lists **136 static** and **23
dynamic** routes and — crucially — it already knows every route contributed by
every layer (`site`, `auth`, `content`, `connect`, `ui`). A glob would have to
re-derive layer aliasing and i18n variants and would get them wrong.

Dynamic routes (`/app/business/:id()`, `/app/posts/feeds/:id()`) are excluded:
they cannot be visited without a concrete id, so they need a hand-written spec
with a real id.

## Why a separate Playwright config

The sweep is minutes long and visits every route. It therefore lives outside the
default `testDir`:

- `packages/site/playwright.config.ts` → `testDir: ./tests/e2e` (the 413-test suite)
- `packages/site/playwright.screenshots.config.ts` → `testDir: ./tests/screenshots`

`pnpm test:e2e` never picks up the sweep; `pnpm screenshots:routes` never runs the
suite. It is the **same** harness and the same auth fixtures — only the entry
point differs. No second browser tool was added.

## Auth is real

The sweep signs up a genuine throwaway user through Better Auth
(`e2e-<ts>@test.magicsync.dev`), verifies it in the libSQL database, signs in,
and creates a real business. That is what makes `/app/*` render its
authenticated state instead of redirecting to `/login`. Nothing is mocked.

Consequence: the sweep leaves fixture rows behind. Clean them with the
`verify-magicsync` skill's purge script (dry-run unless `--yes`):

```bash
node .cursor/skills/verify-magicsync/scripts/purge-fixtures.mjs "$PWD"
```

## Gotchas worth remembering

- **Run the sweep twice.** The first pass cold-compiles every route; the first
  hit on a never-visited route can exceed three minutes. The second pass captures
  clean images.
- **`/app/admin/*` renders for a non-admin test user** as a redirect or 403. The
  manifest records the real `finalUrl` and `status`, so this is visible rather
  than disguised as a good page.
- **Query strings are dropped from the slug.** `/app/calendar?view=month` and
  `?view=week` share one folder — give those real states distinct *action* names.
- **Never write to `packages/site/test-results/`** — Playwright wipes it at the
  start of every run.

## Files

| File | Role |
|---|---|
| `packages/site/tests/e2e/helpers/route-screenshots.ts` | Slug rules, replace-before-write capture, `journey()` ordered steps, dev-overlay suppression |
| `packages/site/tests/e2e/helpers/route-list.ts` | Reads `nuxt-link-checker`'s route manifest |
| `packages/site/tests/e2e/helpers/content-fixtures.ts` | `publishBrandPlaybook()` — unblocks branded-AI capabilities |
| `packages/site/tests/screenshots/capture-all-routes.spec.ts` | The full-route sweep |
| `packages/site/tests/screenshots/capture-feature-interactions.spec.ts` | Runs every registered journey |
| `packages/site/tests/screenshots/journeys/index.ts` | Journey registry |
| `packages/site/tests/screenshots/journeys/content-board.ts` | The first authored journey |
| `packages/site/playwright.screenshots.config.ts` | Screenshot-only Playwright config |
| `packages/doc/skills/route-action-screenshots/SKILL.md` | Per-route/action skill |
| `packages/doc/skills/capture-feature-interactions/SKILL.md` | Step-by-step journey skill |
| `packages/doc/skills/capture-all-routes-screenshots/SKILL.md` | Full-sweep skill |
