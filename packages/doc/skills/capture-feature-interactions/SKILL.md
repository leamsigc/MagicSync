---
name: capture-feature-interactions
description: Capture the step-by-step interactions of a feature, page or route — one numbered screenshot per interaction — by authoring and running a journey. Use when asked for "all the interactions", "the step by step of each feature", "walk through every page", "document every flow", "capture each feature's flow end to end", "screenshot every step", or to build/refresh the per-feature interaction walkthroughs.
---

# Capture feature interactions

The step-by-step companion to `route-action-screenshots`. That skill captures an
action or two while you work; this one captures a whole **journey**: the ordered
interactions of one feature, one image per step.

```
packages/doc/public/img/screenshots/
  app-business-id-content/
    01-board-open.png
    02-board-empty-column.png
    03-board-new-card.png
    ...
    09-board-card-deleted.png
  interactions.json                 # per-journey result + preconditions + gaps
```

Re-running a journey overwrites each step in place. Numbering makes the folder
read as the flow a user actually performs.

## The one rule that matters

**Step IDs come from the feature map, not from your imagination.**
`.cursor/skills/verify-magicsync/features/<feature>.md` already lists the
sub-features (`board-new-card`, `board-move-left`, …) with the exact selectors and
the observable result of each. Those IDs are the interaction inventory. Use them
verbatim as step IDs so the images line up with the documented inventory — and so
"what does this feature do?" has one answer.

If the feature has no file in the map, drive it and **write the feature file
first** following that directory's "Feature entry contract". Do not invent a
journey for a surface nobody has characterised.

## Ground truth (read first)

| Thing | Where |
|---|---|
| Registry → add your journey here | `packages/site/tests/screenshots/journeys/index.ts` |
| An authored journey (copy this) | `packages/site/tests/screenshots/journeys/content-board.ts` |
| Ordered capture API | `journey()` + `suppressDevOverlays()` in `packages/site/tests/e2e/helpers/route-screenshots.ts` |
| Feature interaction inventory | `.cursor/skills/verify-magicsync/features/` |
| Branded-AI precondition fixture | `packages/site/tests/e2e/helpers/content-fixtures.ts` |
| Runner | `packages/site/tests/screenshots/capture-feature-interactions.spec.ts` |

## Steps

1. **Pick the feature and open its map file.** Copy its sub-feature IDs into the
   journey's `steps` array, in user order.

2. **Write the journey** in `packages/site/tests/screenshots/journeys/<feature>.ts`:

   ```ts
   export const myJourney: JourneyDefinition = {
     key: 'my-feature',
     title: 'My feature — the manual flow',
     route: '/app/my-feature',            // stable pattern; `:id` for dynamic routes
     featureDoc: '.cursor/skills/verify-magicsync/features/my-feature.md',
     preconditions: ['A published Brand Playbook — content capabilities 500 without it.'],
     notCovered: ['The scan path — needs AI provider keys.'],
     steps: ['my-open', 'my-first-interaction', 'my-second-interaction'],

     async setup({ authed, user, business }) {
       // fixtures only — never captured
     },

     async run({ page, business, baseURL, journey }) {
       await page.goto(`${baseURL}${ROUTE.replace(':id', business.id)}`)
       await waitForHydration(page)

       await journey.step('my-open')
       await journey.step('my-first-interaction', async () => {
         // drive the real interaction, then assert the observable result
       })
     },
   }
   ```

   `setup` prepares fixtures (not captured). `run` drives and captures. Assert the
   **observable result** of each interaction — a step that always captures is a
   step that proves nothing.

3. **Register it** in `journeys/index.ts` (`export const journeys = [...]`).

4. **Run it.**

   ```bash
   SCREENSHOT_FEATURE=my-feature pnpm screenshots:interactions   # one journey
   pnpm screenshots:interactions                                 # all journeys
   ```

   Read `interactions.json`, then open two or three images. A journey that
   "passed" but produced a spinner is not proof.

5. **Update the feature map** with what the run actually showed — especially if
   the drive contradicted the file (the map's own rule outranks everything:
   drive it, then write down what happened).

## Preconditions are the real work

Most failures are unmet preconditions, not bugs. Established ones:

- **`/app/*` routes** need a real user and, usually, an active business —
  `createTestUser` + `loginWith` + `createActiveBusiness`.
- **Branded-AI capabilities** (`content.update`, `content.delete`, `content.move`,
  `content.write`, `content.scan`) return **500 `BRAND_CONTEXT_REQUIRED` —
  "Publish a Brand Playbook to enable branded AI"** until the business has a
  *published* Brand Playbook. Call `publishBrandPlaybook(authed, user, business.id)`
  in `setup`. `BrandPlaybookSchema` is fully defaulted, so an empty draft
  publishes and no AI provider is needed.
- **AI paths** (scan, write, chat) need provider keys. Do not put them in a
  journey; list them in `notCovered` and say why.

Record every precondition in `preconditions` — it is what makes a red run
diagnosable instead of mysterious.

## Gotchas

- **`setup` first, then drive.** A journey that fails on step 1 because a fixture
  is missing wastes a full debug cycle.
- **Count the steps at the end** — the runner flags any declared step ID with no
  captured file, so a silently-skipped step fails the run.
- **Step IDs are matched loosely** (the file path must *contain* the ID), so keep
  IDs distinctive; `board-open` and `board-open-card` would collide.
- **Leave the fixture clean** where cheap — delete the card you created, close
  the dialog. It keeps re-runs and diffs sane.
- **Don't cover a drag-and-drop** if a component spec already does; it is flaky
  under Playwright. List it in `notCovered`.
- **Never cover a conversational/AI path by mocking it** — that proves a fiction.
- **A journey per feature, not per page.** If a feature spans routes, pick the
  primary route for the folder and drive the others inside the same journey.

## Verify

1. `interactions.json` shows the journey `ok: true` with `captured` = the
   declared `steps`, in order.
2. The folder holds exactly one `NN-<step>.png` per step; re-running does not add
   files.
3. Two or three images opened and confirmed to show the real interaction result.
4. The feature map's Live state updated to match what the run showed.

## Update Scaffold

- [ ] Wiki: `/guide/route-screenshots`
- [ ] Feature map: `.cursor/skills/verify-magicsync/features/<feature>.md`
- [ ] Pattern: `.claude/patterns/route-screenshots.md`
