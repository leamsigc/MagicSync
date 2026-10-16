---
name: add-oauth-platform-provider
description: Add a new social platform end to end — OAuth connect, account row on connect, a publishing plugin, and every registry it must appear in. Use when asked to "add a platform", "connect <network>", "support posting to X", or when wiring a new OAuth provider into Better Auth.
---

# Add an OAuth platform provider

## When to use
A social network must be connectable and (optionally) publishable, e.g.
Snapchat, Mastodon, Pinterest.

## The nine places a platform must be registered
Miss one and you get a half-connected platform that fails at publish time.

| # | File | What |
|---|---|---|
| 1 | `packages/auth/lib/auth.ts` | The provider. Native providers go under `socialProviders`; anything else is a `genericOAuth` config with `providerId`. |
| 2 | `packages/auth/lib/auth.ts` | `accountLinking.trustedProviders` — add the provider id, or linking is refused. |
| 3 | `packages/auth/lib/auth.ts` | `databaseHooks.account.create.after` — create the `social_media_accounts` row from the provider profile. |
| 4 | `packages/connect/server/utils/socialMedia.ts` | `isBetterAuthPlatform()` — whether the connect UI routes through `signInSocial`. |
| 5 | `packages/db/server/services/social-media-account.service.ts` + `packages/db/db/socialMedia/socialMedia.ts` | The `SocialMediaPlatform` type **and** the Drizzle column enum. |
| 6 | `packages/shared/shared/platformConstants.ts` | Limits, media rules, `supportedFormats`, icon, colour. |
| 7 | `packages/shared/shared/platformSettings.ts` | The settings interface, the `PlatformSettings` union, `PlatformSettingsMap` and `createDefaultSettings`. |
| 8 | `packages/db/server/services/plugins/<name>.plugin.ts` + `packages/scheduler/server/services/AutoPost.service.ts` | The plugin class and its entry in the `matcher` map. |
| 9 | UI registries | `packages/ui/app/composables/usePlatformIcons.ts`, `packages/scheduler/app/composables/usePostFilters.ts`, `packages/scheduler/.../platformPreviewSpecs.ts`, `packages/site/server/mcp/utils/platforms.ts` |

## Provider shapes

**Native** (Better Auth ships it): just `socialProviders: { tiktok: { clientKey, clientSecret } }`.

**genericOAuth** (everything else): set `authorizationUrl`, `tokenUrl`, `scopes`,
and — when the provider has no OIDC userinfo endpoint — a `getUserInfo`:

```ts
{
  providerId: 'snapchat',
  clientId: process.env.NUXT_SNAPCHAT_CLIENT_ID as string,
  clientSecret: process.env.NUXT_SNAPCHAT_CLIENT_SECRET as string,
  authorizationUrl: 'https://accounts.snapchat.com/login/oauth2/authorize',
  tokenUrl: 'https://accounts.snapchat.com/login/oauth2/access_token',
  scopes: ['snapchat-marketing-api', 'user.display_name', 'user.bitmoji.avatar'],
  pkce: true,
  getUserInfo: async (tokens) => fetchSnapchatProfile(tokens.accessToken),
}
```
Callback URL is always `{NUXT_BETTER_AUTH_URL}/api/auth/oauth2/callback/<providerId>`.

If the provider returns no email (Snapchat, some others), synthesise
`<externalId>@<provider>.com` and rely on `trustedProviders` so it links rather
than signs up.

## The plugin contract
`BaseSchedulerPlugin` requires `init`, `validate`, `post`, `update`,
`addComment`, `getStatistic`, `getComments`, `replyToComment`
(`getPostInsights` has a default). Implement every one — even unsupported ones
must return a clear failure, never throw.

Read the stored token with `decryptKey(socialMediaAccount.accessToken)`. Return
`PostResponse { id, postId, releaseURL, status, error? }` and emit
`<platform>:post:published` / `:failed`.

## Re-registering an existing account
Changing scopes or the account-create hook does **not** back-fill existing rows.
Every connected account must disconnect and reconnect to pick up the change —
say so in the docs.

## Verify
1. `node scripts/layer-import-audit.mjs` and `node scripts/i18n-audit.mjs` pass.
2. Connect the account in `/app/integrations`; confirm the row in
   `social_media_accounts`.
3. Compose a post targeting the platform; the preview renders and publish either
   succeeds or fails with an actionable message.
