# Content board

`/app/business/<businessId>/content` is a four-column board for one business, with
columns Planned, Approved, Writing and Published. A user fills it through two
doors. Find ideas runs a topic scan through the agent and drops every idea it
returns into Planned. New card writes one down by hand. The column a card lands in
decides what happens next, so the same gesture either moves the card, runs the
writer, or releases the article to the connected destination. Illegal jumps are
refused in the browser with a sentence rather than a server error. Safe mode
keeps approval and publishing with the owner, and autonomous mode hands both to
the agent.

## Sub-features

- `board-open` loads the board for one business with four counted columns.
- `board-empty-column` reads Empty under a column with no cards.
- `board-mode` shows the current mode and the one control that switches it.
- `board-publish-target` shows the chosen destination in a header popover chip.
- `board-new-card` opens the manual dialog and creates a Planned card.
- `board-find-ideas` opens the scan dialog, takes an optional topic and at least one platform, and persists every idea into Planned.
- `board-card-row` draws one card as a row with a title, a meta line and hover-only controls.
- `board-open-card` opens one card's own page.
- `board-write-now` runs the writer chain on a Planned card.
- `board-move-left` moves a card to the nearest legal column on the left.
- `board-move-right` moves a card to the nearest legal column on the right.
- `board-drag` drops a card on a column and lets that column pick the action.
- `board-refuse` answers an illegal column with a warning toast and sends nothing.
- `board-card-menu` opens Edit title and brief and Delete card.
- `board-back` returns to the business list.

## How to get to it (user POV)

- Choose **Content board** in the dashboard quick actions. The link carries the
  active business id and only renders when one exists.
- Choose **Content** inside the **Business** group in the sidebar, next to **All
  businesses**. That link is also omitted when no business is active.
- Open `/app/business/<id>/content` directly. The id is not guessable, so take it
  from `createActiveBusiness(request, user)`.
- Choose **Back to board** in the board header to leave for `/app/business`.

## Driving it with Playwright

Preconditions:

- Doctor passes.
- A throwaway user is logged in **and owns a business**. The board is business
  scoped and the URL needs the id.
- Scan and write both call the agent runtime. A manual New card needs no provider
  keys, so drive that first and treat the agent paths as best effort.

