import type { H3Event } from 'h3'
import { and, desc, eq, gte, inArray } from 'drizzle-orm'
import type { ServiceResponse } from './types'
import {
  CreateTemplateSchema,
  UpdateTemplateSchema,
  contentTemplates,
  postMetrics,
  posts,
  type ContentTemplate,
  type CreateTemplateData,
  type PostMetric,
  type UpdateTemplateData,
} from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { requireBusinessAccess } from '../utils/business-access'
import { businessContextResolver } from './business-context-resolver.service'
import { contentArtifactService } from './content-artifact.service'

export const ANALYTICS_VERSION = 'analytics/v1'

export interface CanonicalMetrics {
  likes: number | null
  comments: number | null
  shares: number | null
  views: number | null
  reach: number | null
  impressions: number | null
  saves: number | null
  quotes: number | null
  reposts: number | null
  engagementRate: number | null
  viralityScore: number | null
  collectedAt: string | null
  platform: string
  businessId: string
  postId: string
}

export interface RankedPost {
  postId: string
  content: string
  platform: string
  metrics: CanonicalMetrics
  freshness: { collectedAt: string | null, stale: boolean }
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function pickNumber(raw: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = num(raw[key])
    if (value !== null) return value
  }
  return null
}

export function engagementRateOf(metrics: Record<string, unknown>): number | null {
  const interactions = (num(metrics.likes) ?? 0)
    + (num(metrics.comments) ?? 0)
    + (num(metrics.shares) ?? 0)
    + (num(metrics.saves) ?? 0)
    + (num(metrics.quotes) ?? 0)
    + (num(metrics.reposts) ?? 0)
  const reach = pickNumber(metrics, ['reach', 'impressions', 'views', 'followers'])
  if (reach === null || reach <= 0) return null
  return (interactions / reach) * 100
}

export function viralityScoreOf(metrics: Record<string, unknown>): number | null {
  const rate = engagementRateOf(metrics)
  const views = pickNumber(metrics, ['views', 'impressions', 'reach'])
  if (rate === null && views === null) return null
  const ratePart = Math.min(rate ?? 0, 20) / 20
  const viewsPart = views ? Math.min(Math.log10(views + 1) / 6, 1) : 0
  return Math.round((ratePart * 0.7 + viewsPart * 0.3) * 100)
}

