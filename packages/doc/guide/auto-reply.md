# Auto-Reply — Comment-to-DM Automation

Someone comments `LINK` on your reel → they get the link by DM seconds-to-minutes later. Neither Later nor OpenPost has this — it is MagicSync's differentiator (OpenReply parity, Gap 16).

## How it works (Phase A)

```
Instagram comments (polled, no webhooks yet)
  │  Nitro task `autoreply:process` every 15 min
  ▼
AutoReply.service (scheduler layer, entity_details only — zero migrations)
  ├─ due campaigns → fetch comments via IG plugin getComments()
  ├─ skip seen (cursor) · skip self · match keywords (whole/partial, unicode-aware)
  ├─ per-commenter cooldown (one DM per user per campaign, 2000 FIFO)
  ├─ rate check (in-memory + hourly counter ≤ 750/account, overflow retried next tick)
  ├─ send DM: InstagramPlugin.sendPrivateReply(commentId, text)
  ├─ optional public replyToComment()
  └─ write autoreply_log row (sent | skipped | failed + reason)
```

## Create a campaign

1. Go to **/app/auto-reply** → **New campaign**.
2. Pick an **Instagram Business/Creator account** (must be connected via **/app/integrations**).
3. Choose watched posts: paste up to 20 external media IDs **or** enable **Watch all posts**.
4. Keywords: 1–10, e.g. `LINK, INFO`. Toggle **whole word** vs **partial**.
5. DM template: use `{username}`, `{link1}`, `{link2}`. Example:
   `Hey {username}! Here is your link: {link1}`
6. Links: up to 2, **https only**. They are sent as tracked short URLs (`/r/{campaign}/{link}`) with click counts — the Instagram private-replies API is **text-only**, so link buttons render as tappable URLs (honest limitation, shown in UI).
7. Optional public reply, AI mode (falls back to template on failure), then **Create**.

Presets: **Link magnet**, **Discount code**, **Webinar/event**.

## Test before going live

Use the **Try your keyword** box in the campaign form, or:

```bash
curl -X POST http://localhost:3000/api/v1/auto-reply/campaigns/<id>/test \
  -H "Cookie: <session>" -H "Content-Type: application/json" \
  -d '{"text":"LINK please!"}'
# → {"success":true,"data":{"matched":"LINK"}}
```

## Monitor

- Campaign cards: enable switch + click counters.
- **Logs** drawer: per-comment `sent | skipped | failed + reason` (`self`, `cooldown`, `no-match`, `rate_limited_750`, `ai_fallback`).
- **Stats** endpoint: `GET /api/v1/auto-reply/campaigns/<id>/stats` → `{ sent, skipped, failed, clicksPerLink[] }`.
- Failures (rate/window errors) notify the owner **once per hour** (`autoreply` notification event).

## Limits & trade-offs

- Polling is every **15 min** (same cadence as `social:post`). ManyChat-instant DMs need **Phase B webhooks** (tracked in PRD, not built).
- 750 DMs/account/hour cap; overflow is retried next tick, never dropped.
- Same user gets **one DM per campaign** (cooldown).
- `followGate` flag + follow-prompt template ship in v1, but **enforcement needs webhooks** (Phase B).
- Story-DM triggers, follow-gate enforcement, and IG inbox read/reply are **Phase B**.

## API reference

| Method | Route |
|---|---|
| GET | `/api/v1/auto-reply/campaigns` |
| POST | `/api/v1/auto-reply/campaigns` |
| GET / PUT / DELETE | `/api/v1/auto-reply/campaigns/:id` |
| GET | `/api/v1/auto-reply/campaigns/:id/logs?limit=25` |
| GET | `/api/v1/auto-reply/campaigns/:id/stats` |
| POST | `/api/v1/auto-reply/campaigns/:id/test` |
| GET (public) | `/r/:campaign/:link` → 302 + click count |

## Storage (zero migrations)

All state lives in `entity_details` (`autoreply_campaign`, `autoreply_state`, `autoreply_log`, `autoreply_link`). Proof: `pnpm --filter @local-monorepo/db db:generate` outputs **no changes**. See also [Facebook & Instagram integration](./facebook-instagram-integration).
