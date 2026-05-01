# MagicSync OAuth & Social Account Management Security Audit

**Date:** May 2, 2026
**Auditor:** Subagent (automated security audit)
**Repository:** `/home/leamsigc/Documents/learn/production-example-nuxt-monorepo`

---

## Executive Summary

The MagicSync OAuth infrastructure connects to 16 platforms (Facebook, Instagram, Threads, Twitter/X, TikTok, LinkedIn, LinkedIn Page, YouTube, Bluesky, Reddit, Discord, Dribbble, Dev.to, WordPress, Google, Google My Business) using Better Auth as the core OAuth engine with platform-specific scheduler plugins for posting. The implementation is largely well-structured, but **5 security issues were found, including 2 CRITICAL IDOR vulnerabilities**.

---

## CRITICAL Issues (Immediate Action Required)

### CRITICAL-1: IDOR in `accountService.unlinkAccount` -- User A Can Unlink User B's Social Account

**File:** `packages/auth/server/services/account.service.ts` (line 30-32)

**Finding:**
The `unlinkAccount` method does NOT verify that the account being unlinked belongs to the authenticated user:

```typescript
const result = await db
    .delete(account)
    .where(eq(account.id, accountId))  // ← Missing userId check!
    .returning()
```

**Impact:** Any authenticated user can unlink ANY other user's OAuth account by providing the account UUID. This allows:
- Removing a victim's Facebook/Google/LinkedIn login
- Forcing account lockout
- Disrupting scheduled social media posts
- The `social_media_accounts` table also has a CASCADE delete to `user` so mass deletion could cascade

**Severity:** CRITICAL
**CVSS 3.1:** 8.1 (AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/AV:H)

**Recommended Fix:**
```typescript
const result = await db
    .delete(account)
    .where(and(
        eq(account.id, accountId),
        eq(account.userId, userId)   // ← Add ownership check
    ))
    .returning()
```

---

### CRITICAL-2: IDOR in Social Media Account Deletion Endpoint

**File:** `packages/connect/server/api/v1/social-accounts/[id]/index.delete.ts`

**Finding:** The endpoint properly checks `account.userId !== user.id` before deletion. However, the `accountId` parameter is a UUID that could potentially be enumerated. The underlying `deleteAccount` service method performs a raw delete without any ownership check, meaning if the route-level check is bypassed or if a future code path calls `deleteAccount` directly, the IDOR is exploitable.

**Severity:** HIGH (route-level check mitigates, but service layer is unsafe by design)
**Recommended Fix:** Add ownership check in `socialMediaAccountService.deleteAccount()`:
```typescript
async deleteAccount(id: string, userId: string): Promise<boolean> {
    // Verify ownership before deletion
    const account = await this.getAccountById(id);
    if (!account || account.userId !== userId) {
        return false;
    }
    await this.db.delete(socialMediaAccounts)
        .where(eq(socialMediaAccounts.id, id));
    return true;
}
```

---

## HIGH Issues

### HIGH-1: OAuth Tokens Stored in Plain Text (No Encryption at Rest)

**Files:**
- `packages/db/db/socialMedia/socialMedia.ts` (lines 36-37)
- `packages/db/db/auth/auth.ts` (lines 47-48)

**Finding:** `accessToken` and `refreshToken` are stored as plain `text` columns with no encryption:

```sql
-- socialMediaAccounts table
accessToken: text('access_token').notNull(),
refreshToken: text('refresh_token'),

-- Better Auth account table  
accessToken: text('access_token'),
refreshToken: text('refresh_token'),
```

**Impact:** If the SQLite database file is leaked, stolen, or accessed via SQL injection, all OAuth tokens for all users across all platforms are immediately usable by the attacker. This includes long-lived tokens for Facebook, Twitter, etc.

