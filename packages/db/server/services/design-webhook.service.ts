import { and, desc, eq, sql } from 'drizzle-orm'
import type { DesignWebhook } from '#layers/BaseDB/db/schema'
import { designWebhooks } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { ValidationError } from './types'

/**
 * Design webhook CRUD + delivery bookkeeping. Delivery execution lives in
 * tools/server/utils/design-webhook.ts (HMAC + safeFetch); this service owns
 * the rows and keeps the last attempts visible to the settings UI.
 */

export interface CreateWebhookInput {
  url: string
  events: string[]
  description?: string
  businessId?: string | null
}

const WEBHOOK_URL_RE = /^https:\/\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]{3,600}$/
const EVENTS_ALLOWED = new Set(['render.completed', 'batch.completed', 'render.failed'])
const MAX_ATTEMPTS_LOG = 8

export interface WebhookAttemptLog {
  at: string
  event: string
  ok: boolean
  status?: number
  attempt: number
}

export class DesignWebhookService {
  private db = useDrizzle()

  async list(userId: string): Promise<ServiceResponse<DesignWebhook[]>> {
    try {
      const rows = await this.db.select().from(designWebhooks).where(eq(designWebhooks.ownerId, userId)).orderBy(desc(designWebhooks.createdAt))
      return { success: true, data: rows.map(redact) }
    } catch {
      return { success: false, error: 'Failed to list webhooks' }
    }
  }

  async create(userId: string, input: CreateWebhookInput): Promise<ServiceResponse<DesignWebhook>> {
    try {
      const url = String(input.url ?? '').trim()
      if (!url || !/^(https:\/\/)/.test(url)) throw new ValidationError('Webhook URL must be https://')
      const events = [...new Set(input.events ?? [])].filter(event => EVENTS_ALLOWED.has(event))
      if (events.length === 0) throw new ValidationError('Select at least one supported event')
      const [row] = await this.db.insert(designWebhooks).values({
        id: crypto.randomUUID(),
        ownerId: userId,
        businessId: input.businessId ?? null,
        url,
        secret: `whsec_${crypto.randomUUID().replace(/-/g, '')}`,
        events,
        description: String(input.description ?? '').slice(0, 200),
        active: true,
      }).returning()
      if (!row) return { success: false, error: 'Failed to create webhook' }
      return { success: true, data: redact(row) }
    } catch (error) {
      if (error instanceof ValidationError) return { success: false, error: error.message, code: 'VALIDATION' }
      return { success: false, error: 'Failed to create webhook' }
    }
  }

  async update(userId: string, id: string, patch: { active?: boolean; events?: string[]; description?: string }): Promise<ServiceResponse<DesignWebhook>> {
    try {
      const events = patch.events ? [...new Set(patch.events)].filter(event => EVENTS_ALLOWED.has(event)) : undefined
      if (patch.events && (!events || events.length === 0)) throw new ValidationError('Select at least one supported event')
      const [row] = await this.db.update(designWebhooks).set({
        ...(patch.active !== undefined ? { active: patch.active } : {}),
        ...(events ? { events } : {}),
        ...(patch.description !== undefined ? { description: String(patch.description).slice(0, 200) } : {}),
      }).where(and(eq(designWebhooks.id, id), eq(designWebhooks.ownerId, userId))).returning()
      if (!row) return { success: false, error: 'Webhook not found', code: 'NOT_FOUND' }
      return { success: true, data: redact(row) }
    } catch (error) {
      if (error instanceof ValidationError) return { success: false, error: error.message, code: 'VALIDATION' }
      return { success: false, error: 'Failed to update webhook' }
    }
  }

  async delete(userId: string, id: string): Promise<ServiceResponse<{ id: string }>> {
    try {
      const rows = await this.db.delete(designWebhooks).where(and(eq(designWebhooks.id, id), eq(designWebhooks.ownerId, userId))).returning()
      if (rows.length === 0) return { success: false, error: 'Webhook not found', code: 'NOT_FOUND' }
      return { success: true, data: { id } }
    } catch {
      return { success: false, error: 'Failed to delete webhook' }
    }
  }

  /** Reveal the secret once for one webhook — the settings UI shows it on demand. */
  async revealSecret(userId: string, id: string): Promise<ServiceResponse<{ secret: string }>> {
    try {
      const row = await this.db.query.designWebhooks.findFirst({ where: and(eq(designWebhooks.id, id), eq(designWebhooks.ownerId, userId)) })
      if (!row) return { success: false, error: 'Webhook not found', code: 'NOT_FOUND' }
      return { success: true, data: { secret: row.secret } }
    } catch {
      return { success: false, error: 'Failed to fetch webhook' }
    }
  }

  /** Called by the delivery util after each attempt cycle. */
  async recordAttempt(userId: string, webhookId: string, event: string, ok: boolean, status: number | undefined): Promise<void> {
    try {
      const row = await this.db.query.designWebhooks.findFirst({ where: and(eq(designWebhooks.id, webhookId), eq(designWebhooks.ownerId, userId)) })
      if (!row) return
      const attempts: WebhookAttemptLog[] = [
        { at: new Date().toISOString(), event, ok, status, attempt: 1 },
        ...((row.lastAttempts as WebhookAttemptLog[] | null) ?? []),
      ].slice(0, MAX_ATTEMPTS_LOG)
      await this.db.update(designWebhooks).set({
        lastAttempts: attempts,
        deliveryCount: ok ? row.deliveryCount + 1 : row.deliveryCount,
        failureCount: ok ? row.failureCount : row.failureCount + 1,
      }).where(eq(designWebhooks.id, webhookId))
    } catch {
      // bookkeeping is best-effort
    }
  }

  /** Full delivery targets for this owner (secret included, delivery-internal only). */
async listDeliveryTargets(userId: string): Promise<Array<{ id: string; url: string; secret: string; events: string[]; active: boolean }>> {
  try {
    const rows = await this.db.select().from(designWebhooks).where(and(eq(designWebhooks.ownerId, userId), eq(designWebhooks.active, true)))
    return rows.map(row => ({ id: row.id, url: row.url, secret: row.secret, events: (row.events as string[] | null) ?? [], active: row.active }))
  } catch {
    return []
  }
}

async count(userId: string): Promise<number> {
    const rows = await this.db.select({ total: sql<number>`count(*)` }).from(designWebhooks).where(eq(designWebhooks.ownerId, userId))
    return Number(rows[0]?.total ?? 0)
  }
}

function redact(row: DesignWebhook): DesignWebhook {
  return { ...row, secret: `${row.secret.slice(0, 8)}…` }
}

export const designWebhookService = new DesignWebhookService()