- **Open the board.** Navigate. Run `await page.goto(\`http://localhost:3000/app/business/${business.id}/content\`)` then `await waitForHydration(page)` then `await page.getByTestId('content-board').waitFor()`. The level 1 heading reads `Content` and four level 2 headings read `Planned (0)`, `Approved (0)`, `Writing (0)`, `Published (0)`.
- **Match the whole column name.** The count sits inside the heading. Run `page.getByRole('heading', { name: 'Planned (0)', exact: true })`. A name of `Planned` alone matches nothing.
- **Read the empty columns.** Inspect each column. `page.getByTestId('board-empty-planned')` reads `Empty`. Assert all four with `page.locator('[data-testid^="board-empty-"]')` at count 4.
- **Read the header controls.** Assert five buttons. `Back to board`, `Publish to` (a chip reading `No destination`), `New card`, `Find ideas`, `Switch to Autonomous`. Next to the last one the mode line reads `Safe mode` and `Nothing is approved or published without you.`
- **Create a card by hand.** Choose **New card**, fill, save. Run `await page.getByTestId('new-card').click()`, then `await page.getByTestId('card-create-title').fill('Reusable coffee cup packaging')`, then `await page.getByTestId('card-create-save').click()`. The dialog closes, a toast reads `Card created`, and the heading becomes `Planned (1)` with one row titled `Reusable coffee cup packaging`. The save button is disabled until the title has text.
- **Second view: the page.** Reload the board. Run `await page.reload()` then `await waitForHydration(page)`. The heading still reads `Planned (1)`. That reload is the proof the card came from the server rather than from the in-memory list.
- **Scope the column once.** Run `const planned = page.getByTestId('board-column-planned')`. Every card step below reuses it, and the card is in this column until the move step near the end.
- **Read a card's controls.** Hover the row. Run `await planned.getByRole('button', { name: 'Reusable coffee cup packaging' }).hover()`. Four controls fade in beside the title button. `Write now`, `Move to the next column`, `Card actions`, `Open the card`. There is no left arrow, because Planned has no legal column to its left.
- **Prove an illegal jump is refused in the browser.** Drag the Planned row onto Approved. Run `await planned.locator('[draggable="true"]').first().dragTo(page.getByTestId('board-dropzone-approved'))`. The Approved column dims while the card is in the air, and the drop raises a warning toast reading `A card cannot go straight from Planned to Approved.` No request is sent and the card stays in Planned. That string is expected from the shipped copy, not from a captured run.
- **Edit title and brief.** Choose **Card actions**, then the edit entry. Run `await planned.getByRole('button', { name: 'Card actions' }).click()`, then `await page.getByRole('menuitem', { name: 'Edit title and brief' }).click()`. The dialog `Edit this idea` opens. Run `await page.getByTestId('card-edit-title').fill('Reusable coffee cup packaging, v2')` then `await page.getByTestId('card-edit-save').click()`. The toast reads `Card updated` and the row shows the new title. Reload before asserting, so the value comes from the server.
- **Open the card.** Choose the title button. Run `await planned.getByRole('button', { name: 'Reusable coffee cup packaging, v2' }).click()`. The card's own page opens at `/app/business/<id>/content/<itemId>`. Run `await page.goBack()` to return to the board.
- **Scan for ideas.** Choose **Find ideas**, tick a platform, submit. Run `await page.getByTestId('find-ideas').click()`, then `await page.getByTestId('scan-topic').fill('sustainable coffee packaging')`, then `await page.locator('[data-testid^="scan-platform-"]').first().click()`, then `await page.getByTestId('scan-confirm').click()`. The topic field is optional and its label reads `Topic (optional)`. The confirm button stays disabled until one platform is ticked, and until then the dialog says `Pick at least one platform to continue.` Progress shows in `page.getByTestId('scan-progress')`. The run ends with a toast reading `New ideas in Planned: <count>` and a larger Planned count, or `The agent found no ideas for this topic`, or `Could not scan for ideas`. Assert whichever and say which.
- **Set the publish target.** Choose the target chip. Run `await page.getByTestId('publish-target-chip').click()`. A popover lists the business's connected destinations. With none it reads `No connected destination yet.` A drop on Published with no destination chosen is refused with `Choose where to publish first`.
- **Switch mode.** Choose the mode button. Run `await page.getByTestId('board-mode-switch').click()`. The line becomes `Autonomous mode` with `The agent approves topics and publishes on its own.` and the button becomes `Switch to Safe`.
- **Send the card to Writing.** Choose the right arrow on the card you created. Run `await page.locator('[data-column]', { hasText: 'Reusable coffee cup packaging, v2' }).getByRole('button', { name: 'Move to the next column' }).click()`. Two outcomes. With provider keys the toast reads `Article written` and the heading becomes `Writing (1)`. Without them the toast reads `Could not write the article` and the card snaps back, leaving `Planned (1)`. Assert whichever happened and say which. This is the same gesture as a plain move, and it is not one.
- **Delete a card.** Choose **Card actions** on the card you created, then delete, then confirm. Run `await page.locator('[data-column]', { hasText: 'Reusable coffee cup packaging, v2' }).getByRole('button', { name: 'Card actions' }).click()`, then `await page.getByRole('menuitem', { name: 'Delete card' }).click()`, then `await page.getByTestId('card-delete-confirm').click()`. The dialog is `Delete this card?` and it names the card. The toast reads `Card deleted` and every column count returns to its starting value. Delete before the run ends so the fixture user is left clean.
- **Proof.** Write to `.cursor/skills/verify-magicsync/evidence/content-board/`: the empty board, the board with one card, a row hovered so the controls show, the refuse toast, the scan dialog, and the move to Writing.

## Gotchas

- **Handles are `data-testid`, not `data-test`.** A probe for `[data-test]` on this page returns an empty list and looks like the board has no handles at all. The board, its columns, its cards and all four dialogs carry `data-testid`. In this repo the legacy `data-test` attribute belongs to the onboarding wizard alone.
- **Card handles carry the item id.** They read `board-card-<id>`, `board-card-open-<id>`, `board-card-write-<id>`, `board-card-menu-<id>` and so on. There is no `board-count-*` and no `board-card-angle-*`. Reach the count through the column heading and the row through its title button, which keeps you off the ids.
- **There is no step rail and no ideas grid.** Scan is a single dialog, not two steps with a rail between them, and there is no populate or rescan control. Every idea the scan returns is already a Planned row.
- **Card controls are hover-only.** They sit at `opacity-0` until the row is hovered or a control is focused. A click hovers for you and `getByRole` still finds them, but a screenshot of the resting board shows no controls at all.
- **The column decides the action, and Writing is not a move.** A Planned card's single arrow points at Writing, which runs the writer chain. This is why a plain arrow press can fail for want of provider keys.
- **Planned cannot reach Approved.** The state machine allows an idea to move only to Writing. Every other jump is refused in the browser, so expect the refusal toast rather than a server error.
- **Dropping a card on its own column is a no-op.** No toast and no request. That is correct behaviour, not a dropped action.
- **The board locks while anything is in flight.** New card and Find ideas go disabled and the whole board drops to `pointer-events-none opacity-60`. Wait for the column count to settle before the next click.
- **A failed action restores the snapshot.** The row never sits half-moved. Read the column counts after the toast, not while the row is in flight.
- **Back to board goes to the business list.** The header button carries that label and lands on `/app/business`.
- **Two sidebar entries are named Content.** One is a section label and one is the link nested under Business. Scope to the Business group.
- **Everything above is uncommitted.** The manual New card dialog, the browser-side refusal, working cross-column drag, the popover target chip and the row layout were all uncommitted local changes on 2026-10-04. Re-read the page before trusting a column name, a control position, or a handle.