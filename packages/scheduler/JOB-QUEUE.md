# MagicSync DB-Backed Job Queue

**No BullMQ dependency.** The scheduler uses Drizzle ORM + Nitro scheduled tasks for a fully self-contained, zero-dependency job queue.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Nitro Server (runs every minute via defineTask)            │
│                                                             │
│  social:post task                                           │
│  │                                                         │
│  ├─ postService.getPostsToProcessNow()                      │
│  │   (SELECT pending posts from DB)                         │
│  │                                                         │
│  ├─ AutoPostService.triggerSocialMediaPost()               │
│  │   ├─ PlatformRateLimiter.canMakeRequest(platform)       │
│  │   ├─ SchedulerPost.publish(platform)                    │
│  │   └─ postService.scheduleRetry() on failure             │
│  │                                                         │
│  └─ Return result                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## How Posts Get Picked Up

1. **Nitro scheduled task** runs `social:post` task every minute
2. `postService.getPostsToProcessNow()` queries the database
3. `AutoPostService.triggerSocialMediaPost()` publishes to each platform in parallel
4. Results are persisted to the DB

### The SQL Query (Drizzle ORM)

```sql
SELECT * FROM posts
WHERE status = 'pending'
  AND scheduledAt <= NOW()          -- catch-up: any past scheduledAt
  AND (nextRetryAt IS NULL         -- no retry scheduled
       OR nextRetryAt <= NOW())     -- retry window has passed
ORDER BY scheduledAt ASC            -- oldest first (FIFO)
LIMIT 100                          -- prevent overwhelming
```

---

## Catch-Up Logic (Problem #1 Fixed)

**Old (broken):** Only queried posts from today. Posts scheduled during server downtime were lost forever.

**New (fixed):** Queries posts from ANY day where `scheduledAt <= now`.

- Server restarts at 9 AM: all posts scheduled for 1 AM - 9 AM get picked up immediately
- Server was down for 4 hours: all posts get processed when it comes back up
- No data loss from downtime

---

## Auto-Retry with Exponential Backoff (Problem #2 Fixed)

When a publish fails, `postService.scheduleRetry()` is called instead of immediately marking the post as permanently failed.

### Backoff Schedule

| Attempt | Delay    | retryCount (after) | nextRetryAt      |
|--------|----------|-------------------|------------------|
| 1      | 5 min    | 1                 | now + 5 min      |
| 2      | 10 min   | 2                 | now + 10 min     |
| 3      | 20 min   | 3                 | now + 20 min     |
| 4      | 40 min   | 4                 | now + 40 min     |
| 5      | 80 min   | 5                 | RETRY_EXHAUSTED  |

Formula: `nextRetryAt = now + 5min * 2^(retryCount - 1)`

### Retry Conditions
- API timeout
- Rate limit exceeded (HTTP 429)
- Server errors (HTTP 5xx)
- Missing/invalid access token
- Network failures

### Permanently Failed
After 5 failed attempts, `status = 'failed'` is set permanently. `lastError` stores the final error. Users can manually retry via the UI.

### How Backoff Is Excluded
The query explicitly excludes posts where `nextRetryAt > now`. This prevents the scheduler from re-attempting posts that are still in their backoff window.

---

## Rate Limiting (Problem #3 Fixed)

`PlatformRateLimiter` implements an in-memory sliding window per platform.

### Default Limits

| Platform       | Max Requests | Window   |
|---------------|-------------|----------|
| Twitter / X   | 50          | 15 min   |
| LinkedIn      | 25          | 1 min    |
| Facebook      | 200         | 1 min    |
| Instagram     | 20          | 1 hour   |
| Bluesky       | 300         | 1 hour   |
| YouTube       | 10          | 1 min    |
| TikTok        | 50          | 1 min    |
| Reddit        | 30          | 1 min    |
| Default       | 30          | 1 min    |

### Behavior
1. Before each API call, `canMakeRequest(platform)` is checked
2. If allowed: counter increments, publish proceeds
3. If blocked: `scheduleRetry()` is called with the rate limit error and the platform is skipped
4. The window resets automatically after `windowMs`

### Multi-Instance Consideration
Rate limiting is **in-memory per instance**. With multiple Nitro instances:
- Each instance tracks independently
- One instance may hit the rate limit while others don't
- This is acceptable for v1; consider Redis-backed rate limiting for production at scale

---

## Files

| File | Purpose |
|------|---------|
| `packages/db/db/posts/posts.ts` | Schema: `retryCount`, `nextRetryAt`, `lastError` columns |
| `packages/db/server/services/post.service.ts` | `getPostsToProcessNow()`, `scheduleRetry()` |
| `packages/scheduler/server/services/AutoPost.service.ts` | `triggerSocialMediaPost()` with rate limit + retry |
| `packages/scheduler/server/services/RateLimiter.service.ts` | `PlatformRateLimiter` class |
| `packages/scheduler/server/tasks/social/post.ts` | Nitro task: orchestrates everything |
| `packages/scheduler/server/utils/test-scheduler.ts` | CLI test script (8 tests) |
| `packages/scheduler/server/utils/verify-job-queue.ts` | Verification script |

---

## Migration

After merging these changes, run:

```bash
# Regenerate types
pnpm --filter @local-monorepo/db db:generate

# Apply migration
pnpm --filter @local-monorepo/db db:migrate

# Verify
npx tsx packages/scheduler/server/utils/verify-job-queue.ts

# Run tests
npx tsx packages/scheduler/server/utils/test-scheduler.ts
```

---

## Manual Retry (API)

The existing `retryFailedPost()` API endpoint is unchanged and still works for manual user-triggered retries. It resets `retryCount` and `nextRetryAt` to allow immediate retry.

---

## Monitoring

The scheduler logs:
- `[RateLimit] Platform 'twitter' is rate-limited. Retry in 843s. Post ID: ...` when rate limited
- `[AutoPost] Failed to publish to 'linkedin' | Post ID: ... | Error: ...` on failures
- `[social:post] Processed 42 posts. Rate limiter windows active: 7` after each run

The rate limiter state can be introspected via `platformRateLimiter.getState()`.
