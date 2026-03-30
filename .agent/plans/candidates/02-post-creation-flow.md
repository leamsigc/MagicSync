# Candidate: Post Creation Flow Consolidation

## Status
`pending`

## Priority
High

## Cluster

**Frontend:**
- `packages/scheduler/app/pages/app/posts/new.vue`
- `packages/scheduler/app/composables/useScheduleManager.ts`

**API:**
- `packages/scheduler/server/api/v1/posts/index.post.ts`

**Services:**
- `packages/db/server/services/post.service.ts`
- `packages/scheduler/server/services/AutoPost.service.ts`

**Schema:**
- `packages/db/db/posts/posts.ts`
- `packages/db/db/schema.ts`

**Plugins:**
- `packages/scheduler/server/services/plugins/*.plugin.ts`

## Problem Statement

Understanding how to create a post requires tracing through **8+ files**:

1. Frontend page → 2. Composable → 3. API route → 4. Post service → 5. Schema → 6. Relations → 7. Auto-post service → 8. Platform plugins

This makes the feature:
- Hard to modify (what happens if I change step 4?)
- Hard to test (which layer should I test?)
- Hard to onboard (too much context needed)

### Current Friction

- Broken API path in `useScheduleManager.ts`: uses `/api/v1/scheduler/posts` but actual endpoint is `/api/v1/posts/`
- Business logic scattered: validation in API, creation in service, publishing in AutoPost
- No clear boundary between "what the user submits" and "how it's processed"

## Why Coupled

1. **Shared types**: `Post`, `ScheduledPost`, `PostStatus` used everywhere
2. **Call chain**: UI → API → Service → Plugin → External
3. **Co-ownership**: Frontend team owns UI, backend team owns services

## Dependency Category
Vertical

## Test Impact

Currently:
- No API tests for post creation
- No service tests for post logic
- Frontend tests would need to mock 8 different modules

After consolidation:
- Test at PostService boundary
- Clear contract between API and service
- Mockable dependencies

## Proposed Solution

Create a unified `PostWorkflowService` that encapsulates:

```typescript
// packages/scheduler/server/services/PostWorkflowService.ts

interface PostWorkflowService {
  /**
   * Complete post creation workflow:
   * 1. Validate input
   * 2. Create draft in DB
   * 3. Schedule if needed
   * 4. Trigger auto-post if immediate
   */
  createPost(input: CreatePostInput): Promise<Post>
  
  /**
   * Update workflow with re-scheduling logic
   */
  updatePost(postId: string, input: UpdatePostInput): Promise<Post>
  
  /**
   * Cancel and cleanup
   */
  cancelPost(postId: string): Promise<void>
}
```

## Implementation Options

### Option A: Service Consolidation (Recommended)
Add new `PostWorkflowService` that orchestrates existing services
- Pros: Minimal code changes, clear new boundary
- Cons: Still relies on existing services

### Option B: Extract to New Package
Create `packages/posts/` with everything post-related
- Pros: Maximum isolation
- Cons: Large refactor, lots of file moves

### Option C: Fix API Path + Add Tests
Just fix the broken path and add service tests
- Pros: Quick win
- Cons: Doesn't address underlying architecture

## Next Steps

1. Choose implementation option
2. Design the PostWorkflowService interface
3. Create GitHub issue RFC
