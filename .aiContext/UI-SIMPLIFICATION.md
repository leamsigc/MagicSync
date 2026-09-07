---
name: ui-simplification
description: Complete documentation of the business-owner-first UI refactor — navigation, onboarding checklist, quick actions, and how to extend them.
last_updated: 2026-08-23
---

# UI Simplification — Business-Owner-First Refactor

## Goal

MagicSync's dashboard previously exposed 10+ sidebar sections with technical
labels (Integrations, Providers, API Keys, Media, Templates…). A business owner
should be able to go from **zero → posting to social media in three steps**
without understanding the internal module structure. This refactor reorganises
the UI around that journey.

## The Business-Owner Journey

```
Sign up → Set up business → Connect social media → Create post → It publishes automatically → Watch results
              (step 1)            (step 2)             (step 3)
```

Everything else (media library, templates, AI tools, API keys) still exists but
is demoted below the daily workflow.

---

## 1. Navigation (sidebar)

**File:** `packages/auth/app/composables/useDashboardNavigation.ts`
**Labels:** `packages/auth/app/layouts/dashboard/Menu.json` (en/es/de/fr)

### New structure

| Group | Items | Routes |
|-------|-------|--------|
| *(top)* | Dashboard | `/app` |
| *(top)* | Calendar | `/app/calendar`, `/weeks`, `/day` |
| *(top)* | Posts | `/app/posts`, New post (`/app/posts/new`), Feed (`/app/posts/feeds`), Bulk create (`/app/bulk-scheduler`) |
| **Content** | Media | `/app/media`, Upload, Edit image |
| **Content** | Tools (AI) | content repurpose, video cropper, text-to-audio, growth strategies |
| **Setup** | Connect accounts | `/app/integrations`, Connected (`/active`) |
| **Setup** | My business | `/app/business`, Switch business (`/app/home`) |
| **Settings** | Templates (gallery/chat/email/images/variables), Profile, Account (`/app/account`), Notifications, API keys | one click each, no nesting |
| **Administration** | Admin (role-gated) | users, businesses, integrations, audit log |

### Follow-up: restored demoted-but-important links (2026-08-23)

The first pass dropped some links whose pages still exist. They were re-added:

- **Templates** regained its children: gallery, chat, email, images, variables
  (all four sub-pages live in `packages/templates/app/pages/app/templates/`).
- **Tools (AI)** regained the assistant entries that exist under the legacy
  route tree: AI chat `/app/tools/content-split` → legacy `/app/ai-tools/chat`,
  knowledge `/app/ai-tools/knowledge`, skills `/app/ai-tools/skills`.
- **Account** (`/app/account` — account settings, linked accounts, danger zone)
  is back in Settings next to Profile.
- **Posts** regained the feed entry (`/app/posts/feeds`, key `menu.feed`).
  `/app/posts` also gained a fourth view toggle **Feed**
  (`components/views/PostsFeedView.vue`) and grid cards now link to the single
  post detail page `/app/posts/feeds/[id]`.

### User nav rule (valid links only)

The header avatar dropdown (`userMenuItems`, also consumed by
`TwitterSideBar.vue`) previously linked to pages that do not exist
(`/app/upgrade`, `/app/billing*`, `/docs`, `/api-docs`, `/help`, `/support`,
`/changelog`, `/app/templates/create`). It now contains only routes that resolve:

> Profile, Account, API keys, Notifications · Business, Integrations,
> Template Gallery · Appearance modes · GitHub (external) · Logout

`UserNav.vue` consumes the shared `userMenuItems` composable — keep it that way;
do not duplicate menu arrays in components. When adding any nav/user-nav link,
verify a matching page file exists under `packages/*/app/pages/…`.

### Conventions

- Group headers are `NavigationMenuItem` items with `type: 'label'`
  (native Nuxt UI v4 support; auto-hidden when the sidebar is collapsed).
- `currentPageTitle` is exported from the composable — the header shows it
  instead of the old hardcoded breadcrumb.
