import { createHash } from 'node:crypto'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Signed download URLs for rendered design outputs. The serve route is
 * session-authenticated; automation consumers (webhooks, APIábng clients)
 * get bounded-lifetime links instead of credentials.
 *
 *   ?expires=<epochSeconds>&signature=<hex>
 *   signature = HMAC-SHA256(secret, `${path}:${expires}`)
 *
 * Secret derive: NUXT_SIGNED_URL_SECRET, else a stable compound of app
 * deployment values — never per-runtime random (works across workers).
 */

function secret(): string {
  const explicit = process.env.NUXT_SIGNED_URL_SECRET
  if (explicit) return explicit
  const app = process.env.NUXT_APP_URL ?? 'http://localhost:3000'
  const mount = process.env.NUXT_FILE_STORAGE_MOUNT ?? './upload/files'
  return createHash('sha256').update(`magic-design-urls:${app}:${mount}`).digest('hex')
}

export interface SignedUrlOptions {
  ttlSeconds?: number
  now?: number
}

export function signAssetPath(path: string, options: SignedUrlOptions = {}): { url: string; expires: number; signature: string } {
  const ttl = Math.min(Math.max(60, options.ttlSeconds ?? 7 * 24 * 3600), 30 * 24 * 3600)
  const expires = Math.floor((options.now ?? Date.now()) / 1000) + ttl
  const signature = hmacFor(path, expires)
  const joiner = path.includes('?') ? '&' : '?'
  return { url: `${path}${joiner}expires=${expires}&signature=${signature}`, expires, signature }
}

export function verifySignedAsset(path: string, expires: string | undefined, signature: string | undefined, now = Date.now()): boolean {
  if (!expires || !signature) return false
  const expiresValue = Number(expires)
  if (!Number.isFinite(expiresValue) || expiresValue * 1000 < now) return false
  const expected = hmacFor(path, expiresValue)
  return safeEquals(expected, signature)
}

function hmacFor(path: string, expires: number): string {
  return createHmac('sha256', secret()).update(`${path}:${expires}`).digest('hex')
}

function safeEquals(expected: string, provided: string): boolean {
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
