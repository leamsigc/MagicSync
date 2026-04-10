# Codebase Concerns

**Analysis Date:** 2026-04-10

## High Severity Issues

### 1. Hardcoded JWT Secret with Fallback

**Issue:** Default JWT secret is hardcoded in production code with a weak fallback.

**File:** `packages/db/server/utils/llm-jwt.ts`

```typescript
const JWT_SECRET = process.env.NUXT_LLM_JWT_SECRET || 'magicsync-llm-secret-change-me'
```

**Impact:** If the environment variable is not set, the application uses an easily guessable secret for LLM JWT tokens.

**Fix approach:** Remove the fallback entirely and fail fast if the secret is not configured. Add a startup validation check.

---

### 2. Deprecated Instagram Basic Display API Plugin Still Active

**Issue:** Instagram Basic Display API was deprecated on December 4, 2024, but the plugin still exists and can cause confusion.

**File:** `packages/scheduler/server/services/plugins/instagram-standalone.plugin.ts`

**Impact:** Users connecting Instagram accounts may use the wrong plugin. The plugin returns errors but is still selectable.

**Fix approach:** Hide the plugin from the UI, add a migration path to move existing accounts to the Graph API plugin, then remove the plugin entirely.

---

### 3. Empty Error Catch Blocks

**Issue:** Empty catch blocks silently swallow errors without logging.

**Files:**
- `packages/ai-tools/tests/e2e/retrieval.spec.ts` (lines 285, 328)
- `packages/ai-tools/app/composables/useGrowthStrategy.ts` (line 42)

```typescript
} catch {}
```

**Impact:** Errors are silently ignored, making debugging impossible and masking failures.

**Fix approach:** At minimum, log the error. Better: handle it properly or re-throw.

---

### 4. Incomplete Registration Implementation

**Issue:** Email/password registration is blocked with a placeholder that shows an error message.

**File:** `packages/auth/app/pages/register/components/UserRegister.vue`

```typescript
// Line 113: TODO: For now only google is available
add({
  title: t('messages.register_error'),
  description: "Registration only available by invitation code",
  color: 'error'
})
```

**Impact:** Users cannot create accounts except through social login (Google).

**Fix approach:** Implement proper email/password registration or clearly document that registration is invite-only.

---

### 5. Broken GitHub Authentication

**Issue:** GitHub login and registration are stubbed with "coming soon" placeholders.

**Files:**
- `packages/auth/app/pages/register/components/UserRegister.vue` (line 79)
- `packages/auth/app/pages/login/components/UserLogin.vue` (line 58)

**Impact:** Users expecting GitHub OAuth cannot use it.

**Fix approach:** Implement GitHub OAuth or remove the buttons entirely.

---

## Medium Severity Issues

### 6. Type Safety - Extensive Use of `any`

**Issue:** Over 310 instances of `any` type throughout codebase, defeating TypeScript's type checking.

**Common patterns:**
- Catch block error typing: `catch (err: any)`
- Function parameters: `function foo(data: any)`
- Event handlers: `handler as any`

**Impact:** Lost type safety, runtime errors, difficult refactoring.

**Fix approach:** Define proper types for all error handlers, event payloads, and function parameters.

---

### 7. Excessive Console Logging

**Issue:** 257+ `console.log`, `console.warn`, and `console.error` statements throughout production code.

**Examples:**
- `packages/ai-tools/app/pages/app/ai-tools/chat/composables/useA2UIChat.ts` - Debug logs in chat flow
- `packages/tools/app/pages/tools/image-editor/composables/editor/ToolsPlugin.ts` - 20+ console statements
- `packages/auth/server/services/business-org.service.ts` - Debug logging with `##########BEFORE`

**Impact:** Pollutes production logs, potential information leakage.

**Fix approach:** Replace with proper logger (e.g., `pino`, `consola`) with configurable levels.

---

### 8. Subscription Usage Not Implemented

**Issue:** Subscription limit checking returns hardcoded 0 for current usage.

**File:** `packages/db/server/services/subscription.service.ts`

```typescript
// TODO: Implement actual usage counting based on limitType
// This would require querying the relevant tables to get current usage
const current = 0 // Placeholder
```

**Impact:** Subscription limits are not enforced correctly.

**Fix approach:** Implement actual usage counting for each limit type (posts, AI generations, etc.)

---

### 9. Dashboard Metrics API Not Connected

**Issue:** Dashboard metrics fetch is stubbed.

**File:** `packages/site/app/composables/useDashboardMetrics.ts`

```typescript
// TODO: Replace with actual API call
const response = await $fetch<DashboardResponse>(`/api/v1/dashboard/metrics`, {
  query: { businessId }
})
```

