# Auto-reply campaigns

Auto-reply lets a user define keyword campaigns on their own Instagram posts.
When someone comments a matching keyword, the app sends that person a private
reply carrying tracked short links, and can post a public reply too. A user
builds a campaign from a preset or a blank form, tries a sample comment against
it, and then watches sends, skips, failures, and link clicks.

## Sub-features

- `autoreply-open` loads the campaign list at `/app/auto-reply`.
- `autoreply-create` opens the new-campaign dialog.
- `autoreply-presets` fills the form from a **Link magnet**, **Discount code**, or **Webinar** preset.
- `autoreply-keywords` takes comma-separated keywords, up to 10.
- `autoreply-match-mode` chooses whole-word or partial matching.
- `autoreply-posts` picks the Instagram posts to watch. Needs a connected Instagram account.
- `autoreply-template` composes the DM with `{username}`, `{link1}`, and `{link2}`.
- `autoreply-links` takes up to two links, each with a label and an `https` URL.
- `autoreply-test` runs a sample comment against the form's keywords and reports a hit or a miss.
- `autoreply-stats` shows sent, skipped, and failed in the DM logs modal.
- `autoreply-clicks` shows a per-link click count on the campaign card, and a total with click-through rate on the detail page.
- `autoreply-toggle` disables a campaign so it stops sending.
- `autoreply-delete` removes a campaign.
- `autoreply-webhooks` shows the Meta callback URL and a subscribe control per page.

## How to get to it (user POV)

- Choose **Auto-Reply** in the sidebar.
- Choose **Auto-Reply** in the dashboard quick actions.
- Open `/app/auto-reply` directly.
- Open a campaign by choosing its name or **View details** on its card.

## Driving it with Playwright

Preconditions:

- Doctor passes.
- A throwaway user is logged in. Create an active business with
  `createActiveBusiness()`, which most `/app` routes expect.
- Creating a campaign needs a connected Instagram account. Without one, the
  list shows **No campaigns yet. Create your first LINK → DM automation.** with
  a **Connect accounts** button, and the dialog can still be opened to prove the
  presets, the field layout, and the matcher.

- **Open the list.** Navigate. Run `page.goto('http://localhost:3000/app/auto-reply')` then `waitForHydration(page)`. The heading `Auto-Reply` is visible.
- **Open the create dialog.** Run `page.getByRole('button', { name: 'New campaign' }).click()`. Run `await page.getByRole('dialog').filter({ hasText: 'New campaign' }).count()` and expect `1`.
- **Read the field order.** Inspect the dialog from top to bottom. It starts with a **Presets:** row, then **Campaign name**, **Instagram account** reading `Select account`, **Watched post IDs (up to 20, comma separated)** with the placeholder `1789..., 1790...`, a **Select posts** button, **Watch all posts from this account**, **Keywords (comma separated)**, **Match mode** reading `Whole word`, **DM template (use , , )**, **Link 1 label**, **Link 1 URL (https)**, **Link 2 label**, **Link 2 URL (https)**, **Optional public reply (e.g. Sent you a DM!)**, and three switches for AI-personalized replies, story replies and inbound DMs, and the follow gate.
- **Apply a preset.** Choose **Link magnet**. Run `page.getByRole('button', { name: 'Link magnet' }).click()`. The keywords field reads `LINK, INFO` and the DM template reads `Hey {username}! Here is your link: {link1}`.
- **Read the post picker gate.** Inspect **Select posts**. It is disabled while no Instagram account is chosen.
- **Dry-run the matcher.** Run `page.getByRole('textbox', { name: /try your keyword/i }).fill('LINK please!')` then `page.getByRole('button', { name: 'Test' }).click()`. A result line reads `Matched: LINK`.
- **Dry-run the miss.** Change the sample to `nice picture` and run **Test** again. The result line disappears. A miss renders nothing, so assert the absence of the `Matched:` line rather than any "No match" text.
- **Confirm the matcher stays local.** Start recording requests before you click **Test** in the create dialog. The browser issues no request. The same control on `/app/auto-reply/[id]` posts to `/api/v1/auto-reply/campaigns/[id]/test`.
- **Create.** With a connected Instagram account, fill **Campaign name**, pick the account, and choose **Create campaign**. Run `authed.get('/api/v1/auto-reply/campaigns')` as the second view and expect the campaign in `data`.
- **Read the stats modal.** Choose **DM logs** on the card. The modal shows sent, skipped, and failed. It does not show clicks.
- **Read clicks.** Choose **View details** on the card to open `/app/auto-reply/[id]`. The detail page shows a total click count and a click-through rate, plus a per-link breakdown.
- **Toggle.** Scope to the campaign card and turn its switch off. Run the same against the card that holds the campaign name, never a bare `getByRole('switch')`. The card text switches to `Disabled`.
- **Delete.** Scope to the same card and choose **Delete**. The card disappears, and `authed.get('/api/v1/auto-reply/campaigns')` no longer lists it.
- **Reject an insecure link.** Save a campaign whose link target is `http://`. The save fails with a validation error. Assert the rejection, never the stored value.
- **Proof.** Write to `.cursor/skills/verify-magicsync/evidence/auto-reply-campaigns/`: the list, the dialog with the presets and every field, the matcher hit and miss, and both API responses.

