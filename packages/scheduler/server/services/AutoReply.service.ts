import { and, desc, eq, like } from 'drizzle-orm'
import { entityDetails } from '#layers/BaseDB/db/entityDetails/entityDetails'
import { platformPosts } from '#layers/BaseDB/db/posts/posts'
import { socialMediaAccounts } from '#layers/BaseDB/db/socialMedia/socialMedia'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import type { ServiceResponse } from '#layers/BaseDB/server/services/types'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { SchedulerPost, type PlatformComment, type PluginSocialMediaAccount } from '#layers/BaseScheduler/server/services/SchedulerPost.service'
import { InstagramPlugin } from '#layers/BaseScheduler/server/services/plugins/instagram.plugin'
import { platformRateLimiter } from '#layers/BaseScheduler/server/services/RateLimiter.service'
import { renewRowToken } from '#layers/BaseScheduler/server/services/TokenRefresh.service'
import { hourBucketUtc as hourBucketUtcPure, isHttpsUrl as isHttpsUrlPure, matchKeywords as matchKeywordsPure, renderTemplate as renderTemplatePure, trackedUrl as trackedUrlPure, trimContacted as trimContactedPure, type WebhookCommentEvent, type WebhookMessageEvent } from '#layers/BaseScheduler/server/services/auto-reply-pure'

export const AUTOREPLY_CAMPAIGN = 'autoreply_campaign'
export const AUTOREPLY_STATE = 'autoreply_state'
export const AUTOREPLY_LOG = 'autoreply_log'
export const AUTOREPLY_LINK = 'autoreply_link'
export const AUTOREPLY_SEEN = 'autoreply_seen'

export const AUTOREPLY_RATE_CAP = 750
const CONTACTED_CAP = 2000
const LOG_CAP = 500
const WATCHED_POST_CAP = 20
const PROCESSED_CAP = 500
const SEEN_DRAIN_CAP = 200
const SEEN_MAX_AGE_DAYS = 7

export interface AutoReplyLinkInput {
  label: string
  target: string
}

export interface AutoReplyCampaign {
  id: string
  userId: string
  businessId?: string
  name: string
  platform: 'instagram'
  socialAccountId: string
  externalPostIds: string[]
  matchAllPosts?: boolean
  keywords: string[]
  matchMode: 'whole' | 'partial'
  dmTemplate: string
  linkIds: string[]
  links?: Array<{ id: string; label: string; target: string; clicks: number }>
  publicReplyTemplate?: string
  storyDmEnabled?: boolean
  followGate: boolean
  followPromptTemplate?: string
  enabled: boolean
  mode?: 'template' | 'ai'
  createdAt: string
  updatedAt: string
}

export interface AutoReplyLogEntry {
  commentId: string
  authorId: string
  authorName: string
  matchedKeyword?: string
  action: 'sent' | 'skipped' | 'failed'
  reason: string
  at: string
}

interface CampaignState {
  lastSeenCommentId?: string
  lastCheckedAt: string
  contactedUserIds: string[]
  /** Webhook/poll dedup: comment ids + message mids already acted on (FIFO). */
  processedCommentIds?: string[]
}

export const AUTO_REPLY_PRESETS: Array<{ key: string; name: string; keywords: string[]; dmTemplate: string; publicReplyTemplate: string }> = [
  {
    key: 'link-magnet',
    name: 'Link magnet',
    keywords: ['LINK', 'INFO'],
    dmTemplate: 'Hey {username}! Here is your link: {link1}',
    publicReplyTemplate: 'Sent you a DM @{username}!',
  },
  {
    key: 'discount',
    name: 'Discount code',
    keywords: ['DISCOUNT', 'CODE', 'DEAL'],
    dmTemplate: 'Hey {username}! Your code is SAVE10 — shop here: {link1}',
    publicReplyTemplate: 'Code sent to your DMs @{username}!',
  },
  {
    key: 'webinar',
    name: 'Webinar / event',
    keywords: ['WEBINAR', 'RSVP', 'JOIN'],
    dmTemplate: 'Hey {username}! Save your seat: {link1} (details: {link2})',
    publicReplyTemplate: 'Invite sent @{username} — check DMs!',
  },
]

function ownedEntityId(userId: string, campaignId: string): string {
  return `${userId}::${campaignId}`
}

function stateEntityId(campaignId: string, externalPostId: string): string {
  return `${campaignId}::${externalPostId}`
}

function rateEntityId(socialAccountId: string, hourBucket: string): string {
  return `rate::${socialAccountId}::${hourBucket}`
}

function notifyThrottleEntityId(userId: string, hourBucket: string): string {
  return `notify::${userId}::${hourBucket}`
}

export const hourBucketUtc = hourBucketUtcPure
export const matchKeywords = matchKeywordsPure
export const renderTemplate = renderTemplatePure
export const isHttpsUrl = isHttpsUrlPure

function appBaseUrl(): string {
  return process.env.NUXT_APP_URL || process.env.APP_URL || 'http://localhost:3000'
}

export function trackedUrl(campaignId: string, linkId: string): string {
  return trackedUrlPure(appBaseUrl(), campaignId, linkId)
}

function trimContacted(ids: string[]): string[] {
  return trimContactedPure(ids, CONTACTED_CAP)
}

function trimProcessed(ids: string[] | undefined): string[] {
  return trimContactedPure(ids || [], PROCESSED_CAP)
}

function markProcessed(state: CampaignState, key: string): void {
  state.processedCommentIds = trimProcessed([...(state.processedCommentIds || []), key])
}

function parseDetails<T>(raw: unknown): T | null {
  if (!raw || typeof raw !== 'object') return null
  return raw as T
}

