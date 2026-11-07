import { isIP } from 'node:net'
import { isBlockedIp } from '#layers/BaseShared/server/utils/ssrf'
import { validatePublicSiteUrl } from './url-allowlist'

/**
 * Validation for a user-supplied LLM base URL.
 *
 * `apiBaseUrl` is stored per user and used by the model runtime to issue
 * server-side requests — including POSTs that carry the user's API key. Left
 * unvalidated it is a first-class SSRF primitive (169.254.169.254, db:8080,
 * python-tools:8100).
 *
 * Public providers must be https + public. Local runners (ollama / llama.cpp)
 * are operator-configured infrastructure: they legitimately live on a LAN, a
 * VPN, a tunnel, or another container, so the host allowlist is deliberately
 * gone. The only remaining blocks are the cloud-metadata endpoints and
 * credentials in the URL — an API base URL should never be able to read an
 * instance's IAM credentials.
 */

const LOCAL_PROVIDERS = new Set(['ollama', 'llama'])

/** Metadata endpoints are never a model server. */
const BLOCKED_METADATA_HOSTS = new Set([
  '169.254.169.254',
  'metadata',
  'metadata.google.internal',
  'kubernetes.default',
])

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '')
}

/** Retained for operators that still reference the old env var; no longer used to gate local hosts. */
export function allowedLocalLlmHosts(): Set<string> {
  const raw = process.env.NUXT_LOCAL_LLM_HOSTS || ''
  return new Set(raw.split(',').map(host => normalizeHost(host.trim())).filter(Boolean))
}

function parseBaseUrl(value: string): URL | null {
  try {
    return new URL(value)
  }
  catch {
    return null
  }
}

function validateShape(parsed: URL): string | null {
  if (!['http:', 'https:'].includes(parsed.protocol)) return 'Base URL must use http(s)'
  if (parsed.username || parsed.password) return 'Base URL must not contain credentials'
  return null
}

function validateLocalHost(host: string): string | null {
  if (BLOCKED_METADATA_HOSTS.has(host)) return 'Base URL host is not allowed'
  return null
}

function validatePublicHost(host: string): string | null {
  if (BLOCKED_METADATA_HOSTS.has(host)) return 'Base URL host is not allowed'
  if (host.endsWith('.internal') || host.endsWith('.local')) return 'Base URL host is not allowed'
  if (isIP(host) && isBlockedIp(host)) return 'Base URL host is not allowed'
  return null
}

/** Returns an error message, or null when the URL is acceptable for the provider. */
export async function validateLlmBaseUrl(
  provider: string,
  raw: string | null | undefined,
): Promise<string | null> {
  const value = raw?.trim()
  if (!value) return null

  const parsed = parseBaseUrl(value)
  if (!parsed) return 'Base URL must be a valid absolute URL'

  const shapeError = validateShape(parsed)
  if (shapeError) return shapeError

  const host = normalizeHost(parsed.hostname)
  if (LOCAL_PROVIDERS.has(provider)) return validateLocalHost(host)

  const hostError = validatePublicHost(host)
  if (hostError) return hostError
  return validatePublicSiteUrl(value)
}
