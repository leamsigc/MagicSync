# Candidate: Auth/Account Type Consolidation

## Status
`pending`

## Priority
Medium

## Cluster

- `packages/db/db/auth/auth.ts` - contains `account` table (OAuth accounts)
- `packages/db/db/socialMedia/socialMedia.ts` - contains `socialMediaAccounts` table
- `packages/db/server/services/social-media-account.service.ts` - manages both
- `packages/auth/server/services/account.service.ts` - auth-specific account logic

## Problem Statement

There are two distinct "account" concepts that are conflated:

1. **Auth Account** (`db/db/auth/auth.ts`): Represents OAuth provider linkage for authentication (Google, GitHub login)
   - Linked to `users` table
   - Used for session management

2. **Social Media Account** (`db/db/socialMedia/socialMedia.ts`): Represents connected social platforms for publishing (Instagram, Twitter, etc.)
   - Linked to `users` table
   - Used for post publishing

Both are called "account" but serve completely different purposes. The `social-media-account.service.ts` manages the second type, but the naming is confusing.

### Current Friction

- New developers: "Which account table do I use?"
- `social-media-account.service.ts` handles both account types but named for social
- Unclear relationship between auth accounts and social accounts (one user can have both)

## Why Coupled

1. **Shared types**: Both linked to `users` table via foreign keys
2. **User identity**: Same user can have auth accounts AND social accounts
3. **Service**: Single service (`social-media-account.service.ts`) handles both

## Dependency Category
Horizontal (shared types across features)

## Test Impact

Currently:
- No tests for either account type
- Unclear what testing each would require

After consolidation:
- Clear account type boundaries
- Test each account type independently

## Proposed Solution

### Option A: Rename Service (Quick Fix)
Rename `social-media-account.service.ts` to something clearer:
- `connected-platform.service.ts`
- `social-connect.service.ts`

Add documentation explaining the two account types.

### Option B: Create Separate Services
Split into two services:
- `AuthAccountService` for auth accounts
- `ConnectedPlatformService` for social accounts

### Option C: Create Account Union Types
Keep services but add clear type discrimination:

```typescript
type UserAccount = AuthAccount | SocialPlatformAccount

interface AuthAccount {
  type: 'auth'
  provider: 'google' | 'github'
  userId: string
}

interface SocialPlatformAccount {
  type: 'social'
  platform: 'instagram' | 'twitter' | 'linkedin'
  userId: string
}
```

## Implementation Options

### Option A: Rename + Document (Recommended)
- Low risk, high clarity
- Add JSDoc explaining each account type
- Rename service file

### Option B: Full Split
- More refactoring
- Cleaner separation
- Better for future growth

## Next Steps

1. Choose implementation option
2. Design the interface changes
3. Create GitHub issue RFC
