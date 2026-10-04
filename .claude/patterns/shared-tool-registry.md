---
name: shared-tool-registry
description: Adding a tool to the unified registry and rendering it in both hubs (/tools + /app/toolbox)
triggers:
  - "add tool"
  - "new tool card"
  - "toolbox"
  - "tool hub"
edges:
  - target: patterns/add-page.md
    condition: when creating a new page for the tool
  - target: .aiContext/DESIGN.md
    condition: when styling cards or pages
last_updated: 2026-08-23
---

# Shared Tool Registry

## Context

All user-facing tool listings must render from ONE source of truth: `packages/ui/app/utils/toolRegistry.ts`. Never hardcode tool arrays in pages or nav — they drift.

Why `packages/ui` and not `packages/shared`? BaseShared only ships server-side code (no `app/utils`, no client exports). BaseUI is extended by every layer and exposes app code via the `#layers/BaseUI/app/...` alias.

## Steps

1. Add an entry to `toolRegistry` in `packages/ui/app/utils/toolRegistry.ts`:
   ```ts
   {
     id: 'my-tool',              // kebab-case, matches route segment
     name: 'My Tool',            // display name
     description: '...',
     icon: 'i-lucide-...',       // lucide icon class
     route: '/tools/my-tool',    // REAL route — verify the page exists
     audience: 'free' | 'app',
     category: 'create' | 'convert' | 'optimize' | 'learn',
     badge?: 'pro' | 'beta',     // optional, translated at render time
     image?: '/img/...',         // used by UBlogPosts on public hub
     date?: 'YYYY-MM-DD'
   }
   ```
2. Consumers import via the layers alias:
   ```ts
   import { toolRegistry } from '#layers/BaseUI/app/utils/toolRegistry'
   ```
3. Known consumers (keep them registry-driven): `packages/site/app/pages/tools/index.vue` (public `/tools`), `packages/site/app/pages/app/toolbox.vue`, sidebar Tools children in `packages/auth/app/composables/useDashboardNavigation.ts`.
4. If the tool needs UI strings beyond name/description (badges, categories), add keys to the page-level i18n JSON (`<page>.json`, en/es/de/fr).

## Gotchas

- Verify the route exists (`git ls-files`) before registering; video-cropper lives only at `/app/tools/video-cropper`.
- `/app/*` routes get `dashboard-layout` + auth automatically (`packages/ui/app/middleware/01.layout.global.ts`, `packages/auth/app/middleware/01.auth.global.ts`) — no `definePageMeta` needed.
- E2e `tests/e2e/tools-pages.spec.ts` asserts exact hrefs on `/tools`; update expectations when correcting routes.

## Verify

- [ ] Registry entry uses the real route; no duplicated tool arrays elsewhere
- [ ] Tool appears on `/tools` and `/app/toolbox` (correct category group)
- [ ] Light + dark mode correct (DESIGN.md tokens only)
- [ ] `pnpm site` build passes

## Debug

**Tool missing from hubs:** check the entry's `category` is one of `TOOL_CATEGORIES` and the consumer filters haven't been hardcoded.

**Import error `#layers/BaseUI/...`:** confirm the consuming layer extends `@local-monorepo/ui` in its `nuxt.config.ts`.
