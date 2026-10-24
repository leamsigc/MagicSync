import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { isBlockedIp, normalizeIpLiteral } from '#layers/BaseShared/server/utils/ssrf'

/**
 * Validate an outbound site URL (WordPress connections, LLM base URLs).
 *
 * Delegates the address classification to the single shared SSRF guard —
 * duplicating the range table here is how the IPv4-mapped IPv6 bypass shipped
 * twice. Allows https only, rejects credentials/ports/blocked hosts, and
 * revalidates every resolved address.
 */
function hostnameBlocked(hostname: string): boolean {
  const host = normalizeIpLiteral(hostname).replace(/\.$/, '')
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === 'metadata.google.internal' || host === 'metadata' || host === 'kubernetes.default') return true
  if (isIP(host)) return isBlockedIp(host)
  return false
}

function checkParsedUrl(parsed: URL): string | null {
  if (parsed.protocol !== 'https:') return 'Site URL must use https'
  if (parsed.username || parsed.password) return 'Site URL must not contain credentials'
  if (parsed.port && parsed.port !== '443') return 'Site URL uses a disallowed port'
  if (hostnameBlocked(parsed.hostname)) return 'Site URL host is not allowed'
  return null
}

async function checkResolvedHost(hostname: string): Promise<string | null> {
  try {
    const records = await lookup(normalizeIpLiteral(hostname), { all: true })
    if (records.length === 0) return 'Site URL could not be resolved'
    for (const record of records) {
      if (isBlockedIp(record.address)) return 'Site URL resolves to a blocked address'
    }
  }
  catch {
    return 'Site URL could not be resolved'
  }
  return null
}

/** Returns an error string, or null when the URL is safe to fetch. */
export async function validatePublicSiteUrl(raw: string): Promise<string | null> {
  let parsed: URL
  try {
    parsed = new URL(raw.trim())
  }
  catch {
    return 'Site URL is not a valid URL'
  }
  const parsedError = checkParsedUrl(parsed)
  if (parsedError) return parsedError
  return await checkResolvedHost(parsed.hostname)
}
