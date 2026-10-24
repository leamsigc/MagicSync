import { createLogger } from 'evlog'

/**
 * Fail-fast configuration check.
 *
 * The app has several "silently insecure" failure modes: a missing
 * BETTER_AUTH_SECRET breaks token encryption (fail-closed but invisible), an
 * empty PYTHON_TOOLS_TOKEN once let the sidecar run unauthenticated, and
 * NUXT_PUBLISH_SECRET silently falls back to the LLM JWT secret. In production
 * we refuse to boot on a hard requirement and warn loudly on the rest.
 */

const REQUIRED_IN_PRODUCTION = ['BETTER_AUTH_SECRET', 'NUXT_BETTER_AUTH_URL', 'NUXT_TURSO_DATABASE_URL']

const RECOMMENDED_SECRETS = ['MACHINE_BRIDGE_SECRET', 'PYTHON_TOOLS_TOKEN', 'NUXT_PUBLISH_SECRET']

const MIN_SECRET_LENGTH = 32

function isMissing(key: string): boolean {
  return !process.env[key]?.trim()
}

function isWeakSecret(key: string): boolean {
  const value = process.env[key]?.trim() ?? ''
  return value.length > 0 && value.length < MIN_SECRET_LENGTH
}

export default defineNitroPlugin(() => {
  const log = createLogger()
  const production = process.env.NODE_ENV === 'production'

  const missingRequired = REQUIRED_IN_PRODUCTION.filter(isMissing)
  if (production && missingRequired.length > 0) {
    throw new Error(`[config] Missing required production env vars: ${missingRequired.join(', ')}`)
  }

  const weak = RECOMMENDED_SECRETS.filter(isWeakSecret)
  const missing = RECOMMENDED_SECRETS.filter(isMissing)

  if (missing.length > 0) {
    log.warn(JSON.stringify({ component: 'config-check', message: 'Optional secrets not set', missing }))
  }
  if (weak.length > 0) {
    log.warn(JSON.stringify({ component: 'config-check', message: 'Secrets shorter than 32 chars', weak }))
  }
  if (process.env.NUXT_TRUST_PROXY !== '1' && production) {
    log.info(JSON.stringify({
      component: 'config-check',
      message: 'NUXT_TRUST_PROXY is off: x-forwarded-for is ignored for audit IPs and rate limiting. Set it only when a proxy overwrites the header.',
    }))
  }
})
