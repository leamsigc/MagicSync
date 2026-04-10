# Technology Stack

**Analysis Date:** 2026-04-10

## Languages

**Primary:**
- TypeScript (catalog) - Used across all packages for type safety
- Vue 3 (catalog) - Frontend framework for all UI components

**Secondary:**
- SCSS (catalog) - Used in content package for styling

## Runtime

**Environment:**
- Node.js (via pnpm monorepo)

**Package Manager:**
- pnpm 10.33.0 (root), 10.19.0 (doc package)
- Lockfile: `pnpm-lock.yaml` (via pnpm-workspace.yaml)

## Frameworks

**Core:**
- Nuxt 4.x (catalog) - Full-stack Vue framework with SSR, auto-imports, file-based routing
- Vue Router (catalog) - Routing

**UI:**
- @nuxt/ui (catalog) 4.x - Component library with Tailwind CSS theming
- Tailwind CSS (catalog) 4.x - Utility-first CSS framework

**Testing:**
- Playwright (catalog) - E2E testing (site, ai-tools, tools, bulk-scheduler packages)
- Vitest (catalog) - Unit testing (bulk-scheduler package)
- Happy DOM (catalog) - DOM mocking for testing
- @nuxt/test-utils (catalog) - Nuxt testing utilities

**Build/Dev:**
- dotenv-cli 11.0.0 - Environment variable loading
- drizzle-kit (catalog) - Database migration tooling
- tsx (catalog) - TypeScript execution
- VitePress (catalog) - Documentation generation

## Key Dependencies

**AI & ML:**
- ai (catalog) - AI SDK for model interactions
- @ai-sdk/vue (catalog) - Vue integration for AI
- @ai-sdk/google 2.0.44 - Google AI provider (Gemini)
- @huggingface/transformers (catalog) - ML model inference
- cheerio (catalog) - HTML parsing

**Database:**
- drizzle-orm (catalog) - Type-safe ORM
- @libsql/client (catalog) - Turso/SQLite client
- better-sqlite3 (catalog) - Synchronous SQLite (auth)
- zod (catalog) - Schema validation
- dayjs (catalog) - Date manipulation

**Auth:**
- better-auth (catalog) - Authentication framework
- @better-auth/utils (catalog) - Auth utilities
- @better-auth/api-key (catalog) - API key auth
- nuxt-auth-utils (catalog) - Nuxt auth helpers
- jsonwebtoken 9.0.3 - JWT handling

**Calendar & Scheduling:**
- @fullcalendar/core (catalog)
- @fullcalendar/vue3 (catalog)
- @fullcalendar/daygrid (catalog)
- @fullcalendar/timegrid (catalog)
- @fullcalendar/list (catalog)
- @fullcalendar/interaction (catalog)
- @fullcalendar/multimonth (catalog)
- @fullcalendar/scrollgrid (catalog)

**Image/Media:**
- sharp (catalog) - Image processing
- @nuxt/image (catalog) - Image optimization
- three (catalog) - 3D graphics
- @types/three (catalog) - Three.js types
- modern-screenshot (catalog) - Screenshot capture

**Email:**
- mjml (catalog) - Email template rendering

**Utilities:**
- axios (catalog) - HTTP client
- papaparse (catalog) - CSV parsing
- googleapis (catalog) - Google API client
- twitter-api-v2 (catalog) - Twitter API wrapper
- @atproto/api (catalog) - Bluesky/AT Protocol API
- evlog (catalog) - Logging
- consola (catalog) - Console logging
- sortablejs 1.15.7 - Drag-and-drop

**Developer Tools:**
- @nuxt/fonts (catalog) - Font optimization
- @nuxt/scripts (catalog) - Script management
- @nuxtjs/seo (catalog) - SEO utilities
- @nuxt/hints (catalog) - Development hints
- nuxt-umami (catalog) - Analytics
- fabric (catalog) - Canvas manipulation
- wavesurfer.js (catalog) - Audio visualization
- idb (catalog) - IndexedDB wrapper
- mediabunny (catalog) - Media utilities
- @comark/nuxt (catalog) - Comark Nuxt integration

**Vue Ecosystem:**
- @vueuse/core (catalog) - Vue composition utilities
- @vueuse/nuxt (catalog) - Nuxt integration
- @vueuse/motion (catalog) - Animation
- @unhead/vue (catalog) - SEO head management
- unhead (catalog) - Head management
- echarts (catalog) - Charts

**Linting/Formatting:**
- @nuxt/eslint (catalog) - ESLint for Nuxt
- eslint (catalog) - Linting

**i18n:**
- @nuxtjs/i18n (catalog) - Internationalization (used in 12 packages)

**Documentation:**
- VitePress 2.0.0-alpha.13 - Static site generator for docs
- shiki (catalog) - Syntax highlighting
- gray-matter (catalog) - Frontmatter parsing
- gsap (catalog) - Animation
- mermaid (catalog) - Diagrams

## Monorepo Structure

**Package Manager:**
- pnpm workspaces with 14 packages
- Catalog-based dependency management via `pnpm-workspace.yaml`

**Packages (14 total):**

| Package | Purpose | Key Dependencies |
|---------|---------|------------------|
| `packages/site` | Main application entry | Nuxt 4, all workspace packages |
| `packages/ui` | Shared UI components | @nuxt/ui, Tailwind, VueUse |
| `packages/db` | Database layer | drizzle-orm, LibSQL, zod |
| `packages/auth` | Authentication | better-auth, JWT, SQLite |
| `packages/scheduler` | Post scheduling | FullCalendar, Google APIs, Twitter, Bluesky |
| `packages/ai-tools` | AI content generation | ai-sdk, Google AI, HuggingFace |
| `packages/email` | Email templates | mjml |
| `packages/connect` | Social platform connections | auth, db, ui |
| `packages/content` | Content management | Nuxt Content, zod |
| `packages/templates` | Post templates | db, ui |
| `packages/assets` | Asset management | file storage, auth |
| `packages/bulk-scheduler` | Bulk scheduling | Vitest, papaparse |
| `packages/tools` | Developer tools | fabric, HuggingFace, wavesurfer.js |
| `packages/doc` | Documentation | VitePress |

## Platform Requirements

**Development:**
- Node.js (compatible with pnpm 10.33.0)
- pnpm for package management
- dotenv-cli for environment loading

**Production:**
- Turso (LibSQL) for database
- SQLite for auth sessions
- Environment variables for configuration

---

*Stack analysis: 2026-04-10*