# Analytics dashboard

`/app` gives a user one screen for how their connected accounts are doing. A
fresh account sees a three-step setup card, six quick-action links, three
summary tiles reading zero, then a Platform Performance block with a day-range
picker, a CSV export, a refresh, and either per-platform cards or a call to
collect stats. Everything below the totals appears only once metrics exist, so an
account with nothing collected is the normal first run and not a broken page.
The dashboard is scoped to the user. It sends no business id.

## Sub-features

- `dash-open` loads `/app` for the logged-in user and sends no business id.
- `dash-onboarding` shows the three-step setup card with a readiness count and a progressbar.
- `dash-quick-actions` offers the six links into the rest of the app.
- `dash-totals` shows the three summary tiles, each with a percentage change.
- `dash-performance` shows the Platform Performance heading with the range picker, CSV export and refresh.
- `dash-range` switches the window between 7, 30 and 90 days.
- `dash-collect` triggers a collection run and reloads the dashboard.
- `dash-empty-stats` shows the no-stats paragraph and the Collect Stats button.
- `dash-platform-cards` shows one card per connected platform with its own chart and counters.
- `dash-freshness` shows a per-account freshness chip.
- `dash-top-posts` shows the ranked table with a Repurpose action per row.
- `dash-best-times` shows the recommended posting slots.
- `dash-export` downloads the metrics as CSV.

## How to get to it (user POV)

- Choose **Dashboard** in the sidebar, the first item.
- Open `/app` directly.

## Driving it with Playwright

Preconditions:

- Doctor passes.
- A throwaway user is logged in. `createActiveBusiness` is not required, because
  the dashboard sends no business id. Create one only if you also want the
  Content board quick action to appear.
- With no connected account there are no metrics, so this drive proves the empty
  path. Say plainly that live metrics were not exercised.

- **Open the dashboard.** Navigate. Run `page.goto('http://localhost:3000/app')` then `await waitForHydration(page)`.
- **Wait for the performance block before reading any text.** Run `await page.getByRole('heading', { name: 'Platform Performance' }).waitFor()`. Only then read the page. A previous drive read `page.locator('body').innerText()` too early and recorded the whole section as missing.
- **Read the setup card.** Inspect the top card. The heading reads `Get set up in 3 steps`, a paragraph contains `33% ready to post`, a `progressbar` reports `33%`, and a button reads `Dismiss setup guide`. Step 1 shows `Done ✓` once a business exists, and its call to action until then.
- **Read the quick actions.** Assert six links by name. `Create post`, `Connect accounts`, `View calendar`, `Open inbox`, `Auto-reply`, `Content board`. The last one carries the active business id, so on a user with no business there are five.
- **Read the three totals.** Assert one text node. Run `await expect(page.locator('main')).toContainText('+0.0% 0 Total Posts')` and the same for `Total Followers` and `Total Engagement`. All three deltas are `+0.0%` because no `growth` field exists yet.
- **Read the performance toolbar.** Assert the heading and three buttons. `Export CSV`, `Refresh Stats`, and one combobox-style trigger showing the bare number `30`.
- **Change the range.** Open the picker, then choose. Run `const perfBar = page.getByRole('heading', { name: 'Platform Performance' }).locator('..')`, then `await perfBar.getByRole('button', { name: 'Show popup' }).click()`. Three options open, named `7 Days`, `30 Days`, `90 Days`. Then run `await page.getByRole('option', { name: '90 Days' }).click()`. The trigger now reads `90`.
- **Export CSV.** Choose **Export CSV**. Run `const dl = page.waitForEvent('download')`, then `await page.getByRole('button', { name: 'Export CSV' }).click()`, then `await (await dl).suggestedFilename()`. The name is `analytics-90d-<date>.csv`. With no metrics the file holds a header row only. Assert the download, not the page, which does not change.
- **Read the empty state.** Inspect below the toolbar. A paragraph reads `No stats collected yet. Click below to fetch platform data.` above a `Collect Stats` button.
- **Collect stats.** Choose **Collect Stats**. Run `await page.getByRole('button', { name: 'Collect Stats' }).click()`. With no connected account the toast reports zero of zero platforms collected and the empty paragraph stays. That is the honest end state.
- **Second view: the API.** Re-read the dashboard. Run `authed.get('/api/v1/stats/dashboard')`. The summary and graph series sit straight on `body.data`. With no metrics both `platformGraphs` and `freshness` come back empty arrays.
- **Proof.** Write to `.cursor/skills/verify-magicsync/evidence/analytics-dashboard/`: the empty dashboard, the open range list, the trigger after choosing 90, and the CSV.

## Gotchas

- **Wait for the heading, not for text.** The performance block renders after the mount fetches resolve. Reading text before it lands produces a false "section missing".
- **The range picker is one trigger, not a set of buttons.** `getByRole('button', { name: '7 days' })` and `{ name: '7 Days' }` both resolve to 0. The collapsed trigger shows only the number and the options carry the word Days. Click the trigger, then click the option.
- **Two buttons on the page share the accessible name `Show popup`.** The range trigger and the header language picker both report it, whatever number the picker is showing. Scope to the toolbar that holds the Platform Performance heading or the click fails on strict mode.
- **`30` on a fresh load is correct.** The default range is 30 days.
- **A reload puts the tables back on 30 days.** Reopening the page asks for 30 days again, so only a change made in the current session reaches the tables. Assert the trigger text after switching, never the tables.
- **Everything below the totals is data-gated.** Platform cards, freshness chips, Best Times to Post and Top Posts do not render with no metrics. Best Times is gated further, on at least one recommended slot.
- **Top Posts has no empty state.** The section renders only when it has rows, and the `noTopPosts` string sits unused in the locale file. Do not assert an empty-state message for it.
- **The `+0.0%` deltas prove nothing.** They come from a `growth` field that does not exist with no metrics. They are not a zero-growth account.
- **Comparison is dead code.** The route serves `mode: 'comparison'` and the composable defines the call, but the dashboard never makes it, so no prior-window delta is ever drawn. Do not go looking for a comparison block.
- **The dashboard is user scoped.** It sends no business id, so two businesses under one account read the same numbers.
- **There is no `h1` on `/app`.** The word Dashboard is plain text in the layout. Assert the Platform Performance heading instead.
- **`findings.json` in this evidence folder is stale.** It records `platformPerformance: false` and `rangeTriggerCount: 0`, and `02-range-90.aria.txt` stops before the performance block ever rendered. Re-run rather than trusting either file.