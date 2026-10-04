# Social inbox

The social inbox gives a user one place to read comments, direct messages, and
notifications from every connected platform. Three tabs switch between those
kinds of item, and a platform filter plus an unread toggle narrow the list. On a
fresh account the list is empty in every tab, and each tab says so in its own
words.

## Sub-features

- `inbox-open` loads the inbox at `/app/inbox` with Comments, Messages, and Notifications tabs.
- `inbox-comments` lists comments across posts and platforms.
- `inbox-messages` lists direct messages. Needs a connected Facebook or Instagram account.
- `inbox-notifications` lists notifications. Nothing writes them, so the tab stays empty.
- `inbox-filter-platform` narrows the list to one platform.
- `inbox-filter-unread` shows only unread items, then flips its label to `Show all`.
- `inbox-empty` shows an empty state per tab.
- `inbox-reply` replies to a comment or a message in place. Needs an item to act on.
- `inbox-mark-read` clears read state. The control renders only when the unread count is above zero.

## How to get to it (user POV)

- Choose **Inbox** in the sidebar.
- Choose **Inbox** in the dashboard quick actions.
- Open `/app/inbox` directly.

## Driving it with Playwright

Preconditions:

- Doctor passes on `http://localhost:3000`.
- A throwaway user is logged in. Create an active business with
  `createActiveBusiness()`, which most `/app` routes expect.
- A connected account is not required. The empty states are the expected outcome
  for a fresh account, not a failure.

- **Open the inbox.** Navigate. Run `page.goto('http://localhost:3000/app/inbox')` then `waitForHydration(page)`. The heading `Inbox` is visible with the subtitle `Manage comments, messages, and notifications from all your connected platforms`.
- **Confirm the three tabs.** Read the tab bar. Run `await page.getByRole('tab').count()` and expect `3`. The names are `Comments`, `Messages`, and `Notifications`, and `Comments` is selected on load.
- **Read the Comments empty state.** Inspect the list region. It reads `No items in your inbox` and `When you receive comments, messages, or notifications, they'll appear here.`
- **Second view.** Run `authed.get('/api/v1/inbox')`. It returns `200` with `data.items` as an empty array, plus `data.unreadCount` and `data.nextCursor`. Run `authed.get('/api/v1/inbox/count')` to read the count on its own.
- **Read the platform filter.** Inspect the toolbar above the list. The trigger is a button whose accessible name is `Show popup`, and its visible text is the placeholder `All Platforms`.
- **Open the platform filter.** Run `page.getByRole('button', { name: 'Show popup' }).click()`. The option list opens.
- **Toggle unread.** Choose **Show unread**. Run `page.getByRole('button', { name: 'Show unread' }).click()`. The label flips to `Show all` and the empty state stays put. Assert the label, not the list.
- **Switch to Messages.** Run `page.getByRole('tab', { name: 'Messages' }).click()`. With no Facebook or Instagram account the panel reads `No Facebook pages connected`. The platform filter and the unread toggle are not on this tab.
- **Read the other Messages empty state.** Connect a Facebook page with `createTestAccount()`, then reload and open **Messages**. With a page connected and no threads the panel reads `No conversations found for this page.`
- **Switch to Notifications.** Run `page.getByRole('tab', { name: 'Notifications' }).click()`. The panel reads the same `No items in your inbox`.
- **Proof.** Write to `.cursor/skills/verify-magicsync/evidence/social-inbox/`: each of the three tabs with its empty state, the filter open, and the two API responses.

## Gotchas

- **`/inbox` is not a route.** The path is `/app/inbox`. The 2026-10-02 map sent a
  driver to `/inbox`, which returns a 404.
- **The tabs are tabs, not buttons.** Use `page.getByRole('tab', { name: ... })`.
  A `getByRole('button', { name: 'Messages' })` lookup finds nothing.
- **The platform filter is not a combobox.** Its accessible name is
  `Show popup`, and `All Platforms` is placeholder text. Target the button by
  `Show popup`.
- **`Comments` appears twice in the accessible tree**, as the tab and as the
  sidebar link. Scope to the tab bar or use `getByRole('tab', ...)`.
- **A throwaway account cannot prove a comment row.** Comment ingestion runs
  only in the `autoreply:process` scheduled task against real Instagram
  credentials. Assert the empty state and state plainly that comment retrieval
  was not exercised.
- **The Notifications tab can never fill.** It reads inbox items of type
  `notification`, and nothing in the repo writes that type. The notifications
  people actually receive live in a separate table that does get written, so
  this tab reads a store that stays empty. That is an open product decision,
  either mirror notifications into the inbox store or drop the tab. Do not
  report this tab as working.
- **The inbox store had no writer at all before 2026-10-04.** Auto-reply now
  mirrors each polled comment into it, so a comment can reach the Comments tab
  once real credentials exist. On any revision before that date no code wrote a
  row, and the empty Comments tab was structural rather than a seeding gap.
- **Messages is gated, the other two tabs are not.** Only Messages needs a
  connected Facebook or Instagram account.
- **No mark-read control renders on an empty inbox.** The header's
  `Mark all as read` button appears only when the unread count is above zero,
  and no per-item mark-read control is wired to anything. There is nothing to
  drive here.
- **The unread toggle changes nothing at zero items.** Assert the label flip
  from `Show unread` to `Show all`.
- **Message retrieval needs Meta scopes the app cannot self-grant.** A 500 on
  the Messages tab is a credential problem, not a UI defect. Record it as
  `verified-unreachable` with the route attempted.