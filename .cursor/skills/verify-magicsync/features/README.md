# MagicSync verification map

This directory is the maintained source for verifying MagicSync's user-facing
behaviour. Read this index first, then open the matching feature file and follow
its recipe literally.

## Rule that outranks everything else here

**Never copy a status from a PRD into this map, and never infer one from a failed
locator.** Drive the route, then write down what happened. Two separate mistakes
in this repo's history came from not doing that. A `.aiContext/` PRD marked a
feature COMPLETE while its only data source had zero callers, and a probe using
`[data-test]` reported that handle-rich pages had no handles at all.

## Baseline preconditions

- Doctor passes: `.cursor/skills/verify-magicsync/scripts/doctor.sh` exits `0`.
- A Nuxt dev server answers `200` on `http://localhost:3000`.
- libsql is up: `docker compose up -d db` (port 8080).
- Playwright and Chromium are installed.
- Run **one** spec at a time against **one** dev server. Concurrent browsers
  cause `net::ERR_ABORTED` resets. Pass `--workers=1`.
- Never drive an instance that this run did not start. See `../SKILL.md`
  § *Isolation*.

## Driving conventions

- Drive with Playwright through
  `pnpm --filter @local-monorepo/site exec playwright test <file> --reporter=list`.
  Never the `pnpm test:e2e -- <file>` form, it silently runs all 413 tests.
- Specs live in `packages/site/tests/e2e/` and import fixtures from
  `./helpers/e2e-utils`.
- Every run creates a throwaway user via `createTestUser()`. No write may touch
  a real account.
- Call `waitForHydration(page)` after every `goto` before clicking, or the
  click is silently lost.
- Set `test.setTimeout(300000)`. A first hit on a cold route compiles on demand
  and can exceed three minutes.
- Probe `[data-testid]`, not `[data-test]`. See `../SKILL.md` § *Selector
  discipline*. The repo has 553 `data-testid` attributes and 10 legacy ones.
- Never click a disabled control. `click()` waits for it to become enabled and
  burns the whole timeout.
- Never mock auth, the app's own routes, or the database. Real signups, real
  sessions, real rows.

## Proof standards

- Capture the action **and** the resulting state. A filled form before submit,
  the outcome after.
- Re-read every side effect through a second read-only view: reload the list, or
  call the API. The row appearing once is not proof; the row surviving a reload
  is.
- Write proof to `.cursor/skills/verify-magicsync/evidence/<feature>/NN-<step>.png`
  (paths inside a spec are prefixed `../../`). **Never** write to
  `packages/site/test-results/`, Playwright wipes it on every run.
- Endpoints return `ServiceResponse<T>`. The payload usually sits directly on
  `data`, not on `data.data`. Getting this wrong produces a false "not found".
- Report an unreachable path with the attempted command and the unmet
  precondition. Do not report a feature as verified through a different entry
  point than the one claimed.
- Evidence survives `cleanup.sh`. Cleanup removes scratch state, never proof.

## Feature entry contract

Each feature file opens with an H1 and one paragraph on the user-visible
behaviour, then four required H2 sections:

1. `Sub-features` — short IDs, one line each.
2. `How to get to it (user POV)` — every user entry point.
3. `Driving it with Playwright` — opens with `Preconditions:`, then labelled
   bullets pairing each user action with an exact command and observable result.
4. `Gotchas` — traps that waste or invalidate a run.

A feature file may add a short `Migration and storage` section after `Gotchas`
when its surface depends on a schema change or a storage backend. Keep
implementation detail out either way. Name user paths, stable handles, required
state, commands, and observable proof.

## Features

Live state is from drives on 2026-10-04. **Proven** means a real user path was
driven and the end state was re-read through a second view. **Partial** means the
page was driven but the specific behaviour listed has not been observed yet.