export function postStructure(content: string): { hookStyle: string, blocks: string[], hashtagCount: number, charCount: number } {
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean)
  const first = lines[0] ?? ''
  const hookStyle = first.endsWith('?') ? 'question' : /^\d/.test(first) ? 'number' : first.endsWith('!') ? 'exclaim' : 'statement'
  const hashtags = (content.match(/#[\p{L}\p{N}_]+/gu) ?? []).length
  return { hookStyle, blocks: lines, hashtagCount: hashtags, charCount: content.length }
}

function canonicalize(row: PostMetric, businessId: string, postId: string, platform: string): CanonicalMetrics {
  let raw: Record<string, unknown> = {}
  try {
    const parsed: unknown = JSON.parse(row.metrics as unknown as string)
    if (parsed && typeof parsed === 'object') raw = parsed as Record<string, unknown>
  } catch {
    raw = {}
  }
  return {
    likes: num(raw.likes),
    comments: num(raw.comments),
    shares: num(raw.shares),
    views: num(raw.views),
    reach: num(raw.reach),
    impressions: num(raw.impressions),
    saves: num(raw.saves),
    quotes: num(raw.quotes),
    reposts: num(raw.reposts),
    engagementRate: engagementRateOf(raw),
    viralityScore: viralityScoreOf(raw),
    collectedAt: row.collectedAt ? new Date(row.collectedAt).toISOString() : null,
    platform,
    businessId,
    postId,
  }
}

export class AnalyticsService {
  private db = useDrizzle()

  private async resolveOwner(userId: string, businessId: string, event?: H3Event) {
    try {
      const access = await requireBusinessAccess(event as H3Event, userId, businessId)
      if (!access.success || !access.data) {
        return { success: false as const, error: 'Business not found', code: 'NOT_FOUND' }
      }
      return { success: true as const, data: access.data.ownerUserId }
    } catch {
      return { success: false as const, error: 'Failed to verify business access' }
    }
  }

  private async latestMetricsByPost(
    businessId: string,
    ownerId: string,
    options: { since?: Date, platform?: string, postIds?: string[] },
  ): Promise<Map<string, { row: PostMetric, platform: string }>> {
    const postRows = await this.db
      .select({ id: posts.id })
      .from(posts)
      .where(and(
        eq(posts.businessId, businessId),
        eq(posts.userId, ownerId),
        ...(options.postIds?.length ? [inArray(posts.id, options.postIds)] : []),
      ))
      .limit(500)
    const ids = postRows.map(row => row.id)
    const latest = new Map<string, { row: PostMetric, platform: string }>()
    if (ids.length === 0) return latest
    const rows = await this.db
      .select()
      .from(postMetrics)
      .where(and(
        inArray(postMetrics.postId, ids),
        ...(options.since ? [gte(postMetrics.collectedAt, options.since)] : []),
      ))
      .orderBy(desc(postMetrics.collectedAt))
      .limit(2000)
    for (const row of rows) {
      if (options.platform && row.platform !== options.platform) continue
      if (!latest.has(row.postId)) latest.set(row.postId, { row, platform: row.platform })
    }
    return latest
  }

  private freshnessWarnings(latest: Map<string, { row: PostMetric }>, days: number): string[] {
    const warnings: string[] = []
    if (latest.size === 0) warnings.push('No metrics in the requested window')
    if (latest.size > 0 && latest.size < 3) warnings.push('Sparse data: fewer than 3 measured posts')
    const cutoff = Date.now() - days * 86400000
    const stale = [...latest.values()].filter(({ row }) => !row.collectedAt || new Date(row.collectedAt).getTime() < cutoff)
    if (stale.length > 0) warnings.push(`${stale.length} post(s) have only stale snapshots`)
    return warnings
  }

  async getBestPosts(
    userId: string,
    businessId: string,
    options: { days?: number, platform?: string, limit?: number } = {},
    event?: H3Event,
  ): Promise<ServiceResponse<{ posts: RankedPost[], warnings: string[], version: string }>> {
    try {
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner
      const days = options.days ?? 30
      const limit = Math.min(options.limit ?? 5, 50)
      const since = new Date(Date.now() - days * 86400000)
      const latest = await this.latestMetricsByPost(businessId, owner.data, { since, platform: options.platform })
      const ranked: RankedPost[] = []
      for (const [postId, { row, platform }] of latest) {
        const [post] = await this.db.select().from(posts).where(eq(posts.id, postId)).limit(1)
        if (!post) continue
        ranked.push({
          postId,
          content: post.content,
          platform,
          metrics: canonicalize(row, businessId, postId, platform),
          freshness: {
            collectedAt: row.collectedAt ? new Date(row.collectedAt).toISOString() : null,
            stale: !row.collectedAt || new Date(row.collectedAt).getTime() < since.getTime(),
          },
        })
      }
      ranked.sort((a, b) => (b.metrics.engagementRate ?? -1) - (a.metrics.engagementRate ?? -1))
      return {
        success: true,
        data: { posts: ranked.slice(0, limit), warnings: this.freshnessWarnings(latest, days), version: ANALYTICS_VERSION },
      }
    } catch {
      return { success: false, error: 'Failed to rank posts' }
    }
  }

  async getPostPerformance(
    userId: string,
    businessId: string,
    postId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<{ postId: string, metrics: CanonicalMetrics | null, structure: ReturnType<typeof postStructure>, explanation: string, warnings: string[], version: string }>> {
    try {
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner
      const [post] = await this.db
        .select()
        .from(posts)
        .where(and(eq(posts.id, postId), eq(posts.businessId, businessId), eq(posts.userId, owner.data)))
        .limit(1)
      if (!post) {
        return { success: false, error: 'Post not found', code: 'NOT_FOUND' }
      }
      const latest = await this.latestMetricsByPost(businessId, owner.data, { postIds: [postId] })
      const found = latest.get(postId)
      const metrics = found ? canonicalize(found.row, businessId, postId, found.platform) : null
      const structure = postStructure(post.content)
      return {
        success: true,
        data: {
          postId,
          metrics,
          structure,
          explanation: this.explainPerformance(metrics, structure),
          warnings: metrics ? [] : ['No metrics collected for this post yet'],
          version: ANALYTICS_VERSION,
        },
      }
    } catch {
      return { success: false, error: 'Failed to load post performance' }
    }
  }

  private explainPerformance(metrics: CanonicalMetrics | null, structure: ReturnType<typeof postStructure>): string {
    if (!metrics || metrics.engagementRate === null) {
      return `No measured engagement yet. The post opens with a ${structure.hookStyle} hook, runs ${structure.charCount} characters, and carries ${structure.hashtagCount} hashtags.`
    }
    return `Engagement rate ${metrics.engagementRate.toFixed(2)}% with a ${structure.hookStyle} hook, ${structure.charCount} characters, and ${structure.hashtagCount} hashtags.`
  }

  async calculateEngagement(
    userId: string,
    businessId: string,
    postIds: string[],
    event?: H3Event,
  ): Promise<ServiceResponse<{ rates: Array<{ postId: string, engagementRate: number | null }>, version: string }>> {
    try {
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner
      const latest = await this.latestMetricsByPost(businessId, owner.data, { postIds: postIds.slice(0, 100) })
      const rates = [...latest.entries()].map(([postId, { row, platform }]) => ({
        postId,
        engagementRate: canonicalize(row, businessId, postId, platform).engagementRate,
      }))
      return { success: true, data: { rates, version: ANALYTICS_VERSION } }
    } catch {
      return { success: false, error: 'Failed to calculate engagement' }
    }
  }

  async scoreVirality(
    userId: string,
    businessId: string,
    input: { postId?: string, content?: string },
    event?: H3Event,
  ): Promise<ServiceResponse<{ score: number | null, reason: string, version: string }>> {
    try {
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner
      if (input.postId) {
        const latest = await this.latestMetricsByPost(businessId, owner.data, { postIds: [input.postId] })
        const found = latest.get(input.postId)
        if (!found) {
          return { success: true, data: { score: null, reason: 'No metrics collected for this post yet', version: ANALYTICS_VERSION } }
        }
        const metrics = canonicalize(found.row, businessId, input.postId, found.platform)
        return { success: true, data: { score: metrics.viralityScore, reason: metrics.viralityScore === null ? 'Insufficient metric coverage' : 'Measured engagement and reach', version: ANALYTICS_VERSION } }
      }
      const structure = postStructure(input.content ?? '')
      const heuristic = structure.hashtagCount > 0 && structure.charCount > 40 ? 35 : 20
      return { success: true, data: { score: heuristic, reason: 'Content-only heuristic (no measured metrics)', version: ANALYTICS_VERSION } }
    } catch {
      return { success: false, error: 'Failed to score virality' }
    }
  }

  async destructurePost(
    userId: string,
    businessId: string,
    postId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<{ sourcePostId: string, hook: { style: string }, structure: string[], tone: string[], cta: { style: string }, performance: { engagementRate: number | null, viralityScore: number | null }, evidence: string[] }>> {
    try {
      const performance = await this.getPostPerformance(userId, businessId, postId, event)
      if (!performance.success) {
        return { success: false, error: performance.error ?? 'Failed to load post', code: performance.code }
      }
      const structure = performance.data.structure
      const blocks = structure.blocks.length > 3 ? ['hook', 'problem', 'lesson', 'cta'] : ['hook', 'body', 'cta']
      return {
        success: true,
        data: {
          sourcePostId: postId,
          hook: { style: structure.hookStyle },
          structure: blocks,
          tone: structure.hashtagCount > 3 ? ['direct', 'discoverable'] : ['direct'],
          cta: { style: 'question' },
          performance: {
            engagementRate: performance.data.metrics?.engagementRate ?? null,
            viralityScore: performance.data.metrics?.viralityScore ?? null,
          },
          evidence: [`post:${postId}`],
        },
      }
    } catch {
      return { success: false, error: 'Failed to destructure post' }
    }
  }

  async createTemplate(userId: string, data: CreateTemplateData, event?: H3Event): Promise<ServiceResponse<ContentTemplate>> {
    try {
      const parsed = CreateTemplateSchema.safeParse(data)
      if (!parsed.success) {
        return { success: false, error: 'Invalid template definition', code: 'VALIDATION_ERROR' }
      }
      const owner = await this.resolveOwner(userId, parsed.data.businessId, event)
      if (!owner.success) return owner
      if (parsed.data.sourcePostId) {
        const [post] = await this.db
          .select({ id: posts.id })
          .from(posts)
          .where(and(eq(posts.id, parsed.data.sourcePostId), eq(posts.businessId, parsed.data.businessId), eq(posts.userId, owner.data)))
          .limit(1)
        if (!post) {
          return { success: false, error: 'Source post not found', code: 'NOT_FOUND' }
        }
      }
      const now = new Date()
      const [created] = await this.db.insert(contentTemplates).values({
        id: crypto.randomUUID(),
        ownerUserId: owner.data,
        businessId: parsed.data.businessId,
        sourcePostId: parsed.data.sourcePostId ?? null,
        name: parsed.data.name,
        description: parsed.data.description,
        platform: parsed.data.platform,
        hookStyle: parsed.data.hookStyle,
        structure: JSON.stringify(parsed.data.structure),
        bodyBlocks: JSON.stringify(parsed.data.bodyBlocks),
        ctaStyle: parsed.data.ctaStyle,
        toneNotes: parsed.data.toneNotes,
        visualPattern: parsed.data.visualPattern,
        requiredInputs: JSON.stringify(parsed.data.requiredInputs),
        sourceMetrics: parsed.data.sourceMetrics,
        version: 1,
        status: 'active',
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      }).returning()
      return { success: true, data: created }
    } catch {
      return { success: false, error: 'Failed to create template' }
    }
  }

  async listTemplates(userId: string, businessId: string, event?: H3Event): Promise<ServiceResponse<ContentTemplate[]>> {
    try {
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner
      const rows = await this.db
        .select()
        .from(contentTemplates)
        .where(and(eq(contentTemplates.businessId, businessId), eq(contentTemplates.ownerUserId, owner.data)))
        .orderBy(desc(contentTemplates.updatedAt))
        .limit(100)
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to list templates' }
    }
  }

  async archiveTemplate(userId: string, templateId: string, businessId: string, event?: H3Event): Promise<ServiceResponse<ContentTemplate>> {
    try {
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner
      const [updated] = await this.db
        .update(contentTemplates)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(and(
          eq(contentTemplates.id, templateId),
          eq(contentTemplates.businessId, businessId),
          eq(contentTemplates.ownerUserId, owner.data),
        ))
        .returning()
      if (!updated) {
        return { success: false, error: 'Template not found', code: 'NOT_FOUND' }
      }
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to archive template' }
    }
  }

  async applyTemplate(
    userId: string,
    businessId: string,
    templateId: string,
    theme: string,
    options: { useBusinessContext?: boolean } = {},
    event?: H3Event,
  ): Promise<ServiceResponse<{ artifactId: string, caption: string }>> {
    try {
      if (!theme.trim()) {
        return { success: false, error: 'A theme is required', code: 'VALIDATION_ERROR' }
      }
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner
      const [template] = await this.db
        .select()
        .from(contentTemplates)
        .where(and(
          eq(contentTemplates.id, templateId),
          eq(contentTemplates.businessId, businessId),
          eq(contentTemplates.ownerUserId, owner.data),
        ))
        .limit(1)
      if (!template || template.status === 'archived') {
        return { success: false, error: 'Template not found', code: 'NOT_FOUND' }
      }
      const brand = await businessContextResolver.resolve(userId, {
        businessId,
        useBusinessContext: options.useBusinessContext === true,
      }, event)
      if (!brand.success || !brand.data) {
        return { success: false, error: brand.error ?? 'Failed to resolve brand context', code: brand.code ?? 'CONTEXT_FAILED' }
      }
      const caption = this.renderFromTemplate(template, theme.trim())
      const submitted = await contentArtifactService.submitArtifact(userId, {
        businessId,
        kind: 'template',
        outputKind: 'social_post_draft',
        output: {
          outputKind: 'social_post_draft',
          caption,
          platformVariants: {},
          slideCopy: [],
          cta: template.ctaStyle,
          claims: [],
          sources: template.sourcePostId ? [`post:${template.sourcePostId}`] : [],
        },
      }, event)
      if (!submitted.success) {
        return { success: false, error: submitted.error ?? 'Failed to submit artifact', code: submitted.code }
      }
      return { success: true, data: { artifactId: submitted.data.id, caption } }
    } catch {
      return { success: false, error: 'Failed to apply template' }
    }
  }

  private renderFromTemplate(template: ContentTemplate, theme: string): string {
    const blocks = this.parseJsonArray(template.bodyBlocks)
    const lines = blocks.length > 0 ? blocks : this.parseJsonArray(template.structure)
    const body = lines.map(line => line.replace(/\{theme\}/gi, theme)).join('\n\n')
    const hook = template.hookStyle ? `[${template.hookStyle} hook] ` : ''
    const cta = template.ctaStyle ? `\n\nCTA (${template.ctaStyle}): ${theme}` : ''
    const tone = template.toneNotes ? `\n\nTone: ${template.toneNotes}` : ''
    return `${hook}${theme}\n\n${body}${cta}${tone}`.trim()
  }

  private parseJsonArray(raw: string | null): string[] {
    if (!raw) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
    } catch {
      return []
    }
  }
}

export const analyticsService = new AnalyticsService()
