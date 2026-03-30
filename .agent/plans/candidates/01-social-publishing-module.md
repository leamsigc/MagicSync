# Candidate: Social Publishing Module

## Status
`pending`

## Priority
High

## Cluster
- `packages/scheduler/` (plugins, auto-post service)
- `packages/connect/` (OAuth callbacks, account connections)
- `packages/db/server/services/social-media-account.service.ts`
- `packages/db/server/services/post.service.ts`

## Problem Statement

Post publishing currently requires understanding and coordinating across 3 separate packages:

1. **Scheduler Package**: Contains plugin system (`plugins/*.plugin.ts`) for each social platform and `AutoPost.service.ts`
2. **Connect Package**: Handles OAuth flows for connecting social accounts (`callback/[platform].get.ts`)
3. **DB Package**: Contains `social-media-account.service.ts` for account CRUD

### Current Friction

- To understand how a post gets published to Instagram, you need:
  - `scheduler/server/services/plugins/instagram.plugin.ts`
  - `scheduler/server/services/AutoPost.service.ts`
  - `connect/callback/instagram.get.ts`
  - `db/server/services/social-media-account.service.ts`

- The `connect` package is very shallow - mostly just OAuth callbacks with minimal business logic
- Unclear ownership: does a new Instagram feature go in scheduler or connect?

## Why Coupled

1. **Shared types**: `SocialMediaAccount` type used across all three packages
2. **Call pattern**: API → Service → Plugin → External API
3. **Co-ownership**: Social platform features split between connect (auth) and scheduler (publishing)

## Dependency Category
Vertical (feature spans UI → API → Service → External)

## Test Impact

Currently:
- No tests for plugin system
- No tests for OAuth flows
- Social media account service untested

After consolidation:
- Boundary tests against unified SocialPublishingService
- Mock external platform APIs
- Test account linking workflow end-to-end

## Proposed Solution

Create a new `packages/social-publishing/` package that consolidates:

1. Social account management (from connect + db)
2. Post scheduling and publishing logic (from scheduler)
3. Platform plugin system (consolidated)

### Rough Interface Sketch

```typescript
// packages/social-publishing/server/services/SocialPublishingService.ts

interface SocialPublishingService {
  // Account management
  connectAccount(userId: string, platform: Platform, code: string): Promise<SocialAccount>
  disconnectAccount(accountId: string): Promise<void>
  getConnectedAccounts(userId: string): Promise<SocialAccount[]>
  
  // Publishing
  schedulePost(post: Post, accounts: string[]): Promise<ScheduledPost>
  publishNow(postId: string): Promise<PublishResult>
  cancelScheduledPost(postId: string): Promise<void>
  
  // Platform operations
  refreshAccountToken(accountId: string): Promise<void>
  validateAccount(accountId: string): Promise<boolean>
}
```

## Implementation Options

### Option A: New Package (Recommended)
Create entirely new package with clear boundaries
- Pros: Clean slate, well-defined interfaces
- Cons: Requires migrating existing code

### Option B: Expand Scheduler
Make scheduler the owning package for social publishing
- Pros: Less code movement, scheduler already has plugins
- Cons: Connect package becomes even more confusing

### Option C: Expand Connect
Make connect handle both auth and publishing
- Pros: More logical grouping (connect = use platform)
- Cons: Connect is currently very shallow, would need major expansion

## Next Steps

1. Choose implementation option
2. Design the unified interface (see `../active/01-social-publishing-module/`)
3. Create GitHub issue RFC