| Feature | Covers | Live state (2026-10-04) |
|---|---|---|
| [Business onboarding](./business-onboarding.md) | The gated first-run wizard: skip setup, skip AI extraction, fill the form, save, prove the row landed. Unlocks every other `/app` route. | **Proven.** Gate redirects to `/app/business/initial`, Save lands on `/app/integrations`, `GET /api/v1/business` returns the row |
| [Create a social post](./create-post.md) | `/app/posts/new` → the post appears in the list | **Proven**, after fixing a draft-blocking bug. See defects below |
| [Notifications](./notifications.md) | `/app/notifications` — per-event in-app and email switches | **Proven** for the switches. The API confirms each flip. Mute has a backend but no UI |
| [Media assets](./media-assets.md) | `/app/media` — upload an asset and prove the file and row exist | **Proven**, after fixing the upload reporting, silent failure and bulk delete defects listed below |
| [Asset folders](./media-assets.md) | `/app/media` folder lifecycle, from create through a delete that loses no asset | **Proven.** The whole lifecycle drove end to end and every end state was re-read through the folders API. See defects below |
| [Social inbox](./social-inbox.md) | `/app/inbox` — Comments, Messages, Notifications tabs with filters | **Proven rendering.** All three tabs, the platform filter, the unread toggle, and all three empty states. Comments now have a writer. The Notifications tab is still permanently empty, see open decisions |
| [Carousel creator](./carousel-creator.md) | `/tools/carousel-creator` — the public, no-auth tool | **Proven** for load, add slide, navigate, and preview switch. Template and palette work is still source-derived |
| [Analytics dashboard](./analytics-dashboard.md) | `/app` — onboarding card, quick actions, range, CSV export | **Partial.** Empty state and toolbar proven. Changing the range was not observed completing |
| [Content board](./content-board.md) | `/app/business/:id/content` — four-column kanban, create and move cards | **Partial.** Four columns and the handle set proven. Card creation was not observed completing |
| [Auto-reply campaigns](./auto-reply-campaigns.md) | `/app/auto-reply` — keyword-to-DM campaigns, presets, keyword matcher | **Partial.** Dialog layout and field names proven. The matcher was not observed returning a result |
| [Auto-repost](./auto-repost.md) | `/app/posts/auto-repost` — interval and cap rules per post | **Partial.** Page and config API proven. A save was not observed confirming |

## Defects found and fixed on 2026-10-04

Every item was reproduced on the running app, fixed, and re-driven. The evidence
paths hold the before and after captures.

- **Saving a draft was impossible.** `Save Draft` passed status `pending`, and a
  guard rejected any `pending` post whose `scheduledAt` was not in the future. The
  composer defaults `scheduledAt` to `new Date()`, so the guard always tripped and
  every draft save was refused with "Scheduled time cannot be in the past". Save
  Draft now writes `draft`, a value the `posts.status` enum already allowed and the
  create route already defaulted to. `getPostsToProcessNow` claims only
  `status = 'pending'`, so drafts are never auto-published. Proved live: the post
  now appears via `GET /api/v1/posts` and the app redirects to `/app/posts`.
- **The inbox had no writer at all.** `InboxService.createItem` existed with zero
  callers anywhere in the repository, so `inbox_items` was never written and the
  Comments and Notifications tabs could only ever render their empty state.
  `PROGRESS.md` records this subsystem as COMPLETE. Auto-reply polling now mirrors
  each comment it sees into the inbox, with the internal post id resolved through
  `platform_posts` so the row cascades when the post is deleted. Proved live: the
  auto-reply route returns 200 and the inbox still renders.
- **A failed upload reported success.** `MediaUploader` discarded the return value
  of `uploadFiles`, which returns an empty array on failure rather than throwing,
  then emitted `upload` unconditionally. The page raised a success toast for
  uploads that never landed. It now emits `error` when nothing landed.
- **Upload failures were silent.** Neither media page bound `@error`, so a
  rejected file produced no output whatsoever. Both now raise an error toast.
  Proved live: a rejected PDF now shows an error and zero success texts.
