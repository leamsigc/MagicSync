<i18n src="./index.json"></i18n>
<script setup lang="ts">
import BillingPlanPanel from '#layers/BaseBilling/app/components/billing/BillingPlanPanel.vue'
import BillingPaymentPanel from '#layers/BaseBilling/app/components/billing/BillingPaymentPanel.vue'
import BillingInvoicesPanel from '#layers/BaseBilling/app/components/billing/BillingInvoicesPanel.vue'
import BillingAccessBanner from '#layers/BaseBilling/app/components/billing/BillingAccessBanner.vue'
import type { BillingPlanId } from '#layers/BaseBilling/app/utils/billing-plans'

/**
 * Billing: one page, three tabs — Plan, Payment and Invoices.
 *
 * The page owns the read (`useBilling`) and the Stripe hand-offs; the three
 * panels are presentational. Usage is composed here from data the page already
 * has — the purchased seats on the subscription and the business count — so the
 * meters never show a number the server did not produce.
 */

const { t } = useI18n()
const {
  overview,
  loading,
  busyPlan,
  portalBusy,
  currentPlan,
  configured,
  load,
  upgrade,
  openPortal,
} = useBilling()
const { businesses, getAllBusinesses } = useBusinessManager()

const activeTab = ref('plan')

const usage = computed(() => ({
  members: overview.value?.subscription?.seats ?? 1,
  projects: businesses.value.pagination?.total ?? 0,
}))

const items = computed(() => [
  { label: t('tabs.plan'), value: 'plan', slot: 'plan' },
  { label: t('tabs.payment'), value: 'payment', slot: 'payment' },
  { label: t('tabs.invoices'), value: 'invoices', slot: 'invoices' },
])

function handleUpgrade(plan: BillingPlanId) {
  void upgrade(plan)
}

function handleViewInvoices() {
  activeTab.value = 'invoices'
}

function handleSelectPlan() {
  activeTab.value = 'plan'
}

function handlePortal() {
  void openPortal()
}

onMounted(() => {
  void load()
  void getAllBusinesses()
})

useSeoMeta({
  title: () => t('seo.title'),
  description: () => t('seo.description'),
})
</script>

<template>
  <UContainer class="max-w-4xl py-8">
    <div class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-highlighted">{{ t('heading') }}</h1>
      <p class="text-muted">{{ t('subheading') }}</p>
    </div>

    <div v-if="loading" v-motion-fade :duration="200" class="flex justify-center py-20">
      <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-muted" />
    </div>

    <template v-else>
      <BillingAccessBanner
        v-motion-fade
        :duration="250"
        class="mb-4"
        :access="overview?.access ?? null"
        @select-plan="handleSelectPlan"
      />

      <UTabs v-model="activeTab" :items="items" class="w-full">
        <template #plan>
          <BillingPlanPanel
            class="mt-4"
            :overview="overview"
            :current-plan="currentPlan"
            :usage="usage"
            :busy-plan="busyPlan"
            :portal-busy="portalBusy"
            :configured="configured"
            :billing-not-required="overview?.access?.state === 'admin'"
            @upgrade="handleUpgrade"
            @view-invoices="handleViewInvoices"
            @portal="handlePortal"
          />
        </template>

        <template #payment>
          <BillingPaymentPanel
            class="mt-4"
            :overview="overview"
            :portal-busy="portalBusy"
            @portal="handlePortal"
          />
        </template>

        <template #invoices>
          <BillingInvoicesPanel class="mt-4" :invoices="overview?.invoices ?? []" />
        </template>
      </UTabs>
    </template>
  </UContainer>
</template>
