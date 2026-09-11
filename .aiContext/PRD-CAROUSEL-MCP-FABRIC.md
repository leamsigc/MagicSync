# PRD: Carousel → MCP Post Flow + Fabric Rebuild

> **Status:** COMPLETE (2026-09-11). All tasks implemented, 53 e2e + 23 unit
> green, QA sign-off on every task. Locked decisions from grill (2026-09-10):
> slides are **structured-only** (`templateKey` + data, no raw HTML over MCP);
> slide PNGs render **server-side**; tools are **separate** (agent chains them);
> preview is **Claude artifact first**; fabric motivates **both** server parity +
> editor power; migration is **big-bang**; fabric scene JSON becomes **storage**;
> decks allow **1–15 slides**, IG 2–10 enforced at export/post time; iteration =
> **update same row**; menu-boards are **save/share only**; **fabric first, MCP
> after**; caption is **written by Claude**; export returns **asset IDs + draft**.

## Goal

End-to-end flow: in Claude.ai (OAuth → `/mcp`) the user generates an Instagram
carousel in chat (artifact preview), says "create a social post with this
carousel", and the agent chains MCP tools: `create-carousel` (structured slides)
→ `export-carousel-images` (server fabric render → PNG assets + draft post) →
`update-post`/`create-post` (Claude-written caption + schedule).

## Why fabric first

Today slides become images only in the browser (DOM → `modern-screenshot` →
PNG → `/api/v1/assets`), which an MCP agent cannot do. fabric.js scene JSON
renders identically in browser and on Node, so it is both the editor upgrade
(free canvas manipulation) and the server renderer. fabric 7.4.0 is already in
the catalog; image-editor ships a Fabric plugin architecture to reuse.

## Implementation Tracker

Legend: `[ ]` not started · `[-]` in progress · `[x]` done (only with evidence:
typecheck pass + Playwright spec green + QA subagent sign-off).

### Phase 1 — Fabric rebuild (ships first)

- [x] **Task 1.1 — Isomorphic scene core.** `packages/tools/shared/carousel-scene/`
  (constants + pure `layerSpec → fabric scene JSON` translator, fabric/DOM-free).
  *Evidence:* `tests/e2e/carousel-scene-core.spec.ts` 9/9 (7 translator unit +
  light/dark control-bar goldens), QA sign-off PASS (complexity max 5,
  i18n ×4 locales, handlers, tokens). Also fixed pre-existing creator debt
  found by QA: `:loading` on save-all/use-in-post, `v-motion-slide-bottom` bar
  wrapper, 2 bare-assignment handlers → named fns, download/load/video-fail
  toasts + `library.*` keys, 7 hardcoded literals → `t()`.
- [x] **Task 1.2a — FabricStage read-only renderer + beta preview.**
  `components/FabricStage.vue` (dispatch-map builders, dynamic fabric import,
  dispose lifecycle) + `?fabric=1`-gated `section-fabric` preview in index.vue.
  *Evidence:* `tests/e2e/carousel-fabric-stage.spec.ts` 2/2 (ready/rendered
  attrs, pixel-diversity, chrome-free golden of Split Screen paint), QA PASS
  (complexity max 5 after dispatch-map refactor, SSR-safe, query-gate proven).
  Intel: deck slides are html-bound (bg + 2 skipped) → Task 1.3 must convert
  html-kind content; scoped CSS needs `:deep()` for fabric-created DOM
  (see `patterns/playwright-golden-oracles.md`).
- [x] **Task 1.2b — Interactive fabric editor.** `FabricStage` selectable
  (background locked) with select/modify write-back into slide layers via the
  existing `selectLayer`/`updateLayerTransform` API; `?fabric=1` beta editable
  for native slides, converted legacy slides read-only.
  *Evidence:* `carousel-fabric-interact.spec.ts` 2/2 (click-select index,
  empty-clear, drag proven by DOM text moving), QA PASS (complexity max 5).
  Shared builders extracted to `shared/fabric-build.ts` for server reuse.
- [x] **Task 1.3 — All 40 templates compatible.** `shared/carousel-scene/`
  gained `legacy-presets.ts` (28 presets, sizes harvested from the DOM
  `render()` fns) + `html-convert.ts` (auto-layout engine: text/image/shape
  blocks, 9 item styles, 4 decorations, 7 image regions, footers) + radius/
  stroke passthrough in translator + FabricStage. 12 layers-kind paint
  natively; 28 html-kind convert content-completely.
  *Evidence:* 30 pure tests (all 28 keys: content-presence, geometry sanity,
  zero HtmlUnsupported) + 6-template browser proof (rendered>0, skipped==0,
  bitmap bg/light/ledger-fill assertions, 3× green), QA PASS (complexity max
  5 after regionGrid extraction). Test helper `tests/e2e/fabric-bitmap.ts`
  asserts true canvas buffers instead of flaky compositor goldens.
