---
name: add-endpoint
description: Adding a new API endpoint to a layer package
triggers:
  - "add endpoint"
  - "add api route"
  - "create new endpoint"
edges:
  - target: context/conventions.md
    condition: when checking code style requirements
  - target: context/architecture.md
    condition: when understanding where endpoints live
  - target: patterns/debug-api.md
    condition: when endpoint fails and needs debugging
last_updated: 2026-03-30
---

# Add New API Endpoint

## Context

API endpoints live in layer packages under `server/api/v1/<feature>/`. Each package (auth, scheduler, etc.) extends the main site and provides its own API routes.

## Steps

1. Identify which layer package should contain the endpoint:
   - `packages/auth/server/api/v1/` — authentication, user management
   - `packages/scheduler/server/api/v1/` — post scheduling
   - `packages/connect/server/api/v1/` — social media connections
   - `packages/db/server/` — if it's pure database operations

2. Create the route file using Nuxt's file-based routing:
   - `index.get.ts` — GET /api/v1/feature
   - `index.post.ts` — POST /api/v1/feature
   - `[id].get.ts` — GET /api/v1/feature/:id
   - `[action].post.ts` — POST /api/v1/feature/:action

3. Write the handler:
   ```typescript
   import { postService } from '#layers/BaseDB/server/services/post.service'
   
   export default defineEventHandler(async (event) => {
     const body = await readBody(event)
     const result = await postService.create(event.context.user.id, body)
     
     if (result.error) {
       throw createError({ statusCode: 400, message: result.error })
     }
     return result.data
   })
   ```

4. Add Zod validation if needed (for create/update operations)

5. Create frontend composable in `app/composables/useXxxManagement.ts`

## Gotchas

- Always use `#layers/BaseDB` alias for importing services from db package
- Route handlers must be thin — business logic goes in services
- Services return `ServiceResponse<T>`, check for `.error` before using `.data`
- Protected routes need auth middleware (check existing routes for pattern)

## Verify

- [ ] Handler is in correct layer package
- [ ] Business logic is in service, not handler
- [ ] Uses `ServiceResponse` pattern for errors
- [ ] Zod validation on create/update endpoints
- [ ] Frontend uses composable pattern

## Debug

**404 on new endpoint:**
- Verify file name matches Nuxt routing (e.g., `create.post.ts` not `create.ts`)
- Check package is in `extends` array in site's nuxt.config.ts
- Rebuild: `pnpm build`

**500 error:**
- Check service is imported correctly (`#layers/BaseDB/...`)
- Verify service returns `ServiceResponse`, not throwing
- Check auth context: `event.context.user.id` exists

