---
name: verify-magicsync
description: Drive and prove MagicSync's real web UI with Playwright. Use when you need to verify a user-facing feature end to end (business onboarding, posts, content board, media, carousel creator), capture proof screenshots, or check whether a running MagicSync dev instance is worth driving.
---

# Verify MagicSync

Scripted, repeatable proof that MagicSync's user-facing behaviour actually works.

**You are probably here because someone asked you to prove a feature works, not
because the tests already failed.** This skill launches the real app, drives a
real feature the way a user would, and leaves proof behind. It does not mock the
app. It does not use internal setters or test-only endpoints. If the feature
works, the screenshot shows a working feature.

## What kind of app this is

MagicSync is a **Nuxt 4 monorepo** social-media scheduler. The primary surface
is a web UI; you drive it with a browser.

| Surface | Where | Drive it? |
|---|---|---|
| Web UI — `/app/*`, `/tools/*` | `packages/site` (+ layer packages) | **Yes — this is the primary surface** |
| HTTP API — `/api/v1/*`, `/api/auth/*` | Nuxt server routes | Yes, as a read-only second view of a side effect |
| CLI | none | No CLI exists |
| Python tools sidecar | `packages/python-tools`, port 8100 | Optional, not started by default |

Routes are owned by **five** page directories, not just `packages/site`:
`packages/site` (`/app/*`, `/tools/*`), `packages/content` (marketing),
`packages/auth` (`/login`, `/register`, `/app/account`…), `packages/connect`,
and `packages/ui`. When a route is "missing", check the layers before concluding
it does not exist.

## Launch

The app is the `site` package. The repo's own documented command is:

```bash
cd /path/to/production-example-nuxt-monorepo
docker compose up -d db          # libsql on :8080 — only if not already up
pnpm site:dev                    # Nuxt dev server on :3000
```

`pnpm site:dev` must run from the **repo root** so Nuxt picks up the shared
`.env` (auth secret, session password, Turso URL). Launching from
`packages/site` changes which env is loaded and the app will fail auth.

**Ready means:** `GET http://localhost:3000/` returns `200`. That is exactly what
the compose healthcheck uses. Do not wait for a specific log line — Nuxt dev
prints `Vite client built` long before the first SSR route has compiled.

**Teardown:** `Ctrl-C` the `pnpm site:dev` you started. Never `pkill -f nuxt` —
that kills the developer's own server. See [Isolation](#isolation-read-this).

### Cold-route compile

The first browser hit on a never-visited route triggers an on-demand SSR compile
that **can exceed three minutes**. It is not a hang. Set
`test.setTimeout(300000)` in any drive you write, and re-run once if the first
attempt fails on a fresh route — the config's single retry usually absorbs it.

## Doctor

Run this first whenever anything looks off. It is read-only: it starts nothing,
stops nothing, and writes nothing.

```bash
.cursor/skills/verify-magicsync/scripts/doctor.sh
```

Exit `0` = worth driving. Exit `1` = do not trust results from this instance.

