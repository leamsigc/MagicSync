---
name: partial-publish-retry
description: Retry only the platform posts that failed instead of republishing to every target, and derive missing platform metadata at publish time
triggers:
  - "retry post"
  - "partial failure"
  - "duplicate post"
  - "youtube title missing"
  - "platform status"
edges:
  - target: "context/conventions.md"
    condition: "when adding a new publish entry point"
last_updated: 2026-10-24
---

# Partial Publish Retry

## Context

A post targets several accounts and publishes them in parallel. When one failed,
editing the post and clicking Post re-sent it to every platform: `postService.update()`
deleted all `platform_posts` rows and recreated them as `pending`, and
`triggerSocialMediaPost()` published every row. The post-level status was also
last-writer-wins, so a partial failure could look `published`.

## Steps

1. Reconcile platform rows instead of deleting them. In
   `postService.update()`, keep rows with status `published` for accounts still
   targeted, delete removed accounts and non-published rows, and insert
   `pending` rows only for newly added accounts (`syncPlatformPostsAfterUpdate`).
2. Guard the single publish funnel: in `AutoPostService.triggerSocialMediaPost()`
   skip any `platformPost` whose status is not `pending`. Every entry point
   (cron, POST, PUT, CLI, MCP `publish-now`) must go through it.
3. Derive the post status from all rows in
   `postService.recomputeStatusFromPlatforms()`: any `failed` → `failed`; else
   any `published` → `published`; else `pending`. Write only when it changes so
   `publishedAt` is stable.
4. Derive missing platform metadata at publish time, not in the UI. For YouTube,
   use `packages/db/server/utils/youtube-metadata.ts` (`resolveTitle`,
   `resolveTags`, `resolveDescription`); explicit `platformSettings` wins.
5. Accept explicit overrides where the caller can provide them (API-key route
   forwards `platformSettings`).

## Gotchas

- `platform_posts.platformPostId` holds the platform name; there is no
  `platform` column.
- Do not reset published rows to pending on edit — that is the duplicate bug.
- A newly added account must start as `pending`, otherwise it is never published.
- Keep the failure-wins aggregation: success-wins hides the failed platform and
  the retry UI never appears.

## Verify

- Force one platform failure, edit, re-post: only the failed row is sent;
  successful rows keep `publishDetail` and `publishedAt`.
- API-key video post without settings gets a derived title and 3–5 tags.
- Explicit `platformSettings.youtube.title/tags` override the derivation.

## Update Scaffold

- [ ] Add any new publish entry point to the "must go through
      `triggerSocialMediaPost`" list.
