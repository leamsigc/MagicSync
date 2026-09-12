import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

function inCidr(ip: string, base: string, bits: number, version: 4 | 6): boolean {
  if (isIP(ip) !== version || isIP(base) !== version) return false
  const toBytes = (value: string): number[] => {
    if (version === 4) return value.split('.').map(part => Number(part))
    const expanded: number[] = []
    const halves = value.split('::')
    const head = halves[0] ? halves[0].split(':') : []
    const tail = halves[1] ? halves[1].split(':') : []
    const missing = 8 - head.length - tail.length
    for (const part of [...head, ...Array<string>(missing).fill('0'), ...tail]) {
      const num = parseInt(part, 16)
      expanded.push((num >> 8) & 255, num & 255)
    }
    return expanded
  }
  const a = toBytes(ip)
  const b = toBytes(base)
  const fullBytes = Math.floor(bits / 8)
  const restBits = bits % 8
  for (let index = 0; index < fullBytes; index += 1) {
    if (a[index] !== b[index]) return false
  }
  if (restBits > 0) {
    const mask = (0xff << (8 - restBits)) & 0xff
    if ((a[fullBytes] & mask) !== (b[fullBytes] & mask)) return false
  }
  return true
}

function isBlockedIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    return inCidr(ip, '127.0.0.0', 8, 4)
      || inCidr(ip, '10.0.0.0', 8, 4)
      || inCidr(ip, '172.16.0.0', 12, 4)
      || inCidr(ip, '192.168.0.0', 16, 4)
      || inCidr(ip, '169.254.0.0', 16, 4)
      || inCidr(ip, '0.0.0.0', 8, 4)
  }
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase()
    if (lower === '::1' || lower === '::') return true
    return inCidr(ip, 'fc00::', 7, 6)
      || inCidr(ip, 'fe80::', 10, 6)
  }
  return true
}

function hostnameBlocked(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === 'metadata.google.internal') return true
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
    const records = await lookup(hostname, { all: true })
    for (const record of records) {
      if (isBlockedIp(record.address)) return 'Site URL resolves to a blocked address'
    }
  } catch {
    return 'Site URL could not be resolved'
  }
  return null
}

/**
 * Validate an outbound site URL (WordPress connections, T120).
 * Allows https only, rejects credentials/ports/blocked hosts, and
 * revalidates every resolved address. Returns an error string or null.
 */
export async function validatePublicSiteUrl(raw: string): Promise<string | null> {
  let parsed: URL
  try {
    parsed = new URL(raw.trim())
  } catch {
    return 'Site URL is not a valid URL'
  }
  const parsedError = checkParsedUrl(parsed)
  if (parsedError) return parsedError
  return await checkResolvedHost(parsed.hostname)
}
