---
name: social-account-business-placement
description: Decide which business a provider-created social account belongs to — active business with a first-business fallback — and keep the write lookup tenant-scoped. Use when a connected account "doesn't show up", "lands on the wrong business", "connects but no social account", or when touching the Better Auth account.create hook in packages/auth/lib/auth.ts.
---

# Social account business placement

## When to use
A user connects a provider (X/Twitter, LinkedIn, Threads, Instagram…) and the
social account is missing from the app, or lands on a business the user is not
working in.

## Root cause pattern
`packages/auth/lib/auth.ts` creates the `social_media_accounts` row from the
`databaseHooks.account.create.after` hook via
`socialMediaAccountService.createOrUpdateAccountFromAuth(...)`. If that method
resolves the business with an unfiltered
`businessProfiles.findFirst({ where: eq(userId) })`, it always picks the **first**
business by insertion order — ignoring the UI's active business (which is passed
in the OAuth `callbackURL` but not consumed by the hook).

## Steps
1. **Resolve at the single choke point.** All providers funnel through
   `createOrUpdateAccountFromAuth`, so fix it once there:
   ```ts
   private async resolveBusinessForUser(userId: string): Promise<string> {
     const active = await this.db.query.businessProfiles.findFirst({
       where: and(eq(businessProfiles.userId, userId), eq(businessProfiles.isActive, true)),
       orderBy: [desc(businessProfiles.updatedAt)],
     })
     if (active) return active.id
     const first = await this.db.query.businessProfiles.findFirst({
       where: eq(businessProfiles.userId, userId),
       orderBy: [asc(businessProfiles.createdAt)],
     })
     return first?.id ?? ''
   }
   ```
   This mirrors the UI's own resolution (`/api/v1/business/active` →
   `businessProfileService.getActive`).
2. **Scope the write lookup.** In `createOrUpdateAccount`, never look up the
   existing row by `accountId` alone — that can overwrite another user's row
   (cross-tenant) or a different platform's row with a colliding id. Scope by
   `(userId, platform, accountId)`.
3. **Confirm `is_active` semantics.** Owners: `setActive` flips the target to
   `true` and the rest to `false`. Members: never flipped → order by `updatedAt`
   for determinism.

## Gotchas
- `updateAccount` never writes `businessId`, so reconnecting does **not** re-home
  an existing mis-filed row. Movement requires disconnect → reconnect.
- The `account.create.after` hook only fires on insert. Disconnecting only the
  social account (leaving the Better Auth `account` row) means a later reconnect
  never fires the hook and never recreates the row.
- The deeper fix is moving creation into the connect callback route
  (`/api/v1/social-accounts/callback/[platform]`), which already has the session
  and `businessId`. Treat as a follow-up.

## Verify
1. With business B active, connect a provider → `business_id = B`.
2. With no active business, connect → first business (by `createdAt`).
3. One native (reddit) + one generic-OAuth (threads) provider — same path.
4. Second user connecting the same platform account gets its own row and does not
   mutate the first user's row.
