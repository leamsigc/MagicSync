import type { PostInsight } from '#layers/BaseDB/server/services/SchedulerPost.service'

export interface NormalizedPostMetrics {
  likes?: number
  comments?: number
  shares?: number
  views?: number
  reach?: number
  impressions?: number
  saves?: number
  quotes?: number
  bookmarks?: number
  retweets?: number
  reposts?: number
  total: number
}

export type MetricKey = keyof Omit<NormalizedPostMetrics, 'total'>

/**
 * Keys that count as *engagement* for the `total` used by Top Posts / Best
 * Times ranking. Reach metrics (views, impressions, reach) are deliberately
 * excluded: summing them made view-heavy platforms (YouTube `viewCount`)
 * dominate every ranking and pushed real engagement to the bottom.
 */
export const ENGAGEMENT_KEYS: MetricKey[] = ['likes', 'comments', 'shares', 'saves', 'quotes', 'bookmarks', 'retweets', 'reposts']

const LABEL_ALIASES: Record<string, MetricKey> = {
  likes: 'likes', like: 'likes', like_count: 'likes', likecount: 'likes',
  comments: 'comments', comment: 'comments', comment_count: 'comments', commentcount: 'comments',
  replies: 'comments', reply: 'comments', reply_count: 'comments', replycount: 'comments',
  shares: 'shares', share: 'shares', share_count: 'shares', sharecount: 'shares',
  views: 'views', view: 'views', view_count: 'views', viewcount: 'views', play_count: 'views',
  impressions: 'impressions', impression: 'impressions', impression_count: 'impressions', impressioncount: 'impressions',
  reach: 'reach', reach_count: 'reach', reachcount: 'reach',
  saves: 'saves', save: 'saves', save_count: 'saves', savecount: 'saves',
  quotes: 'quotes', quote: 'quotes', quote_count: 'quotes', quotecount: 'quotes',
  bookmarks: 'bookmarks', bookmark: 'bookmarks', bookmark_count: 'bookmarks', bookmarkcount: 'bookmarks',
  retweets: 'retweets', retweet: 'retweets', retweet_count: 'retweets', retweetcount: 'retweets',
  reposts: 'reposts', repost: 'reposts', repost_count: 'reposts', repostcount: 'reposts',
}

export function normalizePostInsights(insights: PostInsight[] | undefined): NormalizedPostMetrics {
  const metrics: NormalizedPostMetrics = { total: 0 }
  if (!Array.isArray(insights)) return metrics

  for (const insight of insights) {
    const label = String(insight.label ?? '').trim().toLowerCase()
    if (!label) continue
    const key = LABEL_ALIASES[label]
    if (!key) continue
    const value = typeof insight.value === 'number' ? insight.value : Number(insight.value) || 0
    metrics[key] = (metrics[key] ?? 0) + value
  }

  metrics.total = ENGAGEMENT_KEYS.reduce((sum, key) => sum + (metrics[key] ?? 0), 0)
  return metrics
}

export function sumEngagement(metrics: NormalizedPostMetrics): number {
  return ENGAGEMENT_KEYS.reduce((sum, key) => sum + (metrics[key] ?? 0), 0)
}