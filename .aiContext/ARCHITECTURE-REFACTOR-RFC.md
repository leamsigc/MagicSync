# Architecture Refactor RFC: Consolidate Duplicate AssetService

**Date:** 2026-05-16
**Status:** IMPLEMENTED ✅ (2026-05-23)
**Related:** ServiceResponse Type Fragmentation (Candidate 1)

---

## Implementation Summary

This RFC was fully implemented. See `ARCHITECTURE-CANDIDATES.md` for the full resolution details.

### What was created:
- `packages/shared/server/services/asset.service.ts` — unified asset service
- `packages/shared/server/types/` — shared ServiceResponse types and error classes

### What was deprecated (re-exports):
- `packages/db/server/services/asset.service.ts`
- `packages/assets/server/services/asset.service.ts`

---

## Problem Statement

The codebase has two identical AssetService implementations that return different `ServiceResponse` shapes:

- `packages/db/server/services/asset.service.ts` (312 lines) — returns `{ data?, error?, code? }`
- `packages/assets/server/services/asset.service.ts` (325 lines) — returns `{ success: boolean, data?, error?, code? }`

This causes:
1. Runtime bugs when callers check for `.success` on db service responses
2. Cross-package fragility (scheduler imports `ValidationError` from assets)
3. Zero tests — services can't be mocked without interfaces
4. Maintenance burden — changes must be made in two places

---

## Proposed Solution

### 1. Unified ServiceResponse Type

Create a shared type used by all packages:

```typescript
// packages/shared/server/types/service.types.ts
export interface ServiceResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

export interface PaginatedResponse<T> extends ServiceResponse<T[]> {
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
```

### 2. Consolidated AssetService Interface

```typescript
// packages/shared/server/services/asset.service.ts
export interface CreateAssetData {
  businessId?: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
  thumbnailUrl?: string
  metadata?: Record<string, unknown>
}

export interface IAssetService {
  // Core operations (80% of calls)
  findById(id: string, userId: string): Promise<ServiceResponse<Asset>>
  findByBusinessId(businessId: string, userId: string, options?: QueryOptions): Promise<PaginatedResponse<Asset>>
  create(userId: string, data: CreateAssetData): Promise<ServiceResponse<Asset>>
  delete(id: string, userId: string): Promise<ServiceResponse<Asset>>

  // Extended operations
  findByIds(ids: string[], userId: string): Promise<ServiceResponse<Asset[]>>
  deleteMultiple(ids: string[], userId: string): Promise<ServiceResponse<Asset[]>>
  updateMetadata(id: string, userId: string, metadata: AssetMetadata): Promise<ServiceResponse<Asset>>
  getStorageUsage(userId: string): Promise<ServiceResponse<{ totalSize: number; count: number }>>
  getStorageUsageByBusiness(businessId: string, userId: string): Promise<ServiceResponse<{ totalSize: number; count: number }>>

  // Type helpers
  getAssetType(mimeType: string): 'image' | 'video' | 'document' | 'other'
}

export const assetService: IAssetService
```

### 3. Port Interface for DI

```typescript
// For testing and cross-package decoupling
export type AssetPort = {
  findById(id: string, userId: string): Promise<ServiceResponse<Asset>>
  create(userId: string, data: CreateAssetData): Promise<ServiceResponse<Asset>>
  delete(id: string, userId: string): Promise<ServiceResponse<Asset>>
}
```

---

## Migration Path

### Phase 1: Create shared types (no behavior change)
1. Create `packages/shared/server/types/service.types.ts`
2. Update all packages to import from shared

### Phase 2: Create unified service
1. Create `packages/shared/server/services/asset.service.ts`
2. Implement using db service as base (more complete implementation)
3. Ensure `success: boolean` always present

### Phase 3: Update callers
1. Update `packages/assets/server/api/v1/assets/*` to use shared service
2. Update `packages/scheduler` to use shared service (removes assets import)
3. Mark old services as `@deprecated`

### Phase 4: Remove duplicates
1. Remove duplicate from `packages/assets/server/services/asset.service.ts`
2. Remove duplicate from `packages/db/server/services/asset.service.ts` (or keep as deprecated shim)

---

## Files to Modify

| File | Action |
|------|--------|
| `packages/shared/server/types/service.types.ts` | Create |
| `packages/shared/server/services/asset.service.ts` | Create |
| `packages/assets/server/api/v1/assets/*` | Update imports |
| `packages/scheduler/server/services/SchedulerPost.service.ts` | Remove assets import |
| `packages/assets/server/services/asset.service.ts` | Deprecate or remove |
| `packages/db/server/services/asset.service.ts` | Deprecate or remove |

---

## Testing Strategy

1. Create unit tests for new service using mocked db
2. Add integration tests for API endpoints
3. Verify scheduler works without importing from assets package

---

## Alternative Designs Considered

### Minimal Interface (3 entry points)
```typescript
manage(action: AssetAction): Promise<AssetResult>
find(query: AssetQuery): Promise<AssetReadResult>
stats(params: AssetStatsParams): Promise<ServiceResponse<AssetStats>>
```
- **Trade-off:** More elegant but breaks backward compatibility more

### Full Flexibility (20+ methods + hooks)
- **Trade-off:** Overkill for current needs; adds complexity without immediate benefit

### Full Ports & Adapters
- **Trade-off:** Best for testability but requires creating new `packages/core` layer

---

## Impact Assessment

| Area | Impact |
|------|--------|
| **Breaking changes** | Low — maintains method signatures, changes return type |
| **Testability** | High — enables mocking via port interface |
| **Bundle size** | Neutral — same code, different location |
| **Performance** | Neutral — same queries |
| **Cross-package coupling** | Reduced — scheduler decoupled from assets |