- "Home" and "Dashboard" were merged into one item (`/app`). The business
  switcher lives under *My business → Switch business* (`/app/home`).

### Adding a nav item

1. Add a label key to all four locales in `Menu.json`.
2. Add the item in `useDashboardNavigation.ts` inside the matching group.
3. If it needs its own header, use `{ type: 'label', label: m.menu.yourSection }`.

---

## 2. Getting Started checklist

**Component:** `packages/ui/app/components/BaseGettingStarted.vue`
**State:** `packages/site/app/composables/useGettingStarted.ts`

A dismissible card on the dashboard that tracks the 3-step setup:

1. **Set up your business** — done when `/api/v1/business` returns ≥ 1 record
2. **Connect social media** — done when `/api/v1/social-accounts` returns ≥ 1 account
3. **Schedule your first post** — done when `/api/v1/posts?businessId=…`
   returns total > 0 for the active business

Behaviour:

- Hidden entirely once all steps are complete.
- Dismissal persists in `localStorage` key `magicsync:getting-started-dismissed`.
- Highlights the first incomplete step with a CTA link.
- Progress bar shows `% ready to post`.

### Component API

```ts
interface GettingStartedStep {
  key: string          // unique id
  label: string        // step title
  description: string  // shown until done
  to: string           // NuxtLink target
  icon: string         // lucide icon name
  done: boolean        // completion state
  cta?: string         // optional button text on the next pending step
}
```

```vue
<BaseGettingStarted :steps="steps" @dismiss="..." />
```

### Reusing the state composable

```ts
const { steps, complete, loading, fetch } = useGettingStarted()
await fetch() // refreshes counts from the API
```

The active-business id comes from `useState('business:id')`, populated by
`packages/connect/app/middleware/03.business-check.global.ts`.

---

## 3. Quick actions row

**File:** `packages/site/app/pages/app/index.vue`

Above the metric cards:

- **Create post** (primary, large) → `/app/posts/new`
- **Connect accounts** (outline) → `/app/integrations`
- **View calendar** (ghost) → `/app/calendar`

These mirror the onboarding steps so they stay relevant after setup is complete.

---

## Translations

All new strings live in two i18n JSON blocks (en/es/de/fr):

| File | Keys |
|------|------|
| `packages/auth/app/layouts/dashboard/Menu.json` | `allPosts`, `sectionContent`, `sectionSetup`, `connectAccounts`, `allBusinesses`, `switchBusiness`, `adminSection`, `admin`, `businesses`, `auditLog` |
| `packages/site/app/pages/app/DashboardOverviewCards.json` | `quickCreatePost`, `quickConnect`, `quickCalendar`, `getting_started.{business,connect,post}.{label,description,cta}` |

## Design rules applied (see `.aiContext/DESIGN.md`)

- Semantic tokens only (`bg-background`, `text-foreground`, `text-primary`,
  `border-border`) — no hardcoded colors; both light/dark supported.
- Composition API `<script setup>` everywhere.
- Touch targets ≥ 44px on quick-action buttons (`size="lg"`).

## Files changed

| File | Change |
|------|--------|
| `packages/auth/app/composables/useDashboardNavigation.ts` | Grouped nav + `currentPageTitle` |
| `packages/auth/app/layouts/dashboard/Sidebar.vue` | Filter label items when collapsed |
| `packages/auth/app/layouts/dashboard/Header.vue` | Dynamic page title; bell links to notifications |
| `packages/ui/app/components/BaseGettingStarted.vue` | NEW — onboarding checklist card |
| `packages/site/app/composables/useGettingStarted.ts` | NEW — setup-state composable |
| `packages/site/app/pages/app/index.vue` | Quick actions + checklist wiring |
| `Menu.json`, `DashboardOverviewCards.json` | New translation keys (4 locales) |

## Verification

- `pnpm site` (full production build of all layers) passes.
- ESLint clean (0 errors) on all touched files.
