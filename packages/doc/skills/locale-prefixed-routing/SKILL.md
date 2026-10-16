---
name: locale-prefixed-routing
description: Keep the active locale across navigation with prefix_except_default — strip prefixes before matching paths, build links with useLocalePath. Use when language "resets to English" on navigation, a logged-in user sees /es/login, middleware guards or active-link states misbehave in German/French/Spanish, or when adding any /app, /login, or /register link or redirect.
---

# Locale-prefixed routing

## When to use
Language flips back to English after clicking through the app, a route guard
(auth/admin/business-check) behaves differently per language, or you are adding
any link, redirect, or path check under `/app`, `/login`, `/register`.

## Root-cause pattern
With `prefix_except_default`, `/de/app/calendar` is the German calendar page
but a bare `/app/calendar` resolves to the **default locale**. So:

- `to.path.startsWith('/app')` is false on `/de/app/…` → guards skip, users
  pass through login walls and setup checks.
- `navigateTo('/app/calendar')` / `to: '/app/calendar'` from a German page
  re-resolves the locale to English and rewrites the session cookie.

English never shows it (the default locale is never prefixed), which is why it
hides until someone switches language.

## Steps
1. Find every unprefixed match or target:
   ```bash
   rg -n "startsWith\('/app|navigateTo\('/app|to: '/app" packages --glob '!node_modules'
   ```
2. Match on the stripped path:
   ```ts
   import { stripLocalePrefix } from '#layers/BaseShared/utils/locale'
   if (!stripLocalePrefix(to.path).startsWith('/app')) return
   ```
3. Build link/redirect targets with the locale:
   ```ts
   const localePath = useLocalePath()
   to: localePath('/app/calendar')
   navigateTo(localePath('/app/calendar/month/2026-10-16'))
   ```
   Strip first if the source may already carry a prefix:
   `localePath(stripLocalePrefix(maybePrefixed))`.
4. For a whole menu array, map once instead of editing every `to:`:
   ```ts
   function localize<T extends { to?: unknown; children?: T[] }>(items: T[]): T[] {
     return items.map(item => ({
       ...item,
       ...(typeof item.to === 'string' && item.to.startsWith('/app') ? { to: localePath(item.to) } : {}),
       ...(item.children ? { children: localize(item.children) } : {}),
     }))
   }
   ```
   Unprefixed, external, and non-string targets pass through untouched.
5. Query-only pushes (`router.push({ query })`) keep the path — no change needed.
6. Verify: `pnpm audit:layers` (shared-layer import must stay green), switch
   language, click through — the URL must keep its `/de|es|fr/` prefix.

## Gotchas
- `route.path.includes('/app/calendar')` (not `startsWith`) for active states.
- `useLocalePath` works in route middleware, not just components.
- The i18n locale cookie follows `setLocale`; bare-path navigations are what
  overwrite it — the switcher itself is rarely at fault.