class AutoReplyStore {
  db = useDrizzle()

  async listCampaignRows(userId: string) {
    return this.db
      .select()
      .from(entityDetails)
      .where(and(eq(entityDetails.entityType, AUTOREPLY_CAMPAIGN), like(entityDetails.entityId, `${userId}::%`)))
  }

  async getCampaignRow(entityId: string) {
    const [row] = await this.db
      .select()
      .from(entityDetails)
      .where(and(eq(entityDetails.entityType, AUTOREPLY_CAMPAIGN), eq(entityDetails.entityId, entityId)))
      .limit(1)
    return row || null
  }

  async saveCampaignRow(entityId: string, details: unknown) {
    const existing = await this.getCampaignRow(entityId)
    if (existing) {
      await this.db.update(entityDetails).set({ details: details as never, updatedAt: new Date() }).where(eq(entityDetails.id, existing.id))
    } else {
      await this.db.insert(entityDetails).values({ id: crypto.randomUUID(), entityId, entityType: AUTOREPLY_CAMPAIGN, details: details as never })
    }
  }

  async deleteCampaignRows(userId: string, campaignId: string) {
    const owned = ownedEntityId(userId, campaignId)
    await this.db.delete(entityDetails).where(and(eq(entityDetails.entityType, AUTOREPLY_CAMPAIGN), eq(entityDetails.entityId, owned)))
    await this.db.delete(entityDetails).where(and(eq(entityDetails.entityType, AUTOREPLY_LINK), like(entityDetails.entityId, `${campaignId}::%`)))
    await this.db.delete(entityDetails).where(and(eq(entityDetails.entityType, AUTOREPLY_LOG), like(entityDetails.entityId, `${campaignId}::%`)))
    await this.db.delete(entityDetails).where(and(eq(entityDetails.entityType, AUTOREPLY_STATE), like(entityDetails.entityId, `${campaignId}::%`)))
  }

  async listLogRows(campaignId: string, limit: number) {
    return this.db
      .select()
      .from(entityDetails)
      .where(and(eq(entityDetails.entityType, AUTOREPLY_LOG), like(entityDetails.entityId, `${campaignId}::%`)))
      .orderBy(desc(entityDetails.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100))
  }

  async countLogRows(campaignId: string): Promise<number> {
    const rows = await this.db
      .select({ id: entityDetails.id })
      .from(entityDetails)
      .where(and(eq(entityDetails.entityType, AUTOREPLY_LOG), like(entityDetails.entityId, `${campaignId}::%`)))
    return rows.length
  }

  async pruneLogs(campaignId: string) {
    const rows = await this.db
      .select()
      .from(entityDetails)
      .where(and(eq(entityDetails.entityType, AUTOREPLY_LOG), like(entityDetails.entityId, `${campaignId}::%`)))
      .orderBy(desc(entityDetails.createdAt))
    if (rows.length <= LOG_CAP) return
    const stale = rows.slice(LOG_CAP)
    for (const row of stale) {
      await this.db.delete(entityDetails).where(eq(entityDetails.id, row.id))
    }
  }

  async getStateRow(entityId: string) {
    const [row] = await this.db
      .select()
      .from(entityDetails)
      .where(and(eq(entityDetails.entityType, AUTOREPLY_STATE), eq(entityDetails.entityId, entityId)))
      .limit(1)
    return row || null
  }

  async saveStateRow(entityId: string, details: unknown) {
    const existing = await this.getStateRow(entityId)
    if (existing) {
      await this.db.update(entityDetails).set({ details: details as never, updatedAt: new Date() }).where(eq(entityDetails.id, existing.id))
    } else {
      await this.db.insert(entityDetails).values({ id: crypto.randomUUID(), entityId, entityType: AUTOREPLY_STATE, details: details as never })
    }
  }

  async deleteStaleRateRows(keepBucket: string) {
    const rows = await this.db
      .select()
      .from(entityDetails)
      .where(and(eq(entityDetails.entityType, AUTOREPLY_STATE), like(entityDetails.entityId, 'rate::%')))
    for (const row of rows) {
      if (!row.entityId.includes(keepBucket)) {
        await this.db.delete(entityDetails).where(eq(entityDetails.id, row.id))
      }
    }
  }

  async getLinkRow(entityId: string) {
    const [row] = await this.db
      .select()
      .from(entityDetails)
      .where(and(eq(entityDetails.entityType, AUTOREPLY_LINK), eq(entityDetails.entityId, entityId)))
      .limit(1)
    return row || null
  }

  async saveLinkRow(entityId: string, details: unknown) {
    const existing = await this.getLinkRow(entityId)
    if (existing) {
      await this.db.update(entityDetails).set({ details: details as never, updatedAt: new Date() }).where(eq(entityDetails.id, existing.id))
    } else {
      await this.db.insert(entityDetails).values({ id: crypto.randomUUID(), entityId, entityType: AUTOREPLY_LINK, details: details as never })
    }
  }

  async listLinkRows(campaignId: string) {
    return this.db
      .select()
      .from(entityDetails)
      .where(and(eq(entityDetails.entityType, AUTOREPLY_LINK), like(entityDetails.entityId, `${campaignId}::%`)))
  }

  async insertLogRow(entityId: string, details: unknown) {
    await this.db.insert(entityDetails).values({ id: crypto.randomUUID(), entityId, entityType: AUTOREPLY_LOG, details: details as never })
  }
}

export class AutoReplyService {
  private store = new AutoReplyStore()

  private toCampaign(userId: string, row: { entityId: string; details: unknown; updatedAt: Date | null }): AutoReplyCampaign | null {
    const details = parseDetails<Omit<AutoReplyCampaign, 'id' | 'userId'>>(row.details)
    if (!details) return null
    const id = row.entityId.split('::')[1] || row.entityId
    return { ...details, id, userId } as AutoReplyCampaign
  }

