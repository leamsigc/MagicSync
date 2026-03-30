---
name: add-page
description: Adding a new page in a layer package
triggers:
  - "add page"
  - "add route"
  - "create new page"
edges:
  - target: context/conventions.md
    condition: when checking component patterns
  - target: context/architecture.md
    condition: when understanding layer structure
  - target: patterns/add-endpoint.md
    condition: when adding API endpoint for the page
last_updated: 2026-03-30
---

# Add New Page

## Context

Pages live in layer packages under `app/pages/`. Components in `app/components/` are globally auto-imported. Pages should use composables for data fetching and state management.

## Steps

1. Create the page in the appropriate layer package:
   - Public pages: `packages/site/app/pages/`
   - Protected pages: `packages/<layer>/app/pages/app/`

2. Create the page file with translations:
   ```
   app/pages/app/features/
   ├── index.vue
   ├── index.json          # translations
   ├── create.vue
   └── create.json
   ```

3. Use the standard page structure:
   ```vue
   <script lang="ts" setup>
   const { t } = useI18n()
   
   const { data, pending, refresh } = await useFetch('/api/v1/features')
   
   const items = computed(() => data.value?.items || [])
   </script>
   
   <template>
     <div>
       <h1>{{ t('features.title') }}</h1>
       <UButton @click="refresh()">{{ t('common.refresh') }}</UButton>
     </div>
   </template>
   ```

4. Create composables in `app/composables/`:
   - `useFeatures.ts` — data fetching and state
   - `useFeatureManagement.ts` — CRUD operations

## Gotchas

- Components in `app/components/` are global — no need to import them
- Always use `useFetch` or `useAsyncData` for data fetching
- Translation files go alongside pages (`.json` files)
- Protected routes need auth middleware (use existing protected pages as reference)
- Use Nuxt UI components (UButton, UTable, etc.)

## Verify

- [ ] Page in correct layer package
- [ ] Uses `useFetch` for API calls
- [ ] Translation JSON file exists alongside Vue file
- [ ] Composables follow `useXxx.ts` / `useXxxManagement.ts` pattern
- [ ] Protected pages include auth check

## Debug

**Page not found:**
- Check file is in correct `pages/` directory
- Verify layer is in `extends` array in site's nuxt.config.ts
- Rebuild: `pnpm build`

**Translation not loading:**
- Ensure JSON file has same name as Vue file
- Check `useI18n()` is properly set up

**Components not auto-importing:**
- Check component is in `app/components/` (not nested deeply)
- Verify the layer's nuxt.config.ts has components configured

