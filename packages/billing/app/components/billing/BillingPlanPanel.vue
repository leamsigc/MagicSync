<i18n src="#site/app/pages/app/billing/index.json"></i18n>
<script setup lang="ts">
import type { BillingOverview } from '#layers/BaseBilling/server/services/billing.service'
import {
  BILLING_PLANS,
  planLimit,
  usagePercent,
  type BillingPlan,
  type BillingPlanId,
} from '#layers/BaseBilling/app/utils/billing-plans'

/**
 * The Plan tab: the current subscription with its usage meters, then the plan
 * comparison. The panel is presentational — the page owns the read and the
 * upgrade hand-off — so every number here arrives as a prop.
 */

const props = defineProps<{
  overview: BillingOverview | null
  currentPlan: BillingPlan
  /** Usage the page can vouch for: purchased seats and the project count. */
  usage: { members: number, projects: number }
  busyPlan: BillingPlanId | null
  portalBusy: boolean
  configured: boolean
  /** Admins are entitled by role; there is nothing for them to buy. */
  billingNotRequired?: boolean
}>()

const emit = defineEmits<{
  upgrade: [plan: BillingPlanId]
  viewInvoices: []
  portal: []
}>()

const { t, locale } = useI18n()

const plans = BILLING_PLANS

const subscription = computed(() => props.overview?.subscription ?? null)

const renewsAt = computed(() => {
  const iso = subscription.value?.renewsAt
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(locale.value, { month: 'short', day: 'numeric', year: 'numeric' })
})

const usageLines = computed(() => [
  { key: 'members', used: props.usage.members, limit: planLimit(props.currentPlan, 'members') },
  { key: 'projects', used: props.usage.projects, limit: planLimit(props.currentPlan, 'projects') },
])

const currentIndex = computed(() => plans.findIndex(plan => plan.id === props.currentPlan.id))

/** `current` disables, a lower plan downgrades, a higher one upgrades. */
function ctaFor(plan: BillingPlan): string {
  if (plan.id === props.currentPlan.id) return 'current'
  const index = plans.findIndex(entry => entry.id === plan.id)
  return index < currentIndex.value ? 'downgrade' : 'upgrade'
}

function isBusy(plan: BillingPlan): boolean {
  return props.busyPlan === plan.id
}

function handleUpgrade(plan: BillingPlan) {
  if (plan.id === props.currentPlan.id) return
  emit('upgrade', plan.id)
}

function handleUsageWidth(limit: number, used: number): string {
  return `${usagePercent(used, limit)}%`
}

function handleViewInvoices() {
  emit('viewInvoices')
}

function handlePortal() {
  emit('portal')
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-xl font-semibold text-highlighted">{{ t('plan.title') }}</h2>
      <p class="text-sm text-muted">{{ t('plan.subtitle') }}</p>
    </div>

    <div class="rounded-2xl border border-default bg-elevated/40 p-5">
      <p class="text-xs font-medium tracking-wide text-muted uppercase">{{ t('plan.current') }}</p>

      <div class="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-lg font-semibold text-highlighted">
            {{ t(`plans.${currentPlan.id}.name`) }}
            <span class="text-sm font-normal text-muted">
              · {{ t('plan.perMember', { price: currentPlan.priceMonthly }) }}
            </span>
          </p>
          <p v-if="renewsAt" class="text-sm text-muted">
            {{ t('plan.renews', { date: renewsAt, interval: t(`plan.interval.${subscription?.billingInterval ?? 'month'}`) }) }}
          </p>
          <p v-else class="text-sm text-muted">{{ t('plan.noActive') }}</p>
        </div>

        <UButton
          v-if="subscription"
          variant="outline"
          color="neutral"
          :label="t('plan.viewInvoices')"
          @click="handleViewInvoices"
        />
      </div>

      <div v-if="subscription" class="mt-5 space-y-3">
        <div v-for="line in usageLines" :key="line.key">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted">{{ t(`usage.${line.key}`) }}</span>
            <span class="text-highlighted tabular-nums">
              {{ line.limit > 0 ? t('usage.of', { used: line.used, limit: line.limit }) : t('usage.unlimited', { used: line.used }) }}
            </span>
          </div>
          <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full bg-primary transition-all"
              :style="{ width: handleUsageWidth(line.limit, line.used) }"
            />
          </div>
        </div>
      </div>

      <p v-else-if="!configured" class="mt-4 text-sm text-muted">{{ t('plan.notConfigured') }}</p>
    </div>

    <div class="grid gap-3 md:grid-cols-3">
      <div
        v-for="plan in plans"
        :key="plan.id"
        class="flex flex-col rounded-2xl border p-5"
        :class="plan.id === currentPlan.id ? 'border-primary bg-primary/5' : 'border-default bg-elevated/40'"
      >
        <div class="flex items-center gap-2">
          <p class="font-semibold text-highlighted">{{ t(`plans.${plan.id}.name`) }}</p>
          <UBadge v-if="plan.id === currentPlan.id" :label="t('plan.currentBadge')" variant="subtle" color="primary" size="sm" />
        </div>

        <p class="mt-2">
          <span class="text-2xl font-bold text-highlighted">${{ plan.priceMonthly }}</span>
          <span class="text-sm text-muted">{{ t('plan.perMemberShort') }}</span>
        </p>

        <ul class="mt-4 flex-1 space-y-2">
          <li v-for="feature in plan.features" :key="feature" class="flex items-start gap-2 text-sm text-muted">
            <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-success" />
            {{ t(`plans.${plan.id}.features.${feature}`) }}
          </li>
        </ul>

        <UButton
          v-if="!configured"
          class="mt-4 justify-center"
          variant="soft"
          color="neutral"
          :label="t('plan.cta.unavailable')"
          disabled
        />
        <UButton
          v-else-if="billingNotRequired"
          class="mt-4 justify-center"
          variant="soft"
          color="neutral"
          :label="t('plan.cta.notRequired')"
          disabled
        />
        <UButton
          v-else-if="ctaFor(plan) === 'current'"
          class="mt-4 justify-center"
          variant="soft"
          color="neutral"
          :label="t('plan.cta.current')"
          disabled
        />
        <UButton
          v-else
          class="mt-4 justify-center"
          :variant="ctaFor(plan) === 'upgrade' ? 'solid' : 'outline'"
          :color="ctaFor(plan) === 'upgrade' ? 'primary' : 'neutral'"
          :label="t(`plan.cta.${ctaFor(plan)}`)"
          :loading="isBusy(plan)"
          :disabled="busyPlan !== null"
          @click="handleUpgrade(plan)"
        />
      </div>
    </div>

    <div v-if="subscription" class="flex justify-end">
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-settings"
        :label="t('plan.manage')"
        :loading="portalBusy"
        @click="handlePortal"
      />
    </div>
  </div>
</template>
