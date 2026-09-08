# Facebook & Instagram Integration — Developer Guide

End-to-end reference for wiring MagicSync to Meta: what to click in the
[Facebook Developers dashboard](https://developers.facebook.com/), which env
vars to set, which scopes the code actually requests, and how tokens flow.
 Instagram has no separate OAuth in this codebase — it rides the Facebook
 Login flow and is resolved per-Page via `instagram_business_account`.

> Scope source of truth: `packages/auth/lib/auth.ts` → `socialProviders.facebook.scope`.
> If you change scopes there, mirror them in §4 below and force re-consent (§7).

## 1. What to add in the Facebook Developers dashboard

### 1.1 Create the app

1. [developers.facebook.com](https://developers.facebook.com/) → **My Apps → Create App**.
2. App type: **Business** (required for `pages_*` + Instagram Graph API).
3. Fill **App name** + contact email → Create. Save the **App ID** and
   **App secret** (Settings → Basic).

### 1.2 Add the product

Add product → **Facebook Login for Business** (covers Page OAuth, Instagram
Business login, and long-lived token exchange). There is no separate
"Instagram" product to add — the Instagram Graph API is called with the Page
token server-side (`graph.facebook.com/v25.0`, see
`packages/scheduler/server/services/plugins/*.plugin.ts`).

### 1.3 Facebook Login for Business → Settings (the important screen)

| Field | Value |
|---|---|
| **Valid OAuth Redirect URIs** (exact match, one per environment) | Dev: `http://localhost:3000/api/auth/callback/facebook` · Prod: `https://<your-domain>/api/auth/callback/facebook` (pattern: `NUXT_BETTER_AUTH_URL` + `/api/auth/callback/facebook`) |
| **Configuration ID** | Create a configuration under **Facebook Login for Business → Configurations**, copy its ID → `NUXT_FACEBOOK_CONFIG_ID` (the code passes it as `configId` in `auth.ts`; without it Business Login fails) |
| **Configuration permissions** | Open that same configuration → enable **every permission from §1.4** (`pages_manage_metadata`, `pages_messaging`, `instagram_manage_messages`, …). The config acts as an allow-list: Meta never grants a scope that isn't enabled here, no matter what `auth.ts` requests. Revisit this list each time a scope is added in code |
| Login with JavaScript / Embedded browser OAuth | Leave defaults unless you embed login in a WebView |

`redirect_uri_mismatch` (Error 400) always means the URI above is missing or
not character-identical (scheme, host, port, path, trailing slash).

### 1.4 Permissions → what to request (App Review)

Request these in **App Review → Permissions and Features**, matching the code:

| Scope (as in `auth.ts`) | Used by | Dashboard permission name |
|---|---|---|
| `email`, `public_profile` | Login identity | Approved by default |
| `pages_show_list` | List Pages at connect time | `pages_show_list` |
| `business_management` | Business asset access | `business_management` |
| `read_insights` | Page/post insights (`getStatistic`, `getPostInsights`) | `read_insights` |
| `pages_manage_posts` | Publish/update FB + IG media | `pages_manage_posts` |
| `pages_read_engagement` | Read comments, counts | `pages_read_engagement` |
| `pages_manage_engagement` | Reply/hide/delete comments | `pages_manage_engagement` |
| `instagram_basic` | IG profile + media reads | `instagram_basic` |
| `instagram_content_publish` | IG containers + `media_publish` | `instagram_content_publish` |
| `instagram_manage_insights` | IG insights metrics | `instagram_manage_insights` |
| `instagram_manage_comments` | `getComments` / `replyToComment` / hide | `instagram_manage_comments` |
| `instagram_manage_messages` ✅ | Auto-Reply `sendPrivateReply` + story-DM `sendDirectMessage` + IG inbox | `instagram_manage_messages` |
| `pages_messaging` ✅ | FB inbox DMs (`getConversations`) + required alongside the above for private replies | `pages_messaging` |
| `pages_manage_metadata` ✅ | Page webhook subscription (`POST /{page-id}/subscribed_apps` via **Subscribe Page** in `/app/auto-reply`) | `pages_manage_metadata` |

> After any scope change in `auth.ts`, every FB/IG account must **disconnect +
> reconnect** — Meta grants scopes at consent time only.

In **development mode** all of these work immediately but only for users with
a role on the app — add testers under **App Roles → Roles** (or use
**Test Users**). Production requires Business verification + App Review
approval per permission.

### 1.5 Business prerequisites (do this before connecting)

1. A **Facebook Page** where the connecting user has Admin/equivalent access.
2. An **Instagram Business or Creator account** (personal accounts cannot use
   the Graph API — calls return `(#200) Requires business account`).
3. Link them: Page **Settings → Linked Accounts → Instagram** (the connect
   UI surfaces `instagram_business_account.id` from this link and stores the
   row with `platform: 'instagram'`).
4. For Auto-Reply DMs, on the IG account enable **Settings → Privacy →
   Messages → Allow access to messages**.

### 1.6 Webhooks (Auto-Reply instant delivery — live)

Polling (15 min) stays as the reconciler backstop; webhooks deliver events in
seconds. Modeled on [diwenne/openreply](https://github.com/diwenne/openreply);
unlike openreply we need no Redis/BullMQ — events land as `autoreply_seen`
rows and the same sender path drains them inline + on the next task tick.

**Dashboard setup (all three steps required):**

1. **Add product → Webhooks.** In the product settings pick the **Instagram**
   object and subscribe to **`comments`**, **`messages`**, **`story_mentions`**.
   - `comments` → comment-to-DM (what most people come for).
   - `messages` → inbound DMs + story replies (what the campaign **story-DM
     toggle** runs on — without this the toggle looks enabled but never fires).
2. **Callback URL:** `https://<your-domain>/meta/webhooks`
   (local dev: expose port 3000 with a tunnel — Meta must reach it publicly).
   **Verify Token:** the value of `NUXT_META_WEBHOOK_VERIFY_TOKEN` (§2).
   Click **Verify and save** — the app echoes `hub.challenge` on token match
   (`GET /meta/webhooks`, `packages/site/server/routes/meta/`).
   - If the button is greyed out, re-paste the token (editing the URL clears it).
   - Use the **Test** button's *Send to My Server* (second click — the first
     only previews) to confirm delivery.
3. **Page subscription:** in MagicSync go to **/app/auto-reply → Subscribe
   Page** per IG account (`POST /{page-id}/subscribed_apps`, fields
   `feed,messages`). Needs `pages_manage_metadata` (§1.4).

**Security:** every POST is checked against `X-Hub-Signature-256` (HMAC-SHA256
over the raw body, trying FB then IG app secret — Meta signs with either),
timing-safe compare, 401 otherwise. Redeliveries are idempotent
(deterministic `seen::…` entityIds).

**Go-live gotchas (from openreply's setup guide):**
- Real events only arrive when the app is **Live** — in Development mode only
  the console Test button delivers. #1 cause of "nothing happens".
- Every IG account needs a **role on the app**: invite the exact IG username
  under App Roles → Instagram testers **and** accept it inside Instagram
  (profile → menu → Settings → Apps and websites → Tester invites). Published
  ≠ Advanced Access: Standard Access still covers only accounts with a role;
  strangers need App Review.
- Changing domains? Update the callback URL — Meta doesn't reliably follow
  redirects, so webhooks silently stop.

## 2. Env vars (never commit — `.env` only)

```bash
# Meta OAuth (Better Auth facebook provider: packages/auth/lib/auth.ts)
NUXT_FACEBOOK_CLIENT_ID=...        # Settings → Basic → App ID
NUXT_FACEBOOK_CLIENT_SECRET=...    # Settings → Basic → App secret
NUXT_FACEBOOK_CONFIG_ID=...        # Facebook Login for Business → Configurations → ID
NUXT_BETTER_AUTH_URL=http://localhost:3000  # prod: https://<your-domain>

# Meta webhooks (Auto-Reply instant delivery): random per deploy, paste the
# same value as Verify Token in the dashboard (§1.6)
NUXT_META_WEBHOOK_VERIFY_TOKEN=<openssl-rand-hex-32>

# Declared in packages/auth/nuxt.config.ts runtimeConfig (consumed by
# site + scheduler layers via NUXT_ prefix):
# NUXT_INSTAGRAM_CLIENT_ID / NUXT_INSTAGRAM_CLIENT_SECRET exist but IG login
# reuses the Facebook flow above — no separate IG callback in this codebase.
```

## 3. How the token flow works in code

```
User clicks Connect (/app/integrations)
  → Better Auth OAuth, provider `facebook`, scopes from auth.ts (§1.4)
  → POST /api/v1/social-accounts/facebook/{pageId}
      ├─ getAccessTokenHelper() resolves the Better Auth row token
      ├─ Facebook: fb_exchange_token → 60-day long-lived user token
      │   (page tokens inherit the user token's lifetime — skipping this
      │    is why page tokens used to die in hours)
      ├─ fetchPageInformation(pageId, token, { instagramId })
      └─ socialMediaAccountService.createOrUpdateAccount()
          platform = 'instagram' when instagram_business_account.id present,
          else 'facebook'. Tokens stored encrypted.
Later: token:health task warns on expiry; FB has no refresh tokens —
  renew via exchange + page token (POST /api/v1/social-accounts/refresh/{id}).
```

## 4. Connect an account in MagicSync

1. `pnpm site:dev` (port 3000), open **/app/integrations**.
2. **Facebook / Instagram → Connect**, grant the permission screen, pick the
   Page (IG badge shows when a Business account is linked).
3. Verify it appears under **Connected**. Tokens live encrypted in
   `social_media_accounts` — never exposed to the client
   (`sanitizeSocialMediaAccount` strips them from API responses).
4. **Account-ID trap:** IG rows store the professional `user_id` (the same ID
   Meta puts in webhook `entry.id`), never the app-scoped id. Accounts
   connected via Instagram Login *before* this fix store the wrong id and
   silently miss every webhook event (server logs show `webhook comment for
   unknown account`) — **disconnect + reconnect** such accounts once.

## 5. Auto-Reply extras (on top of §1–§4)

1. Scopes are already in `auth.ts` (§1.4: `instagram_manage_messages`,
   `pages_messaging`, `pages_manage_metadata`). After pulling, **reconnect**
   any account connected before the scope change.
2. `sendPrivateReply` calls
   `POST https://graph.facebook.com/v25.0/{comment-id}/private_replies?message=…`
   — text-only API, so campaign links are sent as tracked short URLs
   (`/r/{campaign}/{link}`), not buttons (stated in the UI). Story-DM triggers
   use `POST /{ig-user-id}/messages` (`sendDirectMessage`) instead, since a
   story reply has no comment to private-reply to.
3. Only works on **your own media's comments**; the business commenting on
   itself is skipped and logged as `skipped/self` (Meta rejects self-DMs).
4. Sandbox test: follow the full walkthrough in [Auto-Reply → Live end-to-end
   verification](./auto-reply#live-end-to-end-verification-path-a) — comment,
   story, and follow-gate tests with a per-step failure table. Without
   webhooks the 15 min `autoreply:process` poll still delivers
   (`scheduler/nuxt.config.ts`; trigger manually from Nuxt DevTools → Nitro
   Tasks in dev).
5. **Story-DM test:** enable the campaign's story-DM toggle, reply `LINK` to
   one of the business's stories from the tester account → `messages` event →
   link DM (`sent/story_dm`). Ad-tap referrals count as implicit matches.
6. **Follow-gate test:** enable the gate, trigger from a non-following tester
   account → follow-prompt DM + `skipped/follow_gate`; from a follower (or
   when Meta sends no follow signal) → link DM (fails open, like openreply).
7. **IG inbox test:** **/app/inbox → Messages tab** now lists Instagram
   accounts alongside Facebook (24h customer-service window enforced by Meta).

## 6. Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `redirect_uri_mismatch` (400) | Callback URI missing/mismatched → §1.3, character-exact |
| Business Login fails, no `configId` | `NUXT_FACEBOOK_CONFIG_ID` unset → §1.3 + §2 |
| `(#200) Requires business account` | Personal IG → convert to Business/Creator + link to Page (§1.5) |
| Permissions missing after connect | Scopes changed in code but user never re-consented → full **Disconnect + Connect** (the in-app **Reconnect** button only refreshes the token and can never add scopes; the provider grant in Better Auth stays as-is) |
| Subscribe `(#200) … permissions is needed` after reconnect | Permission not enabled in the Business Login **configuration** (§1.3) — fix there first, then Disconnect + Connect again |
| `OAuthException (#10) Private replies not allowed` | `instagram_manage_messages` not granted or Messages access off → §1.4 + §1.5.4, then reconnect |
| Page token dies in hours | Long-lived exchange skipped/failed — check server logs at connect; `token:health` reports state every 6h |
| `(#200) Unpublished posts must be posted to a page as the page itself` | A Better Auth **user** token was mirrored onto the Page row (publish/health/refresh paths did this blindly) → fixed in code: FB/IG rows renew via exchange and never accept user tokens; corrupted rows self-heal on next publish (or reconnect immediately) |
| `skipped/self` logs | Comment author is the business itself → expected |
| `rate_limited_750` | Hourly Auto-Reply cap → retries next tick automatically |
| Webhook Verify button fails | Wrong/missing `NUXT_META_WEBHOOK_VERIFY_TOKEN`, or app not saved — re-paste token, check server logs |
| Webhook Test delivers, real events don't | App in Development mode (§1.6) or account lacks app role — publish + tester invite dance |
| `skipped/follow_gate` logs | Follow gate blocked a non-follower → expected; prompt DM sent |
| `401 Invalid signature` in logs | Proxy/CDN rewrote the body — Meta signs raw bytes; terminate TLS without body mutation |
| Subscribe Page 502 | Missing `pages_manage_metadata` grant or expired page token → disconnect + reconnect (scopes grant at consent), then retry |
| Subscribe `(#200) … pages_manage_metadata / pages_messaging` | Token predates the scope change → disconnect + reconnect, then retry |
| API URL returns the app's 404 page as HTML (status 200) | Stale deployment still serving traffic: the running server predates that route. Redeploy fully, stop old containers (`docker ps`), hard-refresh. Verify with an invalid param (e.g. `?limit=9999`) — a live handler answers JSON 400, a stale origin answers HTML |

## 7. Checklist before marking done

- [ ] Business app + Facebook Login for Business product added
- [ ] Redirect URIs registered for every environment (§1.3)
- [ ] `NUXT_FACEBOOK_{CLIENT_ID,CLIENT_SECRET,CONFIG_ID}` + `NUXT_BETTER_AUTH_URL` set
- [ ] Scopes in `auth.ts` == permissions requested in App Review (§1.4)
- [ ] Dev: tester roles added; prod: Business verification + approvals
- [ ] Page ↔ IG Business linked; Messages access on (Auto-Reply)
- [ ] Connect flow verified at **/app/integrations**; reconnect after any scope change
- [ ] `NUXT_META_WEBHOOK_VERIFY_TOKEN` set; callback URL + Verify Token saved in dashboard (§1.6)
- [ ] Dashboard subscribed to Instagram object fields `comments`, `messages`, `story_mentions`
- [ ] **Subscribe Page** clicked per account in **/app/auto-reply**; app published for live events
