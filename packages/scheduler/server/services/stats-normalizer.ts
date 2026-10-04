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

  metrics.total = Object.entries(metrics).reduce((sum, [, v]) => sum + (typeof v === 'number' ? v : 0), 0)
  return metrics
}

export function sumEngagement(metrics: NormalizedPostMetrics): number {
  let total = 0
  for (const [key, value] of Object.entries(metrics)) {
    if (key === 'total') continue
    if (typeof value === 'number') total += value
  }
  return total
}