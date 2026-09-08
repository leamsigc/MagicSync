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

## Standard vs Advanced access (who actually receives DMs)

> **If the commenter is not on your app's tester list (and you lack Advanced
> access), commenting the keyword does nothing for them.** Read that twice —
> it is the single most misunderstood part of this feature.

With **Standard access** (the default — no App Review yet), the messaging
permissions (`instagram_manage_messages`, `pages_messaging`,
`instagram_business_manage_messages`) only apply to Instagram accounts that
have a **role on your Meta app** (admin, developer, or accepted Instagram
tester). Here is exactly what happens when someone **without** a role comments
your keyword:

1. The poll reads their comment normally — reading is not gated.
2. The keyword matches normally.
3. The DM send is rejected by Meta with `100/33` ("does not exist …
   missing permissions").
4. You (the owner) get a **`failed` log row** with Meta's message — so the
   attempt is visible to you in the campaign's Logs drawer.
5. The commenter gets **nothing**: no DM, and no public reply either (the
   public reply is only posted after a successful DM).

Retrying changes nothing: the poll cursor moves past the comment, and every
future comment from that user fails the same way until access changes.

Publishing the app (Live mode) does **not** widen this — Live + Standard
still only covers role accounts. DMs to real followers need **Advanced
access**, granted only through App Review (business verification first).
Practical rule: **testers for your own accounts, App Review for strangers.**
Full path: [Meta App Review](./meta-app-review).

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
| `failed` row with Meta's message | Permission/token problem: reconnect the account (scopes), check Messages access is on (IG Settings → Privacy → Messages). If the message is Meta `100/33` ("does not exist … missing permissions"), the **commenter has no app role and you lack Advanced access** — add them as testers or complete [App Review](./meta-app-review). |
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
- Standard access only covers role/tester accounts — real followers need
  Advanced access ([App Review](./meta-app-review)).

## Set it up with an AI assistant

Adapted from [openreply's AI-assistant setup](https://github.com/diwenne/openreply/blob/main/docs/setup.md#set-it-up-with-an-ai-assistant).
If you run an AI coding assistant, it can drive most of this inside a clone of
this repo. Paste the prompt below. Only share secrets with a tool and
environment you trust, and rotate them afterward if unsure.

MagicSync differences the assistant must respect: single Nuxt container (no
separate worker/Redis — the DB-backed `autoreply_seen` queue + `autoreply:process`
Nitro task every 15m is the job system); all auto-reply state lives in
`entity_details` (zero migrations — `db:generate` must stay clean); webhooks
live at `/meta/webhooks` (public, HMAC-verified) and Pages subscribe from the
**/app/auto-reply** webhook card, not the Meta dashboard alone.

```
You are helping me set up MagicSync's auto-reply (Instagram comment-to-DM
automation) in this repository. Read packages/doc/guide/auto-reply.md and
.aiContext/PRD-AUTO-REPLY.md first, then help me get it working end to end.

My goal: <describe it. For example: DM a link to anyone commenting LINK on my
reel, or test with my own two accounts only.>

Work through this in order and stop to ask me whenever you need a value or an
action only I can do:

1. Environment. Confirm NUXT_META_WEBHOOK_VERIFY_TOKEN is set and tell me the
   public /meta/webhooks callback URL for this deploy.

2. Webhooks. Walk me through subscribing comments/messages/story_mentions in
   the Meta dashboard plus the Subscribe Page button in /app/auto-reply, using
   my public URL. Local dev needs a tunnel — localhost never works.

3. Campaign. Help me create one (watch-all or specific media, 1-10 keywords,
   DM template with {username}/{link1}, up to 2 https links).

4. Access check. Tell me plainly who can receive DMs under my app's current
   access: Standard = only role/tester accounts; real followers need Advanced
   via App Review. If my commenter isn't covered, have me add them as a tester
   (both halves: dashboard invite + accept inside Instagram) before testing.

5. Test. Have me comment the keyword from the second account (never the
   business itself — self-DMs are rejected), then confirm a `sent` row in the
   campaign Logs drawer and the DM on the receiver.

Rules for you:
- Never invent Meta dashboard steps. If a screen does not match the guide, ask
  me to screenshot it.
- Diagnose from the campaign Logs drawer first (sent/skipped/failed + reason),
  then the audit log (plugin category) for Meta's raw error. A 100/33 means
  the commenter lacks an app role under Standard access — say so directly.
- Never write raw Drizzle queries in routes; use the service layer. Never
  commit secrets. All Vue components use <script setup>.
- Remind me to rotate any secret I paste to you before real use.

Start by reading the docs, then ask me about my goal and my Meta app state.
```

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
