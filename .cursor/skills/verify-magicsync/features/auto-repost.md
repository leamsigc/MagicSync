# Auto-repost

Auto-repost recycles a published post on a schedule. A user opens the page for one
post, types or pastes its id, turns the rule on, sets the hours between reposts and
the largest number of reposts allowed, and saves. The page then reports how many
reposts have happened and when the next one is due. The page lists nothing, holds
one post at a time, and offers no picker, so the id is always entered by hand. A
test environment can prove the stored rule but not a repost, because reposting
needs a published post and live platform credentials.

## Sub-features

These are step names, not selectors. The page carries no test hooks at all.

- `repost-open` loads the configuration page.
- `repost-load` fetches the stored rule for the id in the box.
- `repost-toggle` turns the rule on or off.
- `repost-interval` sets the hours between reposts, 1 to 168.
- `repost-cap` sets the largest number of reposts, 1 to 20.
- `repost-save` persists the rule and toasts the outcome.
- `repost-summary` shows the current count and the next repost time.

## How to get to it (user POV)

- Open `/app/posts/auto-repost` directly. Nothing in the app links to it, and the
  post list has no entry for it.
- Open `/app/posts/auto-repost?postId=<id>` to load one post on arrival.
- To switch to a different post, type another id into the Post ID box and press the
  **Current Count** button.

## Driving it with Playwright

Preconditions:

- Doctor passes on `http://localhost:3000`.
- A throwaway user from `createTestUser()` is logged in with `loginWith()` and owns
  a business from `createActiveBusiness()`.
- One post is seeded for that business. Run
  `authed.post('/api/v1/posts', { data: { businessId: business.data.id, content: 'auto-repost seed', targetPlatforms: [accountId], status: 'draft' } })`
  and read the post id off `body.data.id`. `accountId` comes from
  `createTestAccount(user.id, business.data.id)`.
- `test.setTimeout(300000)`.

- **Seed the post.** Run the create call above. The response is `200` and
  `body.data.id` is the id you will configure.
- **Open the page with the post in the query.** Run
  `page.goto(\`http://localhost:3000/app/posts/auto-repost?postId=${post.id}\`)` then
  `waitForHydration(page)`. The heading `Auto-Repost` shows and the text beneath it
  reads `Configure automatic reposting for your content`.
- **Confirm there is nothing to select from.** Run
  `expect(page.locator('[data-test]')).toHaveCount(0)`. Then select every control by
  role, label, or input type, because no test hook exists on this page.
- **Confirm the shape of the form.** Run
  `expect(page.getByRole('switch')).toHaveCount(1)`,
  `expect(page.locator('input[type="number"]')).toHaveCount(2)`, and
  `expect(page.getByRole('button', { name: /save configuration/i })).toBeVisible()`.
  There is no grid, table, or card of posts anywhere on the page.
- **Load the rule.** Run
  `page.getByRole('button', { name: 'Current Count' }).click()`. For a post that was
  never configured the summary line reads `Current Count: undefined`. That is the
  correct state for a fresh post, not a failure.
- **Turn the rule on.** Run `page.getByRole('switch').click()`. The label beside the
  switch reads `Auto-repost enabled`.
- **Set the interval.** Run `page.getByLabel('Interval (hours)').fill('48')`. The
  fallback handle is `page.locator('input[type="number"]').first().fill('48')`.
- **Set the cap.** Run `page.getByLabel('Maximum Reposts').fill('5')`. The fallback
  handle is `page.locator('input[type="number"]').nth(1).fill('5')`.
- **Save.** Run
  `page.getByRole('button', { name: /save configuration/i }).click()`. A toast titled
  `Configuration saved successfully` appears.
- **Second view, the API.** Run
  `authed.get(\`/api/v1/posts/auto-repost/${post.id}/config\`)`. `body.config` holds
  `enabled: true`, `intervalHours: 48`, `maxReposts: 5`, `currentCount: 0`, and a
  `nextRepostAt` string.
- **Survive a reload.** Run `page.reload()` then `waitForHydration(page)`. The
  interval box reads 48, the cap box reads 5, and the summary prints
  `Current Count: 0`.
- **Bound the interval.** Run
  `authed.post('/api/v1/posts/auto-repost/configure', { data: { postId: post.id, enabled: true, intervalHours: 200 } })`
  and get a `400`. Repeat with `intervalHours: 0` and get a `400`.
- **Bound the cap.** Repeat the configure call with `maxReposts: 50` and then
  `maxReposts: 0`. Each returns a `400`.
- **Prove the unknown post.** Run
  `authed.get('/api/v1/posts/auto-repost/post_does_not_exist/config')`. It returns
  `404`, not `500`.
- **Proof.** Capture the loaded form, the filled form, the success toast, and the
  page after the reload. Write numbered screenshots with
  `page.screenshot({ path: \`${EVIDENCE}/NN-<step>.png\`, fullPage: true })` into
  `.cursor/skills/verify-magicsync/evidence/auto-repost/`, and save the two API
  bodies beside them.

## Gotchas

- **No test hooks exist.** The count of `data-test` attributes on this page is zero.
  Every `repost-*` selector written into the 2026-10-02 map resolves to nothing.
- **Nothing links here.** A grep across `packages/site/app` and
  `packages/scheduler/app` finds the string `auto-repost` only in the page itself.
  Open the URL directly or the step never runs.
- **A draft post saves fine.** `postService.findById` filters on the post id and the
  user id and nothing else, so configuring a draft returns success. The 2026-10-02
  map claimed a draft silently fails. It does not.
- **You cannot prove a repost happens.** `getDueReposts` hard-filters
  `status = 'published'`, and a test environment has no platform credentials. Stop at
  the stored rule and say so in your report.
- **Do not wait for `repost:process`.** It sits on a `*/15 * * * *` cron alongside
  the other scheduler tasks. Assert the stored rule, not an observed repost.
- **The response key is `config`,** not `autoRepost`. Asserting `body.autoRepost`
  yields undefined and reads as a failure.
- **An empty config is still truthy.** A post that was never configured returns
  `success: true` with `config: {}`, so the page fills the inputs from nothing and
  prints the literal text `Current Count: undefined`.
- **Typing an id does not load it.** The stored rule is fetched on mount from the
  query string and by the **Current Count** button only. Press the button after
  changing the id or you will read the previous post's rule.
- **The `enable` and `disable` locale keys are dead.** The switch label comes from
  `enabled` and `disabled`, which resolve to `Auto-repost enabled` and
  `Auto-repost disabled`.
- **A config read failure points at stored data.** `posts.auto_repost` is a JSON
  column and a malformed value parses to an empty object rather than raising.