import { lookup } from 'node:dns/promises'
import { isIP, type LookupFunction } from 'node:net'
import { request as httpRequest, type IncomingHttpHeaders, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { Transform, type Readable } from 'node:stream'

/**
 * SSRF guard + safe outbound fetcher.
 *
 * The old guard validated the *string it was given* and then let `fetch`
 * follow any redirect it liked — a public URL that 302s to
 * http://169.254.169.254/ walked straight past it. DNS rebinding had the same
 * effect: validate-time lookup returned a public IP, connect-time lookup
 * returned a private one.
 *
 * `safeFetch` closes both holes:
 *   1. the hostname is resolved once, validated, and the socket is pinned to
 *      that address (no second DNS lookup, no rebinding window),
 *   2. redirects are followed manually — every hop is re-validated and pinned,
 *   3. the response body is capped,
 *   4. only http(s), no credentials in the URL, no non-standard ports.
 *
 * `isSafeExternalUrl` stays for callers that only need a pre-flight check.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  'kubernetes.default',
])

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa']

const ALLOWED_PORTS = new Set(['', '80', '443', '8080', '8443'])

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_DEADLINE_MS = 30_000
const MAX_REDIRECTS = 3

export function isBlockedIp(ip: string): boolean {
  const lower = normalizeIpLiteral(ip)
  if (isIP(lower) === 4) return isBlockedIpv4(lower)
  if (isIP(lower) === 6) return isBlockedIpv6(lower)
  return true
}

/** `new URL().hostname` keeps the brackets around IPv6 literals. */
export function normalizeIpLiteral(value: string): string {
  return value.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/%.*$/, '')
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isFinite(part) || part < 0 || part > 255)) return true
  const [a, b] = parts as [number, number, number, number]
  if (a === 127 || a === 0) return true // loopback / this-network
  if (a === 10) return true // 10/8
  if (a === 169 && b === 254) return true // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12
  if (a === 192 && b === 168) return true // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
  if (a === 192 && b === 0) return true // 192.0.0/24 IETF protocol assignments
  if (a >= 224) return true // multicast / reserved
  return false
}

/** Expand an IPv6 address into 8 hextets, or null when it is malformed. */
function expandIpv6(ip: string): number[] | null {
  const dottedTail = ip.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/)
  const normalized = dottedTail
    ? `${dottedTail[1]}${dottedToHextets(dottedTail[2]!)}`
    : ip

  const halves = normalized.split('::')
  if (halves.length > 2) return null

  const toHextets = (part: string): number[] =>
    part === '' ? [] : part.split(':').map(hex => Number.parseInt(hex, 16))

  const head = toHextets(halves[0] ?? '')
  const tail = halves.length === 2 ? toHextets(halves[1] ?? '') : []
  if ([...head, ...tail].some(value => !Number.isInteger(value) || value < 0 || value > 0xffff)) return null

  const missing = 8 - head.length - tail.length
  if (halves.length === 2) {
    if (missing < 1) return null
    return [...head, ...Array<number>(missing).fill(0), ...tail]
  }
  return head.length === 8 ? head : null
}

