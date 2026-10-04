---
name: social-media
description: Working with social media platform integrations
triggers:
  - "social media"
  - "facebook"
  - "twitter"
  - "instagram"
  - "bluesky"
  - "oauth"
edges:
  - target: context/architecture.md
    condition: when understanding platform connections
  - target: context/stack.md
    condition: when checking available technologies
  - target: context/conventions.md
    condition: when implementing platform-specific code
last_updated: 2026-03-30
---

# Social Media Integrations

## Context

The project supports multiple social media platforms via OAuth. Platform connections are stored in the database and managed through the `connect` layer package. Each platform has different API capabilities and limitations.

## Supported Platforms

- Facebook (pages, posts, stories, reels)
- Twitter/X (posts, media)
- Instagram (posts, stories, reels)
- Bluesky (posts, media)
- LinkedIn (posts, company pages)
- TikTok (posts)
- YouTube (community posts)
- Threads (posts)
- Reddit (posts)
- Dribbble (posts)
- WordPress (posts)

## Platform Data Structure

Social accounts are stored with these key fields:
- `platform` — platform name (facebook, twitter, instagram, etc.)
- `platformAccountId` — ID on the external platform
- `accessToken` — OAuth access token (encrypted)
- `refreshToken` — OAuth refresh token (encrypted)
- `userId` — local user ID
- `businessId` — optional business profile ID

## Common Integration Patterns

### Publishing a Post

1. Get user's social accounts from database
2. For each platform, call the appropriate API with:
   - Access token
   - Post content
   - Media assets (if any)
   - Platform-specific settings

3. Update `platformPosts` table with:
   - `platformPostId` — ID returned by platform
   - `status` — published/failed
   - `publishDetail` — URL, engagement metrics, etc.

### Handling OAuth Flow

1. Redirect user to platform's OAuth URL (stored in connect package)
2. User authorizes, callback to `/api/v1/connect/callback`
3. Exchange authorization code for tokens
4. Store tokens in database (encrypt sensitive data)
5. Fetch user's profile from platform

## Gotchas

- Each platform has different rate limits — handle 429 errors gracefully
- Tokens expire — implement refresh token flow
- Platform content limits vary (Twitter: 280 chars, Instagram: 2200, etc.)
- Media requirements differ by platform (aspect ratios, file sizes, formats)
- Some platforms require business accounts for certain features
- **Facebook Graph API deprecations**: several Page/Post Insights metrics were removed in Graph API v25.0 (Feb 2026) and deprecated for all versions by mid-2026. Deprecated metrics include `post_impressions_unique`, `post_impressions_paid_unique`, `post_video_views_unique`, and the `page_posts_impressions_*` family. When fetching post insights, use the documented replacements (`post_total_media_view_unique` / `post_media_view` for unique views/reach) and compute Facebook's Content Library "Engagement" as `Reactions + Comments + Shares` (not `post_engaged_users`, which counts distinct engaged users only). Prefer reading exact reaction/comment/share totals from the post object via `fields=reactions.summary(total_count),comments.summary(total_count),shares.count`.

## Verify

- [ ] Access token is valid before making API calls
- [ ] Handle token expiration with refresh flow
- [ ] Platform-specific content limits enforced
- [ ] Error responses from platform are logged and user notified
- [ ] Impacted Facebook insight metric names checked against the current Graph API version before use

## Facebook post insights (v25+)

Graph rejects an entire `/insights` batch with
`(#100) The value must be a valid insights metric` when **any** metric in the
comma-separated list is invalid for that post type or API version — one bad
metric kills all the good ones.

- `post_impressions*` metrics were deprecated (June 2026) and are not reliable
  on v25+; media-view metrics only exist for some post types.
- `post_total_media_view_unique` is a **total-value** metric: it only validates
  with `metric_type=total_value`, not as a time-series metric.
- Never call `/insights` through the plugin's `fetch()` helper for optional
  batches — a 400 logs a plugin failure. Use the raw-fetch fallback ladder in
  `packages/scheduler/server/services/plugins/facebook-insights.ts`
  (modern + total-value → legacy impressions → individual probes), and fall
  back to post-object totals (reactions/comments/shares) when everything fails.
- Keep the ladder covered by
  `facebook-insights.test.ts` (`node --test <file>`); it asserts a rejected
  batch never fails the whole call.

## Debug

**OAuth fails:**
- Verify client ID/secret in environment
- Check redirect URI matches platform configuration
- Some platforms require specific OAuth scopes

**Publishing fails:**
- Check rate limits (wait and retry)
- Verify media meets platform requirements
- Check token hasn't expired

**Token refresh fails:**
- Refresh tokens also expire — user may need to re-authorize
- Store new tokens immediately after refresh

