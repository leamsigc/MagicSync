import type { H3Event } from 'h3'
import type { ServiceResponse } from './types'
import type { SocialMediaAccount } from '#layers/BaseDB/db/schema'
import { contentArtifactService } from '#layers/BaseDB/server/services/content-artifact.service'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { platformConfigurations } from '#layers/BaseShared/shared/platformConstants'

export type PlatformId = string

export interface PlatformScope {
  requested: string[]
  resolved: PlatformId[]
  rejected: string[]
}

export interface Timeframe {
  kind: 'now' | 'at' | 'window'
  startIso: string
  endIso: string
  maxPosts: number
  timezone: string
}

export interface ScheduleRequest {
  brief: string
  scope: PlatformScope
  window: Timeframe
  accountIds?: string[]
}

export interface ConnectedAccountCheck {
  platform: string
  accountId: string | null
  connected: boolean
}

export interface DirectScheduleInput {
  brief: string
  platforms: string[]
  timeframe: string
  scheduledAt?: string
  accountIds?: string[]
}

export interface DirectScheduleItem {
  postId: string
  platform: string
  accountId: string
  scheduledAt: string
}

export interface DirectScheduleRejection {
  platform: string
  reason: string
  code?: string
  connectUrl?: string
}

export interface DirectScheduleResult {
  items: DirectScheduleItem[]
  rejected: DirectScheduleRejection[]
}

const PLATFORM_ALIASES: Record<string, string> = {
  x: 'twitter',
  twitter: 'twitter',
  ig: 'instagram',
  instagram: 'instagram',
  fb: 'facebook',
  facebook: 'facebook',
}

const ALLOWED_PLATFORMS: ReadonlySet<string> = new Set(
  Object.keys(platformConfigurations).filter(key => key !== 'default' && key !== 'email-password'),
)

export function resolvePlatformScope(requested: string[]): PlatformScope {
  const resolved: string[] = []
  const rejected: string[] = []
  const seen = new Set<string>()
  for (const raw of requested) {
    const normalized = raw.trim().toLowerCase()
    const canonical = PLATFORM_ALIASES[normalized] ?? normalized
    if (ALLOWED_PLATFORMS.has(canonical) && !seen.has(canonical)) {
      seen.add(canonical)
      resolved.push(canonical)
    } else if (!ALLOWED_PLATFORMS.has(canonical)) {
      rejected.push(raw)
    }
  }
  return { requested: [...requested], resolved, rejected }
}

function singleAtTimeframe(iso: string): Timeframe {
  const parsed = new Date(iso)
  const safe = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  const stamp = safe.toISOString()
  return { kind: 'at', startIso: stamp, endIso: stamp, maxPosts: 1, timezone: 'UTC' }
}

function nowTimeframe(now: Date): Timeframe {
  const stamp = now.toISOString()
  return { kind: 'now', startIso: stamp, endIso: stamp, maxPosts: 1, timezone: 'UTC' }
}

export function endOfNextSunday(from: Date): Date {
  const delta = (7 - from.getUTCDay()) % 7
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + delta, 23, 59, 0))
}

function nextWeekTimeframe(now: Date): Timeframe {
  return { kind: 'window', startIso: now.toISOString(), endIso: endOfNextSunday(now).toISOString(), maxPosts: 7, timezone: 'UTC' }
}

export function parseTimeframe(timeframe: string, scheduledAt?: string, nowInput?: Date): Timeframe {
  const now = nowInput ?? new Date()
  if (scheduledAt) return singleAtTimeframe(scheduledAt)
  if (timeframe.toLowerCase().includes('through next week')) return nextWeekTimeframe(now)
  return nowTimeframe(now)
}

export function buildSlots(window: Timeframe): string[] {
  const start = new Date(window.startIso).getTime()
  const count = Math.min(window.maxPosts, 7)
  const slots: string[] = []
  for (let index = 0; index < count; index += 1) {
    slots.push(new Date(start + index * 86_400_000).toISOString())
  }
  return slots
}

export function connectUrlFor(businessId: string): string {
  return `/app/business/${businessId}/accounts`
}

function artifactOutputFor(brief: string, platform: string): Record<string, unknown> {
  return {
    outputKind: 'social_post_draft',
    caption: brief,
    platformVariants: { [platform]: { caption: brief, hashtags: [] } },
    slideCopy: [],
    cta: '',
    claims: [],
    sources: [],
  }
}