- **Bulk delete stranded every file on disk.** `POST /api/v1/assets/bulk-delete`
  deleted the database rows with no file cleanup, unlike the single-delete route
  which unlinks correctly. Each bulk-deleted asset leaked its binary forever. It
  now unlinks each file and tolerates a missing one with a warn log.
- **A raw i18n key rendered as a label.** The `autoreply` event was missing from
  `preferences.events` in all four locales, so the seventh notification row
  displayed the literal text `preferences.events.autoreply`. Added to en, es, de,
  and fr. Proved live: the row now reads "Auto-reply activity".
- **A raw i18n key rendered in a toast.** `usePostManager`, a shared composable,
  calls `t('toast.postCreatedPending')` after a save, but `toast` was absent from
  the translation scope that composable resolves against, so the success toast read
  `toast.postCreatedPending`. Six sibling keys in the same composable were missing
  the same way. All twelve were added to all four locales.
- **Two hardcoded English strings on the media page.** The delete and
  Google Drive import toasts bypassed i18n while the keys already existed unused.
  Both now route through `messages.assets_deleted` and `messages.drive_imported`.
- **A type error in the post composer.** The composer referenced `previewsMap`,
  which was never declared, where the already-declared `PreviewPlatform` type was
  correct.
- **A dead block in the asset service.** `assetService.delete` contained an empty
  `if (storagePath) { }` that read a metadata key no producer writes. Removed
  rather than implemented, because the route already unlinks correctly.
- **Every asset folder count read 0.** Drizzle renders a bare column inside a
  `sql` fragment unqualified, so a correlated subquery compiled to
  `WHERE "folder_id" = "id"` and the inner `"id"` bound to the assets table
  instead of the folder. Replaced with a LEFT JOIN and `count(assets.id)`.
  Proved live: a folder holding assets now reads its real count in the filter
  option and in `GET /api/v1/assets/folders`.
- **A duplicate folder name returned a generic 404.** Drizzle wraps driver
  failures in a `DrizzleQueryError` whose message is `Failed query: <sql>`, which
  parks the real driver message on `.cause`, so the duplicate check never matched
  and the route fell through to not-found. Now 409 with
  `A folder with that name already exists`. Proved live: submitting the same name
  twice in one business raises the conflict instead of a 404.
- **`/app/media` was a hard 500 for every user.** The folder select passed an
  empty string as an option value, and reka-ui throws an invariant on it, so the
  page never rendered at all. The All assets option now carries the literal token
  `all`. Proved live: the gallery loads for a fresh throwaway user and the Folder
  combobox opens.
- **Moving assets posted an empty array.** `selectedAssets` was declared inside
  the composable, so the page and the gallery each held their own copy, and the
  page, which runs the move, read an empty selection. It is module level now.
  Proved live: selecting one asset and moving it toasts `1 asset(s) moved.` and
  the row reappears under the destination folder.
- **The selection badge rendered `0 files ()`.** It used a total-files key whose
  `size` parameter was never supplied, so both halves interpolated empty. It uses
  the existing `toolbar.selected_count` key now. Proved live: with one asset
  selected the badge reads `1 selected`.

## Harness defects found on 2026-10-04

These invalidated findings before they were caught. Each one produced a confident
wrong answer first.

- **The wrong test attribute.** Probing `[data-test]` returned zero matches on
  pages that carry hundreds of `[data-testid]` handles, which reads as "this page
  has no handles". The content board was wrongly reported as handle-free. Corrected
  in `../SKILL.md`.
- **Clicking a correctly disabled control.** `locator.click()` waits for the
  element to become enabled, so clicking Next slide on the last slide stalled two
  carousel drives past 400 seconds. The carousel was never broken. Corrected in
  `../SKILL.md`.
- **A raw-key check that could not fail.** A regex for leaked i18n keys required a
  camelCase segment, so it reported clean while `preferences.events.autoreply` was
  on screen. Read `ariaSnapshot()` instead.
- **Reading text before the section rendered.** An `innerText` probe taken too
  early concluded the dashboard had no Performance section. Wait for the heading.
