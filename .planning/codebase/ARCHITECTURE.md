# Architecture

**Analysis Date:** 2026-04-10

## Pattern Overview

**Overall:** Layer-Based Monorepo Architecture with Nuxt 4

This project uses a **layer-based architecture** pattern where the main application (`site` package) extends multiple feature layers. Each layer package is a self-contained Nuxt module that contributes pages, components, composables, server APIs, and database schemas to the final application.

**Key Characteristics:**
1. **Layer Extension Pattern** - The site package uses Nuxt's `extends` configuration to compose all layer packages
2. **Service Layer Centralization** - All database operations go through `packages/db/server/services/`
3. **API Routes by Domain** - Each layer package exposes its own server API routes
4. **Shared ServiceResponse Pattern** - All services return `ServiceResponse<T>` for consistent error handling
5. **Composition API Only** - All Vue components must use `<script setup>` syntax

## Layers

**Primary Application Layer:**
- Location: `packages/site/`
- Purpose: Main entry point that composes all layers
- Extends: All layer packages via `nuxt.config.ts`

**Database Layer:**
- Location: `packages/db/`
- Purpose: Database schema, migrations, and service layer
- Contains: `db/db/schema.ts`, `db/server/services/`, `db/server/utils/`
- Key Services: `post.service.ts`, `user.service.ts`, `asset.service.ts`, `chat.service.ts`, etc.
- Depends on: Turso (libSQL) database

**Authentication Layer:**
- Location: `packages/auth/`
- Purpose: User authentication, sessions, notifications, API keys
- Contains: `server/api/auth/`, `server/api/v1/`, `server/middleware/`, `lib/auth/`
- Uses: Better Auth

**UI Component Layer:**
- Location: `packages/ui/`
- Purpose: Shared Vue components and design system
- Contains: Component library built on @nuxt/ui

**Feature Layers (Extensible):**
- `packages/assets/` - File upload, storage, Pexels integration
- `packages/content/` - Content management, documentation
- `packages/tools/` - Image editing, podcast tools
- `packages/scheduler/` - Post scheduling, AI content generation
- `packages/connect/` - Social media account connection (OAuth)
- `packages/templates/` - Post templates
- `packages/bulk-scheduler/` - Bulk post scheduling with CSV import
- `packages/ai-tools/` - AI chat, agents, document management, RAG
- `packages/email/` - Email functionality
- `packages/python-backend/` - Python backend services

## Data Flow

**Request Flow (HTTP):**

```
Client Request
    ↓
Site (Nuxt Router) → Matches route in extended layer
    ↓
Server API Handler (e.g., packages/scheduler/server/api/v1/posts/index.post.ts)
    ↓
Service Layer (packages/db/server/services/post.service.ts)
    ↓
Database (Drizzle ORM → Turso/libSQL)
    ↓
ServiceResponse<T> returned to handler
    ↓
JSON response to client
```

**Service Layer Pattern:**
```typescript
// All services return ServiceResponse<T>, never throw
async createPost(userId: string, data: PostCreateData): Promise<ServiceResponse<Post>> {
  try {
    // validation
    // database operation
    return { data: post }
  } catch (error) {
    return { error: 'Failed to create post', code: 'CREATE_FAILED' }
  }
}
```

## State Management

**Approach:** Nuxt Composables + useState

**Key Composables:**
- `packages/site/app/composables/useDashboardMetrics.ts` - Dashboard data fetching

**Pattern:**
```typescript
// Server data fetching via useFetch
const { data } = await useFetch('/api/v1/posts', {
  query: { status: 'pending' }
})
```

**Server State:**
- Sessions handled by Better Auth
- User context via event.context

## Key Abstractions

**ServiceResponse Pattern:**
- Purpose: Consistent return type for all service methods
- Location: `packages/db/server/services/types.ts`
- Pattern: `{ data?: T, error?: string, code?: string }`

**PaginatedResponse Pattern:**
- Purpose: Standard paginated list responses
- Extends ServiceResponse with pagination metadata

**Error Types:**
- `ServiceError` - Base error class
- `ValidationError` - Input validation failures (400)
- `NotFoundError` - Resource not found (404)
- `UnauthorizedError` - Auth failures (401)

## Entry Points

**Frontend Entry:**
- Location: `packages/site/app/app.vue`
- Pages: `packages/site/app/pages/` (file-based routing)

**Server Entry:**
- Location: `packages/site/nuxt.config.ts`
- Runtime: Nitro server (Nuxt 4)

**API Routes:**
- Pattern: `{package}/server/api/{domain}/{resource}.{method}.ts`
- Examples:
  - `packages/scheduler/server/api/v1/posts/index.post.ts`
  - `packages/auth/server/api/v1/notifications/index.get.ts`
  - `packages/connect/server/api/v1/social-accounts/index.get.ts`

## Cross-Cutting Concerns

**Authentication:**
- Implementation: Better Auth
- Location: `packages/auth/lib/auth.ts`
- Session management via `NUXT_SESSION_PASSWORD`

**Validation:**
- Approach: Zod schemas in service methods
- Custom validation in each service

**Environment Configuration:**
- Runtime config in `packages/site/nuxt.config.ts`
- All secrets via environment variables with `NUXT_` prefix

**Logging:**
- Implementation: evlog
- Config: `packages/site/nuxt.config.ts` → `evlog` section

---

*Architecture analysis: 2026-04-10*
