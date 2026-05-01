# MagicSync Scheduler System Audit

## Executive Summary

This audit examines the bulk scheduler and post scheduling system in MagicSync, covering the `packages/bulk-scheduler/` and `packages/scheduler/` packages. The system provides comprehensive post scheduling capabilities with multi-platform support, AI-powered content generation, and automated publishing.

---

## 1. Bulk Scheduler Package (`packages/bulk-scheduler/`)

### 1.1 Bulk Post Generation Features

**Status: IMPLEMENTED**

The bulk scheduler provides two main bulk creation methods:

#### CSV Import (`csv-import.post.ts`)
- **Endpoint**: `POST /api/v1/bulk-scheduler/csv-import`
- **Features**:
  - Multipart form data upload for CSV files
  - Automatic CSV parsing with PapaParse library
  - Validation of required columns (`content`)
  - URL validation for image columns
  - Date validation for `scheduled_time` column
  - Batch asset downloading from URLs
  - Even distribution across date ranges
  - Media asset cycling for posts without images

#### Template-Based Generation (`generate.post.ts`)
- **Endpoint**: `POST /api/v1/bulk-scheduler/generate`
- **Features**:
  - Variable substitution using `{{variable}}` syntax
  - System variables: `{{date}}`, `{{time}}`, `{{day}}`, `{{month}}`, `{{year}}`
  - Date distribution across date ranges
  - Weekend skipping option
  - Business hours only distribution
  - Platform-specific content trimming
  - First comment templating

### 1.2 AI-Powered Template System

**Status: PARTIALLY IMPLEMENTED**

- **Template Processor** (`utils/templateProcessor.ts`):
  - Variable substitution with `{{key}}` syntax
  - Missing variable detection
  - Syntax validation
  - Default system variables

- **Gap Identified**: No AI integration in bulk-scheduler for content generation. The AI features exist in the scheduler package (`/api/v1/ai/generate`) but are not wired into bulk generation.

### 1.3 Bulk Scheduling UI and API Endpoints

**Status: IMPLEMENTED**

**API Endpoints**:
- `POST /api/v1/bulk-scheduler/generate` - Template-based bulk generation
- `POST /api/v1/bulk-scheduler/csv-import` - CSV file import

**Composables** (`app/composables/`):
- `useBulkScheduler.ts` - Main UI composable with error handling
- `useCsvParser.ts` - Client-side CSV parsing
- `useContentSplit.ts` - Content splitting utilities

### 1.4 Error Handling for Bulk Operations

**Status: IMPLEMENTED**

Error handling includes:
- Validation of required fields (template, platforms, businessId, date range, content rows)
- Row-level error reporting in CSV imports
- Notification system integration for success/failure states
- Partial success handling (continues on individual post failures)
- Graceful handling of asset download failures

**Code Location**: `server/services/bulkScheduler.service.ts` lines 284-308

---

## 2. Scheduler Package (`packages/scheduler/`)

### 2.1 Cron Job Setup and Execution

**Status: IMPLEMENTED**

**Configuration** (`nuxt.config.ts` lines 23-26):
```typescript
nitro: {
  experimental: {
    scheduledTasks: {
      '*/15 * * * *': ['social:post']  // Every 15 minutes
    }
  }
}
```

**Task Definition** (`server/tasks/social/post.ts`):
- Task name: `social:post`
- Runs every 15 minutes
- Queries posts due for publishing via `postService.getPostsToProcessNow()`
- Triggers `AutoPostService.triggerSocialMediaPost()` for each post

### 2.2 Scheduled Post Publishing Logic

**Status: IMPLEMENTED**

**Flow**:
1. Cron job triggers `social:post` task every 15 minutes
2. `getPostsToProcessNow()` queries posts where:
   - `status = 'pending'`
   - `scheduledAt <= now`
   - `scheduledAt >= startOfToday`
3. For each post, `AutoPostService.triggerSocialMediaPost()` is called
4. Platform-specific plugins publish to each target

**Database Persistence** (`db/posts/posts.ts`):
- Posts stored in `posts` table with `scheduledAt` timestamp
- Platform-specific tracking in `platform_posts` table
- Status tracking: `pending`, `published`, `failed`

### 2.3 Retry Mechanism for Failed Posts

**Status: FULLY IMPLEMENTED**

**Automatic Retry Logic** (`post.service.ts`):
- `scheduleRetry(postId, currentRetryCount, error)` — schedules exponential backoff
- `getPostsToProcessNow()` — excludes posts where `nextRetryAt > now`

