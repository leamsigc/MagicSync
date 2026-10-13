---
name: prd-graph-api-v26-fb-ig
description: Implementation-ready PRD to migrate the Facebook and Instagram scheduler plugins to Graph API v26.0, fix Page-access-token handling, correct post/page stat collection, and align auth.ts scopes with what the calls actually require.
status: draft
owners: [leamsigc]
last_updated: 2026-10-13
sources:
  - packages/db/server/services/plugins/facebook.plugin.ts
  - packages/db/server/services/plugins/instagram.plugin.ts
  - packages/db/server/services/plugins/facebook-insights.ts
  - packages/db/server/services/TokenRefresh.service.ts
  - packages/connect/server/api/v1/social-accounts/[platform]/[id]/index.post.ts
  - packages/auth/lib/auth.ts
  - packages/shared/shared/platformConstants.ts
---

# PRD — Facebook & Instagram: Graph API v26.0 Migration + Post Stats Correctness

## 0. Problem statement

MagicSync's Facebook and Instagram publishing/stats plugins run on **Graph API `v25.0`**
and fail in production. The failures captured in the audit log are not superficial:

1. **Every page-insights call fails** with `(#190) This method must be called with a Page Access Token`.
2. **Every page-feed read fails** with `code 190, subcode 2069032 — "User Access Token Is Not Supported … A Page access token is required for this call for the new Pages experience."`
3. **Instagram account-stat collection crashes** with a JS `ReferenceError: shares is not defined`.

The goal is a single migration that (a) moves both plugins to `v26.0`, (b) makes the
page-access-token contract correct and enforced, (c) fixes the stat/metric collection so
"Views / Impressions / Engagement / Reach / Saves / Shares" are each real and distinct, and
(d) makes `auth.ts` request exactly the permissions and Page tasks those calls need.

## 1. Goals

- Both plugins target **Graph API v26.0** (one shared constant, no stray versions).
- Facebook page insights, page feed, page profile, and post insights succeed with a **Page Access Token** requested by a user holding the Page `ANALYZE` task.
- Instagram media/account insights succeed with a token+e host combination that matches the account's actual auth path (`graph.facebook.com` + FB-Login, *or* `graph.instagram.com` + IG-Login — not mixed).
- Post insights report correct, non-duplicated metrics; deprecated metrics are removed from batched requests so one bad metric can never zero the whole batch.
- `auth.ts` scopes cover every endpoint the plugins call, with no dead/duplicate scopes, and the required Page tasks are documented and checked.

## 2. Non-goals

- No new social platforms, no new UI surfaces.
- No change to the scheduler job model or the `BaseSchedulerPlugin` interface.
- Not migrating away from Facebook Login to Instagram Login (or vice versa) — the PRD instead makes the existing path *consistent* per account.
- No unit tests (project policy — verify by running the app / doctor checks).

## 3. Evidence — production incident → root causes

Verbatim failures from the production audit log (Oct 2026):

| Log action | Error | Endpoint |
|---|---|---|
| `facebook-fetch-error` | `(#190) This method must be called with a Page Access Token` | `GET /{page-id}/insights?metric=page_views_total,page_post_engagements,page_follows` |
| `facebook-fetch-error` | `code 190, subcode 2069032, "A Page access token is required for this call for the new Pages experience."` | `GET /{page-id}/feed?fields=id&limit=1&summary=false` |
| `instagram-get-stats-media` | `Error: shares is not defined` | `InstagramPlugin.getStatistic()` |

### RC1 — Wrong token class (the dominant failure)