  async listCampaigns(userId: string): Promise<ServiceResponse<AutoReplyCampaign[]>> {
    try {
      const rows = await this.store.listCampaignRows(userId)
      const campaigns = rows
        .map((r) => this.toCampaign(userId, r))
        .filter((c): c is AutoReplyCampaign => c !== null)
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      return { success: true, data: campaigns }
    } catch {
      return { success: false, error: 'Failed to list auto-reply campaigns' }
    }
  }

  async getCampaign(userId: string, id: string): Promise<ServiceResponse<AutoReplyCampaign>> {
    try {
      const row = await this.store.getCampaignRow(ownedEntityId(userId, id))
      if (!row) return { success: false, error: 'Campaign not found', code: 'NOT_FOUND' }
      const campaign = this.toCampaign(userId, row)
      if (!campaign) return { success: false, error: 'Campaign data is corrupted', code: 'CORRUPTED' }
      const enriched = await this.withLinks(campaign)
      return { success: true, data: enriched }
    } catch {
      return { success: false, error: 'Failed to load campaign' }
    }
  }

  private async withLinks(campaign: AutoReplyCampaign): Promise<AutoReplyCampaign> {
    try {
      const rows = await this.store.listLinkRows(campaign.id)
      const links = rows.map((r) => {
        const d = parseDetails<{ label: string; target: string; clicks: number }>(r.details) || { label: '', target: '', clicks: 0 }
        return { id: r.entityId.split('::')[1] || r.entityId, label: d.label, target: d.target, clicks: d.clicks || 0 }
      })
      return { ...campaign, links }
    } catch {
      return campaign
    }
  }

  private validateLinks(links: AutoReplyLinkInput[]): string | null {
    if (links.length > 2) return 'At most 2 links are allowed'
    for (const l of links) {
      if (!l.label?.trim() || !l.target?.trim()) return 'Each link needs a label and target'
      if (!isHttpsUrl(l.target)) return 'Link targets must be https:// URLs'
    }
    return null
  }

  async createCampaign(userId: string, input: Omit<AutoReplyCampaign, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { links?: AutoReplyLinkInput[] }): Promise<ServiceResponse<AutoReplyCampaign>> {
    try {
      const id = crypto.randomUUID().slice(0, 8)
      const now = new Date().toISOString()
      const linkError = this.validateLinks(input.links || [])
      if (linkError) return { success: false, error: linkError, code: 'VALIDATION' }
      const linkIds = (input.links || []).map((_, i) => `link${i + 1}`)
      const campaign: AutoReplyCampaign = {
        id,
        userId,
        businessId: input.businessId,
        name: input.name,
        platform: 'instagram',
        socialAccountId: input.socialAccountId,
        externalPostIds: (input.externalPostIds || []).slice(0, WATCHED_POST_CAP),
        matchAllPosts: input.matchAllPosts,
        keywords: input.keywords,
        matchMode: input.matchMode || 'whole',
        dmTemplate: input.dmTemplate,
        linkIds,
        publicReplyTemplate: input.publicReplyTemplate,
        storyDmEnabled: input.storyDmEnabled || false,
        followGate: input.followGate || false,
        followPromptTemplate: input.followPromptTemplate,
        enabled: input.enabled !== false,
        mode: input.mode || 'template',
        createdAt: now,
        updatedAt: now,
      }
      const { links: _omit, ...persisted } = { ...campaign, links: undefined }
      void _omit
      await this.store.saveCampaignRow(ownedEntityId(userId, id), persisted)
      await this.saveLinks(id, input.links || [])
      return { success: true, data: await this.withLinks(campaign) }
    } catch {
      return { success: false, error: 'Failed to create campaign' }
    }
  }

  private async saveLinks(campaignId: string, links: AutoReplyLinkInput[]) {
    for (let i = 0; i < links.length; i++) {
      const link = links[i]
      if (!link) continue
      await this.store.saveLinkRow(`${campaignId}::link${i + 1}`, { label: link.label, target: link.target, clicks: 0 })
    }
  }

  async updateCampaign(userId: string, id: string, patch: Partial<Omit<AutoReplyCampaign, 'id' | 'userId'>> & { links?: AutoReplyLinkInput[] }): Promise<ServiceResponse<AutoReplyCampaign>> {
    try {
      const current = await this.getCampaign(userId, id)
      if (current.error || !current.data) return { success: false, error: current.error || 'Campaign not found', code: current.code || 'NOT_FOUND' }
      if (patch.links) {
        const linkError = this.validateLinks(patch.links)
        if (linkError) return { success: false, error: linkError, code: 'VALIDATION' }
      }
      const base = current.data
      const merged: AutoReplyCampaign = {
        ...base,
        ...patch,
        id: base.id,
        userId,
        platform: 'instagram',
        linkIds: patch.links ? patch.links.map((_, i) => `link${i + 1}`) : base.linkIds,
        updatedAt: new Date().toISOString(),
      }
      if (merged.externalPostIds) merged.externalPostIds = merged.externalPostIds.slice(0, WATCHED_POST_CAP)
      const { links: _omit2, ...persisted } = { ...merged, links: undefined }
      void _omit2
      await this.store.saveCampaignRow(ownedEntityId(userId, id), persisted)
      if (patch.links) await this.saveLinks(id, patch.links)
      return { success: true, data: await this.withLinks(merged) }
    } catch {
      return { success: false, error: 'Failed to update campaign' }
    }
  }

