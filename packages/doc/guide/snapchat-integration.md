# Snapchat Integration

Snapchat is connected as a **Better Auth `genericOAuth` provider** and published
to through a **scheduler plugin**. This page is the setup guide (where to create
the developer keys) and the reference for what the integration can and cannot
do.

## Where to create the developer keys

1. Go to the **Snap Kit Developer Portal**: <https://kit.snapchat.com/portal>.
2. Sign in with a Snapchat account that belongs to your organization.
3. **Create a project**, then enable **Login Kit** (and **Creative Kit** if you
   plan to add the mobile share sheet later).
4. Under the project's **OAuth redirect URIs**, add exactly:

   ```
   https://<your-domain>/api/auth/oauth2/callback/snapchat
   ```

   For local development, add the loopback form as well:

   ```
   http://localhost:3000/api/auth/oauth2/callback/snapchat
   ```

5. Copy the **Client ID** and **Client Secret** into your `.env`:

   ```bash
   NUXT_SNAPCHAT_CLIENT_ID="<client id>"
   NUXT_SNAPCHAT_CLIENT_SECRET="<client secret>"
   ```

6. Restart the app. **Integrations → Connect account → Snapchat** now starts the
   OAuth flow.

> Snapchat never returns an email address. The provider synthesises
> `<externalId>@snapchat.com` and marks it verified; Snapchat is therefore
> **link-only** — it is listed in `accountLinking.trustedProviders`, so it links
> to an existing account rather than creating a new one from scratch.

## How it is implemented

| Piece | File |
|---|---|
| OAuth provider (`genericOAuth`) | `packages/auth/lib/auth.ts` → `providerId: 'snapchat'` |
| Profile read (Kit GraphQL `me`) | `fetchSnapchatProfile()` in the same file |
| Account row creation on connect | `databaseHooks.account.create` → `snapchat` branch |
| Platform limits / media rules | `packages/shared/shared/platformConstants.ts` → `snapchat` |
| Per-platform settings type | `packages/shared/shared/platformSettings.ts` → `SnapchatSettings` |
| Publishing plugin | `packages/db/server/services/plugins/snapchat.plugin.ts` |
| Plugin registration | `packages/scheduler/server/services/AutoPost.service.ts` (matcher) |

The provider requests these scopes:

```
snapchat-marketing-api  user.display_name  user.bitmoji.avatar
```

`snapchat-marketing-api` is what lets the scheduler call the Marketing API with
the stored token; the other two populate the account display name and avatar.

## Posting to Snapchat

Snapchat has **no public API for posting to a personal story**. The Snap Kit
*Creative Kit* is a client-side (mobile) share sheet, so it cannot be driven from
the server. The only server-side content surface is the **Marketing API**, and
this is what the plugin uses:

1. Upload the post's first image/video to `POST /v1/media`.
2. Create a `SNAP_AD` creative under the ad account:
   `POST /v1/adaccounts/{adAccountId}/creatives`.

Because of this, a Snapchat connection needs an **ad account id**. Configure it
on the connection (per-platform settings → `adAccountId`) or in the connection's
base URL. Without it, publishing fails with an actionable message rather than
silently doing nothing.

### What is not supported

- Commenting / replying — Snapchat exposes no comment API (`getComments` returns
  empty, `replyToComment` returns a clear error).
- Editing a published creative — creatives are immutable; `update` fails with an
  explanation.
- Follower metrics — Snapchat's public API exposes none, so `getStatistic`
  returns zeros with a note and `getPostInsights` reports insights as
  unavailable (they live in Ads Manager).

## Verifying the connection

1. `NUXT_SNAPCHAT_CLIENT_ID` / `_SECRET` set, app restarted.
2. `/app/integrations` → the Snapchat card → **Connect** → complete the Snapchat
   consent screen.
3. You land back on the integrations page; a `snapchat` row exists in
   `social_media_accounts` and the account appears in the publishing target list.

## Security notes

- Tokens are encrypted at rest by `createOrUpdateAccountFromAuth` (the same path
  every other provider uses).
- The refresh token from Snapchat is stored so the scheduler can renew without a
  re-connect.
- Audit events for the connect flow never contain tokens — only the external id.
