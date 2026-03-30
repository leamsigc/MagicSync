---
name: conventions
description: How code is written in this project — naming, structure, patterns, and style. Load when writing new code or reviewing existing code.
triggers:
  - "convention"
  - "pattern"
  - "naming"
  - "style"
  - "how should I"
  - "what's the right way"
edges:
  - target: context/architecture.md
    condition: when a convention depends on understanding the system structure
  - target: context/setup.md
    condition: when understanding environment setup requirements
  - target: patterns/add-endpoint.md
    condition: when adding new endpoints
  - target: patterns/add-service.md
    condition: when adding new services
  - target: patterns/debug-api.md
    condition: when debugging API failures
last_updated: 2026-03-30
---

# Conventions

## Naming

- Directories: lowercase with dashes (e.g., `components/auth-wizard`)
- Components: PascalCase (e.g., `AuthWizard.vue`)
- Composables: camelCase with `use` prefix (e.g., `useAuthState.ts`, `useUserManagement.ts`)
- Files: lowercase with dashes (e.g., `post-service.ts`)
- Database tables/columns: snake_case (e.g., `created_at`, `user_id`)
- Routes/API endpoints: kebab-case (e.g., `/api/v1/api-keys/create.post.ts`)

## Structure

Each layer package follows this structure:
```
app/
  ├── components/      # Vue components (global, auto-imported)
  ├── composables/     # useXxx.ts, useXxxManagement.ts
  ├── layouts/         # Page layouts
  ├── middleware/      # Route middleware (numbered for order)
  └── pages/           # File-based routing
server/
  ├── api/v1/          # API endpoints (RESTful)
  ├── services/        # Business logic
  └── utils/           # Helpers
db/
  └── schema.ts        # Drizzle schema definitions
```

- Business logic lives in services/, never in route handlers
- Each service file exports a singleton instance (e.g., `export const postService = new PostService()`)
- Components in `/app/components` are global — no need to import them

## Patterns

Service layer returns `ServiceResponse<T>` for all operations:
```typescript
// Correct - always return ServiceResponse
async create(userId: string, data: PostCreateBase): Promise<ServiceResponse<Post>> {
  try {
    const [post] = await this.db.insert(posts).values({...}).returning()
    return { data: post }
  } catch (error) {
    return { error: 'Failed to create post' }
  }
}

// Wrong - never throw from service layer
async create(userId: string, data: PostCreateBase): Promise<Post> {
  throw new Error('Failed') // Don't do this
}
```

API routes use the composable pattern with `useFetch`:
```typescript
// server/api/v1/posts/create.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = await postService.create(event.context.user.id, body)
  if (result.error) {
    throw createError({ statusCode: 400, message: result.error })
  }
  return result.data
})
```

## Verify Checklist

Before presenting any code:
- [ ] Composition API with `<script setup>` (no Options API)
- [ ] All database access goes through service layer, not direct queries in routes
- [ ] Service methods return `ServiceResponse<T>`, never throw errors
- [ ] New files follow naming conventions (kebab-case directories, PascalCase components)
- [ ] Zod validation on create/update API endpoints
- [ ] Translation JSON files alongside Vue pages
- [ ] Components in app/components are global (no explicit imports needed)
- [ ] Middleware files numbered for execution order (e.g., `01.auth.global.ts`)