  async deleteCampaign(userId: string, id: string): Promise<ServiceResponse<true>> {
    try {
      await this.store.deleteCampaignRows(userId, id)
      return { success: true, data: true }
    } catch {
      return { success: false, error: 'Failed to delete campaign' }
    }
  }

  async toggleCampaign(userId: string, id: string, enabled: boolean): Promise<ServiceResponse<AutoReplyCampaign>> {
    return this.updateCampaign(userId, id, { enabled })
  }

  async getLogs(userId: string, campaignId: string, limit = 25): Promise<ServiceResponse<AutoReplyLogEntry[]>> {
    try {
      const owned = await this.store.getCampaignRow(ownedEntityId(userId, campaignId))
      if (!owned) return { success: false, error: 'Campaign not found', code: 'NOT_FOUND' }
      const rows = await this.store.listLogRows(campaignId, limit)
      const logs = rows
        .map((r) => parseDetails<AutoReplyLogEntry>(r.details))
        .filter((l): l is AutoReplyLogEntry => !!l && typeof l.action === 'string')
      return { success: true, data: logs }
    } catch {
      return { success: false, error: 'Failed to load logs' }
    }
  }

  async getStats(userId: string, campaignId: string): Promise<ServiceResponse<{ sent: number; skipped: number; failed: number; clicksPerLink: Array<{ linkId: string; label: string; target: string; clicks: number }> }>> {
    try {
      const campaign = await this.getCampaign(userId, campaignId)
      if (campaign.error || !campaign.data) return { success: false, error: campaign.error || 'Campaign not found', code: campaign.code || 'NOT_FOUND' }
      const rows = await this.store.listLogRows(campaignId, 100)
      let sent = 0
      let skipped = 0
      let failed = 0
      for (const r of rows) {
        const log = parseDetails<AutoReplyLogEntry>(r.details)
        if (log?.action === 'sent') sent++
        else if (log?.action === 'skipped') skipped++
        else if (log?.action === 'failed') failed++
      }
      const clicksPerLink = (campaign.data.links || []).map((l) => ({ linkId: l.id, label: l.label, target: l.target, clicks: l.clicks }))
      return { success: true, data: { sent, skipped, failed, clicksPerLink } }
    } catch {
      return { success: false, error: 'Failed to load stats' }
    }
  }

  /**
   * Recent IG media for the post-picker UI (and match-all discovery uses the
   * same plugin call). Ownership-checked; never throws.
   */
  async listRecentMedia(userId: string, socialAccountId: string, limit = 10): Promise<ServiceResponse<Array<{ id: string; caption?: string; mediaType?: string; imageUrl?: string; timestamp?: string; likeCount?: number; commentsCount?: number }>>> {
    try {
      const account = await socialMediaAccountService.getAccountById(socialAccountId, userId)
      if (!account) return { success: false, error: 'Social media account not found', code: 'NOT_FOUND' }
      if (account.platform !== 'instagram') {
        return { success: false, error: 'Post picker is only supported for Instagram accounts', code: 'UNSUPPORTED' }
      }
      const plugin = this.instagramPlugin()
      const capped = Math.min(Math.max(limit, 1), 25)
      const media = await plugin.getRecentMedia(account as unknown as PluginSocialMediaAccount, capped)
      return { success: true, data: media }
    } catch {
      return { success: false, error: 'Failed to load recent posts' }
    }
  }

  testMatch(text: string, keywords: string[], mode: 'whole' | 'partial'): ServiceResponse<{ matched: string | null }> {
    try {
      return { success: true, data: { matched: matchKeywords(text, keywords, mode) } }
    } catch {
      return { success: false, error: 'Match test failed' }
    }
  }

  private instagramPlugin() {
    const scheduler = new SchedulerPost({})
    scheduler.use(InstagramPlugin)
    const plugin = scheduler.getPlugin('instagram')
    if (!plugin) throw new Error('Instagram plugin not registered')
    return plugin as unknown as InstagramPlugin
  }

  private async resolveWatchedPosts(campaign: AutoReplyCampaign): Promise<string[]> {
    const explicit = (campaign.externalPostIds || []).slice(0, WATCHED_POST_CAP)
    if (!campaign.matchAllPosts) return explicit
    const merged = [...explicit]
    const addIds = (ids: string[]) => {
      for (const id of ids) {
        if (merged.length >= WATCHED_POST_CAP) break
        if (id && !merged.includes(id)) merged.push(id)
      }
    }
    // Live media listing first: platformPosts only knows posts published
    // THROUGH MagicSync — natively posted reels (the common case) would
    // otherwise be invisible to match-all campaigns.
    try {
      const account = await socialMediaAccountService.getAccountById(campaign.socialAccountId, campaign.userId)
      if (account) {
        const plugin = this.instagramPlugin()
        addIds(await plugin.getRecentMediaIds(account as unknown as PluginSocialMediaAccount, WATCHED_POST_CAP))
      }
    } catch {
      // Fall through to DB discovery below.
    }
    try {
      const db = useDrizzle()
      const rows = await db.select().from(platformPosts).where(eq(platformPosts.socialAccountId, campaign.socialAccountId)).limit(50)
      const discovered: string[] = []
      for (const row of rows) {
        const raw = (row as unknown as { publishDetail?: unknown }).publishDetail
        let detail: Record<string, unknown> = {}
        if (typeof raw === 'string') {
          try { detail = JSON.parse(raw) } catch { detail = {} }
        } else if (raw && typeof raw === 'object') {
          detail = raw as Record<string, unknown>
        }
        const byAccount = (detail as Record<string, { publishedId?: string }>)[campaign.socialAccountId]?.publishedId
        const flat = (detail as { postId?: string }).postId
        const ext = byAccount || flat
        if (ext && !discovered.includes(ext)) discovered.push(ext)
      }
      addIds(discovered)
      return merged
    } catch {
      return merged.length > 0 ? merged : explicit
    }
  }