function dottedToHextets(dotted: string): string {
  const [a, b, c, d] = dotted.split('.').map(Number) as [number, number, number, number]
  return `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
}

function hextetsToIpv4(high: number, low: number): string {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.')
}

function isBlockedIpv6(ip: string): boolean {
  const hextets = expandIpv6(ip)
  if (!hextets) return true // unparseable IPv6 is never allowed
  const [h0, h1, h2, h3, h4, h5, h6, h7] = hextets as [
    number, number, number, number, number, number, number, number,
  ]

  const isUnspecified = hextets.every(value => value === 0)
  const isLoopback = hextets.slice(0, 7).every(value => value === 0) && h7 === 1
  if (isUnspecified || isLoopback) return true

  // ::ffff:0:0/96 (IPv4-mapped) and ::ffff:0:0:0/96 (IPv4-translated)
  const mapped = h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && (h5 === 0xffff || h5 === 0)
  if (mapped) return isBlockedIpv4(hextetsToIpv4(h6, h7))

  // 64:ff9b::/96 — NAT64 well-known prefix embeds an IPv4 address
  if (h0 === 0x64 && h1 === 0xff9b && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0) {
    return isBlockedIpv4(hextetsToIpv4(h6, h7))
  }

  // 2002::/16 — 6to4 embeds IPv4 in bits 16..48
  if (h0 === 0x2002) return isBlockedIpv4(hextetsToIpv4(h1, h2))

  if ((h0 & 0xfe00) === 0xfc00) return true // fc00::/7 unique local
  if ((h0 & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((h0 & 0xff00) === 0xff00) return true // ff00::/8 multicast
  if (h0 === 0x0100 && h1 === 0 && h2 === 0 && h3 === 0) return true // 100::/64 discard
  return false
}

export interface UrlSafety {
  safe: boolean
  reason?: string
}

/** Parse + reject schemes, credentials, odd ports and literal private hosts. */
function checkParsedUrl(parsed: URL): string | null {
  if (!['http:', 'https:'].includes(parsed.protocol)) return 'URL must be http(s)'
  if (parsed.username || parsed.password) return 'URL must not contain credentials'
  if (!ALLOWED_PORTS.has(parsed.port)) return 'URL uses a disallowed port'
  return checkHostname(normalizeIpLiteral(parsed.hostname))
}

function checkHostname(hostname: string): string | null {
  if (BLOCKED_HOSTNAMES.has(hostname)) return 'URL host is not allowed'
  if (BLOCKED_SUFFIXES.some(suffix => hostname.endsWith(suffix))) return 'URL host is not allowed'
  if (isIP(hostname) && isBlockedIp(hostname)) return 'URL host is not allowed'
  return null
}

async function resolvePublicAddress(host: string): Promise<{ address: string, family: 4 | 6 } | string> {
  // IPv6 literals arrive bracketed from `URL.hostname`; DNS names arrive plain.
  const hostname = normalizeIpLiteral(host)
  const literal = isIP(hostname)
  if (literal) {
    if (isBlockedIp(hostname)) return 'URL host is not allowed'
    return { address: hostname, family: literal as 4 | 6 }
  }
  try {
    const records = await lookup(hostname, { all: true })
    if (records.length === 0) return 'URL host could not be resolved'
    const blocked = records.find(record => isBlockedIp(record.address))
    if (blocked) return 'URL host is not allowed'
    const first = records[0]!
    return { address: first.address, family: first.family === 6 ? 6 : 4 }
  }
  catch {
    return 'URL host could not be resolved'
  }
}

/** Pre-flight only. Prefer `safeFetch`, which also pins the connection. */
export async function isSafeExternalUrl(rawUrl: string): Promise<UrlSafety> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  }
  catch {
    return { safe: false, reason: 'Invalid URL' }
  }
  const parsedError = checkParsedUrl(parsed)
  if (parsedError) return { safe: false, reason: parsedError }
  const resolved = await resolvePublicAddress(parsed.hostname)
  return typeof resolved === 'string' ? { safe: false, reason: resolved } : { safe: true }
}

/** Resolve + validate a hop we are about to request. */
export async function validateOutboundUrl(rawUrl: string): Promise<
  { ok: true, url: URL, address: string, family: 4 | 6 } | { ok: false, reason: string }
> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  }
  catch {
    return { ok: false, reason: 'Invalid URL' }
  }
  const parsedError = checkParsedUrl(parsed)
  if (parsedError) return { ok: false, reason: parsedError }
  const resolved = await resolvePublicAddress(parsed.hostname)
  if (typeof resolved === 'string') return { ok: false, reason: resolved }
  return { ok: true, url: parsed, address: resolved.address, family: resolved.family }
}

/** `net.connect` lookup that always returns the already-validated address. */
function pinnedLookup(address: string, family: 4 | 6): LookupFunction {
  return (_hostname, options, callback) => {
    const all = (options as { all?: boolean } | undefined)?.all
    if (all) {
      callback(null, [{ address, family }])
      return
    }
    callback(null, address, family)
  }
}

export interface SafeFetchOptions {
  method?: 'GET' | 'POST' | 'HEAD'
  headers?: Record<string, string>
  body?: string | Buffer
  maxBytes?: number
  /** Idle-socket timeout. */
  timeoutMs?: number
  /** Absolute wall-clock deadline for the whole request, including the body. */
  deadlineMs?: number
}

export interface SafeFetchResult {
  status: number
  headers: IncomingHttpHeaders
  body: Buffer
  finalUrl: string
}

function sendRequest(
  target: URL,
  pinned: { address: string, family: 4 | 6 },
  options: SafeFetchOptions,
): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const request = target.protocol === 'https:' ? httpsRequest : httpRequest
    // `setTimeout` on the socket is only an *idle* timeout — a server that
    // drips one byte at a time keeps it alive forever. The AbortController
    // enforces a hard wall-clock deadline that survives the whole body.
    const controller = new AbortController()
    const timer = setTimeout(
      () => controller.abort(new Error('Outbound request exceeded its deadline')),
      options.deadlineMs ?? DEFAULT_DEADLINE_MS,
    )
    const clear = () => clearTimeout(timer)
    const req = request(target, {
      method: options.method ?? 'GET',
      headers: options.headers,
      lookup: pinnedLookup(pinned.address, pinned.family),
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      signal: controller.signal,
    }, (res) => {
      res.on('end', clear)
      res.on('close', clear)
      res.on('error', clear)
      resolve(res)
    })
    req.on('timeout', () => req.destroy(new Error('Outbound request timed out')))
    req.on('error', (error) => {
      clear()
      reject(error)
    })
    if (options.body) req.write(options.body)
    req.end()
  })
}

function redirectTarget(res: IncomingMessage, current: URL): string | null {
  const status = res.statusCode ?? 0
  const isRedirect = status === 301 || status === 302 || status === 303 || status === 307 || status === 308
  if (!isRedirect) return null
  const location = res.headers.location
  res.resume()
  return location ? new URL(location, current).toString() : null
}

async function collectBody(res: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of res) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
    total += buffer.length
    if (total > maxBytes) {
      res.destroy(new Error('Outbound response exceeded the size limit'))
      throw new Error('Outbound response exceeded the size limit')
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

/**
 * Follow redirects manually, validating and pinning every hop.
 * Returns the final response plus the URL that produced it.
 */
export async function safeFetch(url: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  let current = url
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const target = await validateOutboundUrl(current)
    if (!target.ok) throw new Error(`Blocked outbound URL: ${target.reason}`)
    const res = await sendRequest(target.url, target, options)
    const next = redirectTarget(res, target.url)
    if (!next) {
      return {
        status: res.statusCode ?? 0,
        headers: res.headers,
        body: await collectBody(res, maxBytes),
        finalUrl: target.url.toString(),
      }
    }
    current = next
  }
  throw new Error('Too many redirects')
}

export interface SafeStreamResult {
  status: number
  headers: IncomingHttpHeaders
  stream: Readable
  finalUrl: string
  cleanup: () => void
}

/** Abort a stream once it exceeds `maxBytes` (protects against endless proxies). */
export function capStream(stream: Readable, maxBytes: number): Readable {
  let total = 0
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      total += chunk.length
      if (total > maxBytes) {
        callback(new Error('Outbound response exceeded the size limit'))
        return
      }
      callback(null, chunk)
    },
  })
  stream.on('error', error => counter.destroy(error))
  return stream.pipe(counter)
}

/**
 * Like `safeFetch`, but streams the body instead of buffering it. The caller
 * owns the stream and must destroy it (the server does that on disconnect).
 * Redirect hops are still validated and pinned individually.
 */
export async function safeFetchStream(url: string, options: SafeFetchOptions = {}): Promise<SafeStreamResult> {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const target = await validateOutboundUrl(current)
    if (!target.ok) throw new Error(`Blocked outbound URL: ${target.reason}`)
    const res = await sendRequest(target.url, target, options)
    const next = redirectTarget(res, target.url)
    if (!next) {
      return {
        status: res.statusCode ?? 0,
        headers: res.headers,
        stream: res,
        finalUrl: target.url.toString(),
        cleanup: () => res.destroy(),
      }
    }
    current = next
  }
  throw new Error('Too many redirects')
}
