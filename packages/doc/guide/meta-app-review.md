# Meta App Review — Advanced Access for Auto-Reply

> **Without Advanced access, auto-reply DMs only reach testers.** If someone
> who is not on your Meta app's tester list comments your keyword, the poll
> reads the comment, the keyword matches, Meta rejects the DM (`100/33`), a
> `failed` row lands in your campaign logs — and the commenter receives
> **nothing**. Retries never fix it. You need App Review if people who are not
> testers on your app should receive DMs. Running MagicSync for your own
> accounts? Add them as testers and skip this entirely.

MagicSync uses the official Meta Graph APIs to send a private reply when someone comments a keyword on a connected Instagram professional account's post or reel (OpenReply parity).

Adapted from [openreply's META_APP_REVIEW.md](https://github.com/diwenne/openreply/blob/main/META_APP_REVIEW.md) and [setup guide](https://github.com/diwenne/openreply/blob/main/docs/setup.md#set-it-up-with-an-ai-assistant).

## Permissions to request

| Permission | Used for |
|---|---|
| `instagram_manage_messages` | Sending the keyword DM (`POST /{comment-id}/private_replies`) |
| `instagram_manage_comments` | Reading comments, optional public reply under the comment |
| `instagram_business_manage_messages` | Same as above via Instagram Login product |
| `instagram_business_manage_comments` | Same as above via Instagram Login product |
| `instagram_business_basic` | Identifying the connected professional account |
| `pages_messaging` | Page-linked conversation access (inbox read/reply) |
| `pages_manage_metadata` | Subscribing the Page to webhooks (`/{page-id}/subscribed_apps`) |

## Permission justifications

Paste these into the App Review request, adjusted to your wording.

`instagram_manage_messages`. When a follower comments a keyword the account owner configured (e.g. LINK) on the owner's own Instagram post or reel, MagicSync sends that follower a one-time private reply with content the owner wrote — typically a link the follower asked for by commenting. One reply per matching comment, per-commenter cooldown, 750/account/hour cap with overflow retried, never dropped.

`instagram_manage_comments`. We read comments on the connecting account's own media to match keywords, and — only if the owner enabled it — post one public reply under the matching comment (e.g. "Sent you a DM!"). We never act on other accounts' media.

`instagram_business_manage_messages` / `instagram_business_manage_comments`. Same flows as above for accounts connected via Instagram Login instead of Facebook Login.

`instagram_business_basic`. We use this to identify the connected Instagram professional account after authorization, so campaigns, logs, and stats attach to the right account.

`pages_messaging`. Powers the unified inbox: the owner reads Instagram/Facebook conversations and replies inside Meta's 24h customer-service window. Replies are manual, one per send.

`pages_manage_metadata`. Subscribes the owner's Page to the `comments`, `messages`, and `story_mentions` webhooks so DMs arrive in seconds instead of on the 15-minute poll.

## Screencast script

Record on your published app, real accounts, one take, about two to three minutes. Narrate each step.

1. Sign in to MagicSync.
2. Go to Connect accounts and click connect Instagram. Show the consent screen with the permissions being granted.
3. Open Auto-Reply, create a campaign on a recent post with keyword `LINK`, a DM message, one link, save.
4. On a second phone/account, comment `LINK` on that post.
5. Show the second account receiving the DM, and the public reply appearing under the comment (if enabled).
6. Back in MagicSync, show the campaign's DM Logs drawer with the `sent` row and the per-link click counter.

Reviewers want to see the permission produce a real result for a real user. This flow does that directly.

## Compliance positioning

- The app never scrapes Instagram and never asks for a password — all access is OAuth with the scopes above.
- It only ever acts on comments left on the connecting account's **own** content, and only sends DMs the account owner configured.
- Nobody can be DM'd twice for the same campaign (per-commenter cooldown); hourly caps prevent spam bursts.
- Users disconnect anytime from Connect accounts — tokens are deleted immediately and all sends stop within one poll tick.
- Access tokens are never written to logs or audit rows (only presence/IDs are logged).
- Data deletion instructions live at `/data-deletion`; privacy policy at `/privacy-policy`.

## Business verification

Meta usually requires business verification before granting Advanced Access. It asks for a document proving a legal entity: a business registration or license (e.g. Gewerbeschein), articles of incorporation, a business tax document, or a business bank statement — with legal name and address matching the portfolio's Business info exactly.

If you do not have a registered business, you cannot complete this step. The practical path is then tester-mode for your own accounts (no review needed), or registering first — for developers in Germany a Gewerbe registration or Freiberufler tax confirmation is the usual route. As a Tech Provider-style app (sending on behalf of other businesses' accounts), expect the additional **access verification** step after business verification passes.

## Common rejection reasons (ours, 2026-09-08)

- `failed` log rows with Meta `100/33` ("does not exist … missing permissions") during testing mean the **commenter's account has no app role** — add them as testers before recording, or the screencast itself fails.
- Requesting `pages_messaging` is disabled until business verification completes — verify first, then add it to the draft.
- Keep the submission's permission list and the OAuth consent screen identical; reviewers compare them.