  private async readRateCount(socialAccountId: string, bucket: string): Promise<number> {
    const row = await this.store.getStateRow(rateEntityId(socialAccountId, bucket))
    const details = row ? parseDetails<{ count: number }>(row.details) : null
    return details?.count || 0
  }

  private async bumpRateCount(socialAccountId: string, bucket: string): Promise<void> {
    const current = await this.readRateCount(socialAccountId, bucket)
    await this.store.saveStateRow(rateEntityId(socialAccountId, bucket), { count: current + 1 })
  }

  private async readPostState(campaignId: string, externalPostId: string): Promise<CampaignState> {
    const row = await this.store.getStateRow(stateEntityId(campaignId, externalPostId))
    const details = row ? parseDetails<CampaignState>(row.details) : null
    if (details && Array.isArray(details.contactedUserIds)) {
      return { ...details, processedCommentIds: trimProcessed(details.processedCommentIds) }
    }
    return { lastCheckedAt: new Date(0).toISOString(), contactedUserIds: [] }
  }

  private async writePostState(campaignId: string, externalPostId: string, state: CampaignState): Promise<void> {
    await this.store.saveStateRow(stateEntityId(campaignId, externalPostId), {
      ...state,
      contactedUserIds: trimContacted(state.contactedUserIds || []),
      processedCommentIds: trimProcessed(state.processedCommentIds),
    })
  }

  private async writeLog(campaignId: string, entry: AutoReplyLogEntry): Promise<void> {
    const rand = Math.random().toString(36).slice(2, 8)
    await this.store.insertLogRow(`${campaignId}::${new Date().toISOString()}::${rand}`, entry)
  }

  private async maybeNotifyFailure(userId: string, title: string, message: string): Promise<void> {
    try {
      const bucket = hourBucketUtc()
      const key = notifyThrottleEntityId(userId, bucket)
      const existing = await this.store.getStateRow(key)
      if (existing) return
      await this.store.saveStateRow(key, { at: new Date().toISOString() })
      const { notificationService } = await import('#layers/BaseAuth/server/services/notification.service')
      await notificationService.notify({ userId, event: 'autoreply', type: 'warning', title, message: message.slice(0, 500), actionUrl: '/app/auto-reply' })
    } catch {
      // Notifications must never break processing
    }
  }

  private buildDmText(campaign: AutoReplyCampaign, username: string): string {
    const links = (campaign.linkIds || []).map((linkId) => trackedUrl(campaign.id, linkId))
    let text = renderTemplate(campaign.dmTemplate, { username, links })
    if (campaign.followGate && campaign.followPromptTemplate) {
      text = `${text}\n\n${renderTemplate(campaign.followPromptTemplate, { username, links })}`
    }
    return text
  }

  private async resolveAiText(campaign: AutoReplyCampaign, comment: PlatformComment, fallback: string): Promise<{ text: string; usedAi: boolean }> {
    if (campaign.mode !== 'ai') return { text: fallback, usedAi: false }
    try {
      const res = await $fetch<{ text?: string; reply?: string }>(`/api/ai-tools/social-media/generate`, {
        method: 'POST',
        body: { comment: comment.text, author: comment.authorName, template: fallback },
      }).catch(() => null)
      const aiText = res?.text || res?.reply
      if (aiText) return { text: aiText.slice(0, 1000), usedAi: true }
      return { text: fallback, usedAi: false }
    } catch {
      return { text: fallback, usedAi: false }
    }
  }

  private async processComment(
    campaign: AutoReplyCampaign,
    account: PluginSocialMediaAccount,
    comment: PlatformComment,
    state: CampaignState,
  ): Promise<{ outcome: 'sent' | 'skipped' | 'failed'; reason: string }> {
    if ((state.processedCommentIds || []).includes(comment.id)) {
      return { outcome: 'skipped', reason: 'dup' }
    }
    if (comment.authorId && String(comment.authorId) === String(account.accountId)) {
      return { outcome: 'skipped', reason: 'self' }
    }
    if (comment.authorId && state.contactedUserIds.includes(String(comment.authorId))) {
      return { outcome: 'skipped', reason: 'cooldown' }
    }
    const matched = matchKeywords(comment.text || '', campaign.keywords, campaign.matchMode)
    if (!matched) return { outcome: 'skipped', reason: 'no-match' }
    const rate = platformRateLimiter.canMakeRequest(`autoreply-${account.id}`)
    if (!rate.allowed) return { outcome: 'failed', reason: 'rate_limited_memory' }
    const bucket = hourBucketUtc()
    const used = await this.readRateCount(account.id, bucket)
    if (used >= AUTOREPLY_RATE_CAP) {
      await this.maybeNotifyFailure(campaign.userId, 'Auto-reply rate limit reached', `Campaign ${campaign.name} hit 750 DMs/hour. Overflow will retry next tick.`)
      return { outcome: 'failed', reason: 'rate_limited_750' }
    }
    const plugin = this.instagramPlugin()
    const fallback = this.buildDmText(campaign, comment.authorName || 'there')
    const resolved = await this.resolveAiText(campaign, comment, fallback)
    const sent = await plugin.sendPrivateReply(account, comment.id, resolved.text)
    if (!sent.success) {
      return { outcome: 'failed', reason: (sent.error || 'send_failed').slice(0, 120) }
    }
    await this.bumpRateCount(account.id, bucket)
    if (campaign.publicReplyTemplate) {
      try {
        const publicText = renderTemplate(campaign.publicReplyTemplate, { username: comment.authorName || '', links: [] })
        const postDetails = { platformPosts: [{ socialAccountId: account.id, publishDetail: JSON.stringify({ postId: '' }) }] } as never
        await plugin.replyToComment(postDetails, account, comment.id, publicText)
      } catch {
        // Public reply is best-effort
      }
    }
    if (comment.authorId) {
      state.contactedUserIds = trimContacted([...state.contactedUserIds, String(comment.authorId)])
    }
    markProcessed(state, comment.id)
    await this.writeLog(campaign.id, {
      commentId: comment.id,
      authorId: String(comment.authorId || ''),
      authorName: comment.authorName || '',
      matchedKeyword: matched,
      action: 'sent',
      reason: resolved.usedAi ? 'ai' : 'keyword',
      at: new Date().toISOString(),
    })
    return { outcome: 'sent', reason: resolved.usedAi ? 'ai' : 'keyword' }
  }

