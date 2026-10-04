# Business onboarding

A brand-new account cannot reach any app route until it has a business. Every
`/app` URL redirects to `/app/business/initial`, where the Organization Management
page offers one Add Business tile that opens a short wizard. The wizard asks for
six optional follow and star prompts, offers AI profile extraction, then falls
back to a manual form. Saving the form lands the user on `/app/integrations`,
the connect-accounts page, with the new business active.

## Sub-features

- `onboard-gate` bounces an account with no business off every app route to
  `/app/business/initial`.
- `onboard-empty` shows Organization Management with `No businesses found` and one
  Add Business tile.
- `onboard-step0` offers six optional follow and star prompts and reads
  `0 of 6 completed`.
- `onboard-step0-continue` stays disabled until all six prompts are done.
- `onboard-step0-skip` advances past the prompts without a network call.
- `onboard-step1-skip` skips AI extraction and lands on the manual form.
- `onboard-form` captures description, name, phone, address, website, and category.
- `onboard-save` creates the business and lands on `/app/integrations`.
- `onboard-api` returns the saved business on `data` from `GET /api/v1/business`.
- `onboard-unlock` lets the same account reach `/app` with the business active.

## How to get to it (user POV)

- Sign up, then open any app route. The app redirects to `/app/business/initial`.
- Open `/app/business/initial` directly.
- With a business in place, choose **Business** in the sidebar to open
  `/app/business`, and use the same Add Business tile for a second one.

## Driving it with Playwright

Preconditions:

- Doctor passes on `http://localhost:3000`.
- A throwaway user exists from `createTestUser()` and is logged in with
  `loginWith()`. The user must have no business yet.
- A unique run id and a business name built from it, so the saved row can be
  found again. Use `` const RUN = 'probe-' + Date.now() `` and
  `` const BIZ = 'Probe Business ' + RUN ``.
- A first hit on a cold route compiles on demand. Set `test.setTimeout(300000)`.

- **Land on the gated page.** Open any app route. Run
  `page.goto('http://localhost:3000/app/business/initial')` then
  `waitForHydration(page)`. The heading `Organization Management` is visible and
  the body reads `No businesses found`. On a brand-new account every app route
  lands here, so assert `page.url()` ends with `/app/business/initial`.
- **Open the wizard.** Choose the Add Business tile. Run
  `page.locator('[data-test="add-business-button"]').click()`. A dialog opens with
  the heading `Get Started`.
- **Read step zero.** The panel reads `0 of 6 completed` and lists six prompts
  from Star our GitHub Repository to Follow us on Facebook. Screenshot it.
- **Step zero blocks Continue.** Run
  `expect(page.getByRole('button', { name: 'Continue to Business Creation' })).toBeDisabled()`.
  Disabled on arrival is the correct state, not a bug.
- **Skip setup.** Choose **Skip Setup**. Run
  `page.getByRole('button', { name: 'Skip Setup' }).click()`. The extraction step
  appears. No network call fires.
- **Skip extraction.** Choose **Skip AI Extraction**. Run
  `page.getByRole('button', { name: /skip ai extraction/i }).click()`. The manual
  form appears with **Save Business**. Submitting a profile URL instead calls an
  LLM, so always take the skip path.
- **Fill the form.** Enter the values. Run
  `page.getByLabel('Business Name').fill(BIZ)`,
  `page.getByLabel('Phone').fill('+15550001111')`,
  `page.getByLabel('Address').fill('1 Test Street')`,
  `page.getByLabel('Website').fill('https://e2e.test')`,
  `page.getByLabel('Category').fill('software')`, and
  `page.getByLabel('Description').fill('Business created by the verify-magicsync skill')`.
  Screenshot before saving.
- **Save.** Choose **Save Business**. Run
  `page.getByRole('button', { name: /save business|create business/i }).click()`
  then `page.waitForURL('**/app/integrations')`. The wizard closes, the URL is
  `/app/integrations`, and the heading reads `Connect your social media accounts`.
- **Second view: the API.** Re-read through the real endpoint. Run
  `authed.get('/api/v1/business')`. `body.data` is the array of business profiles
  and one row's `name` equals `BIZ`.
- **Unlock.** Open the dashboard. Run `page.goto('http://localhost:3000/app')`
  then `waitForHydration(page)`. The app no longer redirects, and the header
  business switcher reads `Switch business: ` plus `BIZ`.
- **Proof.** Write to
  `.cursor/skills/verify-magicsync/evidence/business-onboarding/` as
  `NN-<step>.png`, each paired with a `.aria.txt` dump of the same step. The
  2026-10-04 run left `01-gated`, `02-step-zero`, `03-manual-form`, and
  `04-after-save`. Add the unlocked dashboard as a fifth.

## Gotchas

- A fresh account is redirected away from `/app`, `/app/business`, and every other
  app route. Driving `/app/business` on a new user bounces to
  `/app/business/initial` instead of showing the management page.
- `Continue to Business Creation` needs all six prompts done, so `Skip Setup` is
  the deterministic path and makes no network call.
- **Never count checkboxes here.** The checkbox control renders no
  `input[type=checkbox]`, so a count returns `0` even with six prompts on screen.
  Assert the `0 of 6 completed` text or the Continue button's disabled state.
- **Category resolves by label now.** `getByLabel(/^category$/i)` returns one
  match. The raw-key leak was fixed on 2026-10-02 by adding `category` to all
  four locales of the business page JSON, so the old advice to target it by name
  or placeholder is obsolete.
- **Saving lands on `/app/integrations`, not back on `/app/business/initial`.** The
  2026-10-02 map claimed otherwise and was wrong. Assert the integrations
  heading, not the wizard detaching.
- `GET /api/v1/business` puts the array directly on `data`, not on `data.data`.
  Asserting `body.data.data` reports a false failure.
- Skipping AI extraction stays client-side. Submitting a profile URL calls an LLM
  and stalls or fails without provider keys.
- Clean up the throwaway user with `cleanup.sh --purge-fixtures --yes`, never by
  deleting rows by hand.