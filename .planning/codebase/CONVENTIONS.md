# Coding Conventions

**Analysis Date:** 2026-04-09

## Languages & Frameworks

**Primary:**
- TypeScript - Used across all Nuxt layer packages
- Vue 3 - Composition API with `<script setup>`
- Python - Used in `packages/python-backend` for AI/RAG services

**TypeScript Configuration:**
- Each package has its own `tsconfig.json` extending site `.nuxt/tsconfig.json`

## Naming Patterns

**Files:**
- Vue components: `PascalCase.vue` (e.g., `CsvUploader.vue`)
- TypeScript services: `camelCase.service.ts` (e.g., `post.service.ts`)
- TypeScript types: `PascalCase` (e.g., `ServiceResponse`)
- Test files: `*.test.ts` for Vitest, `test_*.py` for pytest

**Functions:**
- camelCase for functions and methods
- Use descriptive verb prefixes: `get`, `create`, `update`, `delete`, `bulk`

**Variables:**
- camelCase for local variables and parameters
- Interfaces and types use PascalCase

## Code Style

**Formatting:**
- ESLint configuration via `@nuxt/eslint` module
- Each package has `eslint.config.js` or `eslint.config.mjs`
- Site package uses `eslint.config.mjs`
- Other packages use `eslint.config.js`

**Configuration Example:**
```javascript
// packages/bulk-scheduler/eslint.config.js
import withNuxt from './.nuxt/eslint.config.mjs'
export default withNuxt()
```

**Vue Components:**
- Use `<script setup lang="ts">` for all new Vue components
- Props defined with `defineProps<{...}>()`
- Events defined with `defineEmits<{...}>()`
- JSDoc comments for component documentation

**Component Example:**
```vue
<script lang="ts" setup>
/**
 * Component Description: CSV file uploader
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

const emit = defineEmits<{
  fileSelected: [file: File]
}>()
</script>
```

## Import Organization

**Path Aliases:**
- `#layers/BaseDB` - Database layer
- `#layers/BaseAuth` - Authentication layer
- `#layers/BaseUI` - UI layer
- `#layers/BaseScheduler` - Scheduler layer
- `~` or `@` - Current package app directory

**Import Order:**
1. External imports (Vue, Nuxt)
2. Layer imports (#layers/*)
3. Local imports (./ or ../)

## Service Layer Pattern

**Service Location:** `packages/*/server/services/`

**Service Response Pattern:**
All service methods must return `ServiceResponse<T>`:
```typescript
// packages/db/server/services/types.ts
export interface ServiceResponse<T = any> {
  data?: T
  error?: string
  code?: string
}
```

**Service Structure:**
```typescript
export class PostService {
  private db = useDrizzle()

  async create(userId: string, data: PostCreateBase): Promise<ServiceResponse<Post>> {
    try {
      // Implementation
      return { data: post }
    } catch (error) {
      if (error instanceof ValidationError) {
        return { error: error.message, code: error.code }
      }
      return { error: 'Failed to create post' + error }
    }
  }
}
```

## Error Handling

**Custom Error Classes:**
```typescript
// packages/db/server/services/types.ts
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', 400)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends ServiceError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404)
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
    this.name = 'UnauthorizedError'
  }
}
```

**Rules:**
- Never throw exceptions from service methods
- Always return `ServiceResponse<T>` with either `data` or `error`
- Catch ValidationError separately to return proper error code
- Use custom error classes for different error types

## Comments & Documentation

**When to Comment:**
- JSDoc for component definitions
- Author attribution: `@author Name <email>`
- Version info: `@version x.x.x`
- TODO tracking: `@todo [✔]`, `@todo [ ]`

**Example:**
```typescript
/**
 * Creates a new post for the specified user
 * @param userId - The unique identifier of the user
 * @param data - Post creation data
 * @returns ServiceResponse with created post or error
 */
```

## Module Design

**Barrel Files:**
- Use index exports for service directories
- Export services as named exports

**Export Pattern:**
```typescript
// packages/db/server/services/post.service.ts
export class PostService { ... }

// packages/db/server/services/index.ts
export { PostService } from './post.service'
```

---

*Convention analysis: 2026-04-09*