  private async processCampaignPosts(
    campaign: AutoReplyCampaign,
    account: PluginSocialMediaAccount,
    watched: string[],
  ): Promise<{ checked: number; sent: number; skipped: number; failed: number }> {
    const plugin = this.instagramPlugin()
    let checked = 0
    let sent = 0
    let skipped = 0
    let failed = 0
    for (const externalPostId of watched) {
      const state = await this.readPostState(campaign.id, externalPostId)
      const postDetails = {
        platformPosts: [{ socialAccountId: account.id, publishDetail: JSON.stringify({ postId: externalPostId }) }],
      } as unknown as Parameters<InstagramPlugin['getComments']>[0]
      let comments: PlatformComment[] = []
      try {
        const res = await plugin.getComments(postDetails, account, { limit: 50 })
        comments = (res.comments || []) as PlatformComment[]
      } catch (error) {
        // One bad post (deleted media, dead token) must not abort the run —
        // and must be visible: failed++ surfaces in the task summary line.
        console.warn(`[autoreply] getComments failed for post ${externalPostId.slice(0, 12)}…: ${(error as Error).message}`)
        failed++
        continue
      }
      checked += comments.length
      let newestId = state.lastSeenCommentId
      for (const comment of comments) {
        if (state.lastSeenCommentId && comment.id === state.lastSeenCommentId) break
        const result = await this.processComment(campaign, account, comment, state)
        if (result.outcome === 'sent') sent++
        else if (result.outcome === 'skipped' && result.reason !== 'no-match') {
          skipped++
          await this.writeLog(campaign.id, {
            commentId: comment.id,
            authorId: String(comment.authorId || ''),
            authorName: comment.authorName || '',
            action: 'skipped',
            reason: result.reason,
            at: new Date().toISOString(),
          })
        } else if (result.outcome === 'failed') {
          failed++
          await this.writeLog(campaign.id, {
            commentId: comment.id,
            authorId: String(comment.authorId || ''),
            authorName: comment.authorName || '',
            action: 'failed',
            reason: result.reason,
            at: new Date().toISOString(),
          })
        }
        if (!newestId) newestId = comment.id
      }
      await this.writePostState(campaign.id, externalPostId, {
        lastSeenCommentId: newestId || state.lastSeenCommentId,
        lastCheckedAt: new Date().toISOString(),
        contactedUserIds: state.contactedUserIds,
        processedCommentIds: state.processedCommentIds,
      })
    }
    return { checked, sent, skipped, failed }
  }

  private async findAccountByProviderId(providerAccountId: string) {
    try {
      const db = useDrizzle()
      const [row] = await db
        .select()
        .from(socialMediaAccounts)
        .where(eq(socialMediaAccounts.accountId, providerAccountId))
        .limit(1)
      return row || null
    } catch {
      return null
    }
  }

  private async listEnabledCampaigns(): Promise<AutoReplyCampaign[]> {
    const db = useDrizzle()
    const rows = await db.select().from(entityDetails).where(eq(entityDetails.entityType, AUTOREPLY_CAMPAIGN))
    const campaigns: AutoReplyCampaign[] = []
    for (const row of rows) {
      const details = parseDetails<Omit<AutoReplyCampaign, 'id' | 'userId'>>(row.details)
      if (!details || (details as { enabled?: boolean }).enabled === false) continue
      const userId = row.entityId.split('::')[0] || ''
      const id = row.entityId.split('::')[1] || row.entityId
      if (!userId || !id) continue
      campaigns.push({ ...(details as AutoReplyCampaign), id, userId })
    }
    return campaigns
  }

  private async checkRateLimit(
    campaign: AutoReplyCampaign,
    accountId: string,
  ): Promise<{ ok: true; bucket: string } | { ok: false; reason: string }> {
    const mem = platformRateLimiter.canMakeRequest(`autoreply-${accountId}`)
    if (!mem.allowed) return { ok: false, reason: 'rate_limited_memory' }
    const bucket = hourBucketUtc()
    const used = await this.readRateCount(accountId, bucket)
    if (used >= AUTOREPLY_RATE_CAP) {
      await this.maybeNotifyFailure(campaign.userId, 'Auto-reply rate limit reached', `Campaign ${campaign.name} hit 750 DMs/hour. Overflow will retry next tick.`)
      return { ok: false, reason: 'rate_limited_750' }
    }
    return { ok: true, bucket }
  }

