import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * SSRF guard — validates that a URL points at a public, external http(s) host.
 * Prevents server-side fetches from reaching loopback, private, link-local,
 * cloud-metadata (169.254.169.254), CGNAT and reserved address ranges.
 *
 * Usage in a route:
 *   const { safe, reason } = await isSafeExternalUrl(url)
 *   if (!safe) throw createError({ statusCode: 400, statusMessage: reason })
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  'kubernetes.default',
])

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal']

export function isBlockedIp(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length === 4) {
    const a = parts[0]!
    const b = parts[1]!
    if (a === 127 || a === 0) return true                 // loopback / "this network"
    if (a === 10) return true                             // 10.0.0.0/8
    if (a === 169 && b === 254) return true               // link-local incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true      // 172.16.0.0/12
    if (a === 192 && b === 168) return true               // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true     // CGNAT 100.64.0.0/10
    if (a === 198 && (b === 18 || b === 19)) return true  // benchmarking 198.18.0.0/15
    if (a >= 224) return true                             // multicast / reserved
    return false
  }
  const lower = ip.toLowerCase()
  if (lower === '::1' || lower === '::') return true
  if (lower.startsWith('::ffff:')) return isBlockedIp(lower.slice('::ffff:'.length))
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true            // fc00::/7 ULA
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true // fe80::/10
  if (lower.startsWith('ff')) return true                                       // multicast
  return false
}

export interface UrlSafety {
  safe: boolean
  reason?: string
}

export async function isSafeExternalUrl(rawUrl: string): Promise<UrlSafety> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { safe: false, reason: 'Invalid URL' }
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { safe: false, reason: 'URL must be http(s)' }
  }

  const hostname = parsed.hostname.toLowerCase()

  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      return { safe: false, reason: 'URL host is not allowed' }
    }
    return { safe: true }
  }

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { safe: false, reason: 'URL host is not allowed' }
  }
  if (BLOCKED_SUFFIXES.some(suffix => hostname.endsWith(suffix))) {
    return { safe: false, reason: 'URL host is not allowed' }
  }

  try {
    const addresses = await lookup(hostname, { all: true })
    for (const { address } of addresses) {
      if (isBlockedIp(address)) {
        return { safe: false, reason: 'URL host is not allowed' }
      }
    }
    return { safe: true }
  } catch {
    return { safe: false, reason: 'URL host could not be resolved' }
  }
}