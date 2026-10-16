import type { BillingOverview } from '#layers/BaseBilling/server/services/billing.service'
import { billingPlan, type BillingPlanId } from '#layers/BaseBilling/app/utils/billing-plans'

/**
 * The billing page's data and actions.
 *
 * `overview` is the server's Stripe-backed read; `upgrade`, `downgrade` and
 * `openPortal` hand off to Stripe (checkout or the customer portal) through the
 * better-auth client, so the page never talks to Stripe itself.
 */
export function useBilling() {
  const { client } = UseUser()
  const { t } = useI18n()
  const toast = useToast()

  const overview = ref<BillingOverview | null>(null)
  const loading = ref(false)
  const busyPlan = ref<BillingPlanId | null>(null)
  const portalBusy = ref(false)

  const currentPlan = computed(() => billingPlan(overview.value?.subscription?.plan))
  const configured = computed(() => overview.value?.configured ?? false)

  function notifyError(error: unknown) {
    const message = (error as { data?: { message?: string } })?.data?.message ?? t('messages.actionFailed')
    toast.add({ title: message, icon: 'i-lucide-x-circle', color: 'error' })
  }

  async function load() {
    loading.value = true
    try {
      overview.value = await $fetch<BillingOverview>('/api/v1/billing/overview')
    }
    catch (error) {
      notifyError(error)
    }
    finally {
      loading.value = false
    }
  }

  async function upgrade(planId: BillingPlanId) {
    if (planId === 'free') return
    busyPlan.value = planId
    try {
      await client.subscription.upgrade({
        plan: planId,
        successUrl: '/app/billing',
        cancelUrl: '/app/billing',
      })
      toast.add({ title: t('messages.redirecting'), icon: 'i-lucide-external-link', color: 'info' })
    }
    catch (error) {
      notifyError(error)
    }
    finally {
      busyPlan.value = null
    }
  }

  async function openPortal() {
    portalBusy.value = true
    try {
      await client.subscription.billingPortal({ returnUrl: '/app/billing' })
    }
    catch (error) {
      notifyError(error)
    }
    finally {
      portalBusy.value = false
    }
  }

  return { overview, loading, busyPlan, portalBusy, currentPlan, configured, load, upgrade, openPortal }
}
