import { and, eq } from 'drizzle-orm'
import { entityDetails } from '#layers/BaseDB/db/entityDetails/entityDetails'
import { socialMediaAccounts } from '#layers/BaseDB/db/socialMedia/socialMedia'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import type { ServiceResponse } from '#layers/BaseDB/server/services/types'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { AUTOREPLY_SEEN } from '#layers/BaseScheduler/server/services/AutoReply.service'
import {
  parseMetaWebhook,
  verifyWebhookSignature,
  type WebhookParsedEvent,
} from '#layers/BaseScheduler/server/services/auto-reply-pure'

export const META_WEBHOOK_FIELDS = ['comments', 'messages', 'story_mentions'] as const

function verifyToken(): string {
  return process.env.NUXT_META_WEBHOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || ''
}

function appSecrets(): string[] {
  return [
    process.env.NUXT_FACEBOOK_CLIENT_SECRET || '',
    process.env.NUXT_INSTAGRAM_CLIENT_SECRET || '',
  ].filter(Boolean)
}

function appBaseUrl(): string {
  return process.env.NUXT_APP_URL || process.env.APP_URL || process.env.NUXT_BETTER_AUTH_URL || 'http://localhost:3000'
}

export function metaWebhookCallbackUrl(): string {
  return `${appBaseUrl().replace(/\/$/, '')}/meta/webhooks`
}

function seenEntityId(ev: WebhookParsedEvent): string {
  if (ev.kind === 'comment') return `seen::comment::${ev.commentId}`
  return `seen::message::${ev.mid || `${ev.senderId}::${ev.at}`}`
}

export class AutoReplyWebhookService {
  private db = useDrizzle()

  isConfigured(): boolean {
    return verifyToken().length > 0
  }

  verifySubscription(mode: string, token: string, challenge: string): ServiceResponse<string> {
    try {
      const expected = verifyToken()
      if (!expected) {
        return { success: false, error: 'Webhook verify token is not configured', code: 'NOT_CONFIGURED' }
      }
      if (mode === 'subscribe' && token === expected && challenge) {
        return { success: true, data: challenge }
      }
      return { success: false, error: 'Verification failed', code: 'FORBIDDEN' }
    } catch {
      return { success: false, error: 'Verification failed' }
    }
  }

  verifySignature(rawBody: string, signatureHeader: string): boolean {
    return verifyWebhookSignature(rawBody, signatureHeader, appSecrets())
  }

  /**
   * Parse + persist a Meta webhook POST body. Deterministic entityIds make
   * redeliveries idempotent (point-read dedup, no scans). Never throws.
   */
  async ingestPayload(payload: unknown): Promise<ServiceResponse<{ received: number; stored: number; duplicates: number }>> {
    try {
      const events = parseMetaWebhook(payload)
      let stored = 0
      let duplicates = 0
      for (const ev of events) {
        const entityId = seenEntityId(ev)
        const [existing] = await this.db
          .select({ id: entityDetails.id })
          .from(entityDetails)
          .where(and(eq(entityDetails.entityType, AUTOREPLY_SEEN), eq(entityDetails.entityId, entityId)))
          .limit(1)
        if (existing) {
          duplicates++
          continue
        }
        await this.db.insert(entityDetails).values({
          id: crypto.randomUUID(),
          entityId,
          entityType: AUTOREPLY_SEEN,
          details: JSON.parse(JSON.stringify(ev)) as never,
        })
        stored++
      }
      return { success: true, data: { received: events.length, stored, duplicates } }
    } catch {
      return { success: false, error: 'Failed to ingest webhook payload' }
    }
  }

  async getStatus(): Promise<ServiceResponse<{ verifyTokenConfigured: boolean; callbackUrl: string; appIdConfigured: boolean }>> {
    try {
      return {
        success: true,
        data: {
          verifyTokenConfigured: this.isConfigured(),
          callbackUrl: metaWebhookCallbackUrl(),
          appIdConfigured: !!(process.env.NUXT_FACEBOOK_CLIENT_ID || process.env.NUXT_INSTAGRAM_CLIENT_ID),
        },
      }
    } catch {
      return { success: false, error: 'Failed to load webhook status' }
    }
  }

  private async resolvePageCredentials(socialAccountId: string, userId: string): Promise<{ pageId: string; token: string } | null> {
    const account = await socialMediaAccountService.getAccountById(socialAccountId, userId)
    if (!account) return null
    if (account.platform === 'facebook') {
      return { pageId: account.accountId, token: account.accessToken }
    }
    if (account.platform === 'instagram') {
      const siblings = await socialMediaAccountService.getAccounts({ userId, platform: 'facebook' })
      const page = siblings.find((s) => s.accessToken)
      if (page) return { pageId: page.accountId, token: page.accessToken }
    }
    return null
  }

  /**
   * Subscribe the Page to webhook fields (`/{page-id}/subscribed_apps`).
   * Needs pages_manage_metadata (added to auth.ts scopes — reconnect required).
   * App-dashboard subscription to the Instagram object (comments, messages,
   * story_mentions) is still manual, one-time per app (see docs).
   */
  async subscribePage(socialAccountId: string, userId: string): Promise<ServiceResponse<{ subscribed_fields: string[] }>> {
    try {
      const creds = await this.resolvePageCredentials(socialAccountId, userId)
      if (!creds) {
        return { success: false, error: 'No Facebook Page with a token found for this account', code: 'NOT_FOUND' }
      }
      const params = new URLSearchParams({
        access_token: creds.token,
        subscribed_fields: 'feed,messages',
      })
      const response = await fetch(`https://graph.facebook.com/v25.0/${creds.pageId}/subscribed_apps?${params.toString()}`, {
        method: 'POST',
      })
      const body = (await response.json().catch(() => ({}))) as { success?: boolean; subscribed_fields?: string[]; error?: { message?: string } }
      if (!response.ok || body.error) {
        return { success: false, error: body.error?.message || `Meta API error ${response.status}` }
      }
      return { success: true, data: { subscribed_fields: body.subscribed_fields || ['feed', 'messages'] } }
    } catch {
      return { success: false, error: 'Failed to subscribe page to webhooks' }
    }
  }

  async findAccountByProviderId(providerAccountId: string) {
    try {
      const [row] = await this.db
        .select()
        .from(socialMediaAccounts)
        .where(eq(socialMediaAccounts.accountId, providerAccountId))
        .limit(1)
      return row || null
    } catch {
      return null
    }
  }
}

export const autoReplyWebhookService = new AutoReplyWebhookService()
