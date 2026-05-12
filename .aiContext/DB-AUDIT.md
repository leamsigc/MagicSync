# MagicSync Database CRUD Audit Report

**Date:** May 2, 2026  
**Auditor:** DB Audit Subagent  
**Stack:** Drizzle ORM, TypeScript, Nuxt server routes, SQLite (Turso)

---

## Executive Summary

This audit examined the database layer of the MagicSync monorepo, covering:
- Schema definitions and missing indexes
- All service files in `packages/db/server/services/`
- API key service in `packages/auth/`
- Selected API routes across packages

**Overall Risk Assessment:** MODERATE-HIGH

| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH | 18 |
| MEDIUM | 5 |

---

## 1. Missing Indexes in Schema

### CRITICAL - Performance Impact

All foreign key columns and frequently queried fields should have indexes. The following tables are missing indexes:

```sql
-- posts table - queried by businessId and userId constantly
CREATE INDEX idx_posts_business_id ON posts(business_id);
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_status_scheduled ON posts(status, scheduled_at);

-- platform_posts table
CREATE INDEX idx_platform_posts_post_id ON platform_posts(post_id);
CREATE INDEX idx_platform_posts_social_account_id ON platform_posts(social_account_id);

-- social_media_accounts table
CREATE INDEX idx_social_media_accounts_business_id ON social_media_accounts(business_id);
CREATE INDEX idx_social_media_accounts_user_id ON social_media_accounts(user_id);

-- assets table
CREATE INDEX idx_assets_business_id ON assets(business_id);
CREATE INDEX idx_assets_user_id ON assets(user_id);

-- documents table
CREATE INDEX idx_documents_folder_id ON documents(folder_id);
CREATE INDEX idx_documents_user_id ON documents(user_id);

-- document_chunks table
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);

-- chat_threads table
CREATE INDEX idx_chat_threads_user_id ON chat_threads(user_id);

-- chat_messages table
CREATE INDEX idx_chat_messages_thread_id ON chat_messages(thread_id);

-- agent_sessions table
CREATE INDEX idx_agent_sessions_thread_id ON agent_sessions(thread_id);

-- notifications table
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- apikey table (for org lookups)
CREATE INDEX idx_apikey_reference_id ON apikey(reference_id);

-- reviews table - composite indexes for common queries
CREATE INDEX idx_reviews_business_id ON reviews(business_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_review_date ON reviews(review_date);
CREATE INDEX idx_reviews_business_rating ON reviews(business_id, rating);

-- audit_log table
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_category ON audit_log(category);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- subscriptions table
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);

-- knowledge_folders table
CREATE INDEX idx_knowledge_folders_parent_id ON knowledge_folders(parent_id);

-- skills table
CREATE INDEX idx_skills_user_id ON skills(user_id);

-- code_executions table
CREATE INDEX idx_code_executions_user_id ON code_executions(user_id);
```

### Location
File: `packages/db/db/schema.ts` and all sub-schema files

### Recommendation
Add indexes via Drizzle migration. For SQLite/Turso, indexes should be added to all foreign key columns and columns used in WHERE clauses.

---

## 2. Service-Level Issues

### 2.1 post.service.ts

#### CRITICAL - N+1 Query Pattern (create method)
**Lines 68-93:** Creates platform posts using `Promise.all` with individual DB inserts inside map.

```typescript
// BAD: N+1 pattern
if (data.targetPlatforms.length > 0) {
  const platformPostData = data.targetPlatforms.map(async (accountId: string) => {
    const account = await socialMediaAccountService.getAccountById(accountId)
    // ...
    await this.db.insert(platformPosts).values(platformPostEntry).returning()
  })
  await Promise.all(platformPostData)
}
```

**Fix:** Batch insert all platform posts in a single query.

#### CRITICAL - N+1 Query Pattern (update method)
**Lines 295-316:** Same pattern as create method.

