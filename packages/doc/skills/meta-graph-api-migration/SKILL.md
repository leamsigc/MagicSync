---
name: meta-graph-api-migration
description: Migrate or repair a Meta (Facebook / Instagram) Graph API plugin — bump the API version, replace deprecated insight metrics, fix Page-vs-user token errors (#190 / 2069032), route Instagram Login vs Facebook Login hosts, and keep post-stats/Top-Posts correct. Use when asked to "upgrade Graph API", "move to vNN", "fix facebook/instagram stats", "#190 page access token", "insights are zero", "top posts stale", or "shares is not defined".
---

# Meta Graph API migration / FB-IG stats repair

## When to use
Any change to `packages/db/server/services/plugins/facebook.plugin.ts`,
`instagram.plugin.ts`, `facebook-insights.ts`, or the FB/IG stats pipeline
(`StatsCollector`, `stats-normalizer`, `Analytics.getTopPosts`).

## Ground truth (always check first)
1. **Version** — confirm the latest with the Meta changelog:
   `devtools_api_changelog` (product `pages-api` / `instagram-platform`), or
   `devtools_discovery`.
2. **Deprecated metrics** — https://developers.facebook.com/docs/platforminsights/page/deprecated-metrics
   and the Pages API changelog. Metrics are removed for **all versions**, so a clean grep
   of the *latest* docs is not enough — check the changelog lists.
3. **Token class** — Page Insights/feed require a **Page** token from a user with the Page
   `ANALYZE` task. `graph.facebook.com` + `EAA…` = FB Login; `graph.instagram.com` + `IG…`
   = IG Login.

## Steps
1. **Pin the version in one place.** Add/confirm `GRAPH_API_VERSION` in
   `packages/shared/shared/platformConstants.ts`; import it in both plugins. Never hardcode
   a version twice (and never leave a stray `dialog/oauth` version).
2. **Audit every batched `/insights` call.** Remove deprecated metrics. Remember: one
   invalid metric fails the whole batch with `(#100)`, so keep the drop-on-error ladder.
   Read `total_value` metrics from `total_value.value`, not `values[0].value`.
3. **Token class.** Detect `#190` / `2069032` / "must be called with a Page Access Token"
   and surface a reconnect hint. Do not auto-heal tokens without staging verification.
4. **Instagram host routing + metrics.** Resolve the host from the token prefix (`IG` → graph.instagram.com,
   `EAA` → graph.facebook.com). Never request `reach/views/saved/shares` as IG media *fields* — they are
   insight metrics. For **account** insights use only documented metrics and **always pass `since`/`until`**
   (otherwise it defaults to 24h and returns all zeros); `follower_count` is withheld for accounts with
   <100 followers and `profile_visits`/`new_follows` are not valid account metrics. Never batch the removed
   `impressions` metric into a media ladder — it forces a wasted retry per media.
5. **Stats correctness.** `normalizePostInsights.total` must be **engagement only**
   (`ENGAGEMENT_KEYS`); reach metrics are stored separately. A post is `failed` only when
   insights are a bare fallback, never for a partial set (otherwise it vanishes from Top Posts).
6. **Scopes.** Cross-check `packages/auth/lib/auth.ts` against every endpoint: insights need
   `read_insights` + `pages_read_engagement`; tagged/mentions need `pages_read_user_content`;
   BM-granted IG roles need `ads_management` + `ads_read`. Adding a scope requires FB/IG
   accounts to disconnect + reconnect.

## Verify (no unit tests)
```bash
grep -nE "v2[0-9]\.0" packages/db/server/services/plugins/*.ts        # only the target version
node --test packages/db/server/services/plugins/facebook-insights.test.ts  # ladder contract
# then staging: getStatistic + getPostInsights non-zero, no #190/2069032
pnpm dlx vite-doctor .                                                # clean
```
Keep each new/changed function ≤ 5 branches; extract helpers (`insightValue`,
`isPageAccessTokenError`) instead of adding branches.

## Gotchas
- `page_views_total`, `page_post_engagements`, `page_follows` are **still valid** — don't
  "fix" them.
- `createPostInsightsFallback()` returns a label containing `unavailable`; the collector
  turns that into `status='failed'`, which hides the post from Top Posts.
- Page tokens are non-expiring; a row with a near-term `tokenExpiresAt` is a mirrored user
  token (see `TokenRefresh.service.ts`).
- Never log raw `access_token` values (params are redacted in `FacebookPlugin.fetch`).

## Reference implementation
PRD: `.aiContext/PRD-GRAPH-API-V26-FB-IG.md` · Wiki: `/guide/graph-api-v26-migration`.
