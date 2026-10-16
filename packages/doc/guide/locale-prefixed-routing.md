# Locale-Prefixed Routing

With `prefix_except_default`, German URLs live under `/de/…` while bare paths
resolve to the default locale (English). Any navigation or path check that
assumes an unprefixed path silently resets a non-English session.

## The rule

Never match or build an `/app/…`, `/login`, or `/register` path without
accounting for the locale prefix.

- **Matching:** strip the prefix first with `stripLocalePrefix()` from
  `#layers/BaseShared/utils/locale`. Three route middlewares were bitten by
  this: `01.auth.global` (logged-in users saw `/es/login`), `02.admin.global`
  (admin guard bypassed under `/de/app/admin`), and `03.business-check.global`
  (business setup skipped on every prefixed route).
- **Linking:** build targets with `useLocalePath()` — sidebar links, redirect
  pages, dashboard quick actions. A bulk `localize()` pass over a menu array
  beats editing dozens of `to:` lines; it passes through already-prefixed,
  external, and non-string targets untouched.

## Why it hid so long

English (the default) is never prefixed, so every path check and every link
works perfectly until someone switches language. The calendar exposed it first
because its entry points (`/app/calendar` links + legacy redirects) are pure
navigation with no other logic to blame.

## Checklist for new routes

1. Links: `localePath('/app/…')`, never a bare string.
2. Middleware guards: compare `stripLocalePrefix(to.path)`.
3. Redirect targets: `navigateTo(localePath('…'))`, stripping first if the
   source path may already carry a prefix.
4. `updateQueryParams`-style query-only pushes are safe — they keep the path.
