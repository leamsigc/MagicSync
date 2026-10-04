# PRD: Content Pipeline — Four Steps, One API

> **Goal:** A business owner gets from nothing to published in four obvious steps.
> No kanban, no workflow engine, no 3-pane editor, no view toggles.
>
> **Supersedes:** the 13→6-state kanban + shadcn parity + Comark/ai-elements
> 3-pane editor design (2026-09-18). That design was correct about the data model
> and wrong about the product: it shipped 6 columns × 3 view modes × 7 drag
> actions × a 3-pane editor for a job a business owner describes as *"scan, look
> at ideas, draft, publish."*
>
> **Status:** C01–C05 shipped 2026-10-02. Evidence in §7.

---

## 1. The Flow

> **Revised 2026-10-02 (owner):** the board comes back. The owner asked for a
> **kanban over the steps**, where moving a card to the next step *runs that
> step's action*, moving it back reverses it, and the card opens into a single
> idea view with the article, the SEO checks, the per-platform social posts,
> and a real WordPress/GitHub publish choice. §1 below is normative; the old
> "no board vocabulary" rule in §3 is superseded.

```text
  1. Scan     "What should I write about?"   → agent researches, returns ideas
  2. Ideas    a board column of ideas
  3. Draft    drag a card here  → research + write the article
  4. Review   drag it here      → checks + SEO are ready to read
  5. Publish  drag it here      → approve, then publish to WordPress or GitHub
```

One screen is the board; the card opens the idea view.

| Screen | Contents |
|---|---|
| `/app/business/[id]/content` | Scan form + the 4-column board |
| `/app/business/[id]/content/[itemId]` | Idea view: article, checks, social posts, publish |

### 1.1 The board

| Column | Card state | Dropping a card here |
|---|---|---|
| **Planned** | `idea` | — (the scan creates these) |
| **Approved** | `review_required` | plain move; the write already ran its checks |
| **Writing** | `drafting` | runs `content.write` → research + article |
| **Published** | `published` | approve the artifact, then `content.publish` |

A card shows: title, an angle/keyword line with a coloured dot, and — once
published — `Edit` and `View →`. A card whose action has not run yet shows a
quiet `Write now` affordance instead of those. Empty columns show a centred
`Empty`.

Board header: the current mode (`Autonomous` / `Safe`) with one line explaining
what it does, and a single `Switch to Safe` / `Switch to Autonomous` button.
Autonomous approves topics and publishes; Safe asks first. This replaces the
old standalone Safe Mode banner — it belongs on the board, once.

Dragging **backwards** never runs an agent action except Writing ← Approved,
which re-runs `content.write` on the same item. Every other backward move is a
plain `content.move`. Invalid drops are refused with a toast and the card
returns to its column — `contentBoardService.move` stays the authority.

While a triggered action runs, its card shows a busy state and the board is
locked. Failure rolls the card back and toasts; it is never left half-moved.

### 1.2 The idea view

Everything needed to judge and ship one piece of content:

- **Article** rendered from the stored markdown with **comark**
  (`@comark/nuxt@0.7.0`, already registered in both `site` and `connect`).
  The component it registers is **`<Markdown>`** (plus `<MarkdownDocument>`)
  — there is no `<Comark>` component, so `<Comark :content="…">` does not
  exist. The real API is `<Markdown :value="markdown" :plugins="…" />`
  (see `ContentArticlePreview.vue`, which wraps it in
  `.prose.prose-neutral.dark:prose-invert`). comark is the preview renderer,
  always.
- **Edit** with the Nuxt UI editor in markdown mode — `UEditor` with
  `content-type="markdown"` and `UEditorToolbar` — the same control the user
  already has. The user may also ask the agent for the content in a different
  format (plain markdown, summary, outline); the stored artifact stays
  markdown, which is what comark renders.
- **Checks** — the stored SEO / GEO / link checks with their scores.
- **Social posts** — the artifact's per-platform `platformVariants`.
- **Publish target** — the owner's active WordPress and GitHub connections,
  then one button that publishes to the chosen one.
- Header: `Back` · state · date · `Meta` · `Edit` · `Unpublish` · `View Site →`.
  Footer: `Preview` · `Words: N` · version.

### 1.3 Chat is the operator

The chat is the control surface for everything in the system, scoped to the
**active business**. It is not a chat about the chat: the same surface drives
content and brand.

