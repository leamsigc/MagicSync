# PRD: Social Inbox — Unified Comment Management

**Date:** 2026-09-07
**Status:** COMMENTS + NOTIFICATIONS DONE — DMs: Facebook vertical slice live (list + reply + Messages tab); X/Bluesky/IG/Mastodon pending (see PROGRESS.md Gap 2b)
**Goal:** Match OpenPost's unified inbox with comment management, moderation, and DM support

---

## Current State

### What EXISTS (Backend)
- `GET /api/v1/posts/[id]/comments/[platform]` — fetch comments for a post
- `POST /api/v1/posts/[id]/comments/[platform]/reply` — reply to a comment
- Plugin implementations: Facebook, Instagram, X, Bluesky, LinkedIn, Threads, TikTok, YouTube
- Facebook: `deleteComment`, `hideComment` (moderation)
- Unified `PlatformComment` shape in `SchedulerPost.service.ts`

### What's MISSING
- Unified inbox UI (no `/app/inbox` page)
- Comment moderation (like/hide/delete) for all platforms
- DM management (no backend endpoints)
- Notification system
- Cross-post comment aggregation

---

## Implementation Plan

### Phase A: Comment Moderation Backend (Day 1)

#### A1: Add moderation methods to SchedulerPost base class
- `likeComment(post, account, commentId)` — like a comment
- `hideComment(post, account, commentId, isHidden)` — hide/unhide (Facebook, Instagram)
- `deleteComment(post, account, commentId)` — delete (Facebook, Instagram)

#### A2: Add moderation to AutoPostService
- `likeComment({ post, socialAccount, platform, commentId })`
- `hideComment({ post, socialAccount, platform, commentId, isHidden })`
- `deleteComment({ post, socialAccount, platform, commentId })`

#### A3: Add API endpoints
- `POST /api/v1/posts/[id]/comments/[platform]/like`
- `POST /api/v1/posts/[id]/comments/[platform]/hide`
- `POST /api/v1/posts/[id]/comments/[platform]/delete`

### Phase B: Unified Inbox Backend (Day 1-2)

#### B1: Create InboxService
- `getUnifiedInbox({ userId, filters })` — aggregate comments across all posts/accounts
- `getInboxCount({ userId })` — unread count for badge
- `markAsRead({ userId, commentIds })` — mark comments as read

#### B2: Create inbox API endpoints
- `GET /api/v1/inbox` — unified inbox with filters (platform, post, read state)
- `GET /api/v1/inbox/count` — unread count
- `POST /api/v1/inbox/read` — mark as read

#### B3: Add inbox table to database
- `inbox_items` — store normalized inbox items (comments, DMs, notifications)

### Phase C: Unified Inbox Frontend (Day 2-3)

#### C1: Create inbox page
- `/app/inbox/index.vue` — unified inbox with tabs: Comments, Messages, Notifications
- Filter by platform, account, post, read state
- Comment cards with reply, like, hide, delete actions

#### C2: Create inbox composable
- `useInbox.ts` — fetch inbox, mark as read, moderation actions

#### C3: Create inbox components
- `InboxCommentCard.vue` — single comment with actions
- `InboxFilters.vue` — platform/account filters
- `InboxTabs.vue` — tab navigation

### Phase D: Notifications (Day 3-4)

#### D1: Create NotificationService
- `getNotifications({ userId })` — fetch notifications
- `markAsRead({ userId, ids })` — mark as read
- `getUnreadCount({ userId })` — unread count

#### D2: Create notification API endpoints
- `GET /api/v1/notifications` — list notifications
- `GET /api/v1/notifications/count` — unread count
- `POST /api/v1/notifications/read` — mark as read

#### D3: Add notification triggers
- New comment on published post
- New DM (when DM support is added)
- Post publish failures

---

## Database Schema

### `inbox_items` table 
```sql
CREATE TABLE inbox_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  type TEXT NOT NULL, -- 'comment', 'dm', 'notification'
  platform TEXT NOT NULL,
  post_id TEXT REFERENCES posts(id),
  account_id TEXT REFERENCES social_media_accounts(id),
  external_id TEXT, -- external comment/message id
  author_name TEXT,
  author_id TEXT,
  author_picture TEXT,
  content TEXT,
  parent_id TEXT, -- for reply threads
  read INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0,
  metadata TEXT, -- JSON blob for platform-specific data
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_inbox_items_user ON inbox_items(user_id, read, created_at DESC);
CREATE INDEX idx_inbox_items_post ON inbox_items(post_id, platform);
CREATE INDEX idx_inbox_items_account ON inbox_items(account_id);
```

---

## API Reference

### Comments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/posts/[id]/comments/[platform]` | Get comments (EXISTING) |
| POST | `/api/v1/posts/[id]/comments/[platform]/reply` | Reply to comment (EXISTING) |
| POST | `/api/v1/posts/[id]/comments/[platform]/like` | Like a comment (NEW) |
| POST | `/api/v1/posts/[id]/comments/[platform]/hide` | Hide/unhide comment (NEW) |
| POST | `/api/v1/posts/[id]/comments/[platform]/delete` | Delete comment (NEW) |

### Inbox
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/inbox` | Unified inbox (NEW) |
| GET | `/api/v1/inbox/count` | Unread count (NEW) |
| POST | `/api/v1/inbox/read` | Mark as read (NEW) |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/notifications` | List notifications (NEW) |
| GET | `/api/v1/notifications/count` | Unread count (NEW) |
| POST | `/api/v1/notifications/read` | Mark as read (NEW) |

---

## Progress Tracker

- [x] A1: Add moderation methods to SchedulerPost base class
- [x] A2: Add moderation to AutoPostService
- [x] A3: Add moderation API endpoints
- [x] B1: Create InboxService
- [x] B2: Create inbox API endpoints
- [x] B3: Add inbox table to database
- [x] C1: Create inbox page
- [x] C2: Create inbox composable
- [x] C3: Create inbox components
- [x] D1: Create NotificationService (hardened `ServiceResponse`, prefs, email — see PRD-NOTIFICATIONS.md, all 4 slices done)
- [x] D2: Create notification API endpoints (list/count/read/delete + preferences GET/PUT)
- [x] D3: Add notification triggers (post_failed, comment_reply, bulk_done + daily digest)

> **Polish fixes applied 2026-09-07 (verified):** inbox page reply body
> `text` → `replyText` (matches `reply.post.ts` schema), `authorHandle` →
> `authorId` (matches `inbox_items` schema), 3× `@click="x=y"` replaced with
> handler functions (`handleReplyCancel`, `handleDeleteAsk`,
> `handleDeleteCancel`) per AGENTS.md.
