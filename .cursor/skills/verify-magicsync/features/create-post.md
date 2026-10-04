# Create a social post

`/app/posts/new` renders the shared post composer. A user writes content, picks a
format, optionally attaches media or opens the AI rewriting tools, then saves a
draft, posts now, or schedules the post. The three footer actions stay disabled
until at least one connected account chip is picked. Any of them returns the user
to `/app/posts`.

## Sub-features

- `composer-open` loads `/app/posts/new` with the active business preselected.
- `composer-text` counts characters as the user types.
- `composer-format` offers Regular Post, Story, and Reel/Short, narrowed to the
  selected platforms.
- `composer-media` switches to the Media tab to attach assets.
- `composer-ai` opens the AI rewriting tools for the draft.
- `composer-preview` previews the post as POST, REEL, STORY, or SHORT.
- `composer-account` picks connected accounts from a row of platform chips.
- `composer-gate` keeps Save Draft, Post Now, and Schedule disabled until an
  account is picked.
- `composer-draft` saves with draft status and returns to `/app/posts`.
- `composer-now` publishes immediately to the selected accounts.
- `composer-schedule` queues the post for its scheduled time.
- `composer-list` shows the saved post on `/app/posts`.
- `composer-api` returns the saved post with its content on `data` from
  `GET /api/v1/posts`.

## How to get to it (user POV)

- Choose **Create post** in the dashboard quick actions.
- Choose **Posts** in the sidebar, then **Schedule Post** on `/app/posts`.
- Open `/app/posts/new` directly.

## Driving it with Playwright

Preconditions:

- Doctor passes.
- A throwaway user exists, is logged in, and owns a business. Call
  `createActiveBusiness(authed, user)`. Without one the app redirects to
  `/app/business/initial`.
- **The composer needs a connected account.** Call
  `createTestAccount(user.id, business.id)`. It seeds one Twitter account named
  `E2E Account`. Without a row the picker is empty and nothing can be saved.
- **The viewport must be at least 768px wide.** The Post Format and AI Tools
  labels sit in spans hidden below that width, so they lose their accessible
  names on a narrow viewport.
- A unique run id and the post text built from it, so the saved post can be found
  again. Use `` const RUN = '' + Date.now() `` and
  `` const POST = 'verify probe ' + RUN ``.
- The composer is client-heavy and its cold compile is the slowest in this map.
  Set `test.setTimeout(300000)`.

- **Open the composer.** Navigate. Run
  `page.goto('http://localhost:3000/app/posts/new')` then `waitForHydration(page)`.
  The heading `Create New Post` is visible and the business `combobox` shows the
  fixture business.
- **Read the blocked state.** All three footer buttons are disabled on arrival.
  Run `expect(page.getByRole('button', { name: 'Save Draft' })).toBeDisabled()`.
  Disabled before any account is picked is correct.
- **Write the post.** Enter content. Run
  `page.getByRole('textbox', { name: "What's on your mind?" }).fill(POST)`.
  The counter shows the character count.
- **Pick an account.** Run
  `page.locator('button:has(.logos\\:twitter), [class*="logos:twitter"]').first().click()`.
  The chip turns selected, a **Twitter** button appears beside **Master**, and the
  footer line reads `E2E Account  Status  Ready to Post`.
- **Read the enabled state.** Run
  `expect(page.getByRole('button', { name: 'Save Draft' })).toBeEnabled()`. Save
  Draft, Post Now, and Schedule all enable together, and only once an account is
  picked.
- **Choose a format.** Choose **Regular Post**. Run
  `page.getByRole('button', { name: 'Regular Post' }).click()`. Story and
  Reel/Short read disabled because the only account is Twitter, and the panel says
  `Available formats based on 1 selected platform`.
- **Open AI tools.** Choose **AI Tools**. Run
  `page.getByRole('button', { name: 'AI Tools' }).click()`. The rewrite controls
  appear. This calls an LLM, so assert that the controls opened and nothing more.
- **Preview.** Choose each platform. Run
  `page.getByRole('button', { name: 'POST' }).click()`, then `REEL`, then
  `STORY`, then `SHORT`. The preview card re-renders for each.
- **Capture before submit.** Screenshot the filled composer with the chip selected.
- **Save a draft.** Choose **Save Draft**. Run
  `page.getByRole('button', { name: 'Save Draft' }).click()` then
  `page.waitForURL('**/app/posts')`. The URL is `/app/posts` and a success toast
  reads `Post created successfully`.
- **Second view: the list.** The post is already on screen. Run
  `page.getByText(POST).first().waitFor()`, then reload
  `page.goto('http://localhost:3000/app/posts')` and assert it again.
- **Second view: the API.** Re-read through the real endpoint. Run
  `authed.get('/api/v1/posts?businessId=' + business.id)`. `body.data` is the posts
  array and one row's `content` equals `POST`.
- **Proof.** Write to `.cursor/skills/verify-magicsync/evidence/create-post/` as
  `NN-<step>.png`, each paired with a `.aria.txt` dump of the same step. The
  2026-10-04 run left `01-composer`, `02-account-selected`, `03-before-submit`,
  and `04-after-submit`.

## Gotchas

- **Never use `getByRole('button', { name: /show popup/i })` for the account
  picker.** That is the header language switcher. A drive that clicks it opens the
  locale menu, picks no account, and leaves every footer button disabled.
- **The account picker is a row of icon-only chips, not a combobox.** Each chip
  button carries only a platform icon and has no accessible name, so target it by
  icon. The business `combobox` above it is a different control.
- One shared condition drives all three footer buttons, and it reads true while
  the selection is empty. Disabled until an account is picked is correct, so do
  not rewrite a passing assertion that expects the opposite.
- The Post Format and AI Tools labels only exist at 768px and wider. Below that,
  `getByRole('button', { name: 'AI Tools' })` resolves nothing.
- **Save Draft used to fail on every run** with the toast `Scheduled time cannot
  be in the past`, because the form defaults the schedule time to now and the
  draft was submitted as a queued post. It was fixed on 2026-10-04 and now saves
  with draft status. A saved draft is never claimed by the batch publisher, so it
  stays a draft.
- After picking a Twitter account, Story and Reel/Short are disabled. That is the
  format list narrowing to the selected platform, not a broken control.
- The preview toggles are upper-case platform names (`POST`, `REEL`, `STORY`,
  `SHORT`) while the format buttons are title case (`Regular Post`, `Story`,
  `Reel/Short`). Two different controls, do not conflate them.
- **AI Tools opens controls, not results.** Without provider keys the call fails.
  Assert the controls opened rather than a generated caption.
- `/app/posts` offers Grid, Feed, Board, and Table views. Pick one explicitly with
  `getByRole('button', { name: 'Grid' })` or the assertion depends on whichever
  view persisted.
- One toast renders the raw key `toast.postCreatedPending` beside the success
  toast. Observed on 2026-10-04. It is an untranslated key, not a harness failure.