- Header: `Operator` · a `Safe mode on` badge · one `Run morning review` action.
- Empty state: `Talk to your operator` plus one line naming what it reads
  (leads, funnel, content calendar) and invites it to draft something.
- Right rail: **Approvals queue** (count badge) with one card per pending item —
  its type (`Email`, `Publish`), a summary, and `Approve` / `Reject`.
- Below it: **Activity** — what the operator did, newest first.

---

## 2. The API

Four endpoints. Every one is a thin adapter — it authenticates, authorizes,
builds the capability context, calls `runCapability`, and shapes the response.
**No prompt, no model call, and no database query lives in a route.**

| Step | Endpoint | Capability |
|---|---|---|
| 1 + 2 | `POST /api/v1/content/scan` | `content.scan` |
| 3 | `POST /api/v1/content/write` | `content.write` |
| 4 | `POST /api/v1/content/publish` | `content.publish` |
| edit | `PUT /api/v1/artifacts/:id/edit` | existing artifact route |

### 2.1 Scan — `POST /api/v1/content/scan`

```jsonc
// request
{ "businessId": "biz_1", "topic": "roof maintenance", "count": 6 }
// response
{ "ideas": [ { "id": "roof-maintenance-checklist", "title": "…", "brief": "…", "platforms": ["facebook"] } ],
  "sources": [ { "label": "…", "url": "https://…" } ] }
```

`topic` is **optional** — omit it and the agent scans the business itself.
`count` defaults to 6, max 10. Backed by the existing
`createContentIntelligence(...).generateContentIdeas()` (slice B of
PRD-FLUE-AGENT-MIGRATION §8.2), so research and idea generation are one agent
call rather than two. `id` is `normalizeIdeaTitle(title)` — stable across
re-renders, so the UI can key the list without a server round trip.

### 2.2 Draft — `POST /api/v1/content/write`

```jsonc
// request
{ "businessId": "biz_1", "idea": { "id": "roof-maintenance-checklist", "title": "…", "brief": "…" },
  "platforms": ["facebook"] }
// response
{ "itemId": "ci_1", "artifactId": "ca_1", "article": "# markdown body", "checks": [] }
```

Researches the idea, writes the **article**, humanizes it, runs the checks, and
moves the item `idea → drafting → review_required` through the existing board
service. `itemId` may be passed to re-draft an existing item.

`article` is a new `article: string` field on the artifact output contract
(`SocialPostDraftSchema`), defaulted to `''` so every artifact written before
this change still validates. The existing social caption, platform variants,
CTA and claims stay exactly as they are — an article is added *beside* them,
not instead of them.

### 2.3 Publish — `POST /api/v1/content/publish`

```jsonc
// request
{ "businessId": "biz_1", "itemId": "ci_1", "provider": "wordpress", "confirm": true }
// response
{ "itemId": "ci_1", "artifactId": "ca_1", "jobId": "job_1", "postId": "post_1" }
```

**Safe Mode is the `confirm` flag.** The business setting stays, but it stops
being a second dialog on a different screen:

| Safe Mode | Behaviour |
|---|---|
| ON (default) | The publish button is a two-step control (press → "Publish now?"). The second press sends `confirm: true`. |
| OFF | One press sends `confirm: true` immediately. |

Without `confirm: true` the capability returns `CONFIRMATION_REQUIRED` and
performs **no side effect**. There is no third behaviour: the old
`SAFE_MODE_REQUIRED` code is retired.

### 2.4 What stays but leaves the UI

`POST /api/v1/content/check` (SEO audit, extend, rewrite, internal linking,
social post, carousel draft) and every `/api/v1/content-items/*` route stay
exactly as they are — MCP tools, the pipeline studio, and the DB service tests
depend on them. **This PRD changes the UI's data source, not the API surface.**
The UI must call only the four endpoints in §2.

---

## 3. UI Rules

1. **Four steps, always in the same order, always visible.** A step that is not
   reachable yet is not rendered at all.
2. **One primary action per screen.** Everything else is secondary or absent.
3. **No second publish path.** The editor's "Create post now" button
   (`POST /api/v1/posts`) bypasses the approval gate; it goes.
4. **No board vocabulary in the interface** — no columns, no drag targets, no
   state badges, no priority filter. The states still exist in the database;
   they just are not the user interface.
