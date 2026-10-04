# Layer Restructure — Team Brief

**Date:** 2026-10-01 · **Status:** shipped, partially verified · **Full plan:** [`.aiContext/PRD-LAYER-RESTRUCTURE.md`](./PRD-LAYER-RESTRUCTURE.md)

Read this before opening your first PR that touches a page, a component or an import.

## The one rule

**Product pages live in `packages/site/app/pages/`. Feature layers are libraries — they have no `app/pages/` tree.**

Three layers keep their own pages, deliberately:

| Layer | Keeps pages | Why |
|---|---|---|
| `auth` | `app/pages/` (login, register, invitation, consent) | Identity flows are auth's deliverable |
| `ui` | `app/pages/ui-preview/` | Component demo gallery |
| `content` | `app/pages/[...slug].vue` | CMS rendering is content's deliverable |

Everything else moved. `packages/site/app/pages/` now holds 80 `.vue`; the three
exceptions hold 10, 21 and 1.

## What to do differently

- **New page** → create it in `packages/site/app/pages/`. Protected product pages
  under `app/pages/app/`, public tools under `app/pages/tools/`. Locale JSON sits
  beside the `.vue` as `index.json` / `create.json`. Add the layer to `site`'s
  `extends` and stop there — no other layer changes.
- **New page-local component** → promote it into the owning layer at
  `<layer>/app/components/<layer>/<group>/`, then import it from the page with
  `#layers/Base<Layer>/app/components/...`. Keep the local identifier; change only
  the specifier. Never create a `components/` dir next to the page.
- **New composable** → `packages/<layer>/app/composables/useXxx.ts` in the layer
  that owns the feature. If two feature layers need it, it is not layer-local:
  put it in `shared/app/composables/` (`usePostManager`, `useBusinessManager`,
  `useSocialMediaManager` already live there).
- **Cross-layer need** → sink it. Server services and platform plugins go to
  `packages/db/server/services/`; shared constants and utils to `shared`;
  generic UI data to `packages/ui/app/utils/`. Server code never writes queries
  — it calls the service layer.
- **Logging** → `log.error({ message, ...fields })`. See below.

## Traps

Each of these cost real time during the migration.

1. **Never create `components/`, `composables/` or `utils/` inside an `app/pages/`
   tree.** Nuxt scans that tree for routes, so a stray `.ts` file becomes a live
   route. Symptom: a page appearing at a `.ts` path. The first migration attempt
   produced 59 phantom routes, 30 shadowed routes and 89 broken relative imports
   from exactly this.
2. **`~` and `@` are per-layer in Nuxt 4.** `LayerAliasingPlugin` resolves them
   against the *importing* layer's `srcDir` (`<pkg>/app`). The same
   `~/assets/x` means `packages/tools/app/assets/x` in `tools` and something else
   in `site`. Any file that changes package must have its `~/` and `@/` specs
   rewritten.
3. **A feature layer never imports from another feature layer.** Currently 0
   such imports and 0 such `extends` edges — both machine-checkable, so a new one
   is a regression. Extend the foundations only, and sink shared code into
   `shared`, `db` or `ui`.
4. **`<i18n src="...">` is not an import specifier.** Any import rewriter skips
   it. 106 references broke silently in the move and needed a separate audit
   commit. If you write tooling that rewrites specifiers, audit `src=""`
   attributes separately.
5. **The root project has no `#layers/*` alias.** When a library file needs
   something inside `packages/site`, use the `#site/...` self-alias (declared in
   `packages/site/nuxt.config.ts`). 106 references use it, all of them reading a
   page's locale JSON — which is itself an open smell (see Status).
6. **Route collisions resolve to the EARLIEST layer, not the latest.** Nuxt
   builds `_layers` as `[root, ...extends DFS]` and `unrouting` keeps the lowest
   priority number. Order today: `site 0, ui 1, db 2, shared 3, auth 4, email 5,
   assets 6, content 7, tools 8, scheduler 9, connect 10, templates 11,
   bulk-scheduler 12, ai-tools 13, agent 14`. `/app/templates` was won by
   `scheduler` (9) over `templates` (11) — the templates-layer hub became
   `TemplatesHubPage.vue`. That was the only collision.
7. **Nested routes.** `pages/foo.vue` + `pages/foo/child.vue` is a parent/child
   pair, not two pages; without a `<NuxtPage />` the child never mounts. Use
   `pages/foo/index.vue` + `pages/foo/child.vue` for siblings.

## Logging

`evlog/nuxt` is registered in all 15 layers, so `log` is a global auto-import on
client and server. No import statement. One shape:

```ts
log.error({ message: 'import failed', error: String(error) })
```

- `console.*` in `app/` or `server/` is now forbidden — 226 call sites were
  converted in commit `ad75d1ab` (92 files). Structure calls as an event object so
  the drain can index fields.
- Mapping used: `console.log` → `log.debug`, unless the message reports an
  operational event ("... initialized"), which is `log.info`. `console.error` /
  `console.warn` map across unchanged.
- **Web Workers are exempt** until they get a transport. `app/assets/workers/*`
  and anything they import (e.g. `ai-tools/.../text-to-speech/ttsEngine.ts`) are
  separate Vite entries with no auto-import context, so a bare `log` is
  `undefined` at runtime. Three files still hold `console.*`: that worker chain
  plus two verification harnesses (`server/utils/test-scheduler.ts`,
  `server/utils/verify-job-queue.ts`).
