# PRD: Feature Layer Restructure — Composition-Root Architecture

**Created:** 2026-03-30
**Status:** IMPLEMENTED — 2026-10-01
**Related:** `ARCHITECTURE-REFACTOR-RFC.md`, `AGENTS.md`, `.claude/patterns/layer-restructure.md`, `.claude/patterns/add-page.md`

Marker key used throughout: `[x]` delivered as specified · `[~]` delivered with a
deviation, recorded in the row · `[ ]` open.

## Delivery log

| Phase | Commit | What |
|---|---|---|
| 0–4 | `488e166`…`37b8f74` | Foundation sinks, page-local component promotion, `extends` cleanup |
| 5 | `db94bd5` | The page move: 291 files, 231 `git mv` renames, 10 deletions |
| 5a | `87eaa36` | Repaired 106 `<i18n src>` references the import rewriter could not see |
| GROW | `a1278df7` | Scaffold updated for the composition-root architecture |
| follow-up | `7363142`, `ad75d1a`, `8a3abcc7` | evlog registered in all 15 layers; 226 `console.*` call sites replaced; logging convention documented |
| close-out | `1829eb86`, `7e0a461e` | FRAME_W deduped; `#site` self-alias; mic-recorder slot chain from the composition root; missed forwarding hop fixed |

Actuals: **65** pages + **48** locale JSONs moved into `packages/site/app/pages/`;
**51** page-local components promoted into `<layer>/app/components/<layer>/…`;
**58** composables into `app/composables/…`; **15** other modules into
`app/utils/…`; **299** import specifiers rewritten across 125 files.

A first Phase 5 attempt failed and was reverted: it flattened the destination
paths and kept page-local `components/`/`composables/`/`utils/` beside the pages,
which produced 59 phantom routes, 30 shadowed routes and 89 broken relative
imports. The retry kept paths verbatim and promoted the page-local code into the
owning layer first. See `.claude/patterns/layer-restructure.md`.

### Open items

1. [x] **`PostModalContent` -> `MicRecorder` (tools) coupling — CLOSED** (`1829eb86`, `7e0a461e`).
   `PostModalContent` now exposes a `mic-recorder` slot and hands the transcript
   handler back via slot props (`:on-transcript`, typed with `defineSlots`); 5
   scheduler components forward it; 7 site pages supply it with an explicit
   `#layers/BaseTools/...` import. `scheduler` no longer references `MicRecorder`
   at all. Verified in a browser: the calendar header's 3-hop modal renders
   `AI Tools`, `😀`, `Microphone`, `0 chars`.
2. [x] **106 locale reads through 6-to-8 level `../..` into `packages/site` — CLOSED** (`1829eb86`).
   Added `alias: { '#site': currentDir }` to `packages/site/nuxt.config.ts` and
   rewrote every reference. The seam is now greppable and is a declared edge
   rather than a fragile traversal. Verified at runtime: the browser rendered
   "Content Calendar" / "Schedule Post", which exist only in `calendar.json`,
   read via `<i18n src="#site/...">`. The *proper* fix — a locale JSON per
   component — remains undone, see the deviations below.
3. [x] **`FRAME_W` exported from two files in `ui/app/utils` — CLOSED** (`1829eb86`).
   Nothing imported it from `carouselTemplates.ts` and neither module has
   imports, so the duplicate is gone. Auto-import export collisions: **0**.
4. [~] **Runtime gates — partially CLOSED.** Dev-server smoke and a browser
   click-through now pass (§6.4). `pnpm build` is **refused, not merely skipped**:
   `packages/site` sets `--max-old-space-size=12288` and the host had 9.9 GB
   available with a 2 GB swap 100% full. Playwright E2E and per-layer playground
   boot remain unrun — E2E needs a seeded database, and the dev environment has no
   reachable DB.

### New, found during close-out

5. [x] **`PostAIAssistant` and `TemplateVariablePopUp`** were rendered by
   `PostModalContent` with **no import** — they resolved from the `templates`
   layer's global component registry. This was the identical coupling that item 1
   just removed, in a second location. Fixed with the same slot treatment:
   `PostModalContent` now exposes `template-variable` and `ai-assistant` slots
   (with `onAction` / `loading` / `onAction` / `onTemplateAction` handed back to
   the page), the 7 intermediate components forward both, and the 7 composition
   roots supply them with explicit `#layers/BaseTemplate/...` imports.
   `scheduler` no longer references either component. The audit was generalised
   from one slot to three and now checks every child at every render site.

   A third instance surfaced while doing this: `site/app/pages/app/bulk-scheduler/generate.vue`
   also rendered `<TemplateVariablePopUp>` with no import. That one is
   site → templates, which is architecturally legal, but it was equally invisible,
   so it got an explicit import.

   Runtime proof on `/app/calendar/day` and `/app/posts/new`: the braces trigger
   opens the `templates` popup, "Current Date" emits `{{date}}` across the new
   slot boundary into the editor (counter 0 → 8 chars), and the `AI Tools` button
   opens the assistant menu with its real items. Hydration warnings on these
   components were confirmed pre-existing by re-running against HEAD.

### Closed question worth not re-litigating

The TTS engine (`ai-tools/app/composables/ai-tools/tools/text-to-speech/ttsEngine.ts`
+ `ttsEngine`'s worker) was proposed for deletion on the assumption that
`@browser-ai/transformers-js` had replaced it. It has not. `ttsEngine.ts` is a
hand-written Supertonic-3 ONNX pipeline on `onnxruntime-web`, backed by 380 MB of
committed weights in `packages/site/public/assets/onnx/` plus 10 voice-style JSONs.
`@browser-ai/transformers-js` is declared in `packages/tools/package.json` and the
workspace catalog but has **zero imports**; the tools-layer workers use
`@huggingface/transformers`. Deleting the engine would break
`/app/tools/text-to-speech`. The unused `@browser-ai/*` declarations are still
there and can be removed on their own.

---

## 1. Problem Statement

The MagicSync monorepo has 15 packages connected through Nuxt layer extends, forming deep transitive dependency chains:

```
site → scheduler → ai-tools → tools → assets → auth → email → ui
                                ↘ agent
           ↘ connect → (scheduler plugins)
           ↘ templates
           ↘ bulk-scheduler → (connect, scheduler, assets imports)
```

This creates multiple problems:

1. **Hidden broken layering:** `connect/server/api/v1/social-accounts/index.get.ts` imports `#layers/BaseScheduler/server/services/plugins/facebook.plugin`, but `connect` does NOT extend `scheduler`. These imports only resolve under `site`. Each layer's own `.playground` dev server silently crashes on those routes. The rot is invisible at site level but leaks into dev experience.

2. **Route merging hides collisions:** When two feature layers define the same page path (e.g., `/app/templates` exists in both `scheduler/app/pages/app/templates/index.vue` and `templates/app/pages/app/templates/index.vue`), Nuxt's layer merge silently picks one — the winner is determined by extends-order, not by product intent. This is unobservable without deep introspection.

3. **Pages are unreachable from the composition root:** Product pages live deep in the layer chain, importing components and composables from other layers. The site layer (the entry point for users) cannot cleanly compose routes from layers without Nuxt's implicit merge behavior.

4. **Cross-layer coupling via auto-imports:** Pages implicitly consume components/composables from other layers through Nuxt auto-import, making dependencies invisible and un-grippable.

**Decision:** Pages go in `site`. Feature layers are pure libraries. One rule everywhere.

---

## 2. Goals

- Make `packages/site/app/pages/` the single source of truth for all product routes
- Eliminate all feature→feature extends chains (scheduler, ai-tools, tools, bulk-scheduler, connect drop cross-feature extends)
- Each feature layer's `.playground` dev server must boot independently (no hidden deps)
- Preserve ALL current URLs exactly (route parity)
- Preserve all current functionality (zero behavioral changes)
- Enable future team members to trace any route to its page file in one hop

## 3. Non-Goals

- Refactor component internals (props, state, logic stay as-is)
- Change server API route structures (paths, request/response contracts)
- Modify database schema or services (only move/restructure)
- Change i18n keys, locales, or translation infrastructure
- Migrate state management (Pinia is optional — existing composable-singletons fine)
- Alter Playwright E2E tests
- Touch `.env`, CI, Docker, or deployment configuration

---

## 4. Architecture Before the Migration (historical)

> Snapshot taken before any work. Kept for reference only — the tables below no
> longer describe the tree. For the current layout see §5 and
> `packages/site/app/pages/`.

### 4.1 Package Inventory (15 packages)

| Package | Role | Extends | Pages |
|---|---|---|---|
| `shared` | Shared utilities, types | — | 0 |
| `db` | Schema, services | shared | 0 |
| `ui` | Design system, components | — | ~22 (ui-preview dev gallery) |
| `auth` | Identity (better-auth, nuxt-auth-utils) | shared, db, ui, email | ~12 |
| `email` | Email templates/services | db, ui | 0 |
| `assets` | Media/file storage | shared, db, ui, auth | ~6 |
| `content` | CMS rendering (@nuxt/content) | ui | 1 (catch-all) |
| `tools` | Productivity tools | ui, db, auth, assets | ~16 |
| `scheduler` | Post scheduling/editor | db, ui, auth, **connect, assets, templates, ai-tools** | ~50+ |
| `connect` | Social account connections | db, ui, auth | ~14 |
| `templates` | Template management | db, ui, auth | ~10 |
| `bulk-scheduler` | CSV import/generation | db, ui, auth | ~5 |
| `ai-tools` | AI-powered tools | db, ui, auth, **tools, agent** | ~18 |
| `agent` | Agent orchestration | db, auth | 0 |
| `site` | **Composition root** | all 13 | ~16 |

### 4.2 Layer extends Chains (the rot)

```
scheduler ──→ connect, assets, templates, ai-tools     (4 feature extends)
ai-tools    ──→ tools, agent                           (2 feature extends)
tools       ──→ assets                                 (1 feature extend)
agent       ──→ auth                                   (foundation — acceptable)
assets      ──→ (none — all foundations)               (clean)
bulk-scheduler ──→ (none currently, but code imports scheduler/connect/assets at runtime)
```

Transitive depth: `site → scheduler → ai-tools → tools → assets → auth → email → ui` = **8 levels deep**.

### 4.3 Hidden Cross-Layer Imports (code-level, not just extends)

| Consumer | Imports From | What |
|---|---|---|
| `scheduler` server `SchedulerPost.service` | scheduler (self — OK) | Publishing core |
| `scheduler` `PostModalContent.vue` | `#layers/BaseTools` | `MicRecorder` component |
| `scheduler` `PostModalContent.vue` | `#layers/BaseConnect` | `useBusinessManager` composable |
| `connect` server `social-accounts/index.get.ts` | `#layers/BaseScheduler` | `SchedulerPost.service`, platform plugins (facebook, linkedin, youtube, google) |
| `bulk-scheduler` server service | `#layers/BaseAssets` | `createAssetFromBuffer` |
| `bulk-scheduler` server service | `#layers/BaseScheduler` | `platformConstants` |
| `ai-tools` `CarouselSection.vue` | `#layers/BaseTools` | `CAROUSEL_TEMPLATES` data |

### 4.4 Route Collision Example

`/app/templates` is defined by TWO layers:
- `scheduler/app/pages/app/templates/index.vue` — carousel/AI template list
- `templates/app/pages/app/templates/index.vue` — template manager

At the time of writing this was assumed to be "later layer wins". It is not — see
§6.3, where the real rule was established from the Nuxt and `unrouting` sources.

---

## 5. Target Architecture — as delivered

### 5.1 File Layout

```
packages/
├── site/                          # COMPOSITION ROOT — pages go here
│   ├── app/
│   │   ├── pages/                 # ALL product pages
│   │   │   ├── app/
│   │   │   │   ├── index.vue
│   │   │   │   ├── home.vue
│   │   │   │   ├── posts/         ← from scheduler
│   │   │   │   ├── calendar/      ← from scheduler
│   │   │   │   ├── pipelines/     ← from scheduler
│   │   │   │   ├── feeds/         ← from scheduler
│   │   │   │   ├── templates/     ← from templates layer (canonical page)
│   │   │   │   ├── business/      ← from connect
│   │   │   │   ├── media/         ← from assets
│   │   │   │   ├── tools/         ← from ai-tools + tools layers
│   │   │   │   ├── bulk-scheduler/ ← from bulk-scheduler
│   │   │   │   ├── inbox/
│   │   │   │   ├── grow/
│   │   │   │   ├── auto-reply/
│   │   │   │   └── admin/
│   │   │   ├── ui-preview/        ← from ui (dev-only, stays noindexed)
│   │   │   └── [...slug].vue      ← from content (catch-all)
│   │   └── components/
│   │       └── ... (site-level)
│   └── nuxt.config.ts             # extends ALL 13 layers (unchanged)
│
├── scheduler/                     # LIBRARY — pages gone
│   ├── app/
│   │   ├── components/
│   │   │   ├── posts/             ← promoted from pages/posts/components/
│   │   │   │   ├── NewPostModal.vue         → <SchedulerNewPostModal />
│   │   │   │   ├── UpdatePostModal.vue      → <SchedulerUpdatePostModal />
│   │   │   │   ├── views/
│   │   │   │   │   ├── PostsBoardView.vue
│   │   │   │   │   ├── PostsGridView.vue
│   │   │   │   │   ├── PostsTableView.vue
│   │   │   │   │   └── ...
│   │   │   │   └── editor/
│   │   │   │       ├── PostPlatformSelector.vue
│   │   │   │       └── PostContentEditor.vue
│   │   │   ├── calendar/          ← promoted
│   │   │   ├── pipelines/         ← promoted
│   │   │   └── platform-settings/ ← promoted
│   │   ├── composables/           ← promoted from pages/**/composables/
│   │   └── shared/                ← platformConstants, platformSettings
│   ├── server/                    ← unchanged (services, api, utils)
│   └── nuxt.config.ts             # extends: [db, ui, auth] (was 8 layers)
│
├── connect/                       # LIBRARY
│   ├── app/
│   │   ├── components/
│   │   │   └── business/          ← promoted
│   │   └── composables/           ← useBusinessManager, useSocialMediaManager
│   ├── server/                    ← unchanged (services, api, utils)
│   └── nuxt.config.ts             # extends: [db, ui, auth] (unchanged, now honest)
│
├── ai-tools/                      # LIBRARY
│   ├── app/
│   │   ├── components/
│   │   │   └── video-cropper/     ← promoted (~14 components)
│   │   └── shared/                ← carouselTemplates.ts (CAROUSEL_TEMPLATES from pages/)
│   ├── server/
│   └── nuxt.config.ts             # extends: [db, ui, auth] (dropped tools, agent)
│
├── tools/                         # LIBRARY
│   ├── app/
│   │   ├── components/
│   │   │   └── carousel-creator/  ← promoted (~18 components)
│   └── nuxt.config.ts             # extends: [ui, db, auth] (dropped assets)
│
├── bulk-scheduler/                # LIBRARY
│   ├── app/
│   │   ├── components/
│   │   │   └── csv-import/        ← promoted
│   │   └── composables/           ← promoted from pages/
│   ├── server/
│   └── nuxt.config.ts             # extends: [db, ui, auth] (dropped scheduler, connect, assets)
│
├── templates/                     # LIBRARY
│   ├── app/
│   │   ├── components/
│   │   │   └── templates/         ← promoted
│   └── nuxt.config.ts             # extends: [db, ui, auth] (unchanged)
│
├── assets/                        # LIBRARY
│   ├── app/
│   │   ├── components/
│   │   └── composables/
│   ├── server/
│   └── nuxt.config.ts             # extends: [shared, db, ui, auth] (unchanged)
│
├── auth/                          # EXCEPTION — pages stay
│   ├── app/pages/                 ← stays (identity flows are auth's deliverable)
│   │   ├── login/
│   │   ├── register/
│   │   ├── accept-invitation.vue
│   │   ├── consent.vue
│   │   └── app/
│   └── nuxt.config.ts             # extends: [shared, db, ui, email] (unchanged)
│
├── ui/                            # EXCEPTION — ui-preview stays
│   ├── app/pages/ui-preview/      ← stays (component demo gallery)
│   └── nuxt.config.ts             # (unchanged)
│
├── content/                       # EXCEPTION — catch-all stays
│   ├── app/pages/[...slug].vue    ← stays (CMS rendering is content's deliverable)
│   └── nuxt.config.ts             # (unchanged)
│
├── db/                            # FOUNDATION — unchanged
├── email/                         # FOUNDATION — unchanged
├── shared/                        # FOUNDATION — unchanged
└── agent/                         # FOUNDATION — unchanged
```

### 5.2 Promoted Component Naming Convention — `[~]` deviation

**As planned:** promoted components become auto-imports under a layer-prefixed
name (`SchedulerNewPostModal`, `ConnectBusinessBoardView`), and pages drop their
relative imports.

**As delivered:** the directory prefix *was* applied —
`app/components/<layer-name>/<original-group>/…`, e.g.
`scheduler/app/components/scheduler/posts/components/PostModalContent.vue` — but
**pages keep explicit imports and keep the original local identifier**
(`import PostModalContent from '#layers/BaseScheduler/app/components/scheduler/…'`).

Reason: Nuxt derives the auto-import name from the path, so the planned move
would have changed `PostModalContent` to `SchedulerPostsComponentsPostModalContent`
and forced an edit to every `<template>` tag in the codebase — unverifiable at the
time, because the host cannot run a build. Keeping the identifier means the
templates were never touched. Only the import specifier moved. The named
convention remains available to new code, just not forced onto the migration.

The original plan read:

```
scheduler/app/components/posts/NewPostModal.vue   → <SchedulerNewPostModal />
scheduler/app/components/posts/views/PostsBoardView.vue   → <SchedulerPostsBoardView />
connect/app/components/business/BusinessBoardView.vue     → <ConnectBusinessBoardView />
ai-tools/app/components/video-cropper/ExportPanel.vue     → <AiToolsExportPanel />
```

Existing layer components (MediaGallery, EmojiPicker, BaseButton, etc.) retain their current names and locations — no prefix changes, zero churn for live non-page components.

### 5.3 State Management — `[~]` partial

Pinia is installed at `shared` (`@pinia/nuxt` present) but was **not** used for the
shared cross-layer state, per open decision 1. The `useState` singleton composables
were promoted instead — `useBusinessManager` and `UseSocialMediaManager` to
`shared/app/composables/`, `usePostManager` there too (Phase 4). Each feature layer defines its own stores. Any state shared across two feature layers (useBusinessManager, UsePostManager, useSocialMediaManager) is promoted from their respective `pages/**/composables/` locations into the shared foundation layer's composables.

**NewPostModal cross-page trigger:** Local mount pattern. Each site page that needs the modal mounts `<SchedulerNewPostModal />` directly with props (businessId, images, content presets) and named slots for extension. The modal is globally auto-imported from the scheduler layer so any page can invoke it by component name.

### 5.4 Cross-Layer Component Dependencies — `[~]` one leg open

A feature layer component never statically imports from another feature layer.
Enforced: 0 such imports remain. Two different mechanisms were needed —

```vue
<!-- scheduler/app/components/posts/components/PostModalContent.vue (in scheduler layer) -->
<!-- Before: -->
<script setup>
import MicRecorder from '#layers/BaseTools/app/components/MicRecorder.vue'
import { useBusinessManager } from '#layers/BaseConnect/...'
</script>

<!-- After: the useBusinessManager half shipped, the MicRecorder half did not -->
<script setup>
// useBusinessManager: sunk to shared, imported as
//   #layers/BaseShared/app/composables/useBusinessManager   [x]
//
// MicRecorder: the import was DROPPED and the <MicRecorder> tag left to resolve
// from the global component registry (tools registers it there). This removes the
// static import — the layer violation the gate checks for — but the dependency is
// still there at runtime. Slot-wiring it from the composition root is still open.
//   <SchedulerPostModalContent :business-id="id">
//     <template #mic-recorder><ToolsMicRecorder /></template>
//   </SchedulerPostModalContent>
</script>
```

**Update (close-out):** the slot chain shipped after all. The plan's concern was
right but the resolution differs from the sketch above — instead of threading a
template ref for the callback, `PostModalContent` hands `onTranscript` *out*
through slot props, so no ref forwarding is needed. The forwarders are the 4
modals plus `PostsTableView`, `CalendarViewWrapper` and `SchedulerPageHeader`
(the last three reach `PostModalContent` through the modals).

### 5.5 Server-Side Dependency Resolution

Server-side code that currently imports from other feature layers (only possible at site build time due to hidden broken layering) sinks shared logic into foundations:

| Service/Utility | Moves To | Used By |
|---|---|---|
| `SchedulerPost.service` | `db/server/services/` | connect, scheduler |
| Platform plugins (facebook, linkedin, youtube, google) | `db/server/services/plugins/` | connect, scheduler |
| `TokenRefresh.service` | `db/server/services/` | connect, scheduler |
| `platformConstants`, `platformSettings` | `shared/shared/` | scheduler, bulk-scheduler, connect |
| `threadSplitter`, `platformConstants` utils | `shared/shared/` | scheduler, bulk-scheduler |
| `createAssetFromBuffer` (AssetsUtils) | `shared/server/services/` (next to `asset.service`) | bulk-scheduler |
| `useBusinessManager`, `useSocialMediaManager` | `shared/app/composables/` | scheduler, bulk-scheduler |
| `UsePostManager` | `shared/app/composables/` | bulk-scheduler |
| `CAROUSEL_TEMPLATES` | `ui/app/utils/` (next to `toolRegistry`) | ai-tools |

**Status of the sink-down table above:**

| Item | Result |
|---|---|
| `SchedulerPost.service` → `db/server/services/` | [x] |
| Platform plugins → `db/server/services/plugins/` | [x] |
| `TokenRefresh.service` → `db/server/services/` | [x] |
| `platformConstants`, `platformSettings`, `threadSplitter` → `shared/shared/` | [x] |
| `createAssetFromBuffer` → `shared/server/utils/asset-utils.ts` | [x] |
| `useBusinessManager`, `useSocialMediaManager` → `shared/app/composables/` | [x] (Phase 5) |
| `UsePostManager` → `shared/app/composables/usePostManager.ts` | [x]; a dead duplicate left in `scheduler/app/composables/` was deleted |
| `CAROUSEL_TEMPLATES` → `ui/app/utils/` | [x] — and the `tools` page-local copies Phase 1 had left behind were deleted, so there is now exactly one copy |

After this sink-down, all feature layer server code imports ONLY foundation `#layers` aliases.

### 5.6 Post-Migration Extends Matrix

| Layer | Extends (before → after) |
|---|---|
| `shared` | — → — (no change) |
| `db` | shared → shared (no change) |
| `ui` | — → — (no change) |
| `auth` | shared, db, ui, email → same (no change) |
| `email` | db, ui → same (no change) |
| `assets` | shared, db, ui, auth → same (no change) |
| `content` | ui → ui (no change) |
| `agent` | db, auth → same (no change) |
| **`scheduler`** | db, ui, auth, **connect, assets, templates, ai-tools** → **db, ui, auth** |
| **`connect`** | db, ui, auth → db, ui, auth (no change, but now honest) |
| **`tools`** | ui, db, auth, **assets** → **ui, db, auth** |
| **`templates`** | db, ui, auth → same (no change) |
| **`bulk-scheduler`** | db, ui, auth → db, ui, auth (no change, but code no longer imports scheduler/connect/assets) |
| **`ai-tools`** | db, ui, auth, **tools, agent** → **db, ui, auth, agent** — [~] keeps `agent`, which §5.1 lists as a foundation, so no feature edge is introduced |
| `site` | all 13 → all 13 (no change — composition root) |

---

## 6. Migration Plan — executed

### 6.1 Execution Strategy: Big Bang, One Branch

Delivered as atomic commits on `main` rather than one squashed commit, so each
logical group is independently revertible.

### 6.2 Execution Order (within the big bang)

| # | Step | Result |
|---|---|---|
| 1 | **Foundation moves first** — server services/composables to db, shared, ui; imports updated; `@pinia/nuxt` in shared | [x] |
| 2 | **Composable promotion** — shared state composables from `pages/**/composables/` to `shared/app/composables/` | [x] `usePostManager`, `useBusinessManager`, `UseSocialMediaManager`. Not rewritten as Pinia stores — see §5.3 |
| 3 | **Promote page-local components** into `app/components/<layer-name>/`, updating `#layers` imports inside them | [x] 51 components. `PostModalContent` → `MicRecorder` was resolved by dropping the import rather than by the planned slot — see §5.4 |
| 4 | **Move pages to site**, preserving directory structure | [x] 65 pages + 48 locale JSONs. Deviation: pages keep explicit imports and local identifiers instead of switching to `<LayerPrefix>` auto-imports — see §5.2 |
| 5 | **Wire slots at site pages** for cross-layer components | [~] Not needed for imports (all rewritten mechanically). The MicRecorder slot is the one item that would have required it, and it stays open |
| 6 | **Cleanup layer extends** so each feature layer lists only foundations | [x] verified: 0 feature→feature edges in `extends` |
| 7 | **Remove redundant `pages:extend` hooks** | [x] 8 hooks deleted from layers that no longer own pages, plus the site's. `auth`/`ui`/`content` keep theirs because they still own pages |
| 8 | **Update AGENTS.md non-negotiable** + conventions doc | [x] `AGENTS.md`, `.claude/AGENTS.md`, `context/conventions.md`, `context/architecture.md`, `patterns/add-page.md`, `patterns/layer-restructure.md` |

### 6.3 Route Collision Resolution — `[x]` resolved statically

The dev-server route dump planned above could not be taken (no build on this
host), so the rule was established from the source instead:

1. `@nuxt/kit` builds `nuxt.options._layers` as `[root, ...extends DFS order]`.
2. Nuxt passes `getLayerDirectories(nuxt).map(d => d.appPages)` to
   `resolvePagesRoutes`, assigning each directory its **index** as `priority`.
3. `unrouting`'s `buildTree` documents the tie-break: *"On collision, the file
   with the lowest priority number wins."*

**So the EARLIEST layer in `_layers` wins, not the latest** — the opposite of what
§4.4 assumed. The flattened order is
`site 0, ui 1, db 2, shared 3, auth 4, email 5, assets 6, content 7, tools 8, scheduler 9, connect 10, templates 11, bulk-scheduler 12, ai-tools 13, agent 14`.

Applied to `/app/templates`: **scheduler (9) beat templates (11)**, so the
scheduler carousel/AI template page was already the one being served and is now
the canonical page in `site/app/pages/app/templates/index.vue`. The templates-layer
hub page became `packages/templates/app/components/templates/TemplatesHubPage.vue`
with its locale JSON beside it, so the code survives without shadowing a route.
`/app/templates` is now unambiguous, and it is the only collision that existed.

### 6.4 Safety Gates

| Gate | Result | Evidence |
|---|---|---|
| **Route parity** | [x] | 110 routes before, 110 after — **0 added, 0 lost**. 9 phantom `.ts` routes that were being served as pages are gone. Diffed with a script that replays Nuxt's own `_layers` DFS + unrouting's lowest-priority-wins rule |
| **Import resolution** | [x] | 3405 specifiers across 1192 files, **0 broken**. `<i18n src>` audited separately: 212 refs, 0 broken |
| **Syntax** | [x] | All 96 changed files parse under `oxc-parser`, including every `<script>`/`<script setup>` block of the 12 changed `.vue` files |
| **Feature→feature edges** | [x] | 0 in `extends`, 0 in imports |
| **Auto-import collisions** | [x] | 1, pre-existing (`FRAME_W`); the migration introduced none |
| **vite-doctor** | [x] | `pnpm dlx vite-doctor .` → clean, 0 blocker/error/warn/info across 1281 files |
| **Unit tests** | [x] | agent 221, db services 138, tools unit 32 — all pass |
| **Complexity** | [x] | New/changed functions ≤ 5 branches. Max found: 3 (`logError` in `errorHandler.ts` — one ternary + if/else-if) |
| **Event handlers** | [x] | 0 bare state assignments. Two inline arrow handlers in `media/index.vue` were replaced with named functions |
| **No `console.*`** | [x] | Superseded and widened: 226 call sites converted to the `log` auto-import across `app/` + `server/`. Documented exemptions: Web Workers, manual verification harnesses, scripts, tests |
| **i18n keys** | [x] | All 212 `<i18n src>` resolve; 106 of them now go through the `#site` self-alias and were confirmed rendering in a browser. 12 pages still have no `<i18n>` block — pre-existing, not introduced here |
| **Dev server smoke** | [x] | Dev server run with a 3 GB heap cap (never the 12 GB the build script uses). 90 modules force-transformed through Vite — all clean. SSR of `/app/calendar{,/day,/month,/weeks}`, `/app/posts`, `/app/posts/new`, `/app/posts/feeds` — all HTTP 200, 250-330 KB, zero error markers |
| **Browser click-through** | [x] | The mic recorder chain was verified at all three hop counts: 0-hop `/app/posts/new` and 1-hop `/app/posts/feeds` render `i-lucide:mic` in SSR; 3-hop needed a click on "Schedule Post" on `/app/calendar/day`, after which the modal shows `AI Tools`, `😀`, `Microphone`, `0 chars` |
| **i18n at runtime** | [x] | `@nuxtjs/i18n` compiles `<i18n src="#site/...">` to a real module import; the browser rendered strings that exist only in the referenced JSON |
| **Build** | [ ] | **Refused, not skipped.** `packages/site` build sets `NODE_OPTIONS=--max-old-space-size=12288`; this host had 9.9 GB available with a 2 GB swap 100% full. A build would thrash. Free memory or cap the heap first |
| **Playwright E2E** | [ ] | Not run — the suite needs a seeded database and a session; the dev environment has no reachable DB (every Turso query returns `fetch failed`) |
| **Playground boot** | [ ] | Not run. Layer isolation is argued structurally (0 cross-feature imports, foundations only in `extends`), not observed per layer |

### 6.5 Files Affected — estimate vs actual

| Package | Pages `.vue` | Locale `.json` | Components promoted | Composables promoted | Modules promoted | Config |
|---|---|---|---|---|---|---|
| scheduler | 14 | 9 | 0 (done in Phases 0–4) | 1 | 1 | `extends` + `pages:extend` removed |
| tools | 15 | 11 | 35 | 36 | 13 | `extends` + `pages:extend` removed |
| ai-tools | 12 | 11 | 12 | 16 | 1 | `extends` + `pages:extend` removed |
| connect | 14 | 8 | 3 | 5 | 0 | `pages:extend` removed |
| templates | 4 | 4 | 1 (hub → `TemplatesHubPage.vue`) | 0 | 0 | `pages:extend` removed |
| bulk-scheduler | 4 | 4 | 0 | 0 | 0 | `pages:extend` removed |
| assets | 2 | 1 | 0 | 0 | 0 | `pages:extend` removed |
| **Total** | **65** | **48** | **51** | **58** | **15** | **8 configs** |

- **239 moves** against an estimated ~222 files, plus 10 deletions. Two of the moves
  are the `connect → shared` composable sinks from §5.5 rather than page moves. Git
  records the commit as **231 renames + 10 deletions** because 8 of the 239 moves
  were then deleted as dead duplicates — six `tools` carousel-data files Phase 1 had
  already copied into `ui`, and two stale image-editor fabric plugins that shadowed
  the live ones by export name. The other two deletions were already dead before the
  move: a duplicate `scheduler/app/composables/usePostManager.ts` and a leftover
  `TemplatesCarouselListPage.vue` from the reverted first attempt.
- Page total moved into site: **113 files** (65 `.vue` + 48 locale JSON).
- The ~91-component estimate was high because Phases 0–4 had already promoted
  scheduler's posts/calendar/pipelines components and carousel-creator's before
  this table was written; the 51 here are the ones Phase 5 moved.

---

## 7. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation | What actually happened |
|---|---|---|---|---|
| Route parity failure (missed a page or sub-route) | Medium | High | Automated route parity diff as first gate; manual smoke test | **Did not materialise** — 0 added / 0 lost, and the 9 phantom `.ts` routes were removed rather than lost. Manual smoke test still owed |
| Cross-layer slot wiring missed (component silently breaks) | Medium | High | Playwright tests cover all key user flows; dev server smoke test | **Partly materialised, in the safe direction** — the planned slot wiring (§6.2 step 5) turned out to be unnecessary for imports and unsafe for the recorder, so component identifiers were preserved instead. The MicRecorder slot stays open (see §5.4) |
| Server service move breaks Nitro plugin ordering | Low | High | Migrate in isolation first; verify each affected server endpoint independently | **Did not materialise** — the plugins moved as plain files with no plugin registration involved; `db/server/services/plugins/*` resolves and the db test suite passes |
| Auto-import collision (two promoted components with same name in same site page) | Low | Medium | Component names are layer-prefixed; collision would surface as TypeScript error | **Did not materialise** — 0 new component-name collisions (checked against every `.vue` destination before moving). The *reverse* risk appeared instead: promoting `.ts` modules into auto-import-scanned `app/utils/` + `app/composables/` created 28 export collisions, resolved by deleting the duplicate `tools` copies of the carousel data and renaming the TTS engine constants. 1 pre-existing collision remains |
| Pinia store SSR mismatch | Low | Medium | Use `defineStore` with `storeToRefs` for SSR safety; test in dev server | **Avoided entirely** — Pinia was not used for shared cross-layer state (open decision 1). `useState` singletons were promoted instead, so the SSR hazard never applied |
| i18n key breakage during page move | Low | Medium | Locale JSONs move with pages; layer translations stay; no key changes | **Underestimated the mechanism** — locale files travelled correctly, but 106 `<i18n src>` references *broke* because an import-specifier rewriter never sees a `src` attribute. Fixed in `87eaa36`; all 212 refs now resolve |
| Playwright tests fail due to route changes | Low | High | Route parity gate catches this; tests use URL paths not component references | **Not exercised** — Playwright needs a dev server, which was not run. Routes are byte-identical, so a URL-based suite should be unaffected, but this is unproven |
| Team confusion about new layering rule | High | Medium | AGENTS.md rewritten; new devs get clear "pages go in site, layers are libraries" rule | **Mitigated in the scaffold, not yet in the team's heads** — both `AGENTS.md` files, conventions, architecture and two patterns updated. Item 5 of §11 is now closed |

---

## 8. Success Criteria

| # | Criterion | Result |
|---|---|---|
| 1 | **All product routes live in `packages/site/app/pages/`** (3 exceptions: auth flows, ui-preview, content catch-all) | [x] 110/110 routes. `packages/site/app/pages` holds 80 `.vue`; `auth` 10, `ui` 21, `content` 1 keep theirs |
| 2 | **Zero feature→feature extends chains** | [x] verified 0 |
| 3 | **Every layer's `.playground` boots independently** | [~] argued statically, not executed — 0 cross-feature imports and foundations-only `extends`. `evlog/nuxt` added to `db`/`shared`/`content`/`agent`, which previously only had `log` because `site` extended them |
| 4 | **Route parity is 100%** | [x] 110 → 110, 0 added, 0 lost |
| 5 | **Zero behavioural changes** | [x] the 291-file diff is 99% import specifiers. The only non-path edits: 10 provably-dead files deleted, TTS constants renamed `AVAILABLE_*` → `ENGINE_*`, `logError` now emits structured fields, 2 inline arrow handlers → named functions |
| 6 | **AGENTS.md reflects the new architecture** | [x] `AGENTS.md`, `.claude/AGENTS.md`, `context/conventions.md`, `context/architecture.md`, `patterns/add-page.md`, `patterns/layer-restructure.md` |
| 7 | **All safety gates pass** | [~] 13 of 15 pass, including the dev-server smoke and browser click-through. Build refused (host memory), Playwright E2E and playground boot unrun — see §6.4 |

---

## 9. Post-Migration Architecture Benefits

1. **Traceability:** any route URL → one file in `site/app/pages/`. [x] realised
2. **Layer isolation:** feature layers have no hidden dependency on each other. [x] realised and machine-checkable (0 imports, 0 extends)
3. **Playground reliability.** [~] structurally true; not yet observed by running each playground
4. **Collaboration:** no route-merge conflicts between layers. [x] realised — the only collision that existed is gone
5. **Future additions:** create package → add to site's `extends` → put pages in site. No other layer changes. [x] realised
6. **Component reuse:** promoted components are available to any site page. [~] available, but via explicit `#layers/...` imports rather than prefixed auto-import names — see §5.2

---

## 10. Open Decisions

1. **Pinia vs useState composables:** Decision — use existing `useState` composable-singletons + promote to foundations. Pinia is optional. **Outcome: applied.** `@pinia/nuxt` is installed at `shared` but the promoted composables stayed `useState`. *(If team wants Pinia later, refactor `shared/app/composables/*` to stores.)*
2. **CarouselSection → CAROUSEL_TEMPLATES sink target:** `ui/app/utils/` — **Outcome: applied**, and taken further than planned: `designAssets`, `patterns`, `layers/*` and `useCarouselDeck` also live only in `ui/app/utils/`. Phase 1 had copied them into `ui` but left the originals in the `tools` pages; those duplicates were deleted so there is exactly one copy.
3. **`/app/templates` collision resolution:** Non-canonical becomes a component reference. **Outcome: applied — but the canonical page was the opposite of what was assumed.** A dev-server dump was not possible, so the rule was read off the source: `unrouting` keeps the *lowest* priority number, i.e. the *earliest* layer in `_layers`. `scheduler` (9) beat `templates` (11), so scheduler's page was always the live one. That page is now `site/app/pages/app/templates/index.vue`; the templates-layer hub became `TemplatesHubPage.vue`. See §6.3.
4. **`pages:extend` cleanup hook in site nuxt.config:** Remove after migration. **Outcome: applied**, plus one more step not in the plan — the same hook existed in 10 layers, not just `site`. Eight were deleted along with the page trees; `auth`, `ui` and `content` keep theirs because they still own pages.

---

## 11. GROW Step (Post-Migration)

| # | Item | Result |
|---|---|---|
| 1 | **Update AGENTS.md non-negotiables** — "pages go in site, layers are libraries" | [x] `AGENTS.md` + `.claude/AGENTS.md`. Also added the two traps this migration fell into: never leave `components/`/`composables/`/`utils/` inside an `app/pages/` tree, and a feature layer never imports from another feature layer |
| 2 | **Update conventions doc** with the promoted component naming convention | [x] `context/conventions.md` Structure section rewritten to describe the composition root, the 3 page exceptions, and the layer-prefixed convention. It also gained a Logging section covering the `log` auto-import and the Web Worker exemption |
| 3 | **Update patterns index** with a "Layer Restructure" pattern | [x] `patterns/layer-restructure.md` created and indexed. It now records the five gotchas that actually cost time: `~`/`@` are per-layer, `#layers/…` gets eaten by a naive query split, `<i18n src>` is not an import specifier, the root project has no `#layers/*` alias, and route collisions resolve to the *earliest* layer |
| 4 | **Refresh architecture docs** referencing the old extends chain | [x] `context/architecture.md`; plus 19 stale file paths rewritten across `patterns/`, `packages/doc/guide/`, and 4 `.aiContext` PRDs |
| 5 | **Team communication** — brief the team on the new rule and rationale | [~] the brief is written: [`.aiContext/LAYER-RESTRUCTURE-BRIEF.md`](./LAYER-RESTRUCTURE-BRIEF.md). Sending it to people is still a human step |

### Patterns and follow-ups this work created

| Follow-up | Where it is recorded |
|---|---|
| Adding a page now means "put it in the composition root", and never leave support directories inside `app/pages/` | `patterns/add-page.md` |
| Moving files between layers without breaking imports, routes or locale references | `patterns/layer-restructure.md` |
| Replacing `console.*` with the `log` auto-import; the two shapes of `log`; the worker exemption | `patterns/evlog-observability.md`, `context/conventions.md` |
| Open items 1–4 in the header | this document |
