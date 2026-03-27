# Agent Guidelines for This Monorepo

## Project Overview

This is a Nuxt 4 monorepo with multiple packages:
- **site**: Main Nuxt application
- **ui**: UI components library (shadcn-vue, Nuxt UI)
- **db**: Database layer (Drizzle ORM)
- **content**: Nuxt Content package
- **auth**, **connect**, **scheduler**, **bulk-scheduler**, **ai-tools**, **tools**, **assets**, **email**, **templates**: Feature packages


## Build Commands


###  Start the site env

```bash
pnpm packages site dev 
```

### Root Commands
```bash
pnpm install          # Install all dependencies
pnpm build           # Build all packages
pnpm dev             # Development mode for all
pnpm clean           # Clean build artifacts
```

### Site (Main App)
```bash
pnpm site:dev        # Start dev server
pnpm site:build      # Build for production
pnpm site:preview    # Preview production build
pnpm site:start      # Start production server
```

### UI Package
```bash
pnpm ui:dev          # Dev mode
pnpm ui:build        # Build
pnpm ui:lint         # Run ESLint
```

### Database (Drizzle ORM)
```bash
cd packages/db
pnpm db:generate     # Generate migrations
pnpm db:migrate      # Run migrations
pnpm db:studio       # Open Drizzle Studio
```

### Running Single Test
```bash
# In packages with vitest (e.g., bulk-scheduler)
cd packages/bulk-scheduler
pnpm test            # Run all tests
pnpm test:watch      # Watch mode
pnpm test:run        # Single run
```

### Docker
```bash
docker-compose -f docker-compose.yml up -d   # Production
docker-compose -f docker-compose.dev.yml up -d # Development
```

## Code Style Guidelines

### General Principles
- You are an expert in TypeScript, Node.js, NuxtJS 4, Vue 3, Shadcn Vue, Radix Vue, VueUse, and Tailwind
- Write concise, technical TypeScript code
- Use Composition API; avoid Options API
- Prefer iteration and modularization over duplication
- Use descriptive variable names with auxiliary verbs (isLoading, hasError)
- Structure files: exported component, composables, helpers, static content, types
- **AVOID COMMENTS IN CODE** - use documentation in ./packages/docs instead
- Mobile-first UI implementation
- Don't hardcode colors - use design system tokens

### Naming Conventions
- Directories: lowercase with dashes (e.g., `components/auth-wizard`)
- Components: PascalCase (e.g., `AuthWizard.vue`)
- Composables: camelCase (e.g., `useAuthState.ts`)
- Files: lowercase with dashes

### TypeScript
- Use TypeScript for all code
- Prefer `type` over `interface`
- Avoid enums; use `const` objects instead

### Syntax and Formatting
- Use arrow functions for methods and computed properties
- Avoid unnecessary curly braces in conditionals
- Use template syntax for declarative rendering

### UI / Styling
- Use Shadcn Vue, Radix Vue, Nuxt UI, Tailwind CSS
- Mobile-first responsive design approach
- Don't hardcode colors - use design system tokens
- Use Echarts for charts, Embla Carousel for sliders

### Performance Optimization
- Leverage Nuxt's built-in performance optimizations
- Use Suspense for asynchronous components
- Implement lazy loading for routes and components
- Optimize images: use WebP format, include size data, implement lazy loading

### Key Conventions
- Use VueUse for common composables and utility functions
- Use Pinia for state management
- Optimize Web Vitals (LCP, CLS, FID)
- Utilize Nuxt's auto-imports feature for components and composables
- All components in `/app/components` are global - no need to import them

### Database (Drizzle ORM)
- Prefer Query API (`db.query.table.findMany`, `db.query.table.findFirst`)
- Use `db.select()` only for complex aggregations
- Define relations in `schema.ts`
- Use `db.insert`, `db.update`, `db.delete` for mutations

### API Validation
- Use Zod for validation on create/update endpoints
- Handle validation errors with toast notifications
- Frontend must handle validation errors with toast showing error details

## Project Structure for each package