- In a Nitro handler, `const log = useLogger(event)` shadows the global and takes
  positional args: `log.error('message', { ...fields })`. Preferred. Never name an
  unrelated variable `log`.
- `console.*` is fine in `scripts/`, `tests/`, `e2e/`.

## Status

### Done

| Area | Evidence |
|---|---|
| Page move | commit `db94bd5` — 291 files, 231 renames, 10 deletions |
| Moved into site | 65 pages + 48 locale JSONs |
| Promoted | 51 components, 58 composables, 15 modules |
| Imports rewritten | 299 specifiers across 125 files |
| `<i18n src>` repaired | 106 references, commit `87eaa36` |
| evlog | 15 layers registered (4 added in `73631429`), 226 call sites |
| Route parity | 110 → 110, 0 added, 0 lost |
| Import audit | 3405 specifiers / 1192 files, 0 broken; 212 `<i18n src>` refs, 0 broken |
| Feature→feature edges | 0 in `extends`, 0 in imports, 0 unresolved global-registry renders |
| Syntax | 96 changed files parse under `oxc-parser` |
| `vite-doctor` | clean, 0 blocker/error/warn/info across 1281 files |
| Unit tests | agent 221, db services 138, tools unit 32 — green |
| Auto-import export collisions | 0 |
| Dev-server smoke + browser click-through | 6 routes SSR, mic recorder confirmed at 0/1/3 hops |
| `templates` widgets | `ai-assistant` + `template-variable` slots; `{{date}}` round-trip proven in-browser, counter 0 → 8 chars |
| Scaffold | `AGENTS.md`, `.claude/AGENTS.md`, `conventions.md`, `architecture.md`, both patterns, 19 stale paths |

### Deliberately not done

- **Per-component locale JSONs.** 106 library components read their page's locale
  through `#site/...`. The real fix is one JSON per component, but that means
  remapping every `t()` key in 106 files with no way to notice a missing key that
  would silently render as the key string.
- 12 pages still have no `<i18n>` block. Pre-existing.

### Closed since the restructure landed

| Was open | Now |
|---|---|
| `MicRecorder` reached `PostModalContent` via the global component registry | Real slot from the composition root. `PostModalContent` exposes the slot and passes the transcript handler back via slot props; 5 scheduler components forward it; 7 site pages supply it with an explicit `#layers/BaseTools/...` import. `scheduler` no longer references `MicRecorder` at all |
| `FRAME_W` exported twice in `ui/app/utils` | Deduplicated — `carouselTemplates.ts` imports it from `layers/types`. Auto-import export collisions: **0** |
| 106 locale reads used 6-to-8 level `../..` traversals into `packages/site` | Replaced with the `#site/...` self-alias. Verified rendering in a browser, not just resolving |

### Verified against a running app

A dev server was run and driven with a real browser (auth middleware temporarily
disabled, then restored byte-identical).

| Check | Result |
|---|---|
| 90 modules force-transformed through Vite (80 site pages + 10 chain components) | all clean, no transform errors |
| SSR of `/app/calendar{,/day,/month,/weeks}`, `/app/posts`, `/app/posts/new`, `/app/posts/feeds` | all HTTP 200, 250–330 KB, zero error markers |
| `<i18n src="#site/...">` at runtime | `@nuxtjs/i18n` compiled it to a real module import; the browser rendered "Content Calendar" and "Schedule Post" — strings that exist only in `calendar.json` |
| Mic recorder, 1-hop (`/app/posts/feeds`) and direct (`/app/posts/new`) | `i-lucide:mic` present in SSR HTML, correct locale string |
| Mic recorder, 3-hop (calendar header modal) | clicked "Schedule Post" in a real browser: modal shows `AI Tools`, `😀`, `Microphone`, `0 chars` |
| Console during the above | only 401s from an unauthenticated headless browser, plus pre-existing `html-validate` and `intlify` warnings. Nothing traceable to these changes |

### Still not verified

| Gate | Why |
|---|---|
| `pnpm build` / `pnpm site:build` | **Not run, and do not run it casually on this host.** `packages/site` sets `NODE_OPTIONS=--max-old-space-size=12288`; the machine had 9.9 GB available with a 2 GB swap already 100% full. A build here will thrash. Free memory first, or cap the heap. |
| Playwright E2E | The suite needs a seeded database and a session; the dev environment has no reachable DB (`fetch failed` on every Turso query). |
| Per-layer `.playground` boot | Not run. Layer isolation is still argued structurally — 0 cross-feature imports, foundations-only `extends` — rather than observed. |

Route parity was computed by replaying Nuxt's own `_layers` DFS and `unrouting`'s
tie-break, then cross-checked by transforming every page module; it was not read
off a live route table.

## Read more

- [`.aiContext/PRD-LAYER-RESTRUCTURE.md`](./PRD-LAYER-RESTRUCTURE.md) — full plan,
  per-section completion markers, risk log, before/after layout
- [`.claude/patterns/layer-restructure.md`](../.claude/patterns/layer-restructure.md)
  — moving files between layers without breaking imports, routes or locale refs
- [`.claude/patterns/add-page.md`](../.claude/patterns/add-page.md) — adding a
  route today
- [`.claude/patterns/evlog-observability.md`](../.claude/patterns/evlog-observability.md)
  — logging conventions
- [`.claude/context/conventions.md`](../.claude/context/conventions.md) —
  Structure and Logging sections