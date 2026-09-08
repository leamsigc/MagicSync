# Auto-Reply — Comment-to-DM Automation

Someone comments `LINK` on your reel → they get the link by DM seconds later. Neither Later nor OpenPost has this — it is MagicSync's differentiator (OpenReply parity, Gap 16).

## How it works

```
Meta webhooks ──comments/messages/story_mentions──▶ POST /meta/webhooks
   (HMAC verified, idempotent ingest → autoreply_seen rows)
     │  inline drain (seconds) + 15m task backstop + poll reconciler
     ▼
AutoReply.service (scheduler layer, entity_details only — zero migrations)
  ├─ comment events → watched-post match → skip seen/dup · skip self · match keywords
  ├─ message events → storyDmEnabled campaigns → keyword match (referrals count)
  ├─ follow gate on DM events (fails open when Meta gives no signal)
  ├─ per-commenter cooldown (one DM per user per campaign, 2000 FIFO)
  ├─ rate check (in-memory + hourly counter ≤ 750/account, overflow retried next tick)
  ├─ send: sendPrivateReply(commentId) for comments, sendDirectMessage(igsid) for DMs
  ├─ optional public replyToComment() (comments only)
  └─ write autoreply_log row (sent | skipped | failed + reason)
```

No Redis/BullMQ needed (unlike openreply): the DB-backed `autoreply_seen`
queue + Nitro task is this repo's job architecture, and the receiver drains
inline so delivery stays at webhook speed.

## Create a campaign

1. Go to **/app/auto-reply** → **New campaign**.
2. Pick an **Instagram Business/Creator account** (must be connected via **/app/integrations**).
3. Choose watched posts: paste up to 20 external media IDs **or** enable **Watch all posts**.
4. Keywords: 1–10, e.g. `LINK, INFO`. Toggle **whole word** vs **partial**.
5. DM template: use `{username}`, `{link1}`, `{link2}`. Example:
   `Hey {username}! Here is your link: {link1}`
6. Links: up to 2, **https only**. They are sent as tracked short URLs (`/r/{campaign}/{link}`) with click counts — the Instagram private-replies API is **text-only**, so link buttons render as tappable URLs (honest limitation, shown in UI).
7. Optional public reply, AI mode (falls back to template on failure),
   **story-DM trigger** (`Reply LINK to this Story` works with no post involved),
   **follow gate** + follow prompt — then **Create**.

Presets: **Link magnet**, **Discount code**, **Webinar/event**.

## Instant delivery setup

Comment→DM in seconds needs Meta webhooks (else the 15 min poll still
delivers). One-time setup, all on the **/app/auto-reply** webhook card:

1. Set `NUXT_META_WEBHOOK_VERIFY_TOKEN` (random per deploy).
2. Paste the shown **callback URL** + verify token into the Meta app dashboard
   (Instagram object → subscribe `comments`, `messages`, `story_mentions`).
3. Click **Subscribe Page** per account. Publish the Meta app for live events.

Full click-path: [Facebook & Instagram integration](./facebook-instagram-integration#16-webhooks-auto-reply-instant-delivery--live).

## Test before going live

Use the **Try your keyword** box in the campaign form, or:

```bash
curl -X POST http://localhost:3000/api/v1/auto-reply/campaigns/<id>/test \
  -H "Cookie: <session>" -H "Content-Type: application/json" \
  -d '{"text":"LINK please!"}'
# → {"success":true,"data":{"matched":"LINK"}}
```

## Live end-to-end verification (Path A)

This is the one test that proves the whole integration: a real comment on a
real post producing a real DM through Meta's servers. Everything else
(unit tests, signed-payload drills, CRUD) proves our code; only this proves
Meta talks back. Budget an afternoon the first time — the Meta dashboard side
is the slow part, not the code.

**You need:** an Instagram Business/Creator account you control (the
*business*), a second Instagram account (the *commenter* — a personal account
is fine), and admin access to your Meta app.

### Step 1 — Webhook subscription (dashboard)

1. Meta app dashboard → **Webhooks** product → Instagram object → subscribe
   **`comments`**, **`messages`**, **`story_mentions`**.
2. Callback URL = your public `/meta/webhooks` URL, Verify Token =
   `NUXT_META_WEBHOOK_VERIFY_TOKEN`. Click **Verify and save**.
   - Local dev: expose port 3000 with a tunnel (ngrok, cloudflared) and use
     the tunnel URL — Meta must reach it publicly; `localhost` never works.
3. Use the field's **Test → Send to My Server** button (the *second* click —
   the first only previews). This proves Meta can reach you before any real
   event exists.

### Step 2 — Tester roles (both halves)

1. Dashboard → **App Roles** → invite the exact IG usernames of **both**
   accounts as Instagram testers.