**Impact:** Dashboard shows mock data, not real metrics.

**Fix approach:** Implement the `/api/v1/dashboard/metrics` endpoint.

---

### 10. Potential XSS via v-html

**Issue:** `v-html` is used in a few places without sanitization.

**Files:**
- `packages/scheduler/app/pages/app/posts/components/PostModalContent.vue` (line 621)
- `packages/doc/.vitepress/theme/components/ChangelogEntry.vue` (line 64)
- `packages/doc/.vitepress/theme/components/landing/3. code-examples/CodeExamplesSection.vue` (line 200)

**Impact:** If user-controlled content is passed to `v-html`, XSS attacks are possible.

**Fix approach:** Sanitize all content before passing to `v-html`, or avoid `v-html` entirely.

---

### 11. Missing Image Loading Logic

**Issue:** E2E test has incomplete implementation.

**File:** `packages/tools/tests/e2e/filters.spec.ts`

```typescript
// TODO: Add image loading logic here
```

**Impact:** Test is incomplete, cannot verify functionality.

**Fix approach:** Implement the image loading logic or remove the test placeholder.

---

## Low Severity Issues

### 12. Rate Limiting Configuration Exists but Unused

**Issue:** Database schema has rate limit fields but no implementation enforces them.

**File:** `packages/db/db/auth/auth.ts`

```typescript
rateLimitEnabled: integer('rate_limit_enabled', { mode: 'boolean' }),
rateLimitTimeWindow: integer('rate_limit_time_window'),
rateLimitMax: integer('rate_limit_max'),
```

**Impact:** Rate limiting cannot be configured per user/organization.

**Fix approach:** Implement the rate limiting middleware using these fields.

---

### 13. Plugin Methods Not Implemented

**Issue:** Some plugin methods throw "not implemented" errors.

**File:** `packages/scheduler/server/services/plugins/instagram-standalone.plugin.ts`

```typescript
override getStatistic(postDetails: PluginPostDetails, socialMediaAccount: PluginSocialMediaAccount): Promise<any> {
  throw new Error('Method not implemented.');
}
```

**Impact:** Calling these methods crashes the scheduler.

**Fix approach:** Remove unused methods or implement them properly.

---

### 14. Large Files as Maintainability Risk

**Issue:** Some files are extremely large, indicating potential code smell.

**Files:**
- `packages/scheduler/shared/EmojiList.ts` - 11,815 lines (generated, but massive)
- `packages/scheduler/server/services/plugins/facebook.plugin.ts` - 1,694 lines
- `packages/tools/app/pages/tools/text-behave-image-free/components/*.vue` - 941+ lines each
- `packages/assets/app/components/MediaGallery.vue` - 896 lines

**Impact:** Difficult to maintain, test, and understand.

**Fix approach:** Split into smaller modules, extract utilities, use composition for Vue components.

---

### 15. Test Fixtures Have Empty Returns

**Issue:** Some service methods return empty objects instead of proper responses.

**Files:**
- `packages/db/server/services/post.service.ts` (line 354): `return {}`
- `packages/db/server/services/business-profile.service.ts` (line 162): `return {}`
- `packages/scheduler/server/services/plugins/googlemybusiness.plugin.ts` (line 431): `return []`

**Impact:** Callers cannot distinguish between empty results and errors.

**Fix approach:** Return `null` or wrap in a `ServiceResponse` object with error information.

---

## Security Considerations

### 16. API Keys in Client-Side Code Exposure

**Issue:** Various API keys are exposed to client code via `public` runtime config.

**Files:** Multiple `nuxt.config.ts` files expose keys like:
- `NUXT_GOOGLE_GENERATIVE_AI_API_KEY`
- `NUXT_PEXELS_API_KEY`
- OAuth client secrets

**Impact:** Keys visible in browser DevTools could be extracted.

**Fix approach:** Only expose keys needed for client-side. Keep sensitive keys server-side only.

---

## Unknown/Fragile Areas

### 17. Service Layer Inconsistency

**Issue:** Some services return `ServiceResponse<T>`, others throw, others return raw data.

**Evidence:**
- `packages/db/server/services/subscription.service.ts` returns `ServiceResponse<void>`
- `packages/db/server/services/post.service.ts` mixes approaches with `return {}`
- API handlers have inconsistent error handling (414 catch blocks)

**Impact:** Unpredictable error handling makes debugging difficult.

**Fix approach:** Standardize all services to return `ServiceResponse<T>` and never throw.

---

*Concerns audit completed: 2026-04-10*