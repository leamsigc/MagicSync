<i18n src="#site/app/pages/app/billing/index.json"></i18n>
<script setup lang="ts">
import type { BillingInvoice } from '#layers/BaseBilling/server/services/billing.service'

/**
 * The Invoices tab: the Stripe invoice history for the customer. Stripe keeps
 * the PDFs; the page links out to the hosted invoice for the download.
 */

const props = defineProps<{
  invoices: BillingInvoice[]
}>()

const { t, locale } = useI18n()

const rows = computed(() => props.invoices.map(invoice => ({
  ...invoice,
  dateLabel: new Date(invoice.date).toLocaleDateString(locale.value, { month: 'short', day: 'numeric', year: 'numeric' }),
  amountLabel: `$${invoice.amount.toFixed(2)}`,
})))

const columns = computed(() => [
  { accessorKey: 'number', header: t('invoices.columns.invoice') },
  { accessorKey: 'dateLabel', header: t('invoices.columns.date') },
  { accessorKey: 'amountLabel', header: t('invoices.columns.amount') },
  { accessorKey: 'status', header: t('invoices.columns.status') },
])
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-xl font-semibold text-highlighted">{{ t('invoices.title') }}</h2>
      <p class="text-sm text-muted">{{ t('invoices.subtitle') }}</p>
    </div>

    <div class="overflow-hidden rounded-2xl border border-default bg-elevated/40">
      <UTable
        v-if="rows.length > 0"
        :data="rows"
        :columns="columns"
        :ui="{ th: 'text-muted text-xs uppercase', td: 'text-sm text-highlighted' }"
      >
        <template #number-cell="{ row }">
          <span class="font-mono">{{ row.original.number }}</span>
        </template>
        <template #status-cell="{ row }">
          <UBadge
            :label="t(`invoices.status.${row.original.status}`)"
            :color="row.original.status === 'paid' ? 'success' : 'neutral'"
            variant="subtle"
            icon="i-lucide-check"
          />
        </template>
      </UTable>

      <p v-else class="p-6 text-sm text-muted">{{ t('invoices.empty') }}</p>
    </div>
  </div>
</template>