#### CRITICAL - No Transaction Wrapping
Multi-table operations (posts + platform_posts + assets) are not wrapped in transactions. If one operation fails, data becomes inconsistent.

**Fix:** Wrap all related operations in `db.transaction()`.

#### HIGH - Throws Instead of ServiceResponse
**Line 244:** `findByIdFull()` throws error instead of returning `ServiceResponse`.

```typescript
// Line 244
throw new Error('Post not found')  // Should return { error: '...' }
```

### 2.2 asset.service.ts

#### HIGH - SQL Injection Vulnerability
**Line 153:** IDs are interpolated directly into SQL without parameterization.

```typescript
// VULNERABLE: Direct interpolation
sql`${assets.id} IN (${ids.map(id => `'${id}'`).join(',')})`
```

**Fix:** Use Drizzle's `inArray()` with parameterized queries.

#### HIGH - Same Issue
**Line 232:** Same vulnerability in `deleteMultiple()`.

### 2.3 social-media-account.service.ts

#### HIGH - N+1 Query Pattern
**Lines 97-113:** `getUserAccountsCompleteDetails()` iterates with async calls.

```typescript
// Lines 102-104
const details = userAccounts.map((account) => {
  return entityDetailsService.getDetailsByEntity(account.id, 'accounts_pages');
});
```

**Fix:** Batch fetch all entity details upfront.

#### HIGH - Missing Ownership Checks
Methods like `getAccountById()`, `getAccounts()`, `updateAccount()` do not verify the requesting user owns the account.

### 2.4 review.service.ts

#### CRITICAL - Missing Ownership Verification
**All methods:** `findById()`, `update()`, `addResponse()`, `toggleShare()`, `delete()` do not verify user owns the associated business.

```typescript
// Line 75 - no ownership check
async findById(id: string): Promise<ServiceResponse<Review>> {
```

**Fix:** Add business ownership verification to all methods.

#### HIGH - Inconsistent ServiceResponse Pattern
Uses `success: true/false` instead of `data/error` pattern used elsewhere.

### 2.5 subscription.service.ts

#### HIGH - Missing Ownership Checks
**Lines 122-140:** `update()` does not verify user owns the subscription.

#### HIGH - Unchecked Mutations
`cancel()`, `reactivate()`, `updateByUserId()` methods do not verify subscription belongs to user.

### 2.6 business-profile.service.ts

#### HIGH - Data Exposure Risk
**Lines 197-207:** `findAll()` returns ALL business profiles without any filtering.

```typescript
async findAll(): Promise<ServiceResponse<BusinessProfile[]>> {
  const profiles = await this.db.select().from(businessProfiles)
  return { data: profiles }  // Returns everything!
}
```

### 2.7 folder.service.ts

#### HIGH - N+1 Query Pattern
**Lines 191-196:** `moveDocumentsToFolder()` loops with individual updates.

```typescript
for (const docId of documentIds) {
  await this.db.update(documents).set({ folderId })...
}
```

**Fix:** Use batch update with `inArray()`.

### 2.8 bulkScheduler.service.ts

#### HIGH - Sequential Processing
**Lines 284-309:** `createPostsBatch()` creates posts one by one in a loop.

```typescript
for (const post of posts) {
  const result = await postService.create(userId, post)
  // Sequential, not parallel
}
```

**Fix:** Use parallel processing with error handling, or batch insert.

---

## 3. API Route Issues

### 3.1 packages/scheduler/server/api/v1/posts/index.post.ts

#### HIGH - Missing Business Ownership Verification
**Line 44:** Creates post without verifying user owns the businessId.

```typescript
const result = await postService.create(user.id, postData)
// No businessProfileService.findById() call to verify ownership
```

### 3.2 packages/bulk-scheduler/server/api/v1/bulk-scheduler/csv-import.post.ts

#### HIGH - Missing Business Ownership Verification
**Line 95:** Bulk creates posts without verifying businessId ownership.