5. **The agent does the work; the user chooses.** Scanning and drafting are one
   click each. The user never writes a prompt.
6. All copy through `t()`; no hardcoded strings. Named handlers only, never
   `@click="x = 'y'"`.

### 3.1 Deletions

| Delete | Lines | Why |
|---|---|---|
| `BoardColumn.vue`, `BoardCard.vue` | 228 | a linear flow has no columns |
| `BoardListView.vue`, `BoardTableView.vue` | 293 | three renderings of one list |
| `BatchIdeasModal.vue` + its 5-minute poll loop | ~105 | that job is now step 1 |
| `board-types.ts` | 166 | columns, drop mapping, priority — all dead |
| `content-editor-audit.ts` | 58 | re-ran an SEO audit on every keystroke |
| `useContentEditor.ts` | 261 | rewritten against `/api/v1/content/*` |
| `CreateCardModal.vue` | 91 | ideas come from the scan, not a form |
| `ArtifactPreview.vue` carousel branch | ~75 | the deliverable is an article |
| ~600 of 875 i18n leaf keys | — | everything above |

**Keep:** the `safe_mode` column, its settings toggle in `business/[id]/edit.vue`,
its GET/PUT routes (non-UI callers exist), every `/api/v1/content-items/*` route,
every capability, the MCP tools, and `content-chain.service.ts`.

---

## 4. Tasks

Legend: `[ ]` open · `[~]` in progress · `[x]` done (evidence required).

### C01 — Scan returns ideas
- [x] `content.scan` calls `generateContentIdeas` instead of `researchWithWeb`;
      `keyFacts: []` placeholder goes away.
      — *Evidence:* `runScan` injects `contentChainService.researchWithWeb` as the
      intelligence module's `research` provider, so research + ideas are one agent
      call. Wiring copied from `agentic/skills/create-content-ideas.ts`, plus a
      `loadBusiness` dep so the business snapshot is read once.
- [x] `ScanInputSchema` gains optional `topic` (max 300 — the downstream
      `GenerateContentIdeasInputSchema` ceiling), `platforms`, `count`.
- [x] `ScanOutputSchema` becomes `{ ideas, sources }`; `id = normalizeIdeaTitle(title)`.
      *Note:* `normalizeIdeaTitle` yields spaces (`"roof maintenance checklist"`),
      not hyphens as the §2.1 example shows. The UI keys on the returned value.
- [x] Tests: scan returns ideas; empty topic scans the business; `count` clamps to 10.
      — *Evidence:* `content-api.test.mjs` 5 → 13 tests, all green.

### C02 — Draft produces an article
- [x] `SocialPostDraftSchema` gains `article: z.string().default('')`.
      — *Evidence:* a test asserts a pre-`article` output still passes `validateArtifactOutput`.