It checks: HTTP 200, the listening process is really `nuxt` **and** its cwd is
this checkout (so you are not driving someone else's app), the libsql database
is reachable, the auth layer is mounted, `/api/v1/business` returns `401`
without a cookie (proves the session guard *and* the DB round-trip work),
`/app/posts` redirects anonymous callers to `/login`, Playwright and Chromium
are installed, and the git revision plus uncommitted-change count.

Override the target with `VERIFY_BASE_URL=http://localhost:3100` when driving a
side instance.

## Isolation — read this before touching any process

**This repo cannot be fully isolated. Know what you are driving.**

- **One dev server, one database.** The database is a single Docker container
  (`production-example-nuxt-monorepo-db-1`, libsql) holding the developer's real
  accounts. Two app instances pointed at it share every row.
- **Adopt, don't collide.** If something already answers on `:3000`, adopt it —
  the Playwright config does this automatically (`reuseExistingServer: !CI`).
  Launching a second full dev server doubles memory (the build asks for 12 GB)
  and gives you two half-working instances.
- **Never kill by process name.** If you started the server, record its pid:
  `echo $! > /tmp/verify-$RUN_ID.pid` and set `VERIFY_OWNER_FILE` so
  `cleanup.sh` stops exactly that pid and nothing else.
- **Refuse to double-drive.** One browser at a time against one dev server. The
  config comment is explicit: more than a couple of concurrent browsers causes
  `net::ERR_ABORTED` connection resets.
- **Never delete the developer's data.** Every write you make must be scoped to a
  throwaway user created by `createTestUser()`. Those accounts are tagged
  `e2e-*@test.magicsync.dev` and are the only thing `cleanup.sh` may delete.
- To drive a genuinely separate instance you would need a second libsql on
  another port plus `nuxt dev --port 3100` with `NUXT_TURSO_DATABASE_URL`
  repointed. Only do this when a task truly needs concurrent instances.

## Drive

The harness is **Playwright**, already configured at
`packages/site/playwright.config.ts` with `testDir: tests/e2e`, `baseURL:
http://localhost:3000`, and a chromium project. Do not add a second harness.

### The one command that matters

```bash
pnpm --filter @local-monorepo/site exec playwright test \
  verify-<feature>.spec.ts --reporter=list
```

> **Trap:** `pnpm --filter @local-monorepo/site test:e2e -- <file>` **ignores the
> filename and runs the entire 413-test suite.** Use the `exec` form above.

Specs must live under `packages/site/tests/e2e/` — the config's `testDir` finds
nothing else.

### Fixtures already exist — use them, do not reinvent auth

`packages/site/tests/e2e/helpers/e2e-utils.ts` provides real, unmocked setup.
Read it before writing anything.

| Helper | What it gives you |
|---|---|
| `createTestUser(request)` | Real Better Auth signup, `email_verified` flipped **directly in the database**, then a real sign-in. Returns the user and its session cookie. Emails are `e2e-<ts>@test.magicsync.dev`. |
| `loginWith(page, user)` | Applies the session cookie to the browser context. Every SSR and client request is then genuinely authenticated. |
| `createActiveBusiness(request, user)` | Creates a real business via `POST /api/v1/business`. **Almost every `/app` route needs one.** |
| `createTestAccount(userId, businessId)` | Inserts a connected-account row directly. |
| `waitForHydration(page)` | Waits for Nuxt to hydrate. Without it, a click fired right after `goto` is **silently lost**. |
| `blockHeavyAssets(page)` | Aborts HuggingFace/Unsplash asset fetches that some tools start on mount. |

A drive therefore starts like this:

```ts
import { test, expect } from '@playwright/test'
import { createTestUser, loginWith, createActiveBusiness, waitForHydration } from './helpers/e2e-utils'

const authed = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
const user = await createTestUser(authed)
await loginWith(page, user)
const business = await createActiveBusiness(authed, user)
```

**Do not mock.** `tests/e2e/fixtures.ts` contains a large `mockAuthSession` /
`mockChatSSE` library. It is for isolated component tests. For verification you
want the real auth, the real database, and the real route handlers.

### Selector discipline

Use ARIA roles and accessible names — they are stable across restyling and they
fail loudly when copy changes.

**Probe `[data-testid]`, not `[data-test]`.** The repo carries 553 `data-testid`
attributes and only 10 legacy `data-test` ones, and those 10 all belong to the
onboarding wizard. Probing the wrong attribute returns zero matches, which reads as
"this page has no handles" and sends you looking for a product bug that is not
there. This cost two wasted drives on 2026-10-04.

Useful handles that exist today: `[data-testid="add-business-button"]`,
`[data-testid="content-board"]`, `[data-testid="board-column-planned"]`,
`[data-testid="slide-counter"]`. Prefer `page.getByTestId(...)` over a raw locator.

Several pages still expose the older `[data-test]` form, so when a page looks
handle-free, confirm which attribute it uses before concluding anything.

Never click by coordinates, and never rely on DOM order.

### Clicking a disabled control hangs the run

`locator.click()` waits for the element to become enabled, so clicking a correctly
disabled button burns the whole `test.setTimeout`. Two carousel drives stalled for
400 seconds this way because Next slide is correctly disabled when you are on the
last slide. Assert `isDisabled()` before clicking, or click the direction that is
enabled.

## Evidence

**Where proof goes:**

```
.cursor/skills/verify-magicsync/evidence/<feature-slug>/NN-<step>.png
```

> **Trap:** never write proof into `packages/site/test-results/`. Playwright
> **wipes that directory at the start of every run**, so your evidence would be
> deleted by the next test run.

Paths inside a spec are relative to the test's working directory, which is
`packages/site` — use `'../../.cursor/skills/verify-magicsync/evidence/<slug>'`.

**What a valid proof contains:**

1. **The real user path.** Click what a user clicks. A screenshot of a page you
   reached by calling an internal setter proves nothing about the feature.
2. **The action *and* the resulting state.** Capture the filled form before
   submit, and the outcome after. A single "everything looks fine" screenshot at
   the end cannot show whether the save worked.
3. **The side effect, through a second read-only view.** After saving a
   business, re-read it via `GET /api/v1/business` or reload the list page. The
   UI showing a row is the first view; the API confirming the row is the second.
4. **Named, numbered steps.** `04-step2-form-filled.png` is diagnosable.
   `screenshot.png` is not.

**Mocking rules.** Mock only at a boundary production already isolates — an
outbound call to a third-party API. Never mock the app's own auth, its own
routes, or its own database. If a feature cannot be proved without mocking the
app, say so rather than proving a fiction.

**Reading API responses.** Endpoints return `ServiceResponse<T>`:

```ts
type ServiceResponse<T> = { success: boolean, data?: T, error?: { message: string } }
```

So `GET /api/v1/business` puts the array **directly on `data`**
(`body.data` is `BusinessProfile[]`, with a sibling `pagination` block) — *not*
on `body.data.data`. Getting this wrong produces a false "not found".

## Cleanup

```bash
.cursor/skills/verify-magicsync/scripts/cleanup.sh                 # scratch files
.cursor/skills/verify-magicsync/scripts/cleanup.sh --purge-fixtures  # DB dry run
.cursor/skills/verify-magicsync/scripts/cleanup.sh --purge-fixtures --yes  # actually delete
```

It removes scratch specs (`verify-*.spec.ts`, `zz-*.spec.ts`), stops a server
**only** when `VERIFY_OWNER_FILE` names one, and **never deletes evidence**.
Verify that last claim — confirm the files are still there afterwards.

**The fixture purge is safe by default.** Without `--yes` it only reports. It
matches `e2e-%@test.magicsync.dev` and shows how many real accounts would
survive before deleting anything. This repo has accumulated **1103** such
fixture users from past runs; purging them is routine hygiene, but it is a bulk
delete against the developer's database, so confirm before using `--yes`.

Never run `cleanup.sh` in a way that removes the evidence directory. Proof
artifacts are the deliverable.

## Helpers

Both scripts are executable and their invocations are above.

| Script | Purpose | Invocation |
|---|---|---|
| `scripts/doctor.sh` | Read-only "is this instance worth driving?" | `.cursor/skills/verify-magicsync/scripts/doctor.sh` |
| `scripts/cleanup.sh` | Tear down instances and scratch state, keep evidence | `.cursor/skills/verify-magicsync/scripts/cleanup.sh` |
| `scripts/purge-fixtures.mjs` | Remove throwaway e2e users (dry run unless `--yes`) | `node .cursor/skills/verify-magicsync/scripts/purge-fixtures.mjs "$PWD"` |
| `scripts/scaffold.spec.ts` | Copy-paste drive template with fixtures and evidence wired up | `cp .cursor/skills/verify-magicsync/scripts/scaffold.spec.ts packages/site/tests/e2e/verify-<feature>.spec.ts` |

`doctor.sh` and `cleanup.sh` honour `VERIFY_BASE_URL`, `VERIFY_OWNER_FILE`, and
`VERIFY_REPO_ROOT` for side instances.

## Feature map

`features/README.md` is the maintained index. Read it before driving, then open
the matching feature file for the exact recipe, selectors, and end state.

A proof that drives one convenient entry point is incomplete when the map lists
others — if you verify the carousel creator through its editor, you have not
verified it. Each feature file lists every user entry point it knows about.