**Exponential Backoff Schedule**:
| Attempt | Delay   | retryCount (after) | nextRetryAt      |
|---------|---------|-------------------|------------------|
| 1       | 5 min   | 1                 | now + 5 min     |
| 2       | 10 min  | 2                 | now + 10 min    |
| 3       | 20 min  | 3                 | now + 20 min   |
| 4       | 40 min  | 4                 | now + 40 min   |
| 5       | 80 min  | 5                 | RETRY_EXHAUSTED |

After 5 failed attempts: `status = 'failed'` permanently. `lastError` stores the final error.

**Manual Retry** (`retryFailedPost()`) still available for user-triggered retries.

### 2.4 Platform-Specific Publishing Logic

**Status: IMPLEMENTED**

**Supported Platforms** (15 platforms):
- Facebook, Instagram, Instagram-Standalone, X (Twitter)
- LinkedIn, LinkedIn-Page, TikTok, YouTube
- Threads, Reddit, Discord, Bluesky
- Google My Business, WordPress, Dev.to, Dribbble

**Plugin Architecture** (`server/services/SchedulerPost.service.ts`):
- Base plugin interface with required methods:
  - `validate()`, `post()`, `update()`, `addComment()`
  - `getStatistic()`, `getComments()`, `replyToComment()`
- Platform-specific implementations in `plugins/` directory

**Platform Configuration** (`shared/platformConstants.ts`):
- Max post lengths per platform
- Media constraints (image types, sizes, aspect ratios)
- Video duration limits
- Feature support flags (carousel, comments, etc.)

---

## 3. Queue/Worker System Analysis

### Current Implementation

**Status: DB-BACKED JOB QUEUE (no BullMQ needed)**

**What Was Implemented** (2025):
- **Catch-up query**: `getPostsToProcessNow()` picks up ANY past posts (not just today)
- **Exponential backoff**: `scheduleRetry()` with 5m, 10m, 20m, 40m, 80m delays
- **Rate limiting**: `PlatformRateLimiter` per-platform sliding window (in-memory)
- **Retry tracking**: `retryCount`, `nextRetryAt`, `lastError` columns on posts table

**Key Files**:
- `packages/db/db/posts/posts.ts` — schema with retry columns
- `packages/db/server/services/post.service.ts` — `getPostsToProcessNow()`, `scheduleRetry()`
- `packages/scheduler/server/services/AutoPost.service.ts` — `triggerSocialMediaPost()` with rate limit + retry
- `packages/scheduler/server/services/RateLimiter.service.ts` — `PlatformRateLimiter`
- `packages/scheduler/server/tasks/social/post.ts` — Nitro task orchestrator

**Benefits over BullMQ**:
1. No new dependency
2. Persists in the existing SQLite/Turso DB
3. Uses existing Nitro scheduled tasks
4. Works with single-instance and multi-instance (DB is shared)

