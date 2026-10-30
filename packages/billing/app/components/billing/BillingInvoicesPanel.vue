<i18n src="./BillingInvoicesPanel.json"></i18n>
<script setup lang="ts">
import type { BillingInvoice } from '#layers/BaseBilling/server/services/billing.service'
import type { CollectionTableColumn } from '#layers/BaseUI/app/utils/collection'

/**
 * The Invoices tab: the Stripe invoice history for the customer. Stripe keeps
 * the PDFs; the page links out to the hosted invoice for the download.
 */

const props = defineProps<{
  invoices: BillingInvoice[]
}>()

const { t, locale } = useI18n()

const rows = computed<Record<string, any>[]>(() => props.invoices.map(invoice => ({
  ...invoice,
  dateLabel: new Date(invoice.date).toLocaleDateString(locale.value, { month: 'short', day: 'numeric', year: 'numeric' }),
  amountLabel: `$${invoice.amount.toFixed(2)}`,
})))

const {
  search,
  setSearch,
  filters,
  setFilter,
  sort,
  setSort,
  filtered,
  hasActiveFilters,
  resetFilters,
} = useCollectionView<Record<string, any>>({
  key: 'billing-invoices',
  modes: ['table'],
  defaultView: 'table',
  rows,
  searchFields: invoice => [invoice.number, invoice.dateLabel, invoice.amountLabel, invoice.status],
  filterFns: {
    status: (invoice, value) => invoice.status === value,
  },
  sorters: {
    newest: (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    oldest: (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  },
  initialSort: 'newest',
})

const statusOptions = computed(() => [
  { value: 'all', label: t('allStatuses') },
  { value: 'draft', label: t('status.draft') },
  { value: 'open', label: t('status.open') },
  { value: 'paid', label: t('status.paid') },
  { value: 'void', label: t('status.void') },
  { value: 'uncollectible', label: t('status.uncollectible') },
])

const sortOptions = computed(() => [
  { value: 'newest', label: t('sortNewest') },
  { value: 'oldest', label: t('sortOldest') },
])

const toolbarFilters = computed(() => [
  { key: 'status', label: t('statusFilter'), value: filters.value.status || 'all', options: statusOptions.value, width: 'w-full sm:w-40' },
])

const toolbarSort = computed(() => ({ value: sort.value, options: sortOptions.value }))

const columns = computed<CollectionTableColumn[]>(() => [
  { key: 'number', label: t('columns.invoice') },
  { key: 'dateLabel', label: t('columns.date'), hideBelow: 'sm' },
  { key: 'amountLabel', label: t('columns.amount') },
  { key: 'status', label: t('columns.status') },
])

function statusColor(status: string): 'success' | 'neutral' {
  return status === 'paid' ? 'success' : 'neutral'
}

const KNOWN_STATUSES = ['draft', 'open', 'paid', 'void', 'uncollectible']

function statusLabel(status: string): string {
  return KNOWN_STATUSES.includes(status) ? t(`status.${status}`) : status
}

function handleFilterChange(key: string, value: string) {
  setFilter(key, value)
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-xl font-semibold text-highlighted">{{ t('title') }}</h2>
      <p class="text-sm text-muted">{{ t('subtitle') }}</p>
    </div>

    <BaseCollectionToolbar
      :search="search"
      :search-placeholder="t('search')"
      :filters="toolbarFilters"
      :sort="toolbarSort"
      @update:search="setSearch"
      @update:filter="handleFilterChange"
      @update:sort="setSort"
    />

    <BaseDataTable
      :rows="filtered"
      :columns="columns"
      row-key="id"
      min-width="32rem"
    >
      <template #cell-number="{ row }">
        <span class="font-mono text-sm">{{ row.number }}</span>
      </template>
      <template #cell-dateLabel="{ row }">
        <span class="whitespace-nowrap text-muted">{{ row.dateLabel }}</span>
      </template>
      <template #cell-amountLabel="{ row }">
        <span class="tabular-nums font-medium text-highlighted">{{ row.amountLabel }}</span>
      </template>
      <template #cell-status="{ row }">
        <UBadge
          :label="statusLabel(row.status)"
          :color="statusColor(row.status)"
          variant="subtle"
          icon="i-lucide-check"
        />
      </template>

      <template #empty>
        <div class="py-8 text-center">
          <UIcon name="i-lucide-receipt" class="mx-auto mb-3 size-9 text-dimmed" />
          <p class="text-sm font-medium text-highlighted">{{ hasActiveFilters ? t('noResults') : t('empty') }}</p>
          <p class="mt-1 text-sm text-muted">{{ hasActiveFilters ? t('noResultsHint') : t('emptyHint') }}</p>
          <UButton
            v-if="hasActiveFilters"
            class="mt-3"
            variant="ghost"
            size="sm"
            icon="i-lucide-filter-x"
            :label="t('clearFilters')"
            @click="resetFilters"
          />
        </div>
      </template>
    </BaseDataTable>
  </div>
</template>
