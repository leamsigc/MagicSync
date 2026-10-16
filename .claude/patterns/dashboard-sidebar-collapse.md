---
name: dashboard-sidebar-collapse
description: Nuxt UI dashboard sidebar collapse/expand control — the mobile drawer toggle vs the desktop collapse toggle, and the context they share
triggers:
  - "collapse sidebar"
  - "sidebar toggle"
  - "icon rail"
  - "dashboard header"
  - "sidebar uncolapse"
edges:
  - target: "theme-tokens.md"
    condition: "when styling the header controls"
last_updated: 2026-10-16
---

# Dashboard sidebar collapse toggle

## Context

The app shell is `packages/auth/app/layouts/DashboardLayout.vue`
(`UDashboardGroup` → `UDashboardSidebar collapsible resizable`) with the top bar
in `packages/auth/app/layouts/dashboard/Header.vue`.

Nuxt UI v4 ships two buttons whose themes are **exact complements** — use both
and let the breakpoint decide:

| Component | Theme base | Controls |
|---|---|---|
| `UDashboardSidebarToggle` | `lg:hidden` | the drawer (mobile) |
| `UDashboardSidebarCollapse` | `hidden lg:flex` | the inline sidebar collapse (desktop) |

## Steps

1. `UDashboardSidebar` must be `collapsible`, or `collapseSidebar` is a no-op.
2. In `Header.vue`, render both:
   `<UDashboardSidebarToggle class="rounded-xl" />` and
   `<UDashboardSidebarCollapse class="rounded-xl" />`.
3. Nothing else — both read the `UDashboardGroup` context
   (`sidebarCollapsed` / `collapseSidebar`, `sidebarOpen` / `toggleSidebar`) and
   the sidebar listens to the matching runtime hooks. Do not lift state.

## Gotchas

- Both buttons must be inside `UDashboardGroup`, or `useDashboard()` has no
  context and the click does nothing.
- Collapsing sets `--width: 0`, but the root keeps `min-w-16` → it collapses to a
  **4rem icon rail**, not fully hidden. Intended.
- Collapsed state persists in a cookie (`useResizable` storage) across reloads.
- The accessible name is the **Nuxt UI locale** (`"Collapse sidebar"` /
  `"Expand sidebar"`), not the app i18n.

## Verify

- Playwright asserts the sidebar root's `data-collapsed` flips
  `false → true → false`; capture the collapsed rail.

## Update Scaffold

- [ ] Wiki: `/guide/dashboard-sidebar-collapse`
- [ ] Skill: `packages/doc/skills/dashboard-sidebar-collapse/SKILL.md`
