# Notifications

`/app/notifications` gives a user one place to decide which events reach them
in-app and which reach them by email, and to read the notifications they already
have. Each of the seven events carries an in-app switch and an email switch, so
the card holds fourteen. The route is owned by the `auth` package, so finding no
page under `packages/site` does not mean the route is gone.

## Sub-features

- `notif-open` loads the notifications page for the logged-in user.
- `notif-preferences-open` opens the preferences card, which is closed on load.
- `notif-events` lists seven event rows, each with a translated label and its raw slug as a caption.
- `notif-toggle-inapp` turns one event's in-app notifications on or off and persists it.
- `notif-toggle-email` turns one event's email choice on or off and persists it.
- `notif-tabs` switches the list between All and Unread.
- `notif-empty` shows the caught-up empty state on a fresh account.
- `notif-i18n` renders every event label as copy rather than a raw key.

## How to get to it (user POV)

- Choose **Notification** in the sidebar Settings group.
- Choose **Notification** in the header, the link between the dark-mode toggle and the language picker.
- Open `/app/notifications` directly.

## Driving it with Playwright

Preconditions:

- Doctor passes.
- A throwaway user is logged in. Preferences need no business, but most `/app`
  routes need one to be reachable at all.
- A fresh account has no notifications, so the list proof is the empty state.
  Drive the toggles for the behaviour.

- **Open the page.** Navigate. Run `page.goto('http://localhost:3000/app/notifications')` then `waitForHydration(page)`. The `h1` reads `Notifications` above the line `Stay updated with your latest notifications`.
- **Read the closed card.** Assert nothing else yet. The heading `Notification preferences` is absent and `page.getByRole('switch')` resolves to 0. That is the correct state on arrival.
- **Open the preferences.** Choose **Preferences**. Run `page.getByRole('button', { name: 'Preferences' }).click()`. The `h2` reads `Notification preferences` and fourteen switches are present.
- **Count the events.** Run `await expect(page.getByRole('switch')).toHaveCount(14)`. Seven labels are on screen in this order: `General`, `Post failures`, `Comment replies`, `Bulk operations`, `Invitations`, `Expiring connections`, `Auto-reply activity`.
- **Check for raw keys.** Run `await page.locator('body').ariaSnapshot()` and read the text. No label may read like `preferences.events.autoreply`.
- **Turn one off.** Choose the first in-app switch. Run `page.getByRole('switch').first().click()`. It reports `unchecked`.
- **Second view: the API.** Re-read the preferences. Run `authed.get('/api/v1/notifications/preferences')`. The body puts the array straight on `body.data` as seven objects shaped `{ event, inApp, email, customized, mutedUntil }`. The first row now reports `inApp: false` with `customized: true`. The API is the proof, the switch alone is not.
- **Switch tabs.** Choose **Unread**. Run `page.getByRole('tab', { name: 'Unread' }).click()`. The tab reports selected and the empty state stays.
- **Read the empty state.** Inspect the panel. It reads `No notifications` above `You're all caught up! No new notifications.`
- **Prove an unknown event is refused.** Send one. Run `authed.put('/api/v1/notifications/preferences', { data: { preferences: [{ event: 'not_a_real_event', inApp: false, email: false }] } })`. It fails schema validation. Keep the array wrapper or you are testing a different failure.
- **Proof.** Write to `.cursor/skills/verify-magicsync/evidence/notifications/`: the page with the card closed, the card open, the switch after the toggle, and the preferences API body.

## Gotchas

- **There is no bell.** The header entry is a link labelled `Notification` pointing at `/app/notifications`. Scope accessible-name searches to `main`, because a page-wide search also matches Nuxt DevTools chrome at the bottom of the page.
- **The preferences card is closed on load.** Click **Preferences** before touching a switch. A switch count of 0 on arrival is correct, not a broken page.
- **Seven events, not six.** `autoreply` is the seventh and renders `Auto-reply activity`. A six-row count is a stale assertion.
- **No `data-test` handles here.** The page carries `data-tour` attributes only. Do not write `data-test` selectors against it.
- **The list filters are tabs, not buttons.** Drive them with `getByRole('tab', { name: 'All' })` and `getByRole('tab', { name: 'Unread' })`.
- **Mute is backend-only.** No mute or unmute control exists, and the word does not appear on the page. `mutedUntil` is still accepted by the preferences PUT and returned on every row, so a drive can only reach it through the API.
- **The preferences PUT body is an array.** Send `{ preferences: [...] }` holding 1 to 20 rows. A bare `{ event: ... }` is a schema error, not an invalid-event error.
- **A camelCase regex misses lowercase keys.** A pattern like `/\b[a-z]+(?:[A-Z][a-z]+)+\.[a-zA-Z.]+\b/` matches camelCase names only, so it reports no raw keys while `preferences.events.autoreply` sits on screen. Read `page.locator('body').ariaSnapshot()` instead. A previous drive was fooled by exactly this.
- **The bare slug under each label is not a leak.** `autoreply` under `Auto-reply activity` is intended copy. Flag only a dotted `namespace.key`.
- **Email delivery is not live.** The card opens with `Email delivery is coming soon` and says the email choices are saved for later. Prove the in-app channel and the persisted row, then state plainly that the email path was not exercised.