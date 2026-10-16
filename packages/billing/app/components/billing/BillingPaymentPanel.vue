<i18n src="#site/app/pages/app/billing/index.json"></i18n>
<script setup lang="ts">
import type { BillingOverview } from '#layers/BaseBilling/server/services/billing.service'

/**
 * The Payment tab: the default card, then the billing details Stripe holds for
 * the customer. "Update" opens the Stripe customer portal, where the card, the
 * address and the tax id are actually edited — this panel only reports them.
 */

defineProps<{
  overview: BillingOverview | null
  portalBusy: boolean
}>()

const emit = defineEmits<{ portal: [] }>()

const { t } = useI18n()

function handlePortal() {
  emit('portal')
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-xl font-semibold text-highlighted">{{ t('payment.title') }}</h2>
      <p class="text-sm text-muted">{{ t('payment.subtitle') }}</p>
    </div>

    <div class="divide-y divide-default rounded-2xl border border-default bg-elevated/40">
      <div class="flex flex-wrap items-center justify-between gap-4 p-5">
        <div class="flex items-center gap-3">
          <span class="grid size-9 place-items-center rounded-lg bg-muted text-muted">
            <UIcon name="i-lucide-credit-card" class="size-4" />
          </span>
          <div>
            <p v-if="overview?.paymentMethod" class="font-medium text-highlighted">
              {{ t('payment.cardEnding', { brand: overview.paymentMethod.brand, last4: overview.paymentMethod.last4 }) }}
            </p>
            <p v-else class="font-medium text-highlighted">{{ t('payment.noCard') }}</p>
            <p v-if="overview?.paymentMethod" class="text-sm text-muted">
              {{ t('payment.expires', { month: String(overview.paymentMethod.expMonth).padStart(2, '0'), year: overview.paymentMethod.expYear }) }}
            </p>
          </div>
        </div>
        <UButton
          variant="outline"
          color="neutral"
          :label="t('payment.update')"
          :loading="portalBusy"
          @click="handlePortal"
        />
      </div>

      <div class="flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <p class="font-medium text-highlighted">{{ t('payment.billingEmail') }}</p>
          <p class="text-sm text-muted">{{ t('payment.billingEmailHint') }}</p>
        </div>
        <p class="text-sm text-highlighted">{{ overview?.billingEmail || t('payment.notSet') }}</p>
      </div>

      <div class="flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <p class="font-medium text-highlighted">{{ t('payment.billingAddress') }}</p>
          <p class="text-sm text-muted">{{ overview?.billingAddress || t('payment.notSet') }}</p>
        </div>
        <UButton
          variant="outline"
          color="neutral"
          :label="t('payment.edit')"
          :loading="portalBusy"
          @click="handlePortal"
        />
      </div>

      <div class="flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <p class="font-medium text-highlighted">{{ t('payment.taxId') }}</p>
          <p class="text-sm text-muted">{{ t('payment.taxIdHint') }}</p>
        </div>
        <p class="text-sm text-highlighted">{{ overview?.taxId || t('payment.notSet') }}</p>
      </div>
    </div>
  </div>
</template>