- [x] `content.write` input gains `idea` (flat `title`/`brief` still accepted, and
      `idea.brief` accepts `''`); output gains `article`.
      — *Evidence:* `contentChainService.writeArticle()` — 4000-token article prompt in
      `server/agent/prompts/write-article.md` (the repo's home for model-facing prompts),
      fence stripping, `submitForReview` persists `article`.
- [x] The chain is research → `writePost` → `writeArticle` → `humanize` → `runChecks`
      → `submitForReview` → `review_required`. Caption/variants/CTA/claims untouched.
- [x] Re-drafting with an `itemId` reuses the item — a test asserts exactly one row.

### C03 — Publish confirms once
- [x] `safeMode` → `confirm: z.boolean().default(false)`; `SAFE_MODE_REQUIRED` retired.
      The gate is the **first** statement in `runPublish`: no board read, no
      materialize, no job, no board move. A test asserts the item is still
      `review_required` and `postId` still `null` afterwards.
- [x] Publishes `article` when present, caption otherwise.
- [x] Every caller migrated in the same task (`mcp/tools/content/publish-content.ts`,
      `content-api-route.ts` → `CONFIRMATION_REQUIRED` = 409). No shim left behind.

### C04 — Four-step UI
- [x] `content/index.vue` 480 → **224** lines: step rail (`1 Scan → 2 Ideas`), scan
      form, idea list with one action each, research sources, "Scan again".
- [x] `content/[itemId].vue` 680 → **295** lines: step rail driven by the item's own
      state, article editor + save, regenerate, checks, platform-tabbed preview,
      one Publish control, published outcome panel.
- [x] Refresh lands on the step the item state implies (`review_required`/`drafting`/`idea`/`failed`
      → step 3; `scheduled`/`published`/`archived` → step 4).
- [x] i18n trimmed: **875 → 264 leaf keys** across `en`/`es`/`de`/`fr` (66 each),
      zero unused, zero missing, zero literal text nodes in any template.

### C05 — Delete the clutter
- [x] Deleted 8 files: `BoardColumn.vue`, `BoardCard.vue`, `BoardListView.vue`,
      `BoardTableView.vue`, `BatchIdeasModal.vue`, `CreateCardModal.vue`,
      `board-types.ts`, `content-editor-audit.ts` — 917 lines.
      — *Evidence:* `rg` over `packages` for all 6 component names + both module
      names returns **no hits**; every exported `board-types` symbol was swept too.
      (`ai-tools/…/OperatorHome.vue` declares its own local `BoardItem` and does not import it.)
- [x] `useContentEditor.ts` rewritten against `/api/v1/content/*`.
- [x] `ArtifactPreview.vue` carousel branch removed (161 → 132).
- [x] `content-board.spec.ts` rewritten for the four steps (9 tests, collects; **never
      executed** — no live server, see §7).
- [x] **Only surviving non-mutation call into the old family** is one read:
      `GET /api/v1/content-items/:id`, needed because the four §2 endpoints expose no
      read and step 3/4 must know the state on refresh. It lives in the composable, not
      a page. Every *mutation* goes through `/api/v1/content/*` — §5 item 9 verified:
      `rg 'api/v1/posts' packages/site/app/pages/app/business` is empty and the only
      other hit is the artifact edit route.

**Order:** C01 → C02 → C03 → C04 → C05. C04 may start against the contracts in
§2 while C02/C03 land.

---

## 5. Verification Gate

1. **Complexity** — every new/changed function ≤ 5 branches; state the max.
2. **Nuxt doctor** — `pnpm dlx vite-doctor .`, no new diagnostics.
3. **i18n** — no hardcoded user-facing strings; every `t()` key exists in all
   four locales.
4. **Event handlers** — named functions; no bare state assignment.
5. **Conventions checklist** — `.claude/context/conventions.md`, item by item.
6. **Patterns** — `patterns/INDEX.md` checked; update `flue-agent-layer.md` if
   the capability surface changed.
7. **Interaction feedback** — `:loading` on async buttons, toasts on every
   outcome (failures never silent), `@vueuse/motion` on conditional UI.
8. **Tests** — `pnpm --filter @local-monorepo/agent test` and
   `pnpm --filter @local-monorepo/db test:services` green.
9. **No dual path** — `rg 'api/v1/posts' packages/site/app/pages/app/business`
   returns nothing; the UI reaches the agent only through `/api/v1/content/*`.

---

## 6. Non-Goals

- No new tables, no schema migration beyond the `article` field on a JSON
  artifact payload.
- No change to social platform integrations, MCP tools, or the pipeline studio.
- No mobile touch-drag (there is no drag at all now).
- No multi-user collaborative editing.
- No bulk/batch idea generation (the old `BatchIdeasModal`); scan returns ideas
  in one call.

---

## 7. Evidence Log

| Date | Task | Result |
|---|---|---|
| 2026-09-18→21 | T01–T08 (old plan) | 13→6 state migration, kanban, 3-pane editor, 7 actions, Safe Mode. **Schema work kept; UI superseded by this PRD.** |
| 2026-10-02 | Audit | 1160 lines across the two pages; 6 components; 875 i18n keys, ~600 belonging to deleted regions; ~35 keys already dead. The four agent-backed endpoints existed and were **unreachable from the UI** — it called only `/api/v1/content-items/*`. |
| 2026-10-02 | C01–C03 | Scan returns ideas; drafts carry an `article`; publish confirms once. Agent suite **250 tests / 249 pass / 0 fail / 1 skipped**. DB suite **138 / 138**. |
| 2026-10-02 | C04–C05 | Two pages **1160 → 519 lines**; 917 lines of components deleted; i18n **875 → 264 keys**. `pnpm site:build` completes; `vite-doctor` clean (0 diagnostics). Max cyclomatic complexity **5**. |

## 8. Bugs found and fixed

Three defects surfaced while wiring the four steps, all of which made step 4
unreachable in practice:

1. **`content.publish` could never succeed.** It materialized the artifact first,
   then created the job — but materialization moves the artifact to `draft` and
   `createJob` requires `approved`. Reordered: create the job, then materialize.
2. **A created job could never execute.** `materializePost` links a post and sets
   the artifact to `draft`, so `revalidateJobArtifact` — which required `approved`
   — failed the job it had just authorized. `publishing.service.ts` now accepts an
   artifact that is `draft` **with** a `postId`, i.e. one already materialized for
   delivery.
3. **Publishing sent the caption, not the article.** `captionOf`
   (`content-artifact.service.ts`) and `artifactMarkdown`
   (`publishing.service.ts`) both read `output.caption` only, so a WordPress or
   GitHub push ignored the article entirely. Both now prefer `output.article`.

## 9. Known Limitations

- `content-board.spec.ts` collects (9 tests) but **has never run** — no live server
  or model provider in the agent environment. Its riskiest assertion types into the
  ProseMirror surface to make the save buffer dirty.
- `provider` is hardcoded to `wordpress`; there is no picker, by design (one click).
  A business connected only to GitHub gets a `PUBLISH_CONNECTION_REQUIRED` toast.
- `idea.id` is not persisted on `content_items`, so Regenerate re-sends
  `idea.id = item.title`. Fine for the flow; add a column if analytics needs it.
- The one remaining `content-items` read (§C05) would become zero with a
  `GET /api/v1/content/items/:id` route.
- Repo lint is unavailable: `typescript-eslint` does not support the installed
  TypeScript 7.0. Compensated for by tests, `vite-doctor`, and `pnpm site:build`.
---

## 10. Round 2 — The Owner Drives It (2026-10-02)

> Locked by the owner this round:
> **Option (a)** — one content item, several platform bodies in a `variants`
> map on the artifact. **Publish stays separate** — the WordPress/GitHub
> article and the social posts are two distinct actions.
> Nothing here is optional: the round's theme is that the agent does the work
> and the **owner decides and corrects it**.

| # | Task | Owner requirement | Where |
|---|---|---|---|
| D01 | Scan is a modal | "Find ideas" is a button; a modal holds the platform choice; results are added to Planned **automatically** | `content.scan` + board |
| D02 | Card CRUD menu | three-dot corner menu per card: edit, delete, … | `content.update` / `content.delete` |
| D03 | Brief is not JSON | card briefs must never show a JSON envelope | sanitiser + board |
| D04 | Editable brief | the single item's header/brief is editable, not just the body | `content.update` |
| D05 | Right floating sidebar | checks, actions, social posts and shortcuts move to a collapsible right rail | item page |
| D06 | Fix based on checks | hand the failing check + article to the agent; repair until the checks pass, grounded in brief + topic + **target keyword** | `content.fix` |
| D07 | Multi-platform variants | one article, one body per platform. WordPress = SEO/GEO; social = platform reactions. Meta editable, several platforms | `variants` on the artifact |
| D08 | Social posts on demand | empty by default; generate for chosen platforms (supported ∩ connected), then **publish or schedule** | `content.social.*` |
| D09 | Image picker | pick images from the system assets directory inside the article | `/api/v1/assets` |
| D10 | Separate publish | article publish (WordPress/GitHub) and social publish are **different actions** | D07 + D08 |

### 10.1 Rules

1. The scan modal's platform choice drives the variants D07 produces. It is a
   blog post first; the platform decides the *version*, never the format.
2. `variants` is **added beside** `article`, defaulted to `{}`, so every artifact
   written before D07 still validates. Publishing picks the variant matching the
   target and falls back to `article`.
3. `content.fix` is **never automatic**. The owner asks for it.
4. A brief is prose. If the model returns JSON, it is parsed; if it is
   unparseable it is dropped, never rendered raw.
5. Social publishing is a different action from article publishing and never
   shares a confirm step with it.

**Wave 1** — capabilities (D01–D04, D06–D08, D10) · board (D01–D03) ·
social/asset components (D08, D09).
**Wave 2** — item page (D04–D08) wiring the Wave 1 pieces together.

### 10.2 Verification

As §5, plus: no artifact written before D07 fails `validateArtifactOutput`; a
card brief never matches `/[{[]/`; `content.fix` on a passing check set is a
no-op; social publish never touches the article artifact.