2. On each phone: Instagram → profile → menu → Settings → **Apps and
   websites** → **Tester invites** → Accept. Until accepted here, login and
   events keep failing with "Insufficient Developer Role".

### Step 3 — Connect + campaign (MagicSync)

1. **/app/integrations** → disconnect + reconnect the IG account (picks up the
   message scopes granted at consent time).
2. **/app/auto-reply** → **Subscribe Page** for the account (expect
   `feed, messages` back).
3. **New campaign**: watch one reel (paste its media ID or enable Watch all),
   keyword `TEST`, DM template `Hey {username}! Here: {link1}`, one `https://`
   link. Keep it enabled.

### Step 4 — Comment test

1. From the **commenter** account (never the business itself — Meta rejects
   self-DMs and we log them as `skipped/self`), comment `TEST` on the reel.
2. Expect within seconds: a DM with your link on the commenter account, plus
   a `sent` row in the campaign's **Logs** drawer.

### Step 5 — Story + follow-gate tests

1. Enable the campaign's **story-DM toggle**. Reply `TEST` to one of the
   business's stories from the commenter account → link DM (`sent/story_dm`).
2. Enable the **follow gate**. Trigger from an account that does **not** follow
   the business → follow-prompt DM + `skipped/follow_gate`. Trigger from a
   follower → link DM (fails open when Meta sends no follow signal).

### If it fails — where did it stop?

| Observation | Meaning → fix |
|---|---|
| Dashboard Test → Send doesn't arrive | Meta can't reach you: wrong callback URL, tunnel down, or HMAC failing (check server logs for `401`). App still in Development is fine for this button. |
| Real comment arrives, no DM, **no log row at all** | Event never reached the app: fields not subscribed, app not **Live** (dev mode only delivers Test clicks), or account lacks an app role (Step 2). |
| `failed` row with Meta's message | Permission/token problem: reconnect the account (scopes), check Messages access is on (IG Settings → Privacy → Messages). |
| `skipped/self` | You commented from the business account — expected, use the second account. |
| `skipped/follow_gate` | Gate working as designed — test from a follower for the link path. |
| `rate_limited_750` | Hourly cap — retries automatically next tick. |
| DM arrives but link URL is wrong | Campaign links misconfigured — edit the campaign, links re-render per send. |

## Monitor

- Campaign cards: enable switch + click counters + story/follow badges.
- **Logs** drawer: per-comment `sent | skipped | failed + reason` (`self`,
  `cooldown`, `dup`, `no-match`, `follow_gate`, `story_dm`, `inbound_dm`,
  `rate_limited_750`, `ai_fallback`).
- **Stats** endpoint: `GET /api/v1/auto-reply/campaigns/:id/stats` → `{ sent, skipped, failed, clicksPerLink[] }`.
- Failures (rate/window errors) notify the owner **once per hour** (`autoreply` notification event).
- **/app/inbox → Messages tab** reads + replies to IG DMs (24h Meta window).

## Limits & trade-offs

- Without webhooks configured, delivery falls back to the **15 min** poll (same cadence as `social:post`).
- 750 DMs/account/hour cap; overflow is retried next tick, never dropped.
- Same user gets **one DM per campaign** (cooldown).
- Follow gate **fails open** (sends the link) when Meta returns no follow
  status — like openreply — so real followers are never trapped.
- Dev-mode Meta apps only deliver dashboard Test events; publish for live ones.

## API reference

| Method | Route |
|---|---|
| GET | `/api/v1/auto-reply/campaigns` |
| POST | `/api/v1/auto-reply/campaigns` |
| GET / PUT / DELETE | `/api/v1/auto-reply/campaigns/:id` |
| GET | `/api/v1/auto-reply/campaigns/:id/logs?limit=25` |
| GET | `/api/v1/auto-reply/campaigns/:id/stats` |
| POST | `/api/v1/auto-reply/campaigns/:id/test` |
| GET | `/api/v1/auto-reply/webhooks/status` (callback URL + token state) |
| POST | `/api/v1/auto-reply/webhooks/subscribe` (`{ socialAccountId }`) |
| GET (public) | `/meta/webhooks` (Meta verify handshake) |
| POST (public) | `/meta/webhooks` (HMAC receiver, always fast 200) |
| GET (public) | `/r/:campaign/:link` → 302 + click count |

## Storage (zero migrations)

All state lives in `entity_details` (`autoreply_campaign`, `autoreply_state`,
`autoreply_log`, `autoreply_link`, `autoreply_seen`). Proof:
`pnpm --filter @local-monorepo/db db:generate` outputs **no changes**. See also [Facebook & Instagram integration](./facebook-instagram-integration).
