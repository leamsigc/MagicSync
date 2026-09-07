---
name: business-onboarding-ux
description: Pattern for UI that serves the business-owner journey — grouped navigation with type-label sections, setup checklists, and quick-action CTAs on the dashboard.
last_updated: 2026-08-23
---

# Business-Onboarding UX Pattern

Use when adding pages/features to the app dashboard and deciding **where they
belong in the navigation** or how new users discover them.

## Steps

1. **Classify the feature** into one of the three owner-facing tiers:
   - *Daily* — things owners do every week (posts, calendar, dashboard).
     Top-level sidebar items, no group label.
   - *Content* — creation helpers (media, AI tools). Under the `Content` label.
   - *Setup* — one-time configuration (connections, business profile). Under
     the `Setup` label. Settings-level items go under the `Settings` label.

2. **Add nav entry** in
   `packages/auth/app/composables/useDashboardNavigation.ts`
   using `{ type: 'label', label: m.menu.section }` for group headers and add
   every label string to all locales in
   `packages/auth/app/layouts/dashboard/Menu.json`.

3. **Make it discoverable** if it is part of first-run setup:
   - Add a step to `packages/site/app/composables/useGettingStarted.ts`
     (key/label/description/cta/icon/to/done) with a translation block in
     `DashboardOverviewCards.json`.
   - The step auto-renders in `BaseGettingStarted.vue`; hide nothing manually —
     the card disappears when `every(step.done)`.

4. **Give it a CTA path**: any page reachable from onboarding should also be
   reachable from the dashboard quick-actions row (`/app` index.vue) or one
   click from an existing daily page. Never require navigating through more
   than one submenu.

5. **Verify**
   - `pnpm site` builds.
   - ESLint 0 errors on touched files.
   - Both light and dark themes render correctly (semantic tokens only).

## Gotchas

- `<script setup>` allows type-only exports since Vue 3.3 — safe to export
  prop interfaces from components, but never export runtime values from there.
- Nuxt UI v4 hides `type: 'label'` items itself when collapsed; the Sidebar
  also filters them as defence in depth.
- `/api/v1/posts` requires `businessId` — always gate post queries behind
  `useState('business:id')` being set (middleware `03.business-check.global.ts`
  guarantees this inside `/app`).

## Reference implementation

`.aiContext/UI-SIMPLIFICATION.md` — full documentation of the refactor that
introduced this pattern.
