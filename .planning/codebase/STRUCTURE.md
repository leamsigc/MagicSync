# Codebase Structure

**Analysis Date:** 2026-04-09

## Directory Layout

```
production-example-nuxt-monorepo/
├── packages/                    # Layer packages (Nuxt modules)
│   ├── site/                    # Main application (entry point)
│   ├── db/                      # Database layer
│   ├── auth/                    # Authentication layer
│   ├── ui/                      # UI component library
│   ├── assets/                  # File management layer
│   ├── content/                 # Content/Docs layer
│   ├── tools/                   # Image tools layer
│   ├── scheduler/               # Post scheduling layer
│   ├── connect/                 # Social media connections
│   ├── templates/               # Post templates
│   ├── bulk-scheduler/         # Bulk scheduling
│   ├── ai-tools/               # AI chat & agents
│   ├── email/                   # Email functionality
│   └── python-backend/         # Python backend
├── .planning/                   # GSD planning documents
├── docker-compose.yml           # Container orchestration
├── pnpm-workspace.yaml          # PNPM monorepo config
└── AGENTS.md                    # Project anchor
```

## Directory Purposes

**Main Application (Site):**
- Location: `packages/site/`
- Contains: Main Nuxt application entry point
- Key files:
  - `nuxt.config.ts` - Extends all layer packages
  - `app/app.vue` - Root Vue component
  - `app/pages/` - File-based routing
  - `app/composables/` - Vue composables
  - `translations/` - i18n translations

**Database Layer:**
- Location: `packages/db/`
- Contains: Database schema, migrations, service layer
- Key directories:
  - `db/db/schema.ts` - All Drizzle schema definitions
  - `db/db/migrations/` - Database migrations
  - `db/server/services/` - Service classes (19 services)
  - `db/server/utils/drizzle.ts` - Drizzle client utility

**Authentication Layer:**
- Location: `packages/auth/`
- Contains: Auth handlers, sessions, notifications
- Key directories:
  - `server/api/auth/` - Better Auth handlers
  - `server/api/v1/` - Account, notifications, API keys
  - `server/middleware/` - Auth middleware
  - `lib/` - Auth configuration

**UI Layer:**
- Location: `packages/ui/`
- Contains: Vue component library
- Uses: @nuxt/ui

**Service Files (packages/db/server/services/):**
- `post.service.ts` - Post CRUD operations
- `user-llm-config.service.ts` - LLM configuration
- `asset.service.ts` - Asset management
- `social-media-account.service.ts` - Social accounts
- `chat.service.ts` - Chat/messaging
- `template.service.ts` - Post templates
- `business-profile.service.ts` - Business profiles
- `auditLog.service.ts` - Audit logging
- `subscription.service.ts` - Subscription management
- And more...

## Key File Locations

**Entry Points:**
- `packages/site/app/app.vue` - Root Vue component
- `packages/site/nuxt.config.ts` - Main Nuxt config with extends

**Configuration:**
- `packages/site/nuxt.config.ts` - Runtime config, extends, modules
- `packages/db/nuxt.config.ts` - Database layer config
- `packages/auth/nuxt.config.ts` - Auth layer config

**Core Logic:**
- `packages/db/server/services/` - All service classes
- `packages/db/server/utils/drizzle.ts` - DB client
- `packages/auth/lib/auth.ts` - Auth instance

**Database Schema:**
- `packages/db/db/schema.ts` - Main schema file
- `packages/db/db/migrations/` - Migration files

**Testing:**
- `packages/*/tests/` - E2E tests (Playwright)
- `packages/*/playwright.config.ts` - Test configuration

## API Route Structure

**Pattern:** `{package}/server/api/{version}/{domain}/{action}.{method}.ts`

**Examples:**
```
packages/auth/server/api/v1/notifications/index.get.ts
packages/auth/server/api/v1/notifications/mark-read.post.ts
packages/scheduler/server/api/v1/posts/index.post.ts
packages/scheduler/server/api/v1/posts/[id]/index.get.ts
packages/connect/server/api/v1/social-accounts/index.get.ts
packages/assets/server/api/v1/assets/index.post.ts
```

## Naming Conventions

**Files:**
- Service files: `{entity}.service.ts` (kebab-case)
- API routes: `{action}.{method}.ts` (e.g., `index.get.ts`, `create.post.ts`)
- Components: `PascalCase.vue` (e.g., `TokenIndicator.vue`)
- Composables: `camelCase.ts` (e.g., `useDashboardMetrics.ts`)

**Directories:**
- Lowercase, kebab-case: `server/api/`, `server/services/`, `app/pages/`

**Types/Classes:**
- PascalCase: `PostService`, `ServiceResponse`, `UserLlmConfig`

## Where to Add New Code

**New Feature/Module:**
- Create new layer package in `packages/{new-layer}/`
- Add to `packages/site/nuxt.config.ts` extends array

**New Database Service:**
- Location: `packages/db/server/services/{entity}.service.ts`
- Must extend base service pattern with `ServiceResponse<T>`

**New API Endpoint:**
- Location: `{layer}/server/api/v1/{domain}/{action}.{method}.ts`
- Should call service layer, not direct DB queries

**New Page:**
- Location: `{layer}/app/pages/{path}.vue`
- Use file-based routing (Nuxt convention)

**New Component:**
- Location: `{layer}/app/components/{ComponentName}.vue`
- Use `<script setup>` Composition API

**New Composable:**
- Location: `{layer}/app/composables/use{Feature}.ts`

## Special Directories

**playground:**
- Purpose: Development testing for layer packages
- Location: `packages/{layer}/.playground/`
- Generated: Yes (created by Nuxt dev server)
- Committed: No (.gitignore)

**node_modules:**
- Purpose: Dependencies
- Generated: Yes
- Committed: No

**.nuxt:**
- Purpose: Nuxt build output
- Generated: Yes
- Committed: No

**translations:**
- Purpose: i18n locale files
- Location: `packages/*/translations/`
- Contains: `i18n.config.ts`, `global.json`

---

*Structure analysis: 2026-04-09*