Facebook Page Insights and Page-feed on the **new Pages experience** require a **Page
Access Token** obtained from a user token that holds the Page tasks. The log shows the
stored token is being used as if it were a page token while Meta classifies it as a **User**
token. `TokenRefresh.service.ts` already documents this exact hazard
(`PAGE_TOKEN_PLATFORMS = {facebook, instagram}`, "Mirroring a Better Auth user token onto
these rows breaks publishing"). So some `social_media_accounts` rows hold user tokens, and
the plugin sends `socialMediaAccount.accessToken` straight into every call.

**Meta requirement (primary source):**
> Page Insights — Requirements: Access Token = *"A Page access token requested by a person who can perform the ANALYZE task on the Page."* Permissions: `read_insights`, `pages_read_engagement`. Page Tasks: `ANALYZE`.

### RC2 — Page Insights metric deprecations (applies to *all* versions since 2025-11-15)

Per the Pages API changelog, the following are removed for all versions and return an
`invalid metric` error. Relevant to this codebase:

| Deprecated | Replacement |
|---|---|
| `page_impressions*` (+ all `page_impressions_*` variants) | `page_media_view` (breakdowns `is_from_ads`, `is_from_followers`) |
| `page_fans` | `page_follows` |
| `post_impressions*` (+ variants) | `post_media_view` |
| `post_engaged_users*` | *(no direct replacement; use engagement totals)* |
| `page_views` (note: **`page_views_total` is still valid**) | `page_media_view` |
| `post_clicks_unique*` | `post_clicks` |

**Still valid in v26 (confirmed on the v26 reference):** `page_views_total`,
`page_post_engagements`, `page_follows`, `page_media_view`, `page_total_media_view_unique`,
`post_media_view`, `post_total_media_view_unique`, `post_clicks`, `post_reactions_by_type_total`.

> ⚠️ The plugin's per-page metrics (`page_views_total,page_post_engagements,page_follows`)
> are still valid — so the page-insights failure is **RC1 (token), not RC2**. But RC2 breaks
> the **post** insights ladder (below).

### RC3 — `facebook-insights.ts` ladder is now fully deprecated

- `FACEBOOK_MODERN_METRICS` includes **`post_engaged_users`** → deprecated → the whole
  batched request fails with `(#100)`, so the "modern" tier returns `[]`.
- `FACEBOOK_LEGACY_METRICS` (`post_impressions_unique,post_impressions,…`) → entirely
  deprecated → also returns `[]`.
- Net effect: post insights only ever come from the single-metric **probe** tier, and
  `post_engaged_users` never resolves. Fragile and slow.

### RC4 — `total_value` metrics are mis-parsed

`post_total_media_view_unique` is requested with `metric_type=total_value`, which returns
`{ total_value: { value } }` — **not** `values[0].value`. `facebook.plugin.ts` reads
`metric.values?.[0]?.value`, so total-value metrics always read as `0`.

### RC5 — Duplicated labels in `getPostInsights`

`Views`, `Impressions`, and `Video Views` all read the same `post_media_view` value, so the
three tiles are identical and Impressions is not a real metric.

### RC6 — Instagram `shares is not defined`

`InstagramPlugin.getStatistic()` accumulates `totalShares += shares` where `shares` was
never declared → `ReferenceError`, caught by the media-loop `catch`, logged as
`get-stats-media` failure. Result: engagement/views/likes/comments totals never populate.

### RC7 — Invalid direct fields on an IG media node

`getStatistic()` reads `reach, views, saved` as **direct fields** of `/{ig-media}`
(`fields=id,caption,media_type,like_count,comments_count,reach,views,saved`). Those are
**insight metrics**, not node fields → `(#100) nonexisting field`. They must come from
`/{ig-media}/insights`.

### RC8 — Two IG auth paths that the plugin conflates

- `auth.ts` registers a `genericOAuth` provider `instagram` (**Instagram Login**:
  `graph.instagram.com`, scopes `instagram_business_*`) and its `databaseHooks` creates an
  `instagram` row from `https://graph.instagram.com/me`.
- The connect endpoint (`social-accounts/[platform]/[id]`) creates `instagram` rows from
  **Facebook Login** `fetchPageInformation` (page token, `graph.facebook.com`).
- `instagram.plugin.ts` hardcodes `graph.facebook.com`.

So IG rows created via the IG-Login provider cannot work against `graph.facebook.com`, and
IG rows created via the FB-Page path must not be driven through `graph.instagram.com`.
The plugin must branch on the account's auth path (or the IG-Login path must be removed).

### RC9 — Verifying IG account metrics

`getStatistic()` requests account insights `follower_count,profile_visits` and separately
`new_follows`. `profile_views` was deprecated (2024 changelog); metric names must be
re-verified against the v26 **Instagram Account Insights** reference before keeping them.

### RC10 — Top Posts stopped updating after the last deploy (YouTube-dominated)

Three defects compound:

1. **Failed rows are excluded.** `StatsCollector.collectPostMetric()` sets
   `status='failed'` whenever any insight label contains `"unavailable"` (the
   `createPostInsightsFallback()` output). Because FB/IG post insights fail
   (RC1/RC3/RC7), their `post_metrics` rows are written as `failed` and
   `Analytics.getTopPosts()` filters `status='success'` → those posts disappear.
2. **Reach outranked engagement.** `normalizePostInsights()` computed `total` by summing
   *every* metric including `views`/`reach`/`impressions`. YouTube returns a raw
   `viewCount` (a reach metric), so YouTube always topped the list and pushed real
   engagement to the bottom.
3. **Freshness is invisible.** The UI shows no "collected at" so a frozen list is
   indistinguishable from an empty one.

The last deploy also introduced the `totalShares += shares` ReferenceError (RC6), which
zeroed IG account stats at the same time. `getReelInsights()` was likewise broken by the
removed `post_impressions_unique` metric.

## 4. External references (primary)

- Graph API v26.0 launch: `https://developers.facebook.com/blog/post/2026/07/29/introducing-graph-api-v26-and-marketing-api-v26/`
- Page Insights reference (v26): `https://developers.facebook.com/docs/graph-api/reference/v26.0/insights`
- Pages API changelog (deprecation lists): `https://developers.facebook.com/docs/pages-api/changelog`
- Deprecated Page Insights metric list: `https://developers.facebook.com/docs/platforminsights/page/deprecated-metrics`
- Pages API overview / permissions & tasks: `https://developers.facebook.com/documentation/pages-api`
- Instagram Media Insights: `https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media/insights`
- Instagram Account Insights: `https://developers.facebook.com/documentation/instagram-platform/api-reference/instagram-user/insights`
- Instagram Platform changelog: `https://developers.facebook.com/instagram-platform/changelog`

**Confirmed via the Meta Social Technologies MCP** (`devtools_discovery`, `devtools_api_usage`):
- App `MagicSync-treat` = `940015397634489`; `devtools_api_usage(deprecations)` → `latest_platform_version: v26.0`, `deprecations: []` (no *app-level* deprecation flags yet).
- Apps available to the signed-in user: `mixpost 1810853762758630`, `MBSMM 1135290718504570`, `MagicSync-treat 940015397634489`, `Postiz-leamsigc 878369107757682`, `UploadShorts 453910617155962`.

## 5. Current implementation audit (what the code actually does)

**`facebook.plugin.ts`**
- `API_VERSION = 'v25.0'` (line 117); `OAUTH_DIALOG_URL = 'https://www.facebook.com/v20.0/dialog/oauth'` (line 119) — a *third*, unrelated version.
- `getPageInsights()` / `analytics()` → `/{id}/insights?metric=page_views_total,page_post_engagements,page_follows&period=day` (metrics still valid; failure is RC1).
- `getStatistic()` → parallel `profile` + `getPageInsights` + `/{page}/feed?…summary=false` (note: `summary=false` means the summary branch is dead).
- `getPostInsights()` → `collectFacebookPostInsights()` (RC3) + `fetchPostTotals()` (`reactions.summary(total_count)`, `comments.summary(total_count)`, `shares`).
- `fetchPageInformation()` → `/{pageId}?fields=username,access_token,name,picture…` — this is where the Page token is minted.

**`instagram.plugin.ts`**
- `API_VERSION = 'v25.0'` (line 38); base `graph.facebook.com`.
- `getStatistic()` → media `fields=…reach,views,saved` (RC7), media loop (`totalShares += shares`, RC6), account insights `follower_count,profile_visits` + `new_follows` (RC9).
- `fetchMediaInsightsRows()` ladder: `reach,views,likes,comments,shares,saved,impressions` — drop-on-error, `impressions` falls off correctly. Mostly OK.

**`facebook-insights.ts`**
- `FACEBOOK_MODERN_METRICS` (line 33), `FACEBOOK_LEGACY_METRICS` (line 35), `FACEBOOK_PROBE_METRICS` (lines 36–44) — RC3.

**`TokenRefresh.service.ts`** — correct by design: `PAGE_TOKEN_PLATFORMS`, `needsPageTokenRenewal`, `refreshInstagramPageToken`, `refreshPageToken`. The bug is that nothing *validates* the token class on the read paths.

**`auth.ts` facebook scopes**: `email, public_profile, pages_show_list, business_management, read_insights, pages_manage_posts, pages_read_engagement, pages_manage_engagement, pages_manage_metadata, pages_messaging, instagram_basic, instagram_content_publish, instagram_manage_insights, instagram_manage_comments, instagram_manage_messages`.

## 6. Metric matrix (target state)

### Facebook — Page level
| UI label | Current | v26 target |
|---|---|---|
| Reach / Views | `page_views_total` (label "Reach") | keep `page_views_total`; relabel to "Page Views" |
| Post Engagements | `page_post_engagements` | keep |
| Followers | `page_follows` | keep |
| *(new)* Media Views | — | `page_media_view` (+ `is_from_ads` / `is_from_followers` breakdowns) |

### Facebook — Post level
| UI label | Metric (v26) | Notes |
|---|---|---|
| Views / Impressions | `post_media_view` | single source; stop duplicating |
| Unique Viewers | `post_total_media_view_unique` | **must** parse `total_value.value` |
| Reactions | `post_reactions_by_type_total` | keep |
| Clicks | `post_clicks` | keep |
| Comments / Shares | object totals (`comments.summary`, `shares`) | keep as-is |
| ~~Engaged Users~~ | — | drop (`post_engaged_users` deprecated) |

### Instagram — Media level
| UI label | Metric (v26) |
|---|---|
| Likes | `likes` |
| Comments | `comments` |
| Reach | `reach` |
| Views | `views` |
| Saves | `saved` |
| Shares | `shares` |
| Total interactions | `total_interactions` |
| *(drop `impressions` for media created after 2024-07-02)* | — |

### Instagram — Account level
Verify names against the v26 Account Insights reference. Candidate valid set:
`follower_count`, `reach`, `profile_views` → **replaced**, `accounts_engaged`, `total_interactions`, `profile_visits` (verify), `follows_and_unfollows` (verify vs `new_follows`).

## 7. Required changes

**W1 — Version pin (mechanical, unblocks nothing but removes ambiguity)**
- [ ] T1 `facebook.plugin.ts`: `API_VERSION = 'v26.0'`; `OAUTH_DIALOG_URL → https://www.facebook.com/v26.0/dialog/oauth`.
- [ ] T2 `instagram.plugin.ts`: `API_VERSION = 'v26.0'`.
- [ ] T3 Extract one shared `GRAPH_API_VERSION` (suggested: `packages/shared/shared/platformConstants.ts`) and import in both plugins so the version can never drift again.

**W2 — Page Access Token correctness (fixes RC1)**
- [ ] T4 In `FacebookPlugin.fetch()` (and the IG plugin's fetch paths), pass a **token class** — page vs user — explicitly, and reject user tokens for Page Insights/feed with a typed error, not a raw Meta `#190`.
- [ ] T5 Add `ensurePageToken(account)`: if `needsPageTokenRenewal(row)` is true, call `TokenRefresh.service` (`refreshPageToken` / `refreshInstagramPageToken`) before the call, mirroring the connect-flow exchange (short-lived → 60-day user → page token).
- [ ] T6 Audit callers that may have mirrored a user token onto FB/IG rows and heal via the existing refresh path; log a `token-class-healed` plugin event.
- [ ] T7 Store `tokenExpiresAt=null` for page tokens (already the refresh convention) and surface a reconnect CTA when Meta returns `190/2069032`.

**W3 — Facebook post insights (fixes RC3, RC4, RC5)**
- [ ] T8 `facebook-insights.ts`: rebuild the ladder for v26.
  - Modern batch: `post_media_view,post_clicks,post_reactions_by_type_total` (drop `post_engaged_users`).
  - Total-value batch: `post_total_media_view_unique` with `metric_type=total_value`.
  - Delete the deprecated `FACEBOOK_LEGACY_METRICS` tier (or gate it behind `API_VERSION < v26`).
  - Update `FACEBOOK_PROBE_METRICS` accordingly.
- [ ] T9 Extend the metric type to carry `total_value?: { value: number }` and parse it in `getPostInsights()` so `post_total_media_view_unique` resolves.
- [ ] T10 De-duplicate labels: Views = `post_media_view`; Impressions = `post_total_media_view_unique` (unique viewers) *or* relabel honestly; remove the duplicate `Video Views` read.
- [ ] T11 Keep `fetchPostTotals()` drop-on-error ladder; verify `shares` still returns `{count}` on v26 and keep the `shares.count` avoidance.

**W4 — Instagram stats (fixes RC6, RC7, RC9)**
- [ ] T12 Fix `getStatistic()`: remove `totalShares += shares` (declare it or delete it). Define `shares` from the insights `shares` metric.
- [ ] T13 Stop requesting `reach,views,saved` as media *fields*; fetch them from `/{ig-media}/insights` (reuse `fetchMediaInsightsRows`).
- [ ] T14 Branch on auth path: FB-Login accounts → `graph.facebook.com`; IG-Login accounts → `graph.instagram.com`. Centralize a `hostUrl` + `tokenKind` per account (RC8).
- [ ] T15 Re-verify account-level metric names against the v26 Account Insights reference; replace any deprecated ones (`profile_views` → current equivalent).

**W5 — auth.ts scope + task alignment (fixes the "roles" ask)**
- [ ] T16 Add missing scope for tagged/mentions: **`pages_read_user_content`** (`getTaggedPosts`, `getMentions`).
- [ ] T17 Remove dead/duplicate scopes; document the exact scope → endpoint map (see §8).
- [ ] T18 Document required **Page tasks** per operation (`ANALYZE` for insights, `CREATE_CONTENT`/`MANAGE` for posts, `MODERATE` for comments) and add a preflight that surfaces a clear error when a task is missing.
- [ ] T19 Make the Instagram provider path explicit: either (a) keep both providers and tag accounts with their path, or (b) standardize on Facebook Login. Record the decision in §12.
- [ ] T20 Note the re-consent rule: adding a scope requires every FB/IG account to disconnect + reconnect; add a migration note.

**W6 — Top Posts correctness + freshness (fixes RC10)**
- [x] T21 `normalizePostInsights()`: rank `total` by **engagement only** (`ENGAGEMENT_KEYS`), excluding `views`/`reach`/`impressions` so view-heavy platforms (YouTube) stop dominating. `sumEngagement()` reuses the same keys.
- [ ] T22 Split failure from partial data: only mark a post `failed` on a true error; when the ladder returns a partial set, store `success` with the reach metrics present but excluded from `total`. (Today any `"unavailable"` label ⇒ `failed` ⇒ hidden.)
- [ ] T23 Surface **collected-at / freshness** on the Top Posts table so a frozen list is visibly stale, and add a per-platform breakdown column.
- [ ] T24 After deploy, assert: FB/IG posts appear in Top Posts, ordering is by engagement (not views), and `post_metrics` rows for FB/IG are `success`.


## 8. Auth / permissions contract

| Plugin call | Endpoint | Required permission | Required Page task |
|---|---|---|---|
| Page profile / followers | `GET /{page}` | `pages_show_list`, `pages_read_engagement` | — |
| Page insights | `GET /{page}/insights` | `read_insights`, `pages_read_engagement` | `ANALYZE` |
| Page feed (count posts) | `GET /{page}/feed` | `pages_read_engagement` | — |
| Publish post/photo/video/reel | `POST /{page}/feed|/photos|/videos|/video_reels` | `pages_manage_posts` | `CREATE_CONTENT` |
| Comments CRUD | `/{comment}` `/comments` | `pages_manage_engagement` | `MODERATE` |
| Tagged posts / mentions | `GET /{page}/tagged` | **`pages_read_user_content`** ← missing today | — |
| Webhooks | `/{page}/subscribed_apps` | `pages_manage_metadata` | `MANAGE` |
| FB inbox DMs | `/{page}/conversations` | `pages_messaging` | `MANAGE` |
| IG media/account insights | `/{ig-media}/insights` `/insights` | `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement` | — |
| IG publish | `/{ig-user}/media` | `instagram_content_publish` | — |
| IG private reply / DM | `/private_replies`, `/messages` | `instagram_manage_messages` | — |

> If the app user is granted a role on the Page **via Business Manager**, IG insights also
> require `ads_management` + `ads_read`. Decide whether to request these (see §12).

## 9. Failure behavior & observability

- **Never** swallow a `190/2069032`: emit a typed `requires-page-token` result, attempt one
  auto-heal (T5/T6), and if still failing mark the account `needs_reconnect` + toast the user.
- Metric deprecation (`#100 invalid metric`) stays on the existing drop-on-error ladder, but
  the ladder must be *complete* per v26 (T8/T13) so it degrades to a correct subset, not `0`.
- Every stat tile must be individually traceable: log `{ metric, rawValue, source }` at debug.
- No `console.*`; use the `log` auto-import (`log.error({ message, …fields })`).

## 10. Acceptance criteria

1. With a Facebook Page connected via a user holding `ANALYZE`, `getStatistic()` returns
   non-zero `page_views_total`, `page_post_engagements`, `page_follows` and **no** `#190`.
2. `GET /{page}/feed` succeeds with the stored token (no `2069032`).
3. `getPostInsights()` returns distinct Views, Unique Viewers, Reactions, Clicks, Comments,
   Shares — Views ≠ Impressions ≠ Video Views — and no batched `#100`.
4. `InstagramPlugin.getStatistic()` returns without the `shares is not defined` error and
   populates likes/comments/reach/views/saves/shares.
5. Both plugins emit requests under `/v26.0/` only (grep proves no `v25.0`/`v20.0` left).
6. A user token mistakenly stored on an FB/IG row is auto-healed or clearly surfaced; it is
   never sent silently to an insights/feed endpoint.
7. `auth.ts` contains `pages_read_user_content` and the scope→endpoint map in §8 holds; no
   dead scopes remain.

## 11. Verification gates (no unit tests)

Run after implementation, and paste evidence into the tracker:

1. **Grep:** `rg "v25\.0|v20\.0\|graph.facebook.com/v2[0-9]\.0"` → only `v26.0`.
2. **Typecheck/boot:** `pnpm site:build` (or dev boot) compiles `server/services/plugins/**`.
3. **Runtime (staging, real accounts):** invoke `getStatistic` + `getPostInsights` for one FB
   page and one IG account; confirm acceptance criteria 1–4 with real JSON (redact tokens).
4. **Doctor:** `pnpm dlx vite-doctor .` clean.
5. **Cyclomatic complexity:** every new/changed function ≤ 5 branches — extract helpers
   (e.g. `resolveTokenClass`, `parseTotalValueMetric`). State the max found.
6. **Conventions checklist** walked item by item; no dead code; no `console.*`.
7. **MCP cross-check:** re-run `devtools_api_usage(deprecations, app_id=940015397634489)` and
   `devtools_discovery` on the metric names to confirm none are newly deprecated before merge.

## 12. Open decisions — resolved 2026-10-13

- **D1 ✅ RESOLVED — keep both IG auth paths; branch on the path.** Implemented without a
  schema change by resolving the host from the token already in the URL: Instagram-Login
  tokens are prefixed `IG` → `graph.instagram.com`; Facebook tokens `EAA` →
  `graph.facebook.com` (`InstagramPlugin._getGraphApiUrl`). (T14/T19 done.)
- **D2 ✅ RESOLVED — request ads scopes.** `ads_management` + `ads_read` added to the
  Facebook provider scope so Business-Manager-granted IG roles resolve insights. Because
  this adds consent scopes, **every FB/IG account must disconnect + reconnect** to pick
  them up (T20).
- **D3 OPEN** Impressions semantics: map to `post_total_media_view_unique` (unique viewers)
  or drop the tile entirely? (T10 shipped "Unique Views" as a distinct tile.)
- **D4 OPEN** Should `getPageInsights` relabel `page_views_total` from "Reach" to "Page
  Views" to match Meta? (Left unchanged — dashboard label change needs sign-off.)

## 13. Task tracker

| ID | Wave | Depends on | Owner | Status | Evidence |
|---|---|---|---|---|---|
| ID | Wave | Depends on | Owner | Status | Evidence |
|---|---|---|---|---|---|
| T1 | W1 | — | leamsigc | ✅ | `API_VERSION = GRAPH_API_VERSION`; dialog → v26.0 |
| T2 | W1 | — | leamsigc | ✅ | `API_VERSION = GRAPH_API_VERSION` |
| T3 | W1 | T1,T2 | leamsigc | ✅ | `GRAPH_API_VERSION` in `platformConstants.ts` |
| T4 | W2 | T3 | leamsigc | ✅ | `isPageAccessTokenError()` + actionable hint in `fetch()` |
| T5 | W2 | T4 | leamsigc | ✅ | forced Page-token re-mint + retry (`fetchStatsWithHeal`) |
| T6 | W2 | T5 | leamsigc | ✅ | `extra.needsPageToken` signal — verified live |
| T7 | W2 | T5 | leamsigc | ✅ | `renewRowToken(row, { force: true })` |
| T8 | W3 | T3 | leamsigc | ✅ | ladder rebuilt for v26 |
| T9 | W3 | T8 | leamsigc | ✅ | `total_value` parsed in `metricValue()` |
| T10 | W3 | T9 | leamsigc | ✅ | Views/Unique Views/Comments/Shares/Clicks distinct |
| T11 | W3 | T8 | leamsigc | ✅ | `fetchPostTotals` kept (runtime re-verify pending) |
| T12 | W4 | — | leamsigc | ✅ | `shares` now declared; no ReferenceError |
| T13 | W4 | T12 | leamsigc | ✅ | media fields valid; insights via ladder |
| T14 | W4 | D1 | leamsigc | ✅ | token-prefix host routing (`IG`→graph.instagram.com) |
| T15 | W4 | — | leamsigc | ✅ | IG account metrics: valid set + `metric_type=total_value` + `since/until`; verified live |
| T16 | W5 | — | leamsigc | ✅ | `pages_read_user_content` added |
| T17 | W5 | D2 | leamsigc | ✅ | `ads_management` + `ads_read` added |
| T18 | W5 | — | | ⚠️ partial | token-class error surfaced; task preflight open |
| T19 | W5 | D1 | leamsigc | ✅ | decision recorded (§12 D1) |
| T20 | W5 | T16 | leamsigc | ✅ | re-consent rule documented |
| T21 | W6 | — | leamsigc | ✅ | `ENGAGEMENT_KEYS`; reach excluded from `total` |
| T22 | W6 | T21 | leamsigc | ✅ | only a bare fallback ⇒ `failed` |
| T23 | W6 | — | | ☐ | freshness UI not built |
| T24 | W6 | T22,T23 | | ☐ | post-deploy assertion |
| T25 | W3 | — | leamsigc | ✅ | `getReelInsights`: `post_impressions_unique` → `post_media_view` |
| T26 | W3 | — | leamsigc | ✅ | `getStatistic` feed `summary=false` → `summary=true` |

**Implementation order:** W1 → W2 → W3/W4 (parallel) → W5 → W6.
**Definition of done:** all acceptance criteria in §10 pass with pasted evidence; tracker
fully checked; §12 decisions resolved and recorded.

## 13a. Implementation status — 2026-10-13

Applied to the working tree this session:

- **W1 complete.** Both plugins read `GRAPH_API_VERSION` (`'v26.0'`) from
  `packages/shared/shared/platformConstants.ts`; the OAuth dialog URL is now `v26.0`.
- **W3 complete.** `facebook-insights.ts` modern batch = `post_media_view,post_clicks,post_reactions_by_type_total`
  (removed `post_engaged_users`); `post_total_media_view_unique` parsed from `total_value`;
  `getPostInsights` labels de-duplicated (no more identical Views/Impressions/Video Views).
  Extra fixes: `getReelInsights` no longer requests the removed `post_impressions_unique`;
  page-feed post count now uses `summary=true`.
- **W4 partial.** The `shares is not defined` crash (RC6) is fixed; IG media now fetches
  `reach/views/saved/shares` from `/{ig-media}/insights` instead of invalid node fields (RC7).
  T14/T15 remain open (need D1 and a metric-name re-verify).
- **W5 partial.** `pages_read_user_content` added to the Facebook scope. Task preflight /
  re-consent note still open.
- **W6 partial.** `normalizePostInsights()` ranks `total` by engagement only (T21) — YouTube
  `viewCount` no longer dominates Top Posts. T22/T23 (failure-vs-partial split, freshness UI)
  remain.
- **W2 complete (verified live 2026-10-13).** `isPageAccessTokenError()` classifies
  `#190`/`2069032`; `FacebookPlugin.getStatistic` sets `extra.needsPageToken`;
  `StatsCollector.fetchStatsWithHeal` force re-mints the Page token and retries once.
  Verified against the running app: Facebook `hasInsights` flipped `false → true` with
  `insightsMetrics: ["Reach","Post Engagements","Followers"]`. The raw `accessToken` log
  leak in `facebook.plugin.ts` was also removed.

**Verification run this session:**
- `node --test packages/db/server/services/plugins/facebook-insights.test.ts` → **5/5 pass**
  (export surface and ladder contract preserved), Node v26.7.0.
- All changed TS files parse cleanly under Node type-stripping.

**Not verified (requires running app + real accounts):** the runtime JSON for
`getStatistic`/`getPostInsights` (acceptance criteria 1–4) and `pnpm site:build`.

## 14. Session handoff template

```
Wave/IDs completed this session: <e.g. W1 T1-T3>
Files touched: packages/db/server/services/plugins/facebook.plugin.ts, instagram.plugin.ts, facebook-insights.ts
Evidence (commands + output): <grep, build, runtime JSON>
Blocked on: <D1/D2, access to real accounts, etc.>
Next up: <e.g. W2 T4>
Open risks: <e.g. page tokens still drying up on reconnect>
```
