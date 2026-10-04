/**
 * Facebook post-insights metric strategy.
 *
 * Graph API rejects an entire `/insights` request with `(#100) The value must
 * be a valid insights metric` when any metric in the batch is invalid for that
 * post type or API version (impressions were deprecated in v25+, media-view
 * metrics are only valid for some post types, and `post_total_media_view_unique`
 * is a total-value metric that must be requested with `metric_type=total_value`).
 *
 * This helper walks a fallback ladder so one unsupported metric can never turn
 * into a plugin failure:
 *   1. modern time-series + total-value metrics (parallel)
 *   2. legacy impressions batch
 *   3. individual metric probes (parallel, first success wins per metric)
 */

export interface FacebookInsightMetricValue {
  value: number | Record<string, number>
}

export interface FacebookInsightMetric {
  name: string
  values?: FacebookInsightMetricValue[]
}

export interface FacebookInsightsQuery {
  metrics: string
  metricType?: 'total_value'
}

export type FacebookInsightsFetcher = (query: FacebookInsightsQuery) => Promise<FacebookInsightMetric[]>

export const FACEBOOK_MODERN_METRICS = 'post_media_view,post_engaged_users,post_clicks,post_reactions_by_type_total'
export const FACEBOOK_TOTAL_VALUE_METRICS = 'post_total_media_view_unique'
export const FACEBOOK_LEGACY_METRICS = 'post_impressions_unique,post_impressions,post_engaged_users,post_clicks,post_reactions_by_type_total'
export const FACEBOOK_PROBE_METRICS = [
  'post_media_view',
  'post_total_media_view_unique',
  'post_engaged_users',
  'post_clicks',
  'post_reactions_by_type_total',
  'post_impressions_unique',
  'post_video_views',
]

/** Merge metric groups, keeping the first definition of each metric name. */
export function mergeInsightMetrics(groups: FacebookInsightMetric[][]): FacebookInsightMetric[] {
  const byName = new Map<string, FacebookInsightMetric>()
  for (const group of groups) {
    for (const metric of group) {
      if (!byName.has(metric.name)) byName.set(metric.name, metric)
    }
  }
  return [...byName.values()]
}

export async function collectFacebookPostInsights(
  fetchInsights: FacebookInsightsFetcher,
): Promise<FacebookInsightMetric[]> {
  const [modern, totalValue] = await Promise.all([
    fetchInsights({ metrics: FACEBOOK_MODERN_METRICS }),
    fetchInsights({ metrics: FACEBOOK_TOTAL_VALUE_METRICS, metricType: 'total_value' }),
  ])
  const merged = mergeInsightMetrics([modern, totalValue])
  if (merged.length > 0) return merged

  const legacy = await fetchInsights({ metrics: FACEBOOK_LEGACY_METRICS })
  if (legacy.length > 0) return legacy

  const probes = await Promise.all(FACEBOOK_PROBE_METRICS.map(metric => fetchInsights({
    metrics: metric,
    metricType: metric === FACEBOOK_TOTAL_VALUE_METRICS ? 'total_value' : undefined,
  })))
  return mergeInsightMetrics(probes)
}
