# Graph API v26.0 Migration (Facebook & Instagram)

_2026-10-13 — what changed in `facebook.plugin.ts` / `instagram.plugin.ts`, why, and how it works._

## Why

Production audit logs showed three failures after the last deploy:

| Log | Error | Cause |
|---|---|---|
| `facebook-fetch-error` | `(#190) This method must be called with a Page Access Token` | a **user** token sent to a Page endpoint |
| `facebook-fetch-error` | `code 190 / subcode 2069032` "A Page access token is required … new Pages experience" | same |
| `instagram-get-stats-media` | `shares is not defined` | the deploy removed `const shares = …` but left `totalShares += shares` |

Plus Top Posts had gone stale and was YouTube-only.

## What changed

### 1. One version constant
`GRAPH_API_VERSION = 'v26.0'` lives in `packages/shared/shared/platformConstants.ts`. Both
plugins import it, so the version can never drift between files again. The OAuth dialog URL
was also moved off the stray `v20.0`.

### 2. Metric deprecations (the real killer)
Since **2025-11-15** these are removed **for all API versions** and, because one bad metric
fails a whole `/insights` batch with `(#100)`, they silently zeroed post insights:

| Removed | v26 replacement |
|---|---|
| `page_impressions*` / `post_impressions*` | `page_media_view` / `post_media_view` |
| `page_fans` | `page_follows` |
| `post_engaged_users` | *(none — use engagement totals)* |
| `page_views` | `page_media_view` (note: **`page_views_total` is still valid**) |

`facebook-insights.ts` now batches only valid metrics, and `post_total_media_view_unique`
(a `total_value` metric) is read from `total_value.value` — it used to always read `0`.

> Rule of thumb: never batch a newly-added metric with existing ones without checking the
> [deprecated-metrics list](https://developers.facebook.com/docs/platforminsights/page/deprecated-metrics).

### 3. Page Access Token
Page Insights/feed need a **Page** token from a user holding the Page's `ANALYZE` task.
`isPageAccessTokenError()` now classifies `#190` / `2069032` and logs an actionable
"reconnect the Page" hint instead of a bare error. (Automatic token healing is deliberately
deferred — it mutates stored tokens and needs staging.)

### 4. Instagram host routing + valid metrics
The plugin hardcoded `graph.facebook.com`, but the app also supports Instagram **Login**
(`graph.instagram.com`). `_getGraphApiUrl()` picks the host from the token already in the
URL: `IG…` → `graph.instagram.com`, `EAA…` → `graph.facebook.com`. No schema change.

**Account insights — only documented metrics, and always with a range.** `getStatistic()`
now makes **one** account-level read:

```
GET /{ig-user}/insights?metric=reach,views,likes,comments,saves,shares,accounts_engaged,total_interactions
    &period=day&metric_type=total_value&since=…&until=…&access_token=…
```

Three traps this fixes:
- `profile_visits` and `new_follows` are **not valid account metrics** → the call always failed.
- `follower_count`/`online_followers` are **withheld for accounts with <100 followers** →
  "Follower insights error" on small accounts.
- `impressions` was **removed** (2025-04-21). Without `since`/`until` the endpoint only looks
  back **24h** and returns all-zero totals, so the range is mandatory.

**Media insights — never batch the removed metric.** `impressions` is deprecated for media
created after 2024-07-02; keeping it in the fallback ladder forced a wasted retry (and a
warning log) **per media**. The ladder is now `reach,views,likes,comments,shares,saved`, and
account stats no longer call `/{ig-media}/insights` at all — one collect dropped from ~40
requests to 3.

> Note: views/reach are now a **30-day window** (matching the "Last 30 Days" card) instead of
> the old lifetime sum of per-media views, so the number will be smaller and more accurate.

### 5. Top Posts ranking
`normalizePostInsights.total` used to sum **every** metric, including `views`/`reach`. That
made YouTube's raw `viewCount` dominate every ranking. `total` is now **engagement only**
(`ENGAGEMENT_KEYS` = likes, comments, shares, saves, quotes, bookmarks, retweets, reposts).
And a post is only marked `failed` when insights are a *bare* fallback — a partial set stays
visible.

### 6. Facebook: "Views" ≠ Reach ≠ Page Views

These three v26 metrics look alike but are different numbers:

| Dashboard label | Metric | Meaning |
|---|---|---|
| **Views** | `page_media_view` | content played/displayed — **matches the Professional Dashboard "Views"** |
| Unique Viewers | `page_total_media_view_unique` | unique accounts reached → mapped to `reach` |
| Page Views | `page_views_total` | times the Page **profile** was viewed |

`getPageInsights`/`analytics` request all four and label them distinctly.
`getStatistic` maps `views = page_media_view`, `reach = page_total_media_view_unique`, and
exposes `pageProfileViews`/`uniqueViewers` in `extra`. Previously `page_views_total` was
mislabelled **"Reach"** and `page_media_view` wasn't requested at all, so the dashboard
"Views" could never match.

Pull Views directly:

```bash
GET /v26.0/{page-id}/insights?metric=page_media_view&period=day&since=…&until=…&access_token=…
# needs: read_insights + pages_read_engagement, Page token from a user with the ANALYZE task
```

### 7. YouTube: 30-day views need the Analytics API

YouTube's Data API `channels.statistics.viewCount` is **lifetime only** — there is no date
range. Windowed views come from a *different* API:

```bash
GET https://youtubeanalytics.googleapis.com/v2/reports
    ?ids=channel==MINE&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&metrics=views
```

`YouTubePlugin.fetchViewsLast30d()` calls this and sets `engagement.views`, keeping the
lifetime number in `extra.viewCount` and the old last-50 sum in `extra.recentUploadViews`.
It **requires the `yt-analytics.readonly` scope** (added to the youtube provider in
`auth.ts`); until every YouTube account reconnects, the call returns `null` and the plugin
falls back — collecting never fails.

> Note: YouTube's `youtube.force-ssl` does **not** cover Analytics. If Google ever rejects
> the combined consent, split Analytics into its own incremental provider (as done for
> Google Drive / Business).

## How to verify

```bash
# 1. no stray versions
grep -nE "v2[0-9]\.0" packages/db/server/services/plugins/facebook.plugin.ts \
                          packages/db/server/services/plugins/instagram.plugin.ts
# 2. insights ladder contract
node --test packages/db/server/services/plugins/facebook-insights.test.ts
# 3. real accounts (staging): getStatistic + getPostInsights non-zero, no #190
```

## Related

- [Facebook & Instagram Setup](/guide/facebook-instagram-integration)
- [Meta App Review](/guide/meta-app-review)
- PRD: `.aiContext/PRD-GRAPH-API-V26-FB-IG.md`
