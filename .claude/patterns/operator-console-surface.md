---
name: operator-console-surface
description: Building the plain-language operator console — the chat as the single control surface, with an approvals queue and an activity feed that never expose agent/tool/model vocabulary.
triggers:
  - "operator console"
  - "chat surface"
  - "approvals queue"
  - "activity feed"
  - "plain language UI"
  - "Talk to your operator"
edges:
  - target: context/conventions.md
    condition: when writing the components, i18n or motion
  - target: patterns/nuxt-ui-chat.md
    condition: when the chat transcript itself is being restyled
  - target: patterns/agent-capability-extensibility.md
    condition: when an approvals row needs a new capability behind it
last_updated: 2026-10-02
---

# Operator console surface

The chat is the control surface for the whole system, scoped to the **active
business** (PRD-CONTENT-PIPELINE-OVERHAUL §1.3). Two columns: the conversation
on the left, a right rail with **Approvals** on top and **Activity** below.

## Context

Read PRD-CONTENT-PIPELINE-OVERHAUL §1.3, PRD-FLUE-AGENT-MIGRATION §11–§12,
`.aiContext/DESIGN.md` and `context/conventions.md`. Three files carry the work:

- `packages/ai-tools/app/composables/ai-tools/chat/operatorConsoleData.ts` —
  pure mappers. No Vue, no i18n, no fetch. Every value it returns is a **key**.
- `packages/ai-tools/app/composables/ai-tools/chat/useOperatorConsole.ts` —
  three factories (`useOperatorApprovals`, `useOperatorActivity`,
  `useOperatorSafeMode`) plus `useOperatorClock`. Each takes a
  `() => string | undefined` business getter so the component stays reactive.
- `packages/ai-tools/app/components/ai-tools/chat/Operator*.vue` — the four
  regions. They own their own fetch and reload when `isStreaming` flips to false.

The page (`packages/site/app/pages/app/chat/index.vue`) owns only the transcript
and the composer. Never grow the page to fit a rail region.

## Steps

1. **Active business** — always `useBusinessManager().activeBusinessId`
   (`packages/shared/app/composables/useBusinessManager.ts:36`), which wraps
   the global `useState('business:id')` that
   `packages/connect/app/middleware/03.business-check.global.ts` already fills
   for every `/app` route. Do **not** fetch `/api/v1/business` a second time to
   resolve it, and do not add a switcher: the dashboard layout already has one.
2. **Approvals queue** — two reads, then a decision:
   - pending = `GET /api/v1/artifacts?businessId=` filtered to
     `status ∈ {review_required, changes_requested}`,
   - minus anything already in `GET /api/v1/artifacts/approvals?businessId=`
     for the *same version* (the review route rejects a second decision on one
     version with `VERSION_CONFLICT`),
   - decide with `POST /api/v1/artifacts/:id/review`
     `{ decision: 'approved' | 'rejected', version, feedback: '' }` and
     `?businessId=` in the query.
3. **Type badge** — derive from the artifact `kind` enum
   (`social_post · carousel · reel_storyboard · research · template ·
   github_article · wordpress_article`) with a `kinds.*` key per kind plus a
   `draft` fallback. Never hardcode two types.
4. **Activity** — `GET /api/v1/agent/runs?businessId=`. Map each row to a
   sentence and drop the rest (see Gotchas).
5. **Safe mode** — `GET`/`PUT /api/v1/business/:id/safe-mode`. The badge is the
   switch; a failed read fails **closed** (badge stays on) and still toasts.
6. **Morning review** — see Gotchas; there is no dedicated capability.
7. Copy lives in `packages/site/app/pages/app/chat/chat.json` under
   `operator.*` and `activity.*`, in **all four** locales with identical key
   sets.

## Gotchas

- **`GET /api/v1/artifacts*` returns the raw `ServiceResponse`, not the rows.**
  The route returns `result` itself, so `{ success, data }` has to be unwrapped
  by hand — `unwrapList` in `operatorConsoleData.ts`. A failed envelope reads as
  an empty list, not an exception.
- **`contentArtifactService.listApprovals` is a decision log, not a queue.** It
  joins `approval_records`; a row only exists *after* someone decided. The
  pending set comes from `contentArtifacts.status`.
- **`agent_runs` is full of rows that must never be rendered.** Rows whose
  `agentName` starts with `ai.call:` are per-model-call telemetry and their
  `summary` is `provider/model · Nms · Ntok` — model vocabulary. Filter them.
- **A failed run's `summary` is a server error string** (e.g. *"The model
  completed without returning a response"*). Only echo `summary` when
  `status === 'completed'`; otherwise it leaks model vocabulary.
- **Capability approvals can be granted but not listed.** The decide route
  exists — `POST /api/v1/agent/goals/:id/approve` `{ approved: boolean }`,
  already wired in `RunCard.vue`'s approval footer — but nothing lists
  `agent_goal_runs` at `status = 'waiting_for_approval'`. Until that route
  exists, the rail can only show artifact reviews. Report the gap; do not
  invent a second approval model.
- **Morning review** already exists as the cron task `agent:morning-heartbeat`
  (`packages/scheduler/server/tasks/agent/morning-heartbeat.ts`, `0 8 * * *`),
  which writes a `metadata.kind = 'morning-report'` system message rendered by
  `MorningReportCard`. There is no on-demand trigger, so the header button sends
  the morning-review prompt through the chat instead — honest, visible, and it
  lands in the transcript. Do not fake a hardcoded report.
- **`RunCard` leaks two words of internal vocabulary** in strings the rail does
  not own: `run.summaryRunning` ("…tool(s)") and `workflow.skillTag`
  ("Carousel Skill"). Left alone deliberately — the rail must not spread them.
- The `carousel.revision*` keys embed the literal tool name `revise_carousel`
  in user-visible copy. Pre-existing; the flow is developer-initiated.

## Verify

- [ ] `@vue/compiler-sfc` parse + `compileScript` + `compileTemplate` on every
      touched `.vue`; also compile the template with `prefixIdentifiers` and
      assert **zero** `_ctx.*` left, which is what catches a handler you deleted
      but left in a template.
- [ ] `rg '@click="[^"]*=[^=]'` empty; `rg 'console\.'` empty in touched files.
- [ ] Every `t()` key resolves in `chat.json`, all four locales, identical leaf
      key sets — including the dynamic families (`activity.time.*`,
      `activity.phrases.*`, `operator.kinds.*`), whose keys must match every
      value the mapper can emit.
- [ ] No raw text node survives in a template (strip interpolations, then tags).
- [ ] Async buttons carry `:loading`; every outcome toasts; failures never silent.
- [ ] New/changed functions ≤ 5 cyclomatic branches.
- [ ] `pnpm dlx vite-doctor .` reports no new diagnostics.

## Debug

- **Rail is empty for a business that has pending work** — check the envelope
  first (`response.data` missing → the route shape changed), then the status
  filter, then whether the approvals list already carries that artifact+version.
- **Approval toast says it failed with a version conflict** — the artifact moved
  between load and click; `load()` runs again after every decision, so usually
  it is a second click on a stale card.
- **Activity feed empty but the operator clearly worked** — every row was an
  `ai.call:` telemetry row, or the runs belong to another `businessId`.
- **Badge stuck on** — the `GET` failed; it fails closed by design and the toast
  names the failure.

## Update Scaffold

When a route that lists pending capability approvals lands, extend
`awaitingArtifacts` (or add a sibling selector) and note in this file that the
rail is now reading two approval sources.
