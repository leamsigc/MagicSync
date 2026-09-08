# PRD: Notification System — Events, Preferences, Email (Gap 5)

> **Goal:** Close `COMPETITIVE-FEATURES.md` High-Priority Gap 5 + finish
> `PRD-SOCIAL-INBOX.md` Phase D (D1–D3).
> OpenPost: in-app + email, per-event config, workspace muting, daily digest.
> Target: hardened service layer, event taxonomy with triggers, per-event
> preferences, email delivery (+ digest), preferences UI.
>
> **Source:** `.aiContext/COMPETITIVE-FEATURES.md` §5 + Roadmap Phase 2.4.
> **Status:** ✅ COMPLETE (all 4 slices done 2026-09-07).

## What exists (verified 2026-09-07)

| piece | location | state |
|---|---|---|
| `notifications` table | `packages/db/db/notifications/notifications.ts` (migration `0001`, pushed) | id/userId/type/title/message/read/actionUrl/metadata/timestamps — **no `event` column, no prefs** |
| `notificationService` | `packages/auth/server/services/notification.service.ts` | plain object, returns raw values, **throws `createError` (convention violation)** |
| routes (4) | `auth/server/api/v1/notifications/{index.get,mark-read.post,unread-count.get,delete.delete}` | thin, service-backed |
| UI | `auth/app/pages/app/notifications/`, `useNotification{,Management}.ts`, nav + header badge | basic list |
| trigger (1) | `bulkScheduler.service.ts logOperationNotification` (fire-and-forget try/catch) | completion notices only |
| email infra | `packages/email/server/utils/email.ts` (`useMailgun`) + 3 templates (reset/verify/invite) | **no notification templates** |

## Architecture (target)

```
Event source (publish fail · new comment · bulk done · invite)
   │  notify({ userId, event, title, message, actionUrl })
   ▼
NotificationService (auth layer, ServiceResponse<T>, never throws)
   ├── create → notifications row (respects prefs: in-app/email per event)
   ├── email path → useMailgun + notification templates (immediate or digest)
   └── list / unread-count / mark-read / delete / prefs CRUD
   ▲
routes (thin, zod) ◀── useNotificationManagement ◀── pages + header badge
digest task (daily) ──▶ collects undelivered-digest rows ──▶ one email/user
```

**Conventions:** service methods return `ServiceResponse<T>`, never throw
(AGENTS.md non-negotiable). `0001` migration is pushed — any column/table
addition needs a **new** migration (never edit `0001`).

## Implementation Tracker

Legend: `[ ]` not started · `[~]` in progress · `[x]` done (evidence required).

### Slice 1 — service hardening (no schema change)
- [x] `notification.service.ts` → class + singleton, all 6 methods return `ServiceResponse<T>`, no `throw` (NOT_FOUND codes instead)
- [x] 4 routes updated to unwrap `ServiceResponse` (`.error` → `createError`); wire shapes unchanged (`{success,data,pagination}`, `{success,message,data}`, `{success,data:{count}}`, delete returns `{success,message}`)
- [x] `bulkScheduler` caller compatible (ignores return, try/catch retained; test mocks unchanged — same export name)
- [x] esbuild syntax pass on all 5 touched files
- [ ] vitest: `bulkScheduler.service.test.ts` cannot load — **pre-existing** env failure (`Failed to resolve import "#layers/BaseAssets/server/utils/AssetsUtils"`, alias unresolvable in vitest; fails at import time before any test; unrelated to this slice — notification module is `vi.mock`ed). Other 47 tests pass.

### Slice 2 — event taxonomy + triggers (✅ DONE 2026-09-07)
- [x] `event` column (`general`, `post_failed`, `comment_reply`, `bulk_done`, `invite`, `token_expiring`) via migration `0009_notifications-events-prefs.sql` (squashed from 0009+0010+0011; SQLite `DEFAULT 'general'` backfills existing rows)
- [x] Triggers: post publish failure (`AutoPostService`: failed response, catch path, `RETRY_EXHAUSTED` on rate-limit/no-token paths — fire-and-forget, never breaks publishing), comment reply (`reply.post.ts` → `comment_reply`), bulk keeps working with `event='bulk_done'`
- [x] `notify({userId, event, ...})` helper on `notificationService` (`ServiceResponse`, never throws); all 6 touched TS files esbuild-clean; bulkScheduler vitest failure is the pre-existing `#layers/BaseAssets` alias env issue (fails at import, unrelated)

### Slice 3 — preferences (✅ DONE 2026-09-07)
- [x] `notification_preferences` table (userId, event, inApp, email, unique(userId,event)) + migration `0009_notifications-events-prefs.sql` (`drizzle-kit check` clean)
- [x] Service: `getPreferences` (effective list = rows + defaults), `updatePreferences` (upsert, unknown events → `INVALID_EVENT`), `isInAppEnabled` (fail-open)
- [x] `GET/PUT /api/v1/notifications/preferences` (zod on PUT, thin handlers, existing route style)
- [x] Preferences UI on `/app/notifications` (toggle card, per-event in-app/email switches, 4 locales, handler lambdas)
- [x] `createNotification`/`notify` skip rows when in-app disabled (`SKIPPED_BY_PREF`); callers ignore return so zero ripple; email flag stored, enforced in Slice 4

### Slice 4 — email delivery + digest (✅ DONE 2026-09-07)
- [x] Notification email templates (immediate `notificationTemplate` + `notificationDigestTemplate`, MJML `baseTemplate` style) + `sendNotificationEmail`/`sendNotificationDigestEmail` via `useMailgun`
- [x] Immediate email in `createNotification` (per-event email flag, best-effort try/catch, skipped quietly when Mailgun unconfigured)
- [x] Daily digest task (`notifications:digest`, `0 7 * * *`, `getDigestBatch` unread-24h grouped per user, skips cleanly without Mailgun)
- [x] Muting with expiry (`muted_until` on prefs, enforced in both channel checks, set/cleared via `PUT preferences` `mutedUntil`)
- [x] Migration `0009_notifications-events-prefs.sql` (`drizzle-kit check` clean, fresh-DB 47 tables verified); all 9 touched TS files esbuild-clean
- [ ] Header badge already existed (no change); inbox Notifications tab wiring → Gap 2b DM/inbox pass

## Success criteria (per slice)

1. Slice 1: all notification routes behave identically (200s + shapes unchanged); service never throws; esbuild clean
2. Slice 2: failed publish creates `post_failed` row; comment reply creates `comment_reply` row
3. Slice 3: disabling an event stops its in-app rows; prefs UI round-trips
4. Slice 4: email received on enabled events; digest aggregates; mute suppresses
