---
name: add-page
description: Adding a new product page to the site composition root
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
last_updated: 2026-10-01
---

# Add New Page

## Context

All product pages live in `packages/site/app/pages/` — `site` is the composition root and the only route owner. Layer packages are libraries: they expose components, composables, utils and server code, and they do not have an `app/pages/` tree at all. Components in any layer's `app/components/` are globally auto-imported. Pages should use composables for data fetching and state management.

The three exceptions that keep their own pages: `auth` (identity flows), `ui` (`ui-preview/` gallery), `content` (the CMS `[...slug].vue` catch-all).

## Steps

1. Create the page under `packages/site/app/pages/`. Protected product pages go in
   `app/pages/app/`, public tool pages in `app/pages/tools/`.

2. Create the page file with translations:
   ```
   packages/site/app/pages/app/features/
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

4. If the page needs its own components, put them in the owning layer's
   `app/components/<layer>/...` and import them explicitly from the page with a
   `#layers/Base<Layer>/...` spec. **Never** create a `components/`, `composables/`
   or `utils/` directory inside `app/pages/` — Nuxt scans `app/pages/**` for routes and
   a stray `.ts` file there becomes a phantom route.
   - Composable: `app/composables/useFeatures.ts` — data fetching and state
   - CRUD: `app/composables/useFeatureManagement.ts`

## Gotchas

- Components in `app/components/` are global — no need to import them
- Always use `useFetch` or `useAsyncData` for data fetching
- Translation files go alongside pages (`.json` files) and must be the only non-`.vue` file in the page's directory
- Protected routes need auth middleware (use existing protected pages as reference)
- Use Nuxt UI components (UButton, UTable, etc.)
- **`pages/foo.vue` + `pages/foo/child.vue` is a NESTED route**, not two independent
  pages. The child only renders inside a `<NuxtPage />` in `foo.vue`, so navigating to
  `/foo/child` silently renders `foo.vue` (or nothing) instead of the child. For two
  standalone pages use `pages/foo/index.vue` + `pages/foo/child.vue`, which match `/foo`
  and `/foo/child` as siblings. Live example: `app/business/[id]/content/index.vue`
  (board) + `content/[itemId].vue` (item detail) — moving `content.vue` into the folder
  is what makes the detail page renderable.

## Verify

- [ ] Page lives in `packages/site/app/pages/`
- [ ] No `components/`, `composables/` or `utils/` directory under `app/pages/`
- [ ] Uses `useFetch` for API calls
- [ ] Translation JSON file exists alongside Vue file
- [ ] Composables follow `useXxx.ts` / `useXxxManagement.ts` pattern
- [ ] Protected pages include auth check
- [ ] `packages/site/.nuxt/link-checker/routes.json` lists the new route

## Debug

**Page not found:**
- Check the file is under `packages/site/app/pages/`
- Rebuild: `pnpm build`

**A page shows up at a `.ts` path** (e.g. `/tools/menu-board/templates-basic`): a
non-`.vue` file is sitting inside an `app/pages/` directory. Move it to the owning
layer's `app/utils/<layer>/` and import it explicitly.

**URL changes but the target page never appears (parent stays visible, or blank):**
- The page is a nested child of a sibling page file — e.g. `content.vue` next to
  `content/[itemId].vue`. Nuxt nests it and the parent has no `<NuxtPage />`, so the
  child's component is never mounted. Rename the parent page to `content/index.vue`
  and fix relative paths (`./components/x.vue` → `../components/x.vue`,
  `<i18n src="./x.json">` → `../x.json`). Confirm with
  `packages/site/.nuxt/link-checker/routes.json` after the dev server rebuilds — the two
  paths must show up as separate entries, not parent + child.

**Translation not loading:**
- Ensure JSON file has same name as Vue file
- Check `useI18n()` is properly set up

**Components not auto-importing:**
- Check component is in `app/components/` (not nested deeply)
- Verify the layer's nuxt.config.ts has components configured