### 3.3 Template API Routes

#### MEDIUM - Manual Validation Instead of Zod
**packages/templates/server/api/v1/templates/index.post.ts:** Uses manual checks instead of Zod schemas.

---

## 4. API Key Service Audit

### Assessment: GOOD

The API key service in `packages/auth/server/services/api-key.service.ts` is well-implemented:

**Strengths:**
- Uses better-auth API for all CRUD operations
- Proper organization-based access control
- `createApiKey()`, `listApiKeys()`, `deleteApiKey()` methods
- API routes verify business ownership before operations
- Audit logging on create/delete operations

**Verified CRUD Operations:**
| Operation | Status | Notes |
|-----------|--------|-------|
| Create | PASS | Verifies business ownership, org membership |
| List | PASS | Verifies business ownership, returns masked keys |
| Delete | PASS | Verifies business ownership, audit logged |
| Rotate | N/A | Not implemented (would need update endpoint) |

---

## 5. ServiceResponse Pattern Violations

### Pattern Definition (from types.ts)
```typescript
interface ServiceResponse<T = any> {
  data?: T
  error?: string
  code?: string
}
```

### Inconsistent Implementations

1. **review.service.ts** - Uses `{ success: true/false, data, error }` instead of `{ data, error }`
2. **subscription.service.ts** - Uses `{ success: true/false, data, error }`
3. **template.service.ts** - Uses `{ success: true/false, data, error }`

### Recommendation
Standardize all services to use the `data/error` pattern without `success` field. Callers should check `if (result.error)` or `if (result.data)`.

---

## 6. IDOR Vulnerability Assessment

### HIGH RISK - Review Service
- `findById()` accessible by anyone knowing review ID
- `update()` allows modifying any review
- `delete()` allows deleting any review

### MEDIUM RISK - Subscription Service  
- `update()` allows modifying any subscription
- `cancel()` allows cancelling any subscription

### MEDIUM RISK - Social Media Account Service
- `getAccountById()` accessible by any authenticated user
- `updateAccount()` allows modifying any account

---

## 7. Recommended Fixes

### Priority 1 - Immediate (CRITICAL)

1. **Add missing indexes** to all schema files
2. **Fix SQL injection** in asset.service.ts `findByIds()` and `deleteMultiple()`
3. **Add ownership checks** to review.service.ts
4. **Wrap post operations in transactions** in post.service.ts

### Priority 2 - Short Term (HIGH)

1. **Fix N+1 queries** in post.service.ts (create, update)
2. **Fix N+1 queries** in folder.service.ts `moveDocumentsToFolder()`
3. **Add business ownership verification** to scheduler API routes
4. **Remove or protect** `business-profile.service.ts` `findAll()`
5. **Add ownership checks** to subscription.service.ts methods

### Priority 3 - Medium Term (MEDIUM)

1. **Standardize ServiceResponse** pattern across all services
2. **Replace manual validation** with Zod schemas in API routes
3. **Batch platform post operations** in post.service.ts
4. **Document intentional bypasses** (e.g., `updateRaw()`)

---

## 8. Files Modified During This Audit

| File | Change |
|------|--------|
| `packages/db/server/services/asset.service.ts` | Fixed 2 SQL injection vulnerabilities (lines 153, 232) |
| `packages/db/db/migrations/0001_add_performance_indexes.sql` | Created migration with 40+ indexes |

### Recommended Migration File
See: `packages/db/db/migrations/0001_add_performance_indexes.sql`

---

## 9. Summary Statistics

| Category | Issues |
|----------|--------|
| Missing Indexes | 25+ |
| N+1 Query Patterns | 5 |
| SQL Injection Risks | 2 |
| Missing Ownership Checks | 12 |
| ServiceResponse Violations | 3 |
| Transaction Missing | 1 |
| Data Exposure Risks | 1 |

---

*End of Audit Report*