- **A wrong API parameter.** `GET /api/v1/assets` needs `own=true` or a
  `businessId`. Called with neither, it returns an empty list, which looks exactly
  like a missing row.
- **A selector that matched the wrong control.** `getByRole('button', { name:
  /show popup/i })` matches the header language switcher, not the platform picker.
  The account picker is a row of icon-only chips with no accessible name.
- **Counting checkboxes.** `UCheckbox` does not expose `input[type=checkbox]`, so
  counting them returns 0.
- **A raw `.click()` inside `page.evaluate` does not register with a reka-ui
  select.** The value silently stays at its default, so a move destination chosen
  that way sends the assets somewhere else and the run reports a success. Use a
  real Playwright click on the select, then click the option.

## Open decisions, not defects

These need a product call. Do not "fix" them without an answer.

- **The inbox Notifications tab is permanently empty.** It reads `inbox_items`
  with type `notification`, and nothing writes that type. The real notifications
  live in a separate `notifications` table that four emitters do populate, and
  `/app/notifications` already presents them properly with preferences. Either the
  tab mirrors into `inbox_items`, or it is dropped as a duplicate surface. The
  second is less code and one fewer place to be confused.
- **Comment ingestion only runs through auto-reply.** Comments reach the inbox
  only when the `autoreply:process` task polls a watched Instagram post, so a
  comment appears only for posts an auto-reply campaign already watches. A general
  comment-polling pipeline does not exist.

## PRD reconciliation

The `.aiContext/` PRDs contradict each other on the status of several features.
**Treat the live column as authoritative and the docs as stale.**

| Feature | Docs claim | Live (2026-10-04) |
|---|---|---|
| Social inbox | `PROGRESS.md` Gap 2: `COMMENTS COMPLETE` | UI, schema, and routes complete. The Comments tab had **no writer** until this pass. Notifications tab still unwritten |
| Notification system | `PRD-NOTIFICATIONS.md`: `COMPLETE`, mute with expiry | Switches work and persist. **Mute has a backend and no UI**, so the PRD overstates |
| Create post | implied working | **Was entirely broken.** No draft could ever be saved |
| Media | `PROGRESS.md`: complete | Upload reported success on failure, failures were silent, bulk delete leaked files |
| Analytics | `PRD-ANALYTICS.md`: adaptive time-series | Renders with an explicit empty state. A comparison endpoint is dead code the page never calls |
| Content board | `PRD-CONTENT-PIPELINE-OVERHAUL.md` revised section: four-column drag kanban | Four columns confirmed. The same PRD's C05 checklist says the board was deleted and its non-goals say "there is no drag at all", so the PRD contradicts itself |
| Carousel creator | not in a PRD | Works, is public, needs no auth |
| Best time to post | `COMPETITIVE-FEATURES.md`: `DONE` | Not driven. The card is gated on data and does not render on an empty account |
| Sub-agents | `FEATURE-GAPS.md`: exist | `PRD-FLUE-AGENT-MIGRATION.md`: deleted as dead code. Unresolved contradiction, and `/app/chat` has no coverage at all |
| MCP surface | `FEATURE-GAPS.md`: MCP client; `COMPETITIVE-FEATURES.md`: MCP server | Both exist. Not user-facing UI, so out of this map's scope |

`FEATURE-GAPS.md` is dated 2026-05-02 and predates the work it denies.
`PRD.md` marks every task complete while several audits report the same subsystems
as unfixed.

## Coverage backlog

The map covers 10 features. The product has roughly 85 user-facing pages. These
routes are **unverified**. They are listed so the next pass knows where to go, not
as claims that anything is broken. No feature file exists for them yet, and none
should be written until the route has been driven.

Highest value first, because each is a headline surface in `ROUTER.md` or a
shipped PRD:

- `/app/chat` — the agent chat surface. The flagship of the Flue migration and
  the single largest gap in this map. SSE streaming, tool calls, goal runner,
  session picker.