  private async processSeenComment(
    ev: WebhookCommentEvent,
    campaigns: AutoReplyCampaign[],
  ): Promise<{ sent: number; skipped: number; failed: number }> {
    let sent = 0
    let skipped = 0
    let failed = 0
    const account = await this.findAccountByProviderId(ev.entryId)
    if (!account || account.platform !== 'instagram') {
      // Visible in server logs: entry.id must equal the IG row's accountId
      // (professional user_id, not the app-scoped id — see auth.ts note).
      console.warn(`[autoreply] webhook comment for unknown account entry=${ev.entryId.slice(0, 8)}… comment=${ev.commentId}`)
      return { sent, skipped: 1, failed }
    }
    const pluginAccount = account as unknown as PluginSocialMediaAccount
    for (const campaign of campaigns) {
      if (campaign.socialAccountId !== account.id) continue
      if (!ev.mediaId && !campaign.matchAllPosts) continue
      if (ev.mediaId && !campaign.matchAllPosts && !(campaign.externalPostIds || []).includes(ev.mediaId)) continue
      const state = await this.readPostState(campaign.id, ev.mediaId || 'webhook')
      const comment: PlatformComment = {
        id: ev.commentId,
        text: ev.text,
        authorName: ev.username,
        authorId: ev.senderId,
        createdAt: ev.at,
      }
      const result = await this.processComment(campaign, pluginAccount, comment, state)
      await this.writePostState(campaign.id, ev.mediaId || 'webhook', state)
      if (result.outcome === 'sent') {
        // processComment already wrote the sent log (reason keyword/ai).
        sent++
      } else if (result.outcome === 'failed') {
        failed++
        await this.writeLog(campaign.id, {
          commentId: ev.commentId,
          authorId: ev.senderId,
          authorName: ev.username,
          action: 'failed',
          reason: result.reason,
          at: new Date().toISOString(),
        })
      } else {
        skipped++
        if (result.reason !== 'no-match') {
          await this.writeLog(campaign.id, {
            commentId: ev.commentId,
            authorId: ev.senderId,
            authorName: ev.username,
            action: 'skipped',
            reason: result.reason,
            at: new Date().toISOString(),
          })
        }
      }
    }
    return { sent, skipped, failed }
  }

  private followPrompt(campaign: AutoReplyCampaign, username: string): string {
    if (campaign.followPromptTemplate) {
      return renderTemplate(campaign.followPromptTemplate, { username, links: [] })
    }
    return `Hey ${username}! Please follow us first, then reply again and I'll send your link right over.`
  }

  private async processSeenMessage(
    ev: WebhookMessageEvent,
    campaigns: AutoReplyCampaign[],
  ): Promise<{ sent: number; skipped: number; failed: number }> {
    let sent = 0
    let skipped = 0
    let failed = 0
    const account = await this.findAccountByProviderId(ev.entryId)
    if (!account || account.platform !== 'instagram') {
      console.warn(`[autoreply] webhook DM for unknown account entry=${ev.entryId.slice(0, 8)}… sender=${ev.senderId.slice(0, 8)}…`)
      return { sent, skipped: 1, failed }
    }
    const pluginAccount = account as unknown as PluginSocialMediaAccount
    const plugin = this.instagramPlugin()
    for (const campaign of campaigns) {
      if (campaign.socialAccountId !== account.id) continue
      if (!campaign.storyDmEnabled) continue
      const state = await this.readPostState(campaign.id, 'dm')
      const dedupeKey = ev.mid || `${ev.senderId}::${ev.at}`
      if ((state.processedCommentIds || []).includes(dedupeKey)) {
        skipped++
        continue
      }
      const matched = ev.referral
        ? (matchKeywords(ev.text, campaign.keywords, campaign.matchMode) || 'referral')
        : matchKeywords(ev.text, campaign.keywords, campaign.matchMode)
      if (!matched) {
        skipped++
        continue
      }
      if (String(ev.senderId) === String(account.accountId)) {
        skipped++
        markProcessed(state, dedupeKey)
        await this.writePostState(campaign.id, 'dm', state)
        continue
      }
      // Follow gate (openreply parity: fails open when Meta gives no signal).
      if (campaign.followGate && ev.isUserFollowBusiness === false) {
        markProcessed(state, dedupeKey)
        await this.writePostState(campaign.id, 'dm', state)
        await plugin.sendDirectMessage(pluginAccount, ev.senderId, this.followPrompt(campaign, ev.senderId))
        await this.writeLog(campaign.id, {
          commentId: ev.mid || dedupeKey,
          authorId: ev.senderId,
          authorName: ev.senderId,
          matchedKeyword: matched,
          action: 'skipped',
          reason: 'follow_gate',
          at: new Date().toISOString(),
        })
        skipped++
        continue
      }
      const gate = await this.checkRateLimit(campaign, account.id)
      if (!gate.ok) {
        failed++
        await this.writeLog(campaign.id, {
          commentId: ev.mid || dedupeKey,
          authorId: ev.senderId,
          authorName: ev.senderId,
          matchedKeyword: matched,
          action: 'failed',
          reason: gate.reason,
          at: new Date().toISOString(),
        })
        continue
      }
      const fallback = this.buildDmText(campaign, ev.senderId)
      const resolved = await this.resolveAiText(campaign, {
        id: dedupeKey, text: ev.text, authorName: ev.senderId, authorId: ev.senderId, createdAt: ev.at,
      }, fallback)
      const dm = await plugin.sendDirectMessage(pluginAccount, ev.senderId, resolved.text)
      markProcessed(state, dedupeKey)
      if (!state.contactedUserIds.includes(ev.senderId)) {
        state.contactedUserIds = trimContacted([...state.contactedUserIds, ev.senderId])
      }
      await this.writePostState(campaign.id, 'dm', state)
      if (!dm.success) {
        failed++
        await this.writeLog(campaign.id, {
          commentId: ev.mid || dedupeKey,
          authorId: ev.senderId,
          authorName: ev.senderId,
          matchedKeyword: matched,
          action: 'failed',
          reason: (dm.error || 'send_failed').slice(0, 120),
          at: new Date().toISOString(),
        })
        continue
      }
      await this.bumpRateCount(account.id, gate.bucket)
      await this.writeLog(campaign.id, {
        commentId: ev.mid || dedupeKey,
        authorId: ev.senderId,
        authorName: ev.senderId,
        matchedKeyword: matched,
        action: 'sent',
        reason: ev.storyReply ? 'story_dm' : 'inbound_dm',
        at: new Date().toISOString(),
      })
      sent++
    }
    return { sent, skipped, failed }
  }