```
app/
├── components/
│   ├── content/     # Global Nuxt content components
│   ├── OgImage/     # Custom OG images
│   ├── table/       # Table components
│   ├── ui/          # shadcn-vue components
│   └── user/        # Feature CRUD components
├── composables/     # useXxx.ts, useXxxManagement.ts
├── layouts/         # BlogLayout, DashboardLayout, default
├── middleware/      # Numbered for order (00.auth.global.ts)
└── pages/
    ├── app/         # Protected routes
    │   └── admin/
│           ├── components //components only for this route and sub routes
│           ├── composables // composables only for this route and sub routes
    │       └── users/
    │           ├── components //components only for this route and sub routes
    │           ├── composables // composables only for this route and sub routes
    │           ├── index.vue
    │           └── index.json
    ├── login.vue
    ├── register.vue
    └── [...slug].vue

server/
├── api/v1/          # Feature APIs
│   └── auth/[...all].ts
└── utils/          # drizzle.ts, email.ts

config/             # app, drizzle, env, tailwind configs
db/
├── schema.ts        # Database schema
└── migrations/      # Drizzle migrations
translation/        # i18n files
```

## New Feature Workflow

1. Create directory: `app/pages/app/<FEATURE>/`
2. Create composables: `app/composables/use<FEATURE>.ts`, `use<FEATURE>Management.ts`
3. Create API: `server/api/v1/<FEATURE>/index.ts`, `[action].ts`
4. Create service: `server/services/<FEATURE>.ts`
5. Create translations: `app/pages/app/<FEATURE>/<page>.json`

### Example: Comments Feature
```
- app/pages/app/comments/Components/Comments.vue
- app/pages/app/comments/index.vue, index.json
- app/pages/app/comments/create.vue, create.json
- app/pages/app/admin/comments/index.vue, index.json
- app/composables/useComments.ts, useCommentsManagement.ts
- server/api/v1/comments/index.ts, create.ts, update.ts
- server/services/comments.ts
```

## Component Template

```vue
<script lang="ts" setup>
/**
 * Component Description: <Description>
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 * @todo [ ] Test the component
 * @todo [ ] Integration test
 */
</script>

<template>
  <!-- Content here -->
</template>

<style scoped>
</style>
```

## UTabs Usage

```vue
<script setup>
const activeTab = ref('text')
const tabs = [
  { label: 'Text', value: 'text', icon: 'i-lucide-file-text', slot: 'text' as const },
  { label: 'JSON', value: 'json', icon: 'i-lucide-braces', slot: 'json' as const },
]
</script>

<template>
  <UTabs v-model="activeTab" :items="tabs">
    <template #text>
      <div>Text content here</div>
    </template>
    <template #json>
      <div>JSON content here</div>
    </template>
  </UTabs>
</template>
```

## Nuxt Content Guidelines

For markdown content, use:

```md
::F-a-q
---
items:
  - question: What is X?
    answer: It's a platform...
    value: 1
---

#title
Frequently Asked Questions
#description
Find answers here.
::
```

## Charts (Echarts)

```ts
import * as echarts from 'echarts'

const [emblaRef] = emblaCarouselVue()

option = {
  series: [{
    type: 'line',
    smooth: true,
    data: [140, 232, 101, 264]
  }]
}
myChart.setOption(option)
```

## Sliders (Embla Carousel)

```vue
<script setup>
import emblaCarouselVue from 'embla-carousel-vue'
const [emblaRef] = emblaCarouselVue()
</script>

<template>
  <div class="embla" ref="emblaRef">
    <div class="embla__container">
      <div class="embla__slide">Slide 1</div>
      <div class="embla__slide">Slide 2</div>
    </div>
  </div>
</template>
```

## Important Notes

- Translation files go alongside pages (e.g., `index.vue` with `index.json`)
- Middleware files numbered for execution order (e.g., `00.auth.global.ts`)
- Follow official Nuxt.js and Vue.js documentation
- Use `useFetch` and `useAsyncData` for data fetching
- Implement SEO with `useHead` and `useSeoMeta`
- Nuxt auto import for  content global `components`, `composables`, `utils`
