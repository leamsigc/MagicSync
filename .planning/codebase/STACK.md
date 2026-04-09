# Technology Stack

**Analysis Date:** 2026-04-09

## Languages

**Primary:**
- TypeScript 6.0.2 - Used across all packages for type safety
- Vue 3.5.31 - Frontend framework for all UI components

**Secondary:**
- SCSS - Used in content package for styling

## Runtime

**Environment:**
- Node.js (via pnpm monorepo)

**Package Manager:**
- pnpm 10.33.0
- Lockfile: `pnpm-lock.yaml` (via pnpm-workspace.yaml)

## Frameworks

**Core:**
- Nuxt 4.4.2 - Full-stack Vue framework with SSR, auto-imports, file-based routing
- Vue Router 5.0.4 - Routing

**UI:**
- @nuxt/ui 4.6.0 - Component library with Tailwind CSS
- Tailwind CSS 4.2.2 - Utility-first CSS framework

**Testing:**
- Playwright 1.58.2 - E2E testing (site, ai-tools, tools, bulk-scheduler packages)
- Vitest 4.1.2 - Unit testing (bulk-scheduler package)
- Happy DOM 20.8.9 - DOM mocking for testing

**Build/Dev:**
- dotenv-cli 11.0.0 - Environment variable loading
- drizzle-kit 0.31.10 - Database migration tooling

## Key Dependencies

**AI & ML:**
- ai 6.0.141 - AI SDK for model interactions
- @ai-sdk/vue 3.0.141 - Vue integration for AI
- @ai-sdk/google 2.0.44 - Google AI provider
- @huggingface/transformers 4.0.0 - ML model inference

**Database:**
- drizzle-orm 0.45.2 - Type-safe ORM
- @libsql/client 0.17.2 - Turso/SQLite client
- better-sqlite3 12.8.0 - Synchronous SQLite (auth)
- zod 4.3.6 - Schema validation

**Auth:**
- better-auth 1.5.6 - Authentication framework
- @better-auth/utils 0.4.0 - Auth utilities
- @better-auth/api-key 1.5.6 - API key auth
- nuxt-auth-utils 0.5.29 - Nuxt auth helpers
- jsonwebtoken 9.0.3 - JWT handling

**Calendar & Scheduling:**
- @fullcalendar/core 6.1.20
- @fullcalendar/vue3 6.1.20
- @fullcalendar/daygrid 6.1.20
- @fullcalendar/timegrid 6.1.20
- @fullcalendar/list 6.1.20
- @fullcalendar/interaction 6.1.20
- @fullcalendar/multimonth 6.1.20
- @fullcalendar/scrollgrid 6.1.20
- dayjs 1.11.20 - Date manipulation

**Image/Media:**
- sharp 0.34.5 - Image processing
- @nuxt/image 2.0.0 - Image optimization
- three 0.183.2 - 3D graphics
- @types/three 0.183.1 - Three.js types
- modern-screenshot 4.6.8 - Screenshot capture

**Email:**
- mjml 4.18.0 - Email template rendering

**Utilities:**
- axios 1.14.0 - HTTP client
- cheerio ^1.2.0 - HTML parsing
- papaparse 5.5.3 - CSV parsing
- googleapis 171.4.0 - Google API client
- twitter-api-v2 1.29.0 - Twitter API wrapper
- @atproto/api 0.19.5 - Bluesky API
- evlog 2.10.0 - Logging
- consola 3.4.2 - Console logging
- sortablejs 1.15.7 - Drag-and-drop

**Developer Tools:**
- @nuxt/fonts 0.14.0 - Font optimization
- @nuxt/scripts 0.13.2 - Script management
- @nuxtjs/seo 5.1.0 - SEO utilities
- @nuxt/hints 1.0.2 - Development hints
- nuxt-umami 3.2.1 - Analytics
- fabric 7.2.0 - Canvas manipulation
- wavesurfer.js 7.12.5 - Audio visualization
- idb 8.0.3 - IndexedDB wrapper
- mediabunny 1.40.1 - Media utilities

**Vue Ecosystem:**
- @vueuse/core 14.2.1 - Vue composition utilities
- @vueuse/nuxt 14.2.1 - Nuxt integration
- @vueuse/motion 3.0.3 - Animation
- @unhead/vue 2.1.12 - SEO head management
- unhead 2.1.12 - Head management
- echarts 6.0.0 - Charts

**Linting/Formatting:**
- @nuxt/eslint (latest) - ESLint for Nuxt
- eslint 10.1.0 - Linting

**i18n:**
- @nuxtjs/i18n 10.2.4 - Internationalization (12 packages)

## Monorepo Structure

**Package Manager:**
- pnpm workspaces with 12 packages
- Catalog-based dependency management via `pnpm-workspace.yaml`

**Packages:**
- `packages/site` - Main application entry
- `packages/ui` - Shared UI components
- `packages/db` - Database layer with Drizzle ORM
- `packages/auth` - Authentication (better-auth)
- `packages/scheduler` - Post scheduling and calendar
- `packages/ai-tools` - AI content generation
- `packages/email` - Email templates
- `packages/connect` - Social platform connections
- `packages/content` - Content management
- `packages/templates` - Post templates
- `packages/assets` - Asset management
- `packages/bulk-scheduler` - Bulk scheduling
- `packages/tools` - Developer tools
- `packages/doc` - Documentation

## Platform Requirements

**Development:**
- Node.js (compatible with pnpm 10.33.0)
- pnpm for package management

**Production:**
- Turso (LibSQL) for database
- Environment variables for configuration

---

*Stack analysis: 2026-04-09*