function pickAccount(accounts: SocialMediaAccount[], platform: string, accountIds?: string[]): SocialMediaAccount | null {
  const pool = accountIds && accountIds.length > 0 ? accounts.filter(account => accountIds.includes(account.id)) : accounts
  return pool.find(account => (account.platform ?? '') === platform) ?? null
}

function unownedAccountIds(accounts: SocialMediaAccount[], accountIds: string[]): string[] {
  const owned = new Set(accounts.map(account => account.id))
  const missing: string[] = []
  for (const id of accountIds) {
    if (!owned.has(id)) missing.push(id)
  }
  return missing
}

export class DirectScheduleService {
  private async scheduleOne(
    userId: string,
    businessId: string,
    brief: string,
    platform: string,
    accountId: string,
    scheduledAtIso: string,
    event?: H3Event,
  ): Promise<ServiceResponse<DirectScheduleItem>> {
    try {
      const submitted = await contentArtifactService.submitArtifact(userId, {
        businessId,
        kind: 'social_post',
        outputKind: 'social_post_draft',
        output: artifactOutputFor(brief, platform),
      }, event)
      if (!submitted.success) return submitted
      const reviewed = await contentArtifactService.reviewArtifact(userId, submitted.data.id, businessId, {
        decision: 'approved',
        feedback: '',
        version: 1,
      }, event)
      if (!reviewed.success) return reviewed
      const scheduled = await contentArtifactService.scheduleArtifact(userId, submitted.data.id, businessId, new Date(scheduledAtIso), event, [accountId])
      if (!scheduled.success) return scheduled
      return { success: true, data: { postId: scheduled.data.postId as string, platform, accountId, scheduledAt: new Date(scheduledAtIso).toISOString() } }
    } catch (error) {
      log.error({ message: 'directScheduleService.scheduleOne failed', error: String(error) })
      return { success: false, error: 'Failed to schedule post' }
    }
  }

  private async scheduleAll(
    userId: string,
    businessId: string,
    brief: string,
    scope: PlatformScope,
    slots: string[],
    accounts: SocialMediaAccount[],
    accountIds: string[] | undefined,
    event?: H3Event,
  ): Promise<DirectScheduleResult> {
    const items: DirectScheduleItem[] = []
    const rejected: DirectScheduleRejection[] = []
    for (const platform of scope.resolved) {
      const account = pickAccount(accounts, platform, accountIds)
      if (!account) {
        rejected.push({ platform, reason: `No connected account for '${platform}'`, code: 'SOCIAL_NOT_CONNECTED', connectUrl: connectUrlFor(businessId) })
        continue
      }
      for (const slot of slots) {
        const created = await this.scheduleOne(userId, businessId, brief, platform, account.id, slot, event)
        if (!created.success) {
          rejected.push({ platform, reason: created.error, code: created.code })
        } else {
          items.push(created.data)
        }
      }
    }
    return { items, rejected }
  }

  async scheduleDirect(
    userId: string,
    businessId: string,
    input: DirectScheduleInput,
    event?: H3Event,
  ): Promise<ServiceResponse<DirectScheduleResult>> {
    try {
      if (!input.brief.trim()) {
        return { success: false, error: 'Brief is required', code: 'BRIEF_REQUIRED' }
      }
      const scope = resolvePlatformScope(input.platforms ?? [])
      const window = parseTimeframe(input.timeframe ?? '', input.scheduledAt)
      const slots = buildSlots(window)
      const accounts = await socialMediaAccountService.getAccountsByBusinessId(businessId)
      if (input.accountIds && input.accountIds.length > 0 && unownedAccountIds(accounts, input.accountIds).length > 0) {
        return { success: false, error: 'Target accounts must belong to this business', code: 'VALIDATION_ERROR' }
      }
      const rejectedUnsupported = scope.rejected.map(platform => ({
        platform,
        reason: `Platform '${platform}' is not supported`,
        code: 'PLATFORM_NOT_SUPPORTED' as const,
      }))
      const scheduled = await this.scheduleAll(userId, businessId, input.brief, scope, slots, accounts, input.accountIds, event)
      return { success: true, data: { items: scheduled.items, rejected: [...rejectedUnsupported, ...scheduled.rejected] } }
    } catch (error) {
      log.error({ message: 'directScheduleService.scheduleDirect failed', error: String(error) })
      return { success: false, error: 'Failed to schedule direct posts' }
    }
  }
}

export const directScheduleService = new DirectScheduleService()
