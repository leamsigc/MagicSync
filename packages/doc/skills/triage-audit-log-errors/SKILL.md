---
name: triage-audit-log-errors
description: Triage a batch of production audit-log failures (category 'plugin') for social publishing/stat integrations, map each action to its code path, fix the root cause, and verify without unit tests. Use when asked to "check the audit log errors", "fix these production errors", "why is facebook/instagram/linkedin failing", or given raw audit_logs rows containing OAuthException / ReferenceError from a plugin.
---

# Triage provider failures from the audit log

## When to use
You are handed raw `audit_logs` rows (or a screenshot/export of them) with
`category = 'plugin'` and one or more `status = 'failure'` rows for social
platforms. The goal is to find the *code* defects behind them, not to explain
away every 190 as "the user must reconnect".

## Ground truth — read before editing
1. **The exact log action names the plugin method.** `facebook-fetch-error:response`
   is logged by `FacebookPlugin.fetch()`; `linkedin-page-post-error:response` by
   `LinkedInPagePlugin.post()`; `instagram-post-error`, `…-get-stats-media`, etc.
   Grep the action string (minus the plugin prefix) in
   `packages/db/server/services/plugins/`.
2. **Pair rule.** `X:response` (HTTP body) + `X` (thrown summary) are one failure,
   not two. Group them.
3. **Error class decides the fix:**
   - `ReferenceError` / `TypeError: x is not defined` → a **code** bug, usually a
     **missing import** in a helper the plugin calls (e.g. `join`, `Buffer`).
     Grep the helper, not the plugin.
   - `OAuthException` / `code 190` / `2069032` → a **token** problem. Confirm
     *which* token class the endpoint needs before touching code.
4. **Don't stop at the first plausible cause.** In the 2026-10-17 batch, the
   `#190` errors had two independent causes (a user-token mirror **and** a missing
   publish-time renew) plus a separate argument-shift bug and a missing import.

## Steps
1. **Table the rows.** For each unique action, write: plugin, method, the URL
   shape, the Meta/REST message. Note any inline template string rendering
   `undefined` (e.g. `/v26.0/undefined/conversations`) — that is an argument bug,
   not a token bug.
2. **Locate the call site.** Signature must match the base class in
   `packages/db/server/services/SchedulerPost.service.ts`
   (`BaseSchedulerPlugin`). An `override` with an extra leading parameter shifts
   every argument — that is exactly how `/undefined/conversations` happens. The
   only methods that legitimately take a prepended args array are the names in
   `exposedMethods`.
3. **Find who writes the token.** For pool-wide `#190`, grep every
   `socialMediaAccountService.updateAccount(` that passes `accessToken`. Any route
   that mirrors the Better Auth **user** token onto a row must be gated by
   `!usesPageToken(platform)` (`TokenRefresh.service`) — Facebook and Instagram
   rows hold **Page** tokens only.
4. **Check the heal path.** `TokenRefresh.service` (`renewRowToken`) is the only
   correct renewal for Page-token rows; `AutoPost` must pass `{ force: true }` (or
   retry on an auth failure) because Page rows are stored with `null`/optimistic
   expiry. `StatsCollector.fetchStatsWithHeal` already force-renews on
   `extra.needsPageToken`.
5. **Fix surgically, extract helpers.** Keep new/changed functions ≤ 5 branches:
   extract a small `publishPlatformPost` / `forceRenewPageToken` rather than adding
   `if`s to a large loop. Never write unit tests (repo rule) — verify by
   type-checking and running the app.
6. **Verify.**
   ```bash
   pnpm audit:layers
   cd packages/site && pnpm exec tsc --noEmit -p tsconfig.json
   pnpm dlx vite-doctor .
   ```
   Pre-existing doctor findings unrelated to the diff are reported, not fixed
   opportunistically.
7. **Document.** Add a `packages/doc/guide/<task>.md` page, register it in the
   Wiki sidebar group in `packages/doc/.vitepress/config.mts`, and update the
   matching pattern (`.claude/patterns/social-media.md`).

## Anti-patterns
- Blindly "reconnect the account" — check whether a code path is writing the
  wrong token class first.
- Fixing a `ReferenceError` by adding a runtime guard instead of the missing
  import.
- Mirroring a user token onto a Page-token row "to refresh it" — it corrupts the
  row; renew through `TokenRefresh` only.
- Adding a retry that swallows the error — the post must still be recorded as
  `failed` when renewal itself fails.
