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
| `instagram_manage_messages` ⚠️ | Auto-Reply `sendPrivateReply` — **not yet in `auth.ts` scopes; add it when enabling Auto-Reply** | `instagram_manage_messages` |
| `pages_messaging` ⚠️ | FB inbox DMs (`getConversations`) + required alongside the above for private replies | `pages_messaging` |

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

### 1.6 Webhooks (Phase B only — not needed today)

Skip for Phase A (polling). When building webhooks per PRD-AUTO-REPLY §6, add
product **Webhooks**, subscribe the Page to `comments` + `messages` (+
`story_mentions` for story-DM triggers), set a `hub.verify_token`, and
implement the HMAC check before enqueueing.

## 2. Env vars (never commit — `.env` only)

```bash
# Meta OAuth (Better Auth facebook provider: packages/auth/lib/auth.ts)
NUXT_FACEBOOK_CLIENT_ID=...        # Settings → Basic → App ID
NUXT_FACEBOOK_CLIENT_SECRET=...    # Settings → Basic → App secret
NUXT_FACEBOOK_CONFIG_ID=...        # Facebook Login for Business → Configurations → ID
NUXT_BETTER_AUTH_URL=http://localhost:3000  # prod: https://<your-domain>

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

## 5. Auto-Reply extras (on top of §1–§4)

1. Add `instagram_manage_messages` (and `pages_messaging` if you also want FB
   inbox) to `scope` in `packages/auth/lib/auth.ts` **and** request them in
   App Review (§1.4). Existing users must **reconnect** — scopes are granted
   at consent time only.
2. `sendPrivateReply` calls
   `POST https://graph.facebook.com/v25.0/{comment-id}/private_replies?message=…`
   — text-only API, so campaign links are sent as tracked short URLs
   (`/r/{campaign}/{link}`), not buttons (stated in the UI).
3. Only works on **your own media's comments**; the business commenting on
   itself is skipped and logged as `skipped/self` (Meta rejects self-DMs).
4. Sandbox test: from a **tester-role account** (not the business), comment
   `LINK` on a watched reel → `autoreply:process` (every 15 min,
   `scheduler/nuxt.config.ts`) → DM + `autoreply_log` row `sent`. Trigger the
   task manually from Nuxt DevTools → Nitro Tasks in dev.
5. `followGate` is stored but enforced only with Phase B webhooks
   (`is_user_follow_business` arrives on webhook payloads).

## 6. Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `redirect_uri_mismatch` (400) | Callback URI missing/mismatched → §1.3, character-exact |
| Business Login fails, no `configId` | `NUXT_FACEBOOK_CONFIG_ID` unset → §1.3 + §2 |
| `(#200) Requires business account` | Personal IG → convert to Business/Creator + link to Page (§1.5) |
| Permissions missing after connect | Scopes changed in code but user never re-consented → disconnect + reconnect |
| `OAuthException (#10) Private replies not allowed` | `instagram_manage_messages` not granted or Messages access off → §1.4 + §1.5.4, then reconnect |
| Page token dies in hours | Long-lived exchange skipped/failed — check server logs at connect; `token:health` reports state every 6h |
| `skipped/self` logs | Comment author is the business itself → expected |
| `rate_limited_750` | Hourly Auto-Reply cap → retries next tick automatically |

## 7. Checklist before marking done

- [ ] Business app + Facebook Login for Business product added
- [ ] Redirect URIs registered for every environment (§1.3)
- [ ] `NUXT_FACEBOOK_{CLIENT_ID,CLIENT_SECRET,CONFIG_ID}` + `NUXT_BETTER_AUTH_URL` set
- [ ] Scopes in `auth.ts` == permissions requested in App Review (§1.4)
- [ ] Dev: tester roles added; prod: Business verification + approvals
- [ ] Page ↔ IG Business linked; Messages access on (Auto-Reply)
- [ ] Connect flow verified at **/app/integrations**; reconnect after any scope change
