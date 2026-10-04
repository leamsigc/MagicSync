/**
 * Unit tests for the Facebook post-insights fallback ladder.
 * Run: node --test packages/scheduler/server/services/plugins/facebook-insights.test.ts
 * (Node ≥20, no deps — uses node:test + inline .ts import via type stripping.)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  collectFacebookPostInsights,
  FACEBOOK_LEGACY_METRICS,
  FACEBOOK_MODERN_METRICS,
  FACEBOOK_PROBE_METRICS,
  FACEBOOK_TOTAL_VALUE_METRICS,
  mergeInsightMetrics,
  type FacebookInsightMetric,
  type FacebookInsightsQuery,
} from './facebook-insights.ts'

const row = (name: string, value: number | Record<string, number>): FacebookInsightMetric => ({
  name,
  values: [{ value }],
})

function recordingFetcher(results: Record<string, FacebookInsightMetric[]>) {
  const calls: FacebookInsightsQuery[] = []
  return {
    calls,
    fetchInsights: async (query: FacebookInsightsQuery) => {
      calls.push(query)
      return results[query.metrics] ?? []
    },
  }
}

describe('mergeInsightMetrics', () => {
  it('keeps the first definition of a duplicated metric', () => {
    const merged = mergeInsightMetrics([
      [row('post_clicks', 5)],
      [row('post_clicks', 99), row('post_media_view', 12)],
    ])
    assert.equal(merged.length, 2)
    assert.equal(merged.find(metric => metric.name === 'post_clicks')?.values?.[0]?.value, 5)
    assert.equal(merged.find(metric => metric.name === 'post_media_view')?.values?.[0]?.value, 12)
  })
})

describe('collectFacebookPostInsights', () => {
  it('uses the modern and total-value batches when they succeed', async () => {
    const { calls, fetchInsights } = recordingFetcher({
      [FACEBOOK_MODERN_METRICS]: [row('post_media_view', 40), row('post_engaged_users', 7)],
      [FACEBOOK_TOTAL_VALUE_METRICS]: [row('post_total_media_view_unique', 120)],
    })
    const metrics = await collectFacebookPostInsights(fetchInsights)

    assert.deepEqual(metrics.map(metric => metric.name).sort(), [
      'post_engaged_users',
      'post_media_view',
      'post_total_media_view_unique',
    ])
    assert.deepEqual(calls, [
      { metrics: FACEBOOK_MODERN_METRICS },
      { metrics: FACEBOOK_TOTAL_VALUE_METRICS, metricType: 'total_value' },
    ])
  })

  it('falls back to the legacy impressions batch when the modern metrics are rejected', async () => {
    const { calls, fetchInsights } = recordingFetcher({
      [FACEBOOK_LEGACY_METRICS]: [row('post_impressions_unique', 88)],
    })
    const metrics = await collectFacebookPostInsights(fetchInsights)

    assert.deepEqual(metrics.map(metric => metric.name), ['post_impressions_unique'])
    assert.equal(calls.length, 3)
    assert.equal(calls[2].metrics, FACEBOOK_LEGACY_METRICS)
  })

  it('probes metrics individually when every batch fails (invalid metric never fails the plugin)', async () => {
    const { calls, fetchInsights } = recordingFetcher({
      post_engaged_users: [row('post_engaged_users', 3)],
      post_video_views: [row('post_video_views', 55)],
    })
    const metrics = await collectFacebookPostInsights(fetchInsights)

    assert.deepEqual(metrics.map(metric => metric.name).sort(), ['post_engaged_users', 'post_video_views'])
    const probes = calls.filter(call => FACEBOOK_PROBE_METRICS.includes(call.metrics))
    assert.deepEqual(
      [...new Set(probes.map(call => call.metrics))].sort(),
      [...FACEBOOK_PROBE_METRICS].sort(),
    )
    assert.deepEqual(
      probes.find(call => call.metrics === FACEBOOK_TOTAL_VALUE_METRICS),
      { metrics: FACEBOOK_TOTAL_VALUE_METRICS, metricType: 'total_value' },
    )
    assert.ok(probes.filter(call => call.metrics !== FACEBOOK_TOTAL_VALUE_METRICS).every(call => call.metricType === undefined))
  })

  it('returns an empty list when every request fails', async () => {
    const { fetchInsights } = recordingFetcher({})
    const metrics = await collectFacebookPostInsights(fetchInsights)
    assert.deepEqual(metrics, [])
  })
})