  /**
   * Drain webhook-ingested `autoreply_seen` rows (Phase B live path).
   * Same sender path as polling (cooldown, rate, logs); rows are deleted once
   * consumed, stale rows (>7d, e.g. receiver wrote but account was deleted)
   * are pruned. Called inline by the receiver AND by the 15m task as backstop.
   */
  async drainSeenEvents(): Promise<ServiceResponse<{ seen: number; sent: number; skipped: number; failed: number }>> {
    try {
      const db = useDrizzle()
      const campaigns = await this.listEnabledCampaigns()
      const rows = await db
        .select()
        .from(entityDetails)
        .where(eq(entityDetails.entityType, AUTOREPLY_SEEN))
        .limit(SEEN_DRAIN_CAP)
      let seen = 0
      let sent = 0
      let skipped = 0
      let failed = 0
      const cutoff = Date.now() - SEEN_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
      for (const row of rows) {
        const ev = parseDetails<WebhookCommentEvent | WebhookMessageEvent>(row.details)
        const stale = !ev || Number.isNaN(Date.parse((ev as { at?: string }).at || '')) || Date.parse((ev as { at?: string }).at as string) < cutoff
        if (!stale && ev) {
          seen++
          const totals = ev.kind === 'comment'
            ? await this.processSeenComment(ev as WebhookCommentEvent, campaigns)
            : await this.processSeenMessage(ev as WebhookMessageEvent, campaigns)
          sent += totals.sent
          skipped += totals.skipped
          failed += totals.failed
        }
        await db.delete(entityDetails).where(eq(entityDetails.id, row.id))
      }
      return { success: true, data: { seen, sent, skipped, failed } }
    } catch {
      return { success: false, error: 'Failed to drain webhook events' }
    }
  }

  async processDueCampaigns(): Promise<ServiceResponse<{ campaigns: number; checked: number; sent: number; skipped: number; failed: number }>> {
    try {
      const db = useDrizzle()
      const rows = await db.select().from(entityDetails).where(eq(entityDetails.entityType, AUTOREPLY_CAMPAIGN))
      let campaigns = 0
      let checked = 0
      let sent = 0
      let skipped = 0
      let failed = 0
      await this.store.deleteStaleRateRows(hourBucketUtc())
      const drained = await this.drainSeenEvents()
      if (drained.success && drained.data) {
        sent += drained.data.sent
        skipped += drained.data.skipped
        failed += drained.data.failed
      }
      for (const row of rows) {
        const details = parseDetails<Omit<AutoReplyCampaign, 'id' | 'userId'>>(row.details)
        if (!details || (details as { enabled?: boolean }).enabled === false) continue
        const userId = row.entityId.split('::')[0] || ''
        const id = row.entityId.split('::')[1] || row.entityId
        if (!userId || !id) continue
        const campaign = { ...(details as AutoReplyCampaign), id, userId }
        let account = await socialMediaAccountService.getAccountById(campaign.socialAccountId, userId)
        if (!account) {
          failed++
          continue
        }
        // Heal page-token rows before sending (same pattern as the AutoPost
        // publish path): a mirrored user token makes private_replies fail
        // with Meta 100/33. Renewal is a no-op for healthy rows and never
        // throws, so a failure here must not block processing.
        try {
          const renewed = await renewRowToken({
            id: account.id,
            userId,
            platform: account.platform,
            accountId: account.accountId,
            accessToken: account.accessToken,
            tokenExpiresAt: account.tokenExpiresAt,
          })
          if (renewed.success && renewed.data?.renewed) {
            const fresh = await socialMediaAccountService.getAccountById(campaign.socialAccountId, userId)
            if (fresh?.accessToken) account = fresh
          }
        } catch {
          // Fall through with the stored token — the send error is logged per comment.
        }
        const watched = await this.resolveWatchedPosts(campaign)
        if (watched.length === 0) continue
        campaigns++
        const totals = await this.processCampaignPosts(campaign, account as unknown as PluginSocialMediaAccount, watched)
        checked += totals.checked
        sent += totals.sent
        skipped += totals.skipped
        failed += totals.failed
        await this.store.pruneLogs(campaign.id)
      }
      return { success: true, data: { campaigns, checked, sent, skipped, failed } }
    } catch {
      return { success: false, error: 'Failed to process auto-reply campaigns' }
    }
  }

  async recordClick(campaignId: string, linkId: string): Promise<ServiceResponse<{ target: string }>> {
    try {
      const row = await this.store.getLinkRow(`${campaignId}::${linkId}`)
      if (!row) return { success: false, error: 'Link not found', code: 'NOT_FOUND' }
      const details = parseDetails<{ label: string; target: string; clicks: number }>(row.details)
      if (!details || !isHttpsUrl(details.target)) return { success: false, error: 'Link not found', code: 'NOT_FOUND' }
      await this.store.saveLinkRow(`${campaignId}::${linkId}`, { ...details, clicks: (details.clicks || 0) + 1 })
      return { success: true, data: { target: details.target } }
    } catch {
      return { success: false, error: 'Failed to record click' }
    }
  }
}

export const autoReplyService = new AutoReplyService()
