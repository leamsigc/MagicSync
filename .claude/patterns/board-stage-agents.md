---
name: board-stage-agents
description: Wiring content-board column drops to agent runs — drag a card, the destination column runs that step
triggers:
  - "board drag triggers agent"
  - "drop runs the step"
  - "write on drop"
  - "publish on drop"
edges:
  - target: patterns/web-grounded-research.md
    condition: when the stage work needs live web evidence
  - target: context/conventions.md
    condition: when checking ServiceResponse and error handling patterns
  - target: patterns/flue-agent-layer.md
    condition: when the capability surface changes
last_updated: 2026-10-02
---

# Board Stage Agents

## Context

The content board (`/app/business/[id]/content`) is **four** columns mapped
onto the `content_items` states, and the **destination column decides the
action** (PRD-CONTENT-PIPELINE-OVERHAUL §1.1):

| Column | Card state | Drop triggers |
|---|---|---|
| Planned | `idea`, `failed` | — (the scan creates these) |
| Approved | `review_required` | `POST /api/v1/content/move` — plain move |
| Writing | `drafting` | `POST /api/v1/content/write` with `stopAt: 'drafting'` |
| Published | `scheduled`, `published` | approve the artifact, then `POST /api/v1/content/publish` |

Dragging backwards runs **no** agent work, with one exception: Writing always
re-runs `content.write`, so Writing ← Approved is a re-draft, not a move.

The model lives in `packages/connect/app/composables/useContentEditor.ts`
(`BOARD_COLUMN_STATES`, `actionForColumn`, `stateForColumn`, `columnForState`),
not in a component. `ContentBoardColumn.vue` renders one column and decides only
whether a drag may land there; `useContentBoard.runAction` owns the request.

## Steps

1. Add or change a column in `BOARD_COLUMN_ORDER` + `BOARD_COLUMN_STATES` +
   `BOARD_COLUMN_TARGET`. Those three records are the whole mapping; a column
   with no state never shows a card and a state in no column is invisible.
2. If the column runs agent work, add the branch to `perform()` and an entry in
   `BOARD_SUCCESS_KEY` / `BOARD_FAIL_KEY` (one i18n key per action, four
   locales). Keep `perform()` at ≤ 5 branches — extract the request into its own
   `postX` helper rather than growing the chain inline.
3. Request payloads are capability input schemas, not the board's vocabulary:
   `content.move` takes `to`, not `state`; `content.write` takes `stopAt`;
   `content.publish` takes `provider` + `connectionId` + `confirm`. Check the
   schema in `packages/agent/server/capabilities/content.ts` before sending.
4. Keep the server the authority. `runAction` snapshots `items` before the
   action, applies the optimistic hop **only for a plain move**, reloads after
   every outcome, and restores the snapshot on failure. Never assign a state
   the server did not return.
5. Every drop needs a non-drag twin. Each card carries move-left / move-right
   buttons (disabled at the ends of the board) that call the same
   `moveTo(item, column)`; a column must stay reachable without a mouse.

## Gotchas

- `accepts` in `ContentBoardColumn.vue` compares the dragged card's *state* to
  its own column. Dropping a card into the column it is already in is a silent
  no-op, and the highlight never shows — do not turn that into a toast.
- A `write` on an existing item reuses it, so the item id stays stable; the
  scan's `idea.id` is not persisted and the board sends the item's own title as
  the idea key.
- `stopAt: 'drafting'` still persists the artifact and runs the checks; it only
  skips the final move to `review_required`. The card therefore stays in
  Writing with a saved article rather than being handed straight to review.
- The publish drop needs the artifact's **version** for
  `POST /api/v1/artifacts/:id/review`, and the board list does not carry it —
  fetch `GET /api/v1/content-items/:id` first, and skip the review when the
  artifact is already `approved` (`reviewArtifact` rejects any other status).
- Only connections that are `isActive` **and** `hasSecret` can publish; `config`
  is a JSON string holding `{ repo }` (github) or `{ siteUrl }` (wordpress).
- `content-board.spec.ts` collects but has never run (no live server in the
  agent environment). It is the only place the drop→request contract is
  written down, so update it in the same task as any change above.

## Verify

- [ ] Four columns render with their counts, and an empty one says `Empty`
- [ ] Drop idea → Writing sends `content/write` with `stopAt: 'drafting'` and
      no `content/move`
- [ ] Drop drafting → Approved sends `content/move` with `to: 'review_required'`
- [ ] Drop review_required → Published reviews the artifact at its current
      version, then publishes with `provider` + `connectionId` + `confirm: true`
- [ ] A server refusal toasts its coded message and leaves the card in its
      original column
- [ ] The move buttons send the same move as the drag
- [ ] `pnpm --filter @local-monorepo/agent test` and
      `pnpm --filter @local-monorepo/db test:services` green