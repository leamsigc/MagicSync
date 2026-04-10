# External Integrations

**Analysis Date:** 2026-04-10

## APIs & External Services

**Social Media Platforms:**
- Twitter/X API (twitter-api-v2)
  - Implementation: `packages/scheduler/server/services/plugins/twitter.plugin.ts`
  - Auth: OAuth via better-auth
  
- Bluesky/AT Protocol (@atproto/api)
  - Implementation: `packages/scheduler/server/services/plugins/bluesky.plugin.ts`
  - Auth: OAuth
  
- Google My Business
  - Implementation: `packages/scheduler/server/services/plugins/googlemybusiness.plugin.ts`
  - Auth: Google OAuth via googleapis

- YouTube
  - Implementation: `packages/scheduler/server/services/plugins/youtube.plugin.ts`
  - Auth: Google OAuth via googleapis

**AI Providers:**
- Google AI (Gemini)
  - SDK: @ai-sdk/google 2.0.44
  - Used in: `packages/scheduler/server/api/v1/ai/`, `packages/ai-tools`
  - Features: Content generation, repurposing

- HuggingFace Transformers
  - Used in: `packages/tools`
  - Features: ML model inference

**Calendar Integration:**
- Google Calendar API (googleapis)
  - Implementation: `packages/scheduler/server/services/plugins/google-calendar.plugin.ts`
  - Auth: OAuth via googleapis

**Content & SEO:**
- @nuxt/content - File-based content management
- @nuxtjs/seo - SEO utilities
- @nuxt/scripts - Script management

## Data Storage

**Database:**
- Turso (LibSQL)
  - Client: @libsql/client
  - ORM: drizzle-orm
  - Config: `packages/db/config/turso.config.ts`
  - Environment: `NUXT_TURSO_DATABASE_URL`, `NUXT_TURSO_AUTH_TOKEN`

- SQLite (better-sqlite3)
  - Used in: `packages/auth` for session storage
  - Local file-based

**File Storage:**
- Local filesystem (nuxt-file-storage)
  - Used in: `packages/assets` for asset storage
- Cloud storage integrations via social platform APIs

**Documentation Storage:**
- Markdown-based (VitePress)
  - Used in: `packages/doc`
  - Frontmatter: gray-matter

## Authentication & Identity

**Auth Provider:**
- Better Auth
  - Implementation: `packages/auth`
  - Features: Email/password, OAuth, API keys
  - Sessions stored in SQLite
  - JWT for token management

**OAuth Providers:**
- Google (via googleapis)
- Twitter/X
- Bluesky
- Generic OAuth support

## Monitoring & Observability

**Error Tracking:**
- Not detected (no Sentry, Bugsnag, etc.)

**Logs:**
- evlog - Structured logging (used across all packages)
- consola - Console output
- Nuxt built-in logging

**Analytics:**
- nuxt-umami - Website analytics

## CI/CD & Deployment

**Hosting:**
- Not specified (self-hosted capable via `node .output/server/index.mjs`)

**CI Pipeline:**
- Not detected (no GitHub Actions, Vercel, etc.)
- Local development focus

## Environment Configuration

**Required env vars:**
- `NUXT_TURSO_DATABASE_URL` - Database connection URL
- `NUXT_TURSO_AUTH_TOKEN` - Database auth token
- `NODE_ENV` - Environment (production/development)

**Package-specific:**
- Google OAuth credentials (for Google Calendar, YouTube, Google My Business)
- Twitter API keys
- Bluesky credentials

**Secrets location:**
- `.env` files (gitignored)

## Webhooks & Callbacks

**Incoming:**
- Not detected explicit webhook endpoints
- Nuxt server routes handle API requests

**Outgoing:**
- Social platform API calls (Twitter, Bluesky, Google, YouTube, etc.)
- No documented outgoing webhooks

## Framework Integration

**Nuxt Modules Used:**
- @nuxt/ui - UI component library
- @nuxtjs/i18n - Internationalization
- @nuxt/image - Image optimization
- @nuxt/fonts - Font management
- @nuxt/scripts - Script management
- @nuxtjs/seo - SEO utilities
- @nuxt/content - Content management (content package)
- nuxt-umami - Analytics
- @nuxt/hints - Development hints
- nuxt-file-storage - File storage
- @comark/nuxt - Comark integration
- @unhead/vue - Head management

---

*Integration audit: 2026-04-10*