**Limitations**:
- Rate limiting is per-instance (in-memory). With multiple Nitro instances, each tracks independently. Acceptable for v1.
- No dedicated worker processes (runs in Nitro's task handler)

See `packages/scheduler/JOB-QUEUE.md` for full documentation.

---

## 4. Persistence and Server Restart Survival

### Post Persistence

**Status: PERSISTENT**

**Database Schema**:
```
posts (id, userId, businessId, content, scheduledAt, status, ...)
  └── platform_posts (id, postId, socialAccountId, status, ...)
```

**Persistence Mechanism**:
- SQLite with Drizzle ORM (Turso configuration)
- Posts survive server restarts
- `scheduledAt` preserved in database
- `getPostsToProcessNow()` re-queries due posts on restart

### Server Restart Behavior

**What Happens**:
1. Server restarts
2. Posts remain in `pending` status in database
3. Next cron trigger (max 15 minutes) processes due posts
4. Posts scheduled during downtime are processed late

**Gap Identified**: No "catch-up" mechanism for posts missed during downtime.

---

## 5. Missing Features and Recommendations

### High Priority

| Feature | Current Status | Recommendation |
|---------|---------------|----------------|
| Automatic Retry | Manual only | Add BullMQ with auto-retry |
| Queue System | None | Implement Redis/BullMQ |
| Catch-up Processing | None | On startup, process missed posts |
| Rate Limiting per Platform | Partial | Implement per-account rate limits |
| Webhook Notifications | None | Add webhook on publish success/failure |

### Medium Priority

| Feature | Current Status | Recommendation |
|---------|---------------|----------------|
| AI Content Generation in Bulk | Not integrated | Wire AI generate to bulk creation |
| Duplicate Detection | None | Add content hashing |
| Post Editing After Schedule | Limited | Add status-based editing rules |
| Bulk Status Update | None | Cancel/reschedule multiple posts |
| Timezone Support | Basic | Full timezone-aware scheduling |

### Low Priority

| Feature | Current Status | Recommendation |
|---------|---------------|----------------|
| Custom Posting Schedules | Basic | Business hours templates |
| A/B Testing | None | Platform-specific variations |
| Post Preview | None | Platform-specific previews |
| Performance Analytics | Basic | Per-post engagement tracking |

---

## 6. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MagicSync Site                               │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐                         │
│  │  Bulk Generator │    │  CSV Importer   │                         │
│  └────────┬────────┘    └────────┬────────┘                         │
│           │                     │                                   │
│           └──────────┬──────────┘                                   │
│                      ▼                                              │
│           ┌─────────────────────┐                                   │
│           │  BulkSchedulerService│                                  │
│           └──────────┬──────────┘                                   │
│                      ▼                                              │
│           ┌─────────────────────┐                                   │
│           │     Post Service    │                                  │
│           └──────────┬──────────┘                                   │
│                      ▼                                              │
│           ┌─────────────────────┐                                   │
│           │    SQLite/Turso DB   │                                  │
│           │   (posts table)     │                                  │
│           └─────────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (every 15 minutes)
┌─────────────────────────────────────────────────────────────────────┐
│                     Nitro Scheduled Task                             │
│                    "social:post" task                                │
├─────────────────────────────────────────────────────────────────────┤
│                      ▼                                               │
│           ┌─────────────────────┐                                   │
│           │   AutoPostService   │                                  │
│           └──────────┬──────────┘                                   │
│                      ▼                                               │
│           ┌─────────────────────┐                                   │
│           │  SchedulerPost      │                                   │
│           │  (Plugin Manager)  │                                   │
│           └──────────┬──────────┘                                   │
│                      ▼                                               │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐          │
│  │ Facebook    │ Instagram   │ LinkedIn    │ X/Twitter   │  ...     │
│  │ Plugin      │ Plugin      │ Plugin      │ Plugin      │          │
│  └─────────────┴─────────────┴─────────────┴─────────────┘          │
│                      │                                               │
│                      ▼                                               │
│           ┌─────────────────────┐                                   │
│           │  Platform APIs      │                                  │
│           │ (External Services) │                                  │
│           └─────────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Key Files Reference

### Bulk Scheduler
| File | Purpose |
|------|---------|
| `server/services/bulkScheduler.service.ts` | Core bulk creation logic |
| `server/api/v1/bulk-scheduler/generate.post.ts` | Template generation endpoint |
| `server/api/v1/bulk-scheduler/csv-import.post.ts` | CSV import endpoint |
| `utils/templateProcessor.ts` | Variable substitution |
| `utils/dateDistribution.ts` | Date/time slot distribution |
| `utils/csvParser.ts` | CSV parsing utilities |

### Scheduler
| File | Purpose |
|------|---------|
| `server/services/AutoPost.service.ts` | Post triggering orchestration |
| `server/services/SchedulerPost.service.ts` | Plugin management |
| `server/tasks/social/post.ts` | Cron task definition |
| `server/utils/ScheduleUtils.ts` | Token refresh, utilities |
| `shared/platformConstants.ts` | Platform configurations |

### Database
| File | Purpose |
|------|---------|
| `db/posts/posts.ts` | Post schema definitions |
| `server/services/post.service.ts` | Post CRUD operations |

---

## 8. Conclusion

The MagicSync scheduling system is **functional and well-structured** with:
- Good multi-platform support (15 platforms)
- Reliable database persistence
- Clean separation of concerns via plugins
- Comprehensive API for bulk operations

**Critical Gaps**:
1. No dedicated queue/worker system
2. No automatic retry for failed posts
3. Limited error recovery mechanisms

**Recommended Next Steps**:
1. Implement BullMQ with Redis for job queuing
2. Add automatic retry with exponential backoff
3. Implement startup catch-up processing
4. Add webhook notifications for post events

---

*Audit completed: May 2026*
*Auditor: Hermes Agent*
