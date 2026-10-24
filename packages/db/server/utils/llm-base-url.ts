import { isIP } from 'node:net'
import { isBlockedIp } from '#layers/BaseShared/server/utils/ssrf'
import { validatePublicSiteUrl } from './url-allowlist'

/**
 * Validation for a user-supplied LLM base URL.
 *
 * `apiBaseUrl` is stored per user and used by the model runtime to issue
 * server-side requests — including POSTs that carry the user's API key. Left
 * unvalidated it is a first-class SSRF primitive (169.254.169.254, db:8080,
 * python-tools:8100). Public providers must be https + public; local runners
 * (ollama / llama.cpp) are the one legitimate case for private hosts, so they
 * get an explicit host allowlist instead of an open door.
 */

const LOCAL_PROVIDERS = new Set(['ollama', 'llama'])

const BLOCKED_HOSTNAMES = new Set([
  '169.254.169.254',
  'metadata',
  'metadata.google.internal',
  'kubernetes.default',
])

const DEFAULT_LOCAL_HOSTS = 'localhost,127.0.0.1,::1,host.docker.internal'

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '')
}

export function allowedLocalLlmHosts(): Set<string> {
  const raw = process.env.NUXT_LOCAL_LLM_HOSTS || DEFAULT_LOCAL_HOSTS
  return new Set(raw.split(',').map(host => normalizeHost(host.trim())).filter(Boolean))
}

/** Returns an error message, or null when the URL is acceptable for the provider. */
export async function validateLlmBaseUrl(
  provider: string,
  raw: string | null | undefined,
): Promise<string | null> {
  const value = raw?.trim()
  if (!value) return null

  let parsed: URL
  try {
    parsed = new URL(value)
  }
  catch {
    return 'Base URL must be a valid absolute URL'
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return 'Base URL must use http(s)'
  if (parsed.username || parsed.password) return 'Base URL must not contain credentials'

  const host = normalizeHost(parsed.hostname)
  if (BLOCKED_HOSTNAMES.has(host)) return 'Base URL host is not allowed'
  if (host.endsWith('.internal') || host.endsWith('.local')) return 'Base URL host is not allowed'
  if (isIP(host) && isBlockedIp(host)) return 'Base URL host is not allowed'

  if (!LOCAL_PROVIDERS.has(provider)) return validatePublicSiteUrl(value)

  const allowed = allowedLocalLlmHosts()
  if (!allowed.has(host)) {
    return `Local provider host must be one of: ${[...allowed].join(', ')} (configure NUXT_LOCAL_LLM_HOSTS)`
  }
  return null
}
