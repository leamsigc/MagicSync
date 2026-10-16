# Social account business placement

## The bug

When a user connects a provider (X/Twitter, LinkedIn, Threads, Instagram…), the
provider row is created by Better Auth and a matching `social_media_accounts`
row is created automatically from the `databaseHooks.account.create.after` hook
in `packages/auth/lib/auth.ts`. That hook resolved the owning business with:

```ts
const businessFromUser = await this.db.query.businessProfiles.findFirst({
  where: eq(businessProfiles.userId, user.id),
});
```

`findFirst` with no `isActive` filter always returns the user's **first**
business by insertion order. The UI passes the active business in the OAuth
`callbackURL` (`?businessId=...`) but nothing consumed it, and the hook has no
access to that query. Result: accounts connected while a non-first business was
active silently landed on the wrong business and did not show up in the app.

## The fix

`packages/db/server/services/social-media-account.service.ts`:

- New private `resolveBusinessForUser(userId)` — the user's **active** business
  (`isActive = true`, newest `updatedAt`), else their **first** business
  (`asc createdAt`), else `''`.
- `createOrUpdateAccountFromAuth` now calls it. Every provider in the auth hook
  funnels through this one method, so the fix covers all nine (threads,
  instagram, twitter, linkedin, youtube, discord, reddit, tiktok, dribbble).

This mirrors the UI's own active-business resolution
(`/api/v1/business/active` → `businessProfileService.getActive`), so a connected
account appears where the user is looking.

## Related hardening (same change)

`createOrUpdateAccount` used to look up the existing row by `accountId` alone:

```ts
const account = await this.getAccountByAccountId(id); // no user/platform scoping
```

If the same platform account id already existed for **another user**, the code
found that row and overwrote its tokens/name — a cross-tenant write. It now
scopes the lookup by `(userId, platform, accountId)`.

## Gotchas

- `is_active` is reliable for **owners** (`setActive` flips the target to `true`
  and all others to `false`); **members** never get theirs flipped, which is why
  the active pick orders by `updatedAt` for determinism.
- Reconnect does **not** re-home an existing row: `updateAccount` never writes
  `businessId`. Moving an already-mis-filed account requires disconnect →
  reconnect.
- The `account.create.after` hook only fires on insert. Disconnecting only the
  social account (not the Better Auth `account` row) means a later reconnect
  never recreates it. Tracked as a follow-up.

## Verify

1. With business B active, connect a provider → row's `business_id = B`.
2. With no active business, connect → first business (by `createdAt`).
3. Test one native (reddit) and one generic-OAuth (threads) provider — same path.
