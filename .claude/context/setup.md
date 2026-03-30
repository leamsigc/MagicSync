---
name: setup
description: Dev environment setup and commands. Load when setting up the project for the first time or when environment issues arise.
triggers:
  - "setup"
  - "install"
  - "environment"
  - "getting started"
  - "how do I run"
  - "local development"
edges:
  - target: context/stack.md
    condition: when specific technology versions or library details are needed
  - target: context/architecture.md
    condition: when understanding how components connect during setup
  - target: context/conventions.md
    condition: when verifying code patterns after setup
last_updated: 2026-03-30
---

# Setup

## Prerequisites

- **Node.js 20+** — Required for native fetch and modern APIs
- **pnpm** — Package manager (install with `npm install -g pnpm`)
- **Turso CLI** — For local database development (optional, can use cloud)
- **Docker** — For running local infrastructure (optional)

## First-time Setup

1. `pnpm install` — Install all dependencies across all packages
2. Copy `.env.example` to `.env` in packages/site and fill in required values:
   - `NUXT_TURSO_DATABASE_URL` — Turso database URL
   - `NUXT_SESSION_PASSWORD` — Min 32 characters
   - `NUXT_BETTER_AUTH_SECRET` — Auth secret
   - Social media OAuth credentials (optional, for testing specific platforms)
3. `pnpm --filter @local-monorepo/db db:generate` — Generate Drizzle migrations
4. `pnpm --filter @local-monorepo/db db:migrate` — Run migrations
5. `pnpm site:dev` — Start development server

## Environment Variables

Required for basic operation:
- `NUXT_APP_URL` — Application URL (e.g., http://localhost:3000)
- `NUXT_TURSO_DATABASE_URL` — Turso database connection string
- `NUXT_SESSION_PASSWORD` — Min 32 chars, used for session encryption

Required for authentication:
- `NUXT_BETTER_AUTH_SECRET` — Secret for Better Auth

Required for specific features:
- `NUXT_OPENAI_API_KEY` — For AI content generation
- `NUXT_GOOGLE_GENERATIVE_AI_API_KEY` — For Google AI features
- `NUXT_MAILGUN_API_KEY` + `MAILGUN_DOMAIN` — For email
- Social media OAuth credentials — Facebook, Twitter, Instagram, etc. (see nuxt.config.ts for full list)

## Common Commands

- `pnpm site:dev` — Start dev server on port 3000
- `pnpm site:build` — Build for production
- `pnpm site:preview` — Preview production build
- `pnpm build` — Build all packages
- `cd packages/db && pnpm db:generate` — Generate Drizzle migrations
- `cd packages/db && pnpm db:migrate` — Run migrations
- `cd packages/db && pnpm db:studio` — Open Drizzle Studio
- `pnpm ui:lint` — Run ESLint on UI package

## Common Issues

**Port already in use:** `lsof -i :3000` to find the process, `kill -9 [PID]`

**Migration fails:** Check `NUXT_TURSO_DATABASE_URL` is correct and the database is accessible

**Missing layer packages:** Ensure all packages in `extends` array are built. Run `pnpm build` first.

**Hot reload not working:** Some packages may need `nuxi prepare`. Try running `pnpm --filter @local-monorepo/ui dev` first to build individual packages.
