/**
 * Pure helpers for Auto-Reply (comment-to-DM automation).
 * Only node:crypto beyond language builtins — unit-testable with node:test,
 * no Nuxt context needed. Webhook shapes mirror diwenne/openreply.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Unicode-aware keyword matcher. First keyword wins. Returns matched keyword or null. */
export function matchKeywords(text: string, keywords: string[], mode: 'whole' | 'partial'): string | null {
  const hay = (text || '').toLowerCase()
  for (const raw of keywords) {
    const kw = (raw || '').trim().toLowerCase()
    if (!kw) continue
    if (mode === 'partial') {
      if (hay.includes(kw)) return raw.trim()
    } else {
      const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(kw)}([^\\p{L}\\p{N}_]|$)`, 'iu')
      if (pattern.test(text || '')) return raw.trim()
    }
  }
  return null
}

/** Replace {username}, {link1}, {link2} slots. Unknown slots left untouched. */
export function renderTemplate(tpl: string, vars: { username: string; links: string[] }): string {
  let out = tpl || ''
  out = out.split('{username}').join(vars.username || '')
  out = out.split('{link1}').join(vars.links[0] || '')
  out = out.split('{link2}').join(vars.links[1] || '')
  return out
}

export function trackedUrl(appBaseUrl: string, campaignId: string, linkId: string): string {
  return `${appBaseUrl.replace(/\/$/, '')}/r/${campaignId}/${linkId}`
}

export function isHttpsUrl(target: string): boolean {
  try {
    const u = new URL(target)
    return u.protocol === 'https:'
  } catch {
    return false
  }
}

export function hourBucketUtc(date = new Date()): string {
  const d = date instanceof Date ? date : new Date(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}`
}

/** FIFO trim for per-campaign contacted-user cooldown lists. */
export function trimContacted(ids: string[], cap = 2000): string[] {
  if (ids.length <= cap) return ids
  return ids.slice(ids.length - cap)
}

// ── Meta webhook (Phase B) ──────────────────────────────────────────────

export interface WebhookCommentEvent {
  kind: 'comment'
  entryId: string
  commentId: string
  mediaId?: string
  senderId: string
  username: string
  text: string
  at: string
}

export interface WebhookMessageEvent {
  kind: 'message'
  entryId: string
  senderId: string
  mid?: string
  text: string
  /** Story reply / mention (arrives as an inbound DM with reply_to). */
  storyReply: boolean
  referral?: string
  isUserFollowBusiness?: boolean
  isEcho: boolean
  at: string
}

export type WebhookParsedEvent = WebhookCommentEvent | WebhookMessageEvent

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function parseCommentChange(entryId: string, value: unknown, at: string): WebhookCommentEvent | null {
  const val = asRecord(value)
  const commentId = asString(val['id'])
  const from = asRecord(val['from'])
  const media = asRecord(val['media'])
  if (!commentId || !from['id']) return null
  return {
    kind: 'comment',
    entryId,
    commentId,
    mediaId: asString(media['id']) || undefined,
    senderId: asString(from['id']),
    username: asString(from['username']) || 'there',
    text: asString(val['text']),
    at,
  }
}

function parseMessagingItem(entryId: string, item: unknown, at: string): WebhookMessageEvent | null {
  const msg = asRecord(item)
  const sender = asRecord(msg['sender'])
  const senderId = asString(sender['id'])
  if (!senderId || senderId === entryId) {
    // No sender, or an echo of our own send — never act on it.
    if (!senderId) return null
    const inner = asRecord(msg['message'])
    if (!inner['text'] && !msg['postback']) return null
    return {
      kind: 'message', entryId, senderId, mid: asString(inner['mid']) || undefined,
      text: '', storyReply: false, isEcho: true, at,
    }
  }
  const inner = asRecord(msg['message'])
  const postback = asRecord(msg['postback'])
  const replyTo = asRecord(inner['reply_to'])
  const referral = asRecord(msg['referral'])
  const innerReferral = asRecord(inner['referral'])
  const ref = asString(referral['ref']) || asString(innerReferral['ref']) || undefined
  const text = asString(inner['text']) || asString(postback['title']) || asString(postback['payload'])
  const followFlag = msg['is_user_follow_business']
  return {
    kind: 'message',
    entryId,
    senderId,
    mid: asString(inner['mid']) || undefined,
    text,
    storyReply: Object.keys(replyTo).length > 0,
    referral: ref,
    isUserFollowBusiness: typeof followFlag === 'boolean' ? followFlag : undefined,
    isEcho: false,
    at,
  }
}

/**
 * Parse a Meta webhook POST body (page + instagram objects) into automation
 * events. Unknown fields are ignored. Never throws — returns [] on garbage.
 */
export function parseMetaWebhook(payload: unknown): WebhookParsedEvent[] {
  try {
    const root = asRecord(payload)
    const entries = root['entry']
    if (!Array.isArray(entries)) return []
    const events: WebhookParsedEvent[] = []
    for (const rawEntry of entries) {
      const entry = asRecord(rawEntry)
      const entryId = asString(entry['id'])
      const time = typeof entry['time'] === 'number' ? entry['time'] : Date.now()
      const at = new Date(time).toISOString()
      if (!entryId) continue
      const changes = entry['changes']
      if (Array.isArray(changes)) {
        for (const rawChange of changes) {
          const change = asRecord(rawChange)
          const field = asString(change['field'])
          if (field === 'comments' || field === 'live_comments') {
            const ev = parseCommentChange(entryId, change['value'], at)
            if (ev) events.push(ev)
          }
        }
      }
      for (const key of ['messaging', 'standby']) {
        const items = entry[key]
        if (!Array.isArray(items)) continue
        for (const item of items) {
          const ev = parseMessagingItem(entryId, item, at)
          if (ev && !ev.isEcho) events.push(ev)
        }
      }
    }
    return events
  } catch {
    return []
  }
}

/**
 * Verify Meta's X-Hub-Signature-256 header against one of the app secrets
 * (openreply checks both FB + IG secrets — Meta signs with either).
 * Returns false on any malformed input. Timing-safe comparison.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string, secrets: string[]): boolean {
  try {
    const prefix = 'sha256='
    if (!rawBody || !signatureHeader.startsWith(prefix)) return false
    const theirs = Buffer.from(signatureHeader.slice(prefix.length), 'hex')
    for (const secret of secrets) {
      if (!secret) continue
      const ours = Buffer.from(createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex'), 'hex')
      if (theirs.length === ours.length && timingSafeEqual(theirs, ours)) return true
    }
    return false
  } catch {
    return false
  }
}
