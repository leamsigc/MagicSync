---
name: youtube-metadata-and-partial-retry
description: Fix YouTube uploads with missing title/tags and posts that re-publish to every platform after a partial failure. Use when API-key video posts arrive as "Untitled Video" with no tags, or editing a partially failed post and clicking Post duplicates the successful platforms.
---

# YouTube Metadata & Partial Retry

## When to use

- A video post created through the API key reaches YouTube as "Untitled Video"
  with zero tags.
- A post published to several accounts partially fails; after editing and
  clicking Post, the platforms that already succeeded receive the post again.
- The post detail pane shows `published` even though one platform failed.

## Steps

### A. YouTube title/tags fallback

1. Check `packages/db/server/services/plugins/youtube.plugin.ts` — the upload
   must not fall back to a literal `'Untitled Video'` or an empty tags array.
2. Put the pure rules in `packages/db/server/utils/youtube-metadata.ts`:
   - `resolveTitle(explicit, fallback, content)` — explicit (≤100 chars) →
     first meaningful content line with URLs/handles/hashtags stripped.
   - `resolveTags(explicit, content, title)` — explicit (array or
     comma-separated) → `#hashtags` then significant words (≥4 chars,
     stopwords removed); max 5, 30 chars each, 500 chars total.
   - `resolveDescription(content)` — clamp to 5000 chars.
3. Apply them when building `videoMetadata.snippet`. This covers dashboard,
   API-key, scheduled and retry paths because it runs at publish time.
4. Let API callers supply values explicitly: `POST /api/v1/cli/post` accepts
   `platformSettings` and forwards it into `postData.platformSettings`.
5. Do **not** remove the web modal's required-title check unless the user asks;
   the fallback exists for callers that cannot provide one.

### B. Retry only the failed platform

1. In `packages/db/server/services/post.service.ts`, `update()` must preserve
   `platform_posts` rows whose status is `published` for accounts still targeted.
   Delete only removed accounts and non-published rows; insert `pending` rows
   only for newly added accounts. The helper is
   `syncPlatformPostsAfterUpdate()`.
2. In `packages/scheduler/server/services/AutoPost.service.ts`,
   `triggerSocialMediaPost()` must skip every row whose status is not `pending`.
   One guard fixes the cron, POST, PUT, CLI and MCP `publish-now` paths.
3. In `packages/db/server/services/post-batch.service.ts`, replace the
   per-response `updateStatus()` with
   `postService.recomputeStatusFromPlatforms()`: any `failed` → `failed`; else
   any `published` → `published`; else `pending`. Write only on change so
   `publishedAt` stays stable.
4. Fix API responses to expose the platform name from `platformPostId` (there is
   no `platform` column) plus `accountId`.

## Verification

- API key without `platformSettings`: title = first content line, tags = 3–5
  derived terms; with `platformSettings.youtube.title/tags`, those win.
- Force one platform to fail, edit, click Post: the successful rows keep their
  `publishDetail`/`publishedAt`; only the failed row is sent.
- `pnpm audit:layers` passes and `pnpm dlx vite-doctor .` reports no new
  diagnostics.
- No unit tests (repo rule).

## Gotchas

- `platform_posts` has **no** `platform` column; `platformPostId` holds the
  platform name for these rows.
- Do not add a fourth entry point for publishing; all flows must go through
  `triggerSocialMediaPost()` so the pending-only guard applies.
- Aggregating the post status must let failure win, otherwise parallel
  completions hide the failed platform and the retry UI never appears.