- `/app/calendar`, `/calendar/day`, `/calendar/month`, `/calendar/weeks`
- `/app/grow` — `PROGRESS.md` Gap 4 records this as complete for Bluesky
- `/app/business/[id]/playbook` and `/app/business/[id]/corpus`
- `/app/integrations` and `/app/integrations/active`
- `/app/templates` plus its chat, email, images, and variables children
- `/app/ai-tools/agents`, `/knowledge`, `/settings`, `/skills`, `/tools`
- `/app/bulk-scheduler` plus `csv-import` and `generate`
- `/app/keys` — the API key surface behind the MCP toolkit
- `/app/account`, `/app/profile`
- `/app/toolbox`, `/app/home`, `/app/post/video`
- `/app/admin` and its seven children. Admin-only, so it needs an admin fixture
- `/app/tools/*` (content-split, growth-stratergy with create and data,
  text-to-speech, video-cropper)
- `/tools/*` public tools: image-editor, audio-player, audio-transcription,
  flutter-clipper, menu-board, og-image-generator, podcast, text-behind-image-free,
  video-silence-remover

## Security findings triaged on 2026-10-02

The audits report these as open. Two were checked against the running app and
**are already fixed**; the audits are stale. One was real and is now fixed too.

- **IDOR on unlink: already fixed, and now covered by a test.** `accountService.unlinkAccount`
  filters on `and(eq(account.id, accountId), eq(account.userId, userId))` and returns
  404 when nothing matches. Proved over real HTTP with two throwaway users.
- **Raw OAuth tokens in the audit log: already fixed.** Commit `85051f5a` removed
  `JSON.stringify(account)` from every `logAuditEvent` call.
- **The audit sink itself did not redact: real, found, and fixed.** Because every
  call site hand-picks fields, nothing enforced it. `redactSecrets` moved to
  `packages/db/server/utils/redact-secrets.ts` and is applied inside
  `logAuditEvent`. Pinned by `packages/db/tests/audit-redaction.test.mjs`.
- **All request headers logged on error: already fixed.** `server/utils/errorHandler.ts`
  whitelists `user-agent`, `content-type`, and `referer` by name.

## Product risks outside this map

Real, reported as open by `CONNECT-AUDIT.md`, `DB-AUDIT.md`, and `CODE-REVIEW.md`,
and not user-facing behaviour, so out of scope for a verification map. None has
been re-checked on 2026-10-04.

- **`findAll()` on business profiles returns every tenant's rows** with no
  filtering, at `packages/db/server/services/business-profile.service.ts`.
- **Two SQL injections** by string-interpolated `IN (...)` in
  `packages/db/server/services/asset.service.ts`. `DB-AUDIT.md` §8 claims these
  were fixed; `CODE-REVIEW.md` C16 still reports them.
- **No ownership check** on any method of
  `packages/db/server/services/review.service.ts`, which also returns `success:`
  instead of `data`/`error`, breaking the `ServiceResponse` convention.
- **OAuth tokens stored as plain text** in
  `packages/db/db/socialMedia/socialMedia.ts`.

Note that the first item contradicts the 2026-10-02 note claiming the unlink IDOR
was proved fixed. Both cannot be true at once, and neither has been re-proved here.

## Docker build memory cap

The builder stage sets `ENV MAKEFLAGS="-j2"` and that cap is load-bearing.
Without it the image build dies on a large host, and every verification claim in
this map is unfounded because there is nothing left to drive.

- **The uncapped default fanned out to about 16 concurrent g++ processes** on a
  16-core host, all compiling the cairo and pango bindings at the same time.
- **That exhausted a 31 GB machine** and the kernel OOM killer killed the build
  partway through. Nothing in the application was at fault.
- **Memory stayed above 20 GiB available once capped.** The same build finishes on
  the same host with the cap in place.

If an image build dies with no compile error behind it, check this first and stop
re-running the rest of the pipeline until it holds.