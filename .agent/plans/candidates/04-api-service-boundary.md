# Candidate: API Route → Service Layer Boundary

## Status
`pending`

## Priority
Medium

## Cluster

All API routes across packages that directly import from `#layers/BaseDB/server/services/`:

- `packages/auth/server/api/**`
- `packages/scheduler/server/api/**`
- `packages/connect/server/api/**`
- `packages/bulk-scheduler/server/api/**`
- `packages/assets/server/api/**`
- `packages/templates/server/api/**`
- `packages/ai-tools/server/api/**`

## Problem Statement

API routes directly import and call database services:

```typescript
// packages/scheduler/server/api/v1/posts/index.post.ts
import { postService } from "#layers/BaseDB/server/services/post.service"
import { socialMediaAccountService } from "#layers/BaseDB/server/services/social-media-account.service"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  // Direct service calls - tight coupling
  const post = await postService.create({ ... })
  // ...
})
```

This creates:
1. **Tight coupling**: Changing service signatures breaks all callers
2. **Hard to test**: Can't mock services without complex setup
3. **No abstraction**: Business logic leaks into route handlers

### Current Friction

- Adding new parameter to service requires updating every caller
- Testing API requires database (can't mock easily)
- No clear contract between "how data comes in" and "how it's processed"

## Why Coupled

1. **Shared types**: API body types match service input types exactly
2. **Direct imports**: No abstraction layer between route and service
3. **Co-evolution**: Service and route change together

## Dependency Category
Cross-cutting

## Test Impact

Currently:
- No API route tests (would require database)
- No service tests

After consolidation:
- Mockable services → testable API routes
- Clear contracts for testing

## Proposed Solution

Create a **Service Facade** pattern:

```typescript
// packages/scheduler/server/services/PostFacade.ts
// Provides typed interface between API and services

import { postService } from "#layers/BaseDB/server/services/post.service"

export const postFacade = {
  async createPost(input: CreatePostDTO, userId: string) {
    // Validate input
    // Call service
    // Transform output
    return postService.create({ ...input, userId })
  },
  
  async schedulePost(postId: string, scheduledAt: Date) {
    // Business logic here
  }
}

// API route now uses facade:
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const post = await postFacade.createPost(body, event.context.user.id)
})
```

Benefits:
- Single place for validation
- Transform inputs before services
- Easy to mock in tests
- Clear API contract

## Implementation Options

### Option A: Add Facades Per Feature (Recommended)
Add facade files to each feature package:
- `packages/scheduler/server/services/*Facade.ts`
- `packages/auth/server/services/*Facade.ts`
- etc.

- Pros: Incremental, per-feature
- Cons: Many files to create

### Option B: Create Shared API Utilities
Create common patterns in a shared package:
- `packages/api-utils/`

- Pros: Reusable
- Cons: More abstraction

### Option C: Add Tests Without Refactoring
Add integration tests that test API + service together
- Pros: Quick
- Cons: Doesn't solve coupling

## Next Steps

1. Choose implementation option
2. Design facade interfaces for highest-traffic routes
3. Create GitHub issue RFC
