---
name: board-stage-agents
description: Wiring content-board column moves to agent runs — drag a card, an agent does the stage work
triggers:
  - "board drag triggers agent"
  - "stage move runs agent"
  - "research on drop"
  - "generate on drop"
edges:
  - target: patterns/web-grounded-research.md
    condition: when the stage work needs live web evidence
  - target: context/conventions.md
    condition: when checking ServiceResponse and error handling patterns
last_updated: 2026-09-13
---

# Board Stage Agents

## Context

The content board (`/app/business/[id]/content`) is a kanban with seven
columns mapped onto thirteen item states (`BOARD_COLUMNS` in
`packages/connect/app/pages/app/business/[id]/components/board-types.ts`).
Dragging a card calls `handleAction` in `content.vue`, which POSTs to
`/api/v1/content-items/[id]/actions` — the same endpoint as the card-menu
buttons. So a drag-drop can run an agent chain, not just move state: the
drop target resolves to an *action* via `dropActionFor`, and the actions
route runs the agent before returning the final card.

Current wiring:

- Drop on **research** → `research` action → web-grounded research agent
  (`researchWithWeb`), card lands on `research_ready` with the brief saved.
- Drop on **drafting** → `generate` action → writer chain
  (`runContentChain`: research-if-needed → write → humanize → checks →
  `review_required`), card lands on **review** for a human or review agent.
- **Fix issues** (`improve` action, button only — no drop mapping) →
  `reviseDraft`: failing seo/geo/link checks + virality estimate + optional
  user feedback are assembled into one revision prompt, the artifact is
  edited in place (version bump, status back to `review_required`), and the
  checks re-run. Board state is untouched; delivery stays approval-gated.
  `platforms` narrows the rewrite to those variants (per-platform virality
  from `shared/server/utils/virality.ts` grounds the notes); chat checkboxes
  and the `revise_draft` tool both pass it through.
- Chat deep links carry `?businessId=…&cardId=…`; the chat route appends an
  authoritative card snapshot to the system prompt, and the `revise_draft`
  agent tool lets "adjust the post…" requests actually revise the draft.
- Drop on **review** → `submit-review` (plain move `drafting → review_required`).
- Drop on **approved** → `approve`; drop on **archive** → `archive`.

## Steps

1. Decide which action the drop should trigger and add it to
   `DROP_ACTION_COLUMN` (`action → column key`). The card's current state
   must list that action in `BOARD_ACTIONS`, otherwise `dropActionFor`
   returns `null` and the drop is rejected as invalid.
2. If several actions map to one column (e.g. `generate` and
   `request-changes` both → `drafting`), confirm no single state lists both
   — `dropActionFor` returns the first match, so overlapping states would
   silently pick one.
3. Keep heavy side-effect actions on buttons only; only expose a heavy
   action as a drop target when the whole point of the column is that work
   (research, drafting). The final card state may differ from the drop
   column (generate ends in `review_required`) — the toast reports the final
   state, which is the correct feedback.
4. The agent endpoint must record `content_runs` rows per step so the
   activity feed shows progress; failures return typed errors so the toast
   shows the reason and the card stays where the failure left it.

## Gotchas

- `dropActionFor` matches on the *action list of the source state*, not on
  the state machine: a legal state transition with no mapped action still
  rejects the drop. Add the mapping, don't bypass the helper.
- `generate` from `idea`/`researching` runs research first (web-grounded via
  `prepareBrief`); from `research_ready` it reuses the saved brief. An empty
  brief falls back to the title — cards dropped to drafting with no research
  still produce a draft, just a thinner one.
- The e2e spec `content-board.spec.ts` clicks `generate` then
  `submit-review`; after a successful generate the card is already in
  `review_required`, so that second click only fits the failure path. Update
  the spec if you change what `generate` returns.
- Branch budget: keep each changed function ≤ 5 branches; these mappers and
  prompts grow by editing data (`PLATFORM_PLAYBOOK`, prompt text), not by
  adding conditionals.
- Card → chat deep links (`/app/ai-tools/chat?businessId=…&cardId=…`) must
  keep working: chat `index.vue` reads both query params on mount, selects
  the business, and loads the card + artifact into a context panel. If you
  rename the query params, update both the board drawer navigation and the
  chat mount logic.

## Verify

- [ ] Drag idea → research runs research, card lands `research_ready` with a
      brief visible in the drawer
- [ ] Drag research_ready → drafting runs the writer, card lands
      `review_required` with an artifact and 3 checks
- [ ] Drag idea → drafting directly still produces a researched draft
- [ ] Invalid drops (e.g. idea → review) still toast `dnd.invalid`
- [ ] `pnpm --filter @local-monorepo/agent test` green
