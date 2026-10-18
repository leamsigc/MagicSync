# Provider Token Error Triage (Facebook / Instagram / LinkedIn)

_2026-10-17 — how a wall of `plugin` failures in the audit log traced back to
three distinct code defects (and one token-drift root cause), what changed, and
how to read the next batch of log rows._

## Why

Production audit logs (`audit_logs`, `category = 'plugin'`) showed a repeating
set of failures across every connected account:

| Log action | Error | Real cause |
|---|---|---|
| `facebook-fetch-error(:response)` | `(#190) This method must be called with a Page Access Token` | the `facebook`/`instagram` row held a **Better Auth user token**, not a Page token |
| `facebook-fetch-error(:response)` | `Invalid OAuth 2.0 Access Token` / `User Access Token Is Not Supported` (`2069032`) | same — a user token on a Page endpoint |
| `facebook-fetch-error(:response)` | `Invalid OAuth access token - Cannot parse access token` on `/undefined/conversations` | the Page id **and** token were `undefined` |
| `linkedin-…:post-error` / `linkedin-page-post-error:response` | `ReferenceError: join is not defined` | a missing `node:path` import in the asset helper |
| `instagram-post-error` | `…access [token] has expired…` | a Page token that was never force-renewed at publish time |

They looked like one problem ("tokens are broken") but were **four** independent
bugs, so they need four fixes. The lesson: triage each audit-log *action* to its
plugin method before theorising.

## What changed

### 1. `join is not defined` — missing import (`packages/shared/server/utils/asset-utils.ts`)

`getFileFromAsset()` called `join(process.cwd(), …)` from `node:path` but the
module never imported it. It only runs when a post carries an image, so
publishing text succeeded and publishing media died with a bare
`ReferenceError`. Every LinkedIn personal + Page post in the logs had an image.

```ts
import { join } from 'node:path';
```

> A `ReferenceError: <name> is not defined` inside a plugin's catch is almost
> always a missing import in a *sibling* helper, not the plugin. Grep the helper,
> not the plugin.

### 2. `/undefined/conversations` — an argument-shift bug (`facebook.plugin.ts`)

The base class declares:

```ts
getConversations(socialMediaAccount, options?)
```

`SchedulerPost.getConversations()` calls `plugin.getConversations(account, options)`.
But `FacebookPlugin.getConversations` had an extra first parameter:

```ts
// WRONG — every argument shifted by one
override async getConversations(extra, socialMediaAccount, options?)
```

So `socialMediaAccount` received `{ limit, cursor }` and both
`accountId` (`/undefined/…`) and `accessToken` were `undefined`. `InstagramPlugin`
had the correct signature, which is why only Facebook DMs failed. Fixed by
dropping the stray `extra` parameter.

> Exposed-method binding (`SchedulerPost.use()`) *also* prepends an args array —
> but only for names listed in `exposedMethods`. `getConversations` is not one,
> so the extra parameter was pure human error. Keep the override signature
> identical to the base.

### 3. `#190 Page Access Token` — the token mirror (`social-accounts/index.get.ts`)

`GET /api/v1/social-accounts?platformId=facebook` (the Page picker) **mirrored
the Better Auth user token onto every active `facebook` row**:

```ts
// before — corrupts Page-token rows
if (tokenData?.accessToken) {
  for (const mirroredAccount of mirroredAccounts) {
    await socialMediaAccountService.updateAccount(mirroredAccount.id, {
      accessToken: tokenData.accessToken, // ← user token on a Page row
    })
  }
}
```

Facebook/Instagram rows store **Page** tokens minted by `fetchPageInformation`.
Meta then rejects the user token with `#190` on Insights/feed and `2069032` on
feed/conversations. The `refresh/[id]` route and `AutoPost` already excluded
these platforms; the accounts-list route did not. Fixed by gating the mirror
with `!usesPageToken(effectivePlatform)` (from `TokenRefresh.service`).

The same user token was also written onto the wrong table in
`social-accounts/[platform]/[id]/index.post.ts` (`platformAccount` is a Better
Auth row, so `updateAccount(platformAccount.id, …)` was a silent no-op). Removed
— the route now only *uses* the user token to mint the Page token.

### 4. Instagram "token has expired" — heal at publish time (`AutoPost.service.ts`)

Page-token rows are renewed through `TokenRefresh` only. `AutoPost` called
`renewRowToken(...)` **without `force`**, which is skipped when
`tokenExpiresAt` is `null` or optimistic (Page tokens are often stored with a
computed 60-day expiry). A token that died early therefore never renewed and the
publish failed with "has expired".

`triggerSocialMediaPost` now delegates to a small `publishPlatformPost()` that
retries **once** for Facebook/Instagram when the failure looks like a token-auth
error, after a `force: true` re-mint:

```ts
let response = await scheduler.publish(post, [], socialMediaAccount)
if (usesPageToken(platform) && response.status === 'failed' && isPageTokenAuthError(response.error)) {
  socialMediaAccount = await this.forceRenewPageToken(platform, socialMediaAccount)
  response = await scheduler.publish(post, [], socialMediaAccount)
}
```

`isPageTokenAuthError()` matches `has expired`, `revoked`, `invalid oauth`,
`must be called with a Page Access Token`, `User Access Token Is Not Supported`.
When renewal itself can't happen (no linked Better Auth account) the row is left
untouched and the post is recorded failed — that case genuinely needs a manual
reconnect.

## How to verify

```bash
# type-check the whole site graph (layers included)
cd packages/site && pnpm exec tsc --noEmit -p tsconfig.json

# no new cross-layer imports
pnpm audit:layers
```

Then, with a real connected Page:

1. Open the Page picker, then check the Insights card — no `#190` in the audit log.
2. Open Inbox → Facebook conversations — the URL is `/{page-id}/conversations`, not `/undefined/…`.
3. Publish an image post to LinkedIn — no `join is not defined`.
4. Let an Instagram token expire (or hand-edit `tokenExpiresAt` in the past) and
   publish — the retry re-mints and the post succeeds.

## Reading the next batch of log rows

- `facebook-fetch-error:response` + `facebook-fetch-error` come as a **pair**
  per call — `:response` is the HTTP body, the other is the thrown summary.
- A `…:post-error` action carrying `ReferenceError` / `TypeError` is a **code**
  bug; a message with `OAuthException` is a **token** problem.
- `user_id` and `target_id` are often blank on plugin rows — use the `target_id`
  URL (`/undefined/…`) and the action prefix (`facebook-`, `linkedin-page-`,
  `instagram-`) to locate the plugin first.

## Related

- [Graph API v26.0 Migration](/guide/graph-api-v26-migration)
- [Facebook & Instagram Setup](/guide/facebook-instagram-integration)
- `packages/db/server/services/TokenRefresh.service.ts`,
  `packages/scheduler/server/services/StatsCollector.service.ts`