## Gotchas

- **The matcher label is `Try your keyword`.** The 2026-10-02 map told a driver to
  look for a `test` input. The real accessible name is `Try your keyword`, and
  the button beside it reads exactly `Test`.
- **A matcher miss renders nothing.** The result line only appears on a hit, so
  assert the absence of the line. Waiting for a `No match` string times out on
  correct behaviour.
- **The DM template label loses its placeholders.** It renders as
  `DM template (use , , )`, because the braces are consumed before you see
  them. The stored copy still contains `{username}`, `{link1}`, and `{link2}`.
- **The matcher in the create dialog makes no request.** It is a local regex in
  the browser. Only the detail page calls
  `POST /api/v1/auto-reply/campaigns/[id]/test`. The old map claimed the create
  form posts to that endpoint, which is wrong.
- **Creating a campaign requires a connected Instagram account.** The picker
  lists only connected Instagram rows, **Select posts** stays disabled without
  one, and the create route rejects an empty account. With no Meta connection the
  form proves the presets, the field layout, and the matcher, and nothing more.
- **`getByRole('switch')` is ambiguous.** The create dialog holds four switches
  and every campaign card holds one more. Scope to the dialog or to the card that
  holds the campaign name.
- **Stats are split across two surfaces.** The list modal shows sent, skipped,
  and failed. Clicks and click-through rate live on the detail page, with a
  per-link count on the card itself. The old map claimed clicks appear in the
  list modal.
- **The card footer has four buttons that repeat across cards.** **View details**,
  **Save**, **DM logs**, and **Delete** all appear once per campaign. Scope them
  to the card that holds the campaign name.
- **The heading is English only.** `Auto-Reply` is the English string. Spanish,
  German, and French differ, so do not assert the English heading on a
  non-English locale.
- **Never assert a real DM was sent.** Delivery needs Meta App Review with
  advanced access, which the PRD records as unresolved. Prove the matcher and the
  management surface only.
- **Keywords are capped at 10 entries and links at 2.** A longer keyword list is
  silently truncated, and a third link is rejected by validation.
- **A miss in whole-word mode is not a bug.** Matching is whole-word and
  case-insensitive by default. A substring only matches in partial mode.
- **Watched post IDs are Instagram media IDs**, the long numbers, not internal
  post IDs. Using **Select posts** avoids the mistake.
- **A campaign on a fresh account returns an empty array.** `GET
  /api/v1/auto-reply/campaigns` returns `200` with `data` as `[]`. That is the
  second view for an empty list, not a failure.