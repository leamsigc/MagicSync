import { createHmac } from 'node:crypto'
import { safeFetch } from '#layers/BaseShared/server/utils/ssrf'

/**
 * Design automation webhooks — HMAC-signed delivery with retry backoff.
 * Payloads carry asset metadata + signed URLs only. Submitted dynamic field
 * values are never serialized into a webhook body.
 */

export const DESIGN_WEBHOOK_EVENTS = ['render.completed', 'batch.completed', 'render.failed'] as const
export type DesignWebhookEvent = (typeof DESIGN_WEBHOOK_EVENTS)[number]

export interface DesignWebhookTarget {
  id: string
  url: string
  secret: string
  events: string[]
  active: boolean
}

export interface DesignWebhookPayload {
  event: DesignWebhookEvent
  data: Record<string, unknown>
}

/** Only https and no loopback — private-range targets are rejected. */
export function isWebhookUrlSafe(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' && !['localhost'].includes(url.hostname)) return false
    return !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|::1(\.|$)|f[c-d][0-9a-f]{2}:)/i.test(url.hostname)
  } catch {
    return false
  }
}

export function webhookSignature(secret: string, timestamp: number, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`
}

const RETRY_DELAYS_MS = [5_000, 30_000, 120_000]

/** Fire-and-forget delivery; returns true when an attempt succeeded. */
export async function deliverDesignWebhook(target: DesignWebhookTarget, payload: DesignWebhookPayload): Promise<boolean> {
  return deliverWithRetries(target, payload, RETRY_DELAYS_MS)
}

async function deliverWithRetries(
  target: DesignWebhookTarget,
  payload: DesignWebhookPayload,
  retryDelaysMs: number[],
): Promise<boolean> {
  if (!target.active || !target.events.includes(payload.event) || !isWebhookUrlSafe(target.url)) return false
  const body = JSON.stringify({ ...payload, sentAt: new Date().toISOString() })
  for (const delay of [0, ...retryDelaysMs]) {
    if (delay > 0) await sleep(delay)
    const ok = await attemptDelivery(target, body)
    if (ok) return true
  }
  return false
}

async function attemptDelivery(target: DesignWebhookTarget, body: string): Promise<boolean> {
  const timestamp = Math.floor(Date.now() / 1000)
  try {
    const response = await safeFetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MagicSync-Design-Automation/1.0',
        'X-MagicSync-Event': JSON.parse(body).event as string,
        'X-MagicSync-Timestamp': String(timestamp),
        'X-MagicSync-Signature': webhookSignature(target.secret, timestamp, body),
      },
      body,
      timeoutMs: 10_000,
      maxBytes: 65_536,
    })
    return response.status >= 200 && response.status < 400
  } catch {
    return false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function newWebhookSecret(): string {
  return `whsec_${crypto.randomUUID().replace(/-/g, '')}`
}
