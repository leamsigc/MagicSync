import type { AccessSummary } from '#layers/BaseBilling/server/utils/entitlement'

/**
 * The access gate.
 *
 * Runs after auth (01) so there is a session, and after the admin and business
 * checks (02/03). It is off unless the deployment turns it on
 * (`BILLING_ENFORCE_ACCESS=true`), because switching it on for an existing
 * install would otherwise lock out every account that signed up before the
 * billing feature existed.
 *
 * Roles, trials and subscriptions are all decided on the server; the client only
 * reacts to the verdict. A failed lookup fails **open** — an API hiccup must
 * never strand a paying customer outside their own app.
 */

/** Pages an expired account still needs: billing to pay, profile to leave. */
const EXEMPT_PREFIXES = ['/app/billing', '/app/profile']

function isExempt(path: string): boolean {
  return EXEMPT_PREFIXES.some(prefix => path.startsWith(prefix))
}

async function loadAccess(): Promise<AccessSummary | null> {
  try {
    return await $fetch<AccessSummary>('/api/v1/billing/access')
  }
  catch {
    return null
  }
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (!useRuntimeConfig().public.billingEnforce) return
  if (!to.path.startsWith('/app') || isExempt(to.path)) return
  const access = useState<AccessSummary | null>('billing:access', () => null)
  if (!access.value) access.value = await loadAccess()
  if (access.value?.allowed === false) return navigateTo('/app/billing')
})