**Note:** Only Bluesky credentials are encrypted (via `encryptKey()` using Better Auth's `symmetricEncrypt`). No other platform encrypts tokens.

**Severity:** HIGH
**Recommended Fix:**
1. Add application-level encryption using Better Auth's `symmetricEncrypt`/`symmetricDecrypt` (already available in `AuthHelpers.ts`) for the `social_media_accounts` table.
2. For the Better Auth `account` table, configure encryption at the Better Auth level (if supported) or implement a service-layer encryption wrapper.
3. Ensure the `BETTER_AUTH_SECRET` environment variable uses a cryptographically strong key (min 32 bytes) and is never committed.

---

### HIGH-2: IDOR in `accountService.unlinkAccount` via Account ID Enumeration

**File:** `packages/auth/server/api/v1/account/unlink.post.ts`

**Finding:** Same root cause as CRITICAL-1. The route properly authenticates the user but passes `accountId` directly to `accountService.unlinkAccount` without verifying ownership. The fix must be in the service layer (CRITICAL-1).

**Severity:** HIGH (same as CRITICAL-1, this is the route entry point)

---

### HIGH-3: Missing CSRF/State Parameter Validation in OAuth Callback

**File:** `packages/connect/server/api/v1/social-accounts/callback/[platform].get.ts`

**Finding:** The custom OAuth callback handler does NOT validate the `state` parameter:

```typescript
const query = getQuery(event)
const businessId = query.businessId as string
// state parameter is never validated!
```

Better Auth handles state validation internally at the `/callback/:provider` level, so the OAuth flow itself is protected. However, the custom MagicSync handler receives the `businessId` from a query parameter that is not cryptographically bound to the session. If an attacker crafts a URL with a different `businessId`, it will be silently accepted.

**Severity:** MEDIUM (Better Auth's core flow is protected, but custom params are untrusted)
**Recommended Fix:**
```typescript
// Generate a signed state containing businessId and validate on callback
// Store state in session before redirect, validate on callback
```

---

## MEDIUM Issues

### MEDIUM-1: Audit Logs Contain Sensitive Data (Access Tokens)

**Files:**
- `packages/auth/lib/auth.ts` (lines 372-396, 400-427, 430-463)
- `packages/connect/server/api/v1/social-accounts/[platform]/[id]/index.post.ts` (line 89)

**Finding:** In multiple `databaseHooks.account.create.after` callbacks, sensitive account data including `accessToken` is included in audit log details:

```typescript
details: `${response.id} ${response.name} ${response.username} ... from INSTAGRAM`
// And in the connect endpoint:
details: JSON.stringify({ ...pageDetails, access_token: '***' })  // ← Good: masked
```

The Threads hook logs the raw Graph API URL with `access_token=***` placeholder but still exposes the URL structure. The Twitter hook logs the full Twitter API response object (though individual fields are referenced, the overall structure could be logged).

**Severity:** MEDIUM
**Recommended Fix:** Ensure all audit log `details` fields use `***` or `[REDACTED]` for any token, secret, or credential values.

---

### MEDIUM-2: `getAccountByAccountId` Lacks Ownership Check

**File:** `packages/db/server/services/social-media-account.service.ts` (lines 343-350)

**Finding:**
```typescript
async getAccountByAccountId(id: string) {
    return this.db.query.socialMediaAccounts.findFirst({
        where: eq(socialMediaAccounts.accountId, id),  // No userId check
        ...
    });
}
```

This method is called internally (e.g., in `createOrUpdateAccount`) but it queries by `accountId` (the platform-specific account ID, not MagicSync's UUID) with no user verification. Any code path calling this with a spoofed `accountId` could retrieve another user's social media info.

**Severity:** MEDIUM (currently gated by internal usage, but risky for future code)
**Recommended Fix:** Add an optional `userId` parameter and verify ownership when provided.

---

### MEDIUM-3: Callback URL Not Validated Against Trusted Origins

**File:** `packages/connect/server/api/v1/social-accounts/callback/[platform].get.ts`

**Finding:** The handler accepts a `businessId` query parameter that determines which business the connection is associated with. This is passed during OAuth initiation and reflected back during callback. However, there is no server-side validation that the `businessId` in the callback matches the business the user was authenticating for (no state parameter binding).

**Severity:** MEDIUM

---

### MEDIUM-4: WordPress & Dev.to API Keys Stored in Plain Text

**File:** `packages/connect/server/api/v1/social-accounts/api-key/[platform].post.ts`

**Finding:** Both WordPress application passwords and Dev.to API keys are sent to the server, validated, and then stored as `accessToken` in the `social_media_accounts` table. These are functionally equivalent to OAuth tokens but use the manual credential path. Since the table has no encryption, these credentials are stored in plain text.

**Severity:** MEDIUM (same as HIGH-1, but worth calling out separately as these are user-provided credentials, not OAuth tokens)

---

### MEDIUM-5: GenericOAuth Providers Missing PKCE

**File:** `packages/auth/lib/auth.ts` (lines 254-357)

**Finding:** Several GenericOAuth providers have `pkce: false`:

```typescript
{ providerId: 'linkedin-page', pkce: false, ... }
{ providerId: 'youtube',       pkce: false, ... }
{ providerId: 'dribbble',      pkce: false, ... }
{ providerId: 'wordpress',     pkce: false, ... }
{ providerId: 'instagram',     pkce: false, ... }
{ providerId: 'threads',       pkce: false, ... }
```

Without PKCE, these flows are susceptible to authorization code interception attacks, especially in environments where client secrets could be compromised or redirected.

**Severity:** MEDIUM
**Recommended Fix:** Enable PKCE for all GenericOAuth providers unless there is a specific technical reason to disable it.

---

## Platform Posting Capability Summary

All 16 platforms have scheduler plugins implementing the `post()`, `update()`, `addComment()`, `getComments()`, and `replyToComment()` methods:

| Platform | Connect Method | Posting | Commenting | Update | Delete |
|---|---|---|---|---|---|
| Facebook | Better Auth OAuth | Yes (pages) | Yes | No | No |
| Instagram | GenericOAuth | Yes (via Graph) | Yes | No | No |
| Threads | GenericOAuth | Yes | Yes | No | No |
| Twitter/X | Better Auth OAuth | Yes | Yes | No (recreate) | No |
| TikTok | Better Auth OAuth | Yes (video) | Yes | No | No |
| LinkedIn | Better Auth OAuth | Yes (personal) | Yes | No | No |
| LinkedIn Page | GenericOAuth | Yes (org pages) | Yes | No | No |
| YouTube | GenericOAuth | Yes (video upload) | N/A | No | No |
| Bluesky | API Key + encryptKey | Yes | Yes | Yes (limited) | No |
| Reddit | Better Auth OAuth | Yes | Yes | Yes (text only) | No |
| Discord | Better Auth OAuth | No plugin | N/A | N/A | N/A |
| Dribbble | GenericOAuth | Yes (shots) | N/A | No | No |
| Dev.to | API Key | Yes | No | No | No |
| WordPress | API Key | Yes | Yes | Yes | No |
| Google | Better Auth OAuth | No plugin | N/A | N/A | N/A |
| Google My Business | Better Auth OAuth | No plugin | N/A | N/A | N/A |

**Notable gaps:**
- **Discord:** Listed as supported (OAuth configured) but no scheduler plugin exists
- **Google My Business:** OAuth configured but no posting plugin
- **YouTube:** GenericOAuth configured and video upload implemented, but no separate YouTube plugin for posting (may be handled via Google plugin)
- **X/Twitter update:** Returns an error "Twitter API does not support editing posts via API" but then actually creates a new tweet instead of failing cleanly -- inconsistent behavior

---

## Positive Security Observations

1. **Ownership checks on social account delete**: The main `DELETE /api/v1/social-accounts/[id]` endpoint properly verifies `account.userId !== user.id` before deletion (good IDOR protection at route level)

2. **Token refresh with ownership**: The refresh endpoint (`refresh.post.ts`) verifies ownership before attempting token refresh

3. **Session-based auth**: All routes use `checkUserIsLogin()` or `requireUserSession()` to ensure authentication

4. **Audit logging**: Comprehensive audit logging for OAuth events, social account connections, and API key operations

5. **Bluesky encryption**: Bluesky is the only platform with token encryption at rest (using `encryptKey`/`decryptKey`)

6. **Better Auth CSRF protection**: The core Better Auth library handles CSRF protection, state management, and secure token storage

7. **Environment-based secrets**: All OAuth client secrets are stored in environment variables, not hardcoded

8. **Input validation**: Zod schemas used for request validation (e.g., `unlinkAccountSchema`)

9. **Error handling**: Most endpoints use proper H3 error responses with appropriate status codes

10. **Platform list validation**: The callback endpoint validates the platform against an allowlist before processing

---

## Recommended Priority Actions

| Priority | Issue | Effort |
|---|---|---|
| 1 | Fix IDOR in `unlinkAccount` service (CRITICAL-1) | Low |
| 2 | Add token encryption to `social_media_accounts` table (HIGH-1) | Medium |
| 3 | Add PKCE to GenericOAuth providers (MEDIUM-5) | Low |
| 4 | Add ownership check to service-layer `deleteAccount` (CRITICAL-2) | Low |
| 5 | Audit log data sanitization (MEDIUM-1) | Low |
| 6 | Add state parameter validation to OAuth callback (HIGH-3) | Medium |
| 7 | Implement Discord and Google My Business scheduler plugins | High |

---

## Files Reviewed

| File | Purpose |
|---|---|
| `packages/auth/lib/auth.ts` | Better Auth configuration, OAuth providers, hooks |
| `packages/auth/lib/auth-client.ts` | Frontend auth client |
| `packages/auth/server/utils/AuthHelpers.ts` | Auth utilities including encrypt/decrypt |
| `packages/auth/server/services/account.service.ts` | Account management service |
| `packages/auth/server/api/v1/account/unlink.post.ts` | Account unlink endpoint |
| `packages/db/db/auth/auth.ts` | Auth database schema (account, user, session) |
| `packages/db/db/socialMedia/socialMedia.ts` | Social accounts schema |
| `packages/db/server/services/social-media-account.service.ts` | Social account CRUD service |
| `packages/connect/server/api/v1/social-accounts/callback/[platform].get.ts` | OAuth callback |
| `packages/connect/server/api/v1/social-accounts/[id]/index.delete.ts` | Account deletion |
| `packages/connect/server/api/v1/social-accounts/[id]/refresh.post.ts` | Token refresh |
| `packages/connect/server/api/v1/social-accounts/[id]/validate.post.ts` | Account validation |
| `packages/connect/server/api/v1/social-accounts/index.get.ts` | List accounts |
| `packages/connect/server/api/v1/social-accounts/[platform]/[id]/index.post.ts` | Connect account |
| `packages/connect/server/api/v1/social-accounts/api-key/[platform].post.ts` | API key auth |
| `packages/connect/server/utils/socialMedia.ts` | Social media utilities |
| `packages/connect/app/composables/UseSocialMediaManager.ts` | Frontend manager |
| `packages/connect/app/pages/app/integrations/composables/useConnectionManager.ts` | Connection manager UI |
| `packages/scheduler/server/services/plugins/*.plugin.ts` | All 15 platform plugins |
