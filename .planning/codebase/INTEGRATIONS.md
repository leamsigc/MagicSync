# External Integrations

**Analysis Date:** 2026-04-09

## APIs & External Services

**Social Media Platforms:**
- Twitter/X API (twitter-api-v2 1.29.0)
  - Implementation: `packages/scheduler/server/services/plugins/twitter.plugin.ts`
  - Auth: OAuth via better-auth
  
- Bluesky/AT Protocol (@atproto/api 0.19.5)
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
  - Used in: `packages/scheduler/server/api/v1/ai/`
  - Features: Content generation, repurposing

- HuggingFace Transformers (@huggingface/transformers 4.0.0)
  - Used in: `packages/tools`
  - Features: ML model inference

**Calendar Integration:**
- Google Calendar API (googleapis 171.4.0)
  - Implementation: `packages/scheduler/server/services/plugins/google-calendar.plugin.ts`
  - Auth: OAuth via googleapis

## Data Storage

**Database:**
- Turso (LibSQL)
  - Client: @libsql/client 0.17.2
  - ORM: drizzle-orm 0.45.2
  - Config: `packages/db/config/turso.config.ts`
  - Environment: `NUXT_TURSO_DATABASE_URL`, `NUXT_TURSO_AUTH_TOKEN`

- SQLite (better-sqlite3 12.8.0)
  - Used in: `packages/auth` for session storage
  - Local file-based

**File Storage:**
- Local filesystem (nuxt-file-storage 0.3.2)
  - Used in: `packages/assets` for asset storage
- Cloud storage integrations via social platform APIs

## Authentication & Identity

**Auth Provider:**
- Better Auth 1.5.6
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
- evlog 2.10.0 - Structured logging
- consola 3.4.2 - Console output
- Nuxt built-in logging

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

**Secrets location:**
- `.env` files (gitignored)

## Webhooks & Callbacks

**Incoming:**
- Not detected explicit webhook endpoints
- Nuxt server routes handle API requests

**Outgoing:**
- Social platform API calls (Twitter, Bluesky, Google, etc.)
- No documented outgoing webhooks

---

*Integration audit: 2026-04-09*