- [x] **Task 1.4 — Scene snapshot storage (additive, no migration).**
  `CarouselData.scene` (opaque per-slide fabric JSON) stored + returned by
  `carousel.service`; REST POST/PUT accept `layers` (fixes object-layer data
  loss) + `scene` via shared `server/utils/carousel-schema.ts` (deduped);
  IndexedDB + save flows persist snapshots built by shared
  `scene-snapshot.ts` (`resolveSlideLayers` reused by the beta preview).
  *Evidence:* `carousel-scene-snapshot.spec.ts` 7/7 (builder mapping,
  conversion, schema accept/strip/reject, guest save gate), QA pending batch.
- [x] **Task 1.5 — Server renderer.** `server/utils/fabric-scene-render.ts`
  (shared builders + `fabric/node` + node-canvas; SSRF allowlist
  data:/app-origin/picsum/unsplash/pexels; fonts reported, system fallback)
  + `POST /api/v1/carousel/render` (authed, binary PNG + counter headers).
  *Evidence:* `tests/unit/fabric-scene-render.test.ts` 3/3 (1080×1350 bytes,
  descriptor skip, allowlist denial, converted-slide end-to-end) + endpoint
  401 gate e2e. Deviation: no custom TTF pipeline yet (system fonts;
  `fontsRequested` reported) — follow-up, not a silent gap.

### Phase 2 — MCP tools (after Phase 1; 18 → 33 tools)

Follows `patterns/add-mcp-tool.md`. All rows are user-scoped
(`{userId}::{id}`) so every tool uses `resolveUserId(mcp)` (documented v1
limitation: one business key = one fallback owner). Writes: `requireScope`
full + `logMcpCall`. Never 401. `inputSchema` = plain zod object.

- [x] **Task 2.1 — Carousel CRUD (7).** `tools/carousel/`: `create-carousel`
  (structured slides 1–15, auto-UUID, server builds scene JSON),
  `list-carousels` (shaped, no full slides), `get-carousel` (+ shareUrl),
  `update-carousel` (partial merge, same row), `delete-carousel`,
  `publish/unpublish-carousel`. *Evidence:* `tests/unit/mcp-tools.test.ts`
  handler tests (mapping, merge, failures, audits) + `guide/mcp.md`.
- [x] **Task 2.2 — `export-carousel-images`.**
  `server/utils/carousel-export.ts` engine (render → PNG assets → 24h-out
  placeholder post; IG 2–10 enforced; creation never triggers publish) +
  thin MCP wrapper. *Evidence:* unit tests incl. real fabric render + real
  PNG writes to isolated tmp dir, bounds rejection without side effects.
- [x] **Task 2.3 — Menu-board CRUD (7).** Same 7-shape, save/share only
  (page-id generation, settings merge). *Evidence:* unit tests + `guide/mcp.md`.
- [x] **Task 2.4 — Docs.** `packages/doc/guide/mcp.md` 18 → 33 tools +
  carousel/menu-board sections + chat-to-post recipes.
### Per-task gates (every task)
1. Follow the desing system.
2. QA subagent sign-off on UI/UX (screenshots, light + dark, toasts, `:loading`,
   `@vueuse/motion` enters).
3. Project gates: complexity ≤5 branches/fn; no hardcoded UI strings (locale JSON
   + `t()`); named event handlers (never `@click="x = 'y'"`); conventions Verify
   Checklist item-by-item; matching pattern followed; no `console.*`/dead code.
4. Design guide: semantic tokens only, Inter/JetBrains Mono, radius scale,
   control-bar + testid contracts kept.
## FINAL CHECKLIST
1. Playwright spec green (listed above; run `pnpm test:e2e` in `packages/tools`).
## Risks

- Big-bang freeze on creator features during Phase 1.
- fabric cannot render arbitrary HTML (`HtmlLayer`/`customHtml`) — Task 1.3 owns
  the decision.
- Native canvas dep in Nitro/Docker (`docker-build.md`).
- Silent font mismatch server-side — TTF manifest + loud failure (Task 1.5).
- Claude.ai connects via existing `@better-auth/mcp` OAuth + consent
  business-attach — no new auth work; verify business claim → `mcp.businessId`.
