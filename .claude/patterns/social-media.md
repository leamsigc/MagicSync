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

## Verify

- [ ] Access token is valid before making API calls
- [ ] Handle token expiration with refresh flow
- [ ] Platform-specific content limits enforced
- [ ] Error responses from platform are logged and user notified

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

