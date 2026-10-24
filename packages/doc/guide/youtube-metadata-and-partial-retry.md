# YouTube Metadata & Partial Retry

Two publishing bugs that show up together when a post targets Facebook,
Instagram and YouTube:

1. YouTube videos created through the API key landed as **"Untitled Video"**
   with **no tags**.
2. After one platform failed, fixing the post and clicking **Post** again
   re-published to *every* platform — duplicating the posts that had already
   succeeded.

## 1. YouTube metadata fallbacks

### Why it happened

`packages/db/server/services/plugins/youtube.plugin.ts` built the upload with:

```ts
title: settings?.title || postDetails.title || 'Untitled Video',
tags: settings?.tags || [],
```

The API-key endpoint never sent `platformSettings`, and `postDetails.title` is
empty for that flow. Only the web modal enforced a title, so API posts silently
became "Untitled Video".

### How it works now

`packages/db/server/utils/youtube-metadata.ts` owns the fallbacks:

| Helper | Rule |
| --- | --- |
| `resolveTitle(explicit, fallback, content)` | Explicit title wins (trimmed, ≤100 chars). Otherwise the first meaningful content line, with URLs, `@handles` and `#hashtags` stripped. `'Untitled Video'` only when there is no content at all. |
| `resolveTags(explicit, content, title)` | Explicit tags win (array or comma-separated, de-duped, `#` stripped). Otherwise `#hashtags` first, then significant words (≥4 chars, stopwords removed), lowercased and de-duped. Max 5 tags, 30 chars each, 500 chars total. |
| `resolveDescription(content)` | Clamped to 5000 chars. |

The plugin calls them at upload time, so the fallback applies to the dashboard,
the API key, scheduled posts and retries alike. The web modal still requires an
explicit YouTube title — the fallback is for callers that cannot provide one.

### Providing values through the API

`POST /api/v1/cli/post` now accepts `platformSettings`, passed straight into the
post:

```json
{
  "content": "Historic night at the Nou Camp...",
  "platforms": ["facebook", "instagram", "youtube"],
  "media": { "video": "https://example.com/clip.mp4" },
  "platformSettings": {
    "youtube": {
      "title": "Historic night at the Nou Camp",
      "tags": ["ligamx", "futbol"],
      "privacyStatus": "public"
    }
  }
}
```

Omit `title`/`tags` and they are derived from `content`.

## 2. Retrying only the failed platform

### Why duplicates happened

- `postService.update()` deleted **all** `platform_posts` rows and recreated them
  as `pending` whenever `targetPlatforms` was sent (the UI always sends it). The
  record of which platforms had already published was erased.
- `AutoPostService.triggerSocialMediaPost()` iterated over every row, so the next
  trigger published to all of them again.

### How it works now

- `syncPlatformPostsAfterUpdate()` (in `post.service.ts`) preserves rows whose
  status is `published` for accounts still targeted. Removed accounts and
  non-published rows are deleted; only accounts without a surviving row are
  inserted as `pending`. Editing therefore resets exactly the failed platform.
- `triggerSocialMediaPost()` skips any row whose status is not `pending`. This
  is the universal guard, so the cron, POST, PUT, CLI and MCP `publish-now`
  paths can no longer republish a live post.
- `postService.recomputeStatusFromPlatforms()` derives the post-level status
  from all rows: any `failed` → `failed`; else any `published` → `published`;
  else `pending`. Only writes when the value changes, so `publishedAt` is stable.
  This replaces last-writer-wins, which could hide a partial failure behind
  `published`.

### The resulting flow

1. Post to FB + IG + YT → FB and IG succeed, YT fails.
2. Edit the caption and click Post.
3. `update()` keeps the FB/IG rows `published` and recreates the YT row as
   `pending`.
4. The trigger skips FB/IG and uploads only YT — now with a derived title and
   tags.
5. Post-level status becomes `published` once every row is published.

## Files touched

- `packages/db/server/utils/youtube-metadata.ts` (new)
- `packages/db/server/services/plugins/youtube.plugin.ts`
- `packages/scheduler/server/api/v1/cli/post.post.ts`
- `packages/db/server/services/post.service.ts`
- `packages/db/server/services/post-batch.service.ts`
- `packages/scheduler/server/services/AutoPost.service.ts`
- `packages/scheduler/server/api/v1/posts/index.post.ts`
- `packages/scheduler/server/api/v1/posts/[id]/index.put.ts`

## How to verify

- API key, no `platformSettings`: YouTube title is the first content line and
  tags are 3–5 derived terms.
- API key with `platformSettings.youtube.title/tags`: those values win.
- Partial failure: after an edit + Post, the successful platforms' `publishedAt`
  and `publishDetail` must be unchanged, and only the failed row hits the
  network.
