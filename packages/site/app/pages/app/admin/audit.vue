<i18n src="./audit.json"></i18n>

<script lang="ts" setup>
/**
 * Admin audit log — table-only collection surface.
 *
 * `useCollectionView` owns search + status/action filters, `BaseDataTable` owns
 * the table chrome, and the page keeps the audit-log API calls it always had.
 */
import type { CollectionTableColumn } from '#layers/BaseUI/app/utils/collection'

definePageMeta({
  layout: 'dashboard-layout',
})

const { t } = useI18n()
const toast = useToast()

interface AuditEntry {
  id: number
  userId: string | null
  category: string
  action: string
  targetType: string | null
  targetId: string | null
  ipAddress: string | null
  userAgent: string | null
  status: string | null
  details: string | null
  createdAt: string
}

type BadgeTone = 'success' | 'error' | 'warning' | 'neutral'

const STATUS_TONES: Record<string, BadgeTone> = {
  success: 'success',
  failure: 'error',
  pending: 'warning',
}

const logs = ref<AuditEntry[]>([])
const loading = ref(true)
const selectedLog = ref<AuditEntry | null>(null)
const selected = ref<string[]>([])

const {
  search,
  setSearch,
  filters,
  setFilter,
  filtered,
} = useCollectionView<AuditEntry>({
  key: 'admin-audit-log',
  modes: ['table'],
  rows: logs,
  searchFields: entry => [
    entry.action,
    entry.category,
    entry.targetType,
    entry.targetId,
    entry.userId,
    entry.ipAddress,
    entry.details,
  ],
  filterFns: {
    status: (entry, value) => (entry.status ?? '') === value,
    action: (entry, value) => entry.action === value,
  },
})

const statusOptions = computed(() => [
  { value: 'all', label: t('filters.allStatuses') },
  { value: 'success', label: t('status.success') },
  { value: 'failure', label: t('status.failure') },
  { value: 'pending', label: t('status.pending') },
])

const actionOptions = computed(() => {
  const actions = [...new Set(logs.value.map(entry => entry.action))].sort()
  return [
    { value: 'all', label: t('filters.allActions') },
    ...actions.map(action => ({ value: action, label: action })),
  ]
})

const toolbarFilters = computed(() => [
  {
    key: 'status',
    label: t('filters.status'),
    value: filters.value.status || 'all',
    options: statusOptions.value,
    width: 'w-full sm:w-40',
  },
  {
    key: 'action',
    label: t('filters.action'),
    value: filters.value.action || 'all',
    options: actionOptions.value,
    width: 'w-full sm:w-56',
  },
])

const columns = computed<CollectionTableColumn[]>(() => [
  { key: 'createdAt', label: t('columns.time'), width: '11rem' },
  { key: 'category', label: t('columns.category'), hideBelow: 'md' },
  { key: 'action', label: t('columns.action') },
  { key: 'status', label: t('columns.status'), width: '8rem' },
  { key: 'details', label: t('columns.details'), hideBelow: 'xl' },
])

function entryId(entry: Record<string, any>): string {
  return String(entry.id)
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString()
}

function statusTone(status: string | null): BadgeTone {
  return STATUS_TONES[status ?? ''] ?? 'neutral'
}

function handleFilter(key: string, value: string) {
  setFilter(key, value)
}

function openDetail(entry: AuditEntry) {
  selectedLog.value = entry
}

function closeDetail() {
  selectedLog.value = null
}

function handleDetailOpen(open: boolean) {
  if (!open) closeDetail()
}

async function fetchLogs() {
  loading.value = true
  try {
    const data = await $fetch<{ logs: AuditEntry[] }>('/api/v1/admin/audit-log')
    logs.value = data.logs
  } catch {
    toast.add({ title: t('toast.error'), description: t('toast.loadFailed'), color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(fetchLogs)

function forgetSelected(entry: AuditEntry) {
  selected.value = selected.value.filter(key => key !== String(entry.id))
}

async function deleteLog(entry: AuditEntry) {
  try {
    await $fetch(`/api/v1/admin/audit-log/${entry.id}`, { method: 'DELETE' })
    forgetSelected(entry)
    toast.add({ title: t('toast.deleted'), description: t('toast.deletedDescription', { id: entry.id }), color: 'success' })
    await fetchLogs()
  } catch {
    toast.add({ title: t('toast.error'), description: t('toast.deleteFailed'), color: 'error' })
  }
}

function confirmDelete(entry: AuditEntry) {
  toast.add({
    title: t('deleteOne.title'),
    description: t('deleteOne.description', { id: entry.id }),
    color: 'error',
    actions: [
      { label: t('deleteOne.confirm'), color: 'error', variant: 'solid', onClick: () => deleteLog(entry) },
      { label: t('common.cancel'), color: 'neutral', variant: 'outline' },
    ],
  })
}

function clearSelection() {
  selected.value = []
}

async function deleteSelected() {
  if (selected.value.length === 0) return
  const ids = selected.value.map(key => Number(key))
  try {
    await $fetch('/api/v1/admin/audit-log', { method: 'DELETE', body: { ids } })
    selected.value = []
    toast.add({ title: t('toast.deleted'), description: t('toast.deletedManyDescription', { count: ids.length }), color: 'success' })
    await fetchLogs()
  } catch {
    toast.add({ title: t('toast.error'), description: t('toast.deleteSelectedFailed'), color: 'error' })
  }
}

async function deleteAllLogs() {
  try {
    await $fetch('/api/v1/admin/audit-log', { method: 'DELETE', body: { all: true } })
    selected.value = []
    toast.add({ title: t('toast.deleted'), description: t('toast.deletedAllDescription'), color: 'success' })
    await fetchLogs()
  } catch {
    toast.add({ title: t('toast.error'), description: t('toast.deleteAllFailed'), color: 'error' })
  }
}

function askDeleteAll() {
  toast.add({
    title: t('deleteAll.title'),
    description: t('deleteAll.description', { count: logs.value.length }),
    color: 'error',
    actions: [
      { label: t('deleteAll.confirm'), color: 'error', variant: 'solid', onClick: deleteAllLogs },
      { label: t('common.cancel'), color: 'neutral', variant: 'outline' },
    ],
  })
}

function menuItems(entry: AuditEntry) {
  return [
    [
      { label: t('menu.view'), icon: 'i-lucide-eye', onSelect: () => openDetail(entry) },
    ],
    [
      { label: t('menu.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => confirmDelete(entry) },
    ],
  ]
}
</script>

<template>
  <BaseCollectionPage
    :title="t('title')"
    :description="t('description')"
  >
    <template #actions>
      <UButton
        v-if="logs.length > 0"
        color="error"
        variant="ghost"
        size="sm"
        icon="i-lucide-trash-2"
        @click="askDeleteAll"
      >
        {{ t('actions.deleteAll') }}
      </UButton>
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-refresh-cw"
        :loading="loading"
        @click="fetchLogs"
      >
        {{ t('actions.refresh') }}
      </UButton>
    </template>

    <template #toolbar>
      <BaseCollectionToolbar
        :search="search"
        :search-placeholder="t('searchPlaceholder')"
        :filters="toolbarFilters"
        :busy="loading"
        @update:search="setSearch"
        @update:filter="handleFilter"
      />
    </template>

    <BaseDataTable
      v-model:selected="selected"
      :rows="filtered"
      :columns="columns"
      :row-key="entryId"
      :loading="loading"
      :selectable="true"
      :empty-title="t('empty')"
      empty-icon="i-lucide-scroll-text"
    >
      <template #cell-createdAt="{ row }">
        <span class="whitespace-nowrap text-xs text-muted">{{ formatDate(row.createdAt) }}</span>
      </template>

      <template #cell-category="{ row }">
        <span class="font-mono text-xs">{{ row.category }}</span>
      </template>

      <template #cell-action="{ row }">
        <span class="text-sm">{{ row.action }}</span>
      </template>

      <template #cell-status="{ row }">
        <UBadge v-if="row.status" :color="statusTone(row.status)" variant="subtle" size="sm">
          {{ row.status }}
        </UBadge>
        <span v-else class="text-xs text-muted">—</span>
      </template>

      <template #cell-details="{ row }">
        <span class="block max-w-[220px] truncate text-xs text-muted">{{ row.details || '—' }}</span>
      </template>

      <template #row-actions="{ row }">
        <UDropdownMenu :items="menuItems(row)" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="t('a11y.actions')"
          />
        </UDropdownMenu>
      </template>

      <template #bulk>
        <p class="text-sm font-medium">{{ t('footer.selected', { selected: selected.length, total: filtered.length }) }}</p>
        <div class="ms-auto flex items-center gap-2">
          <UButton color="error" size="xs" icon="i-lucide-trash-2" @click="deleteSelected">
            {{ t('actions.deleteSelected') }}
          </UButton>
          <UButton variant="ghost" color="neutral" size="xs" @click="clearSelection">
            {{ t('actions.clearSelection') }}
          </UButton>
        </div>
      </template>

      <template #footer>
        <div class="flex flex-wrap items-center justify-between gap-3 px-1 py-3">
          <p class="text-sm text-muted">
            {{ t('footer.selected', { selected: selected.length, total: filtered.length }) }}
          </p>
        </div>
      </template>
    </BaseDataTable>

    <UModal :open="selectedLog !== null" @update:open="handleDetailOpen">
      <template #content>
        <UCard v-if="selectedLog">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold">{{ t('detail.title') }}</h3>
              <UButton
                variant="ghost"
                color="neutral"
                icon="i-lucide-x"
                :aria-label="t('detail.close')"
                @click="closeDetail"
              />
            </div>
          </template>

          <dl class="space-y-3 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-muted">{{ t('detail.id') }}</dt>
              <dd class="font-mono">{{ selectedLog.id }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted">{{ t('detail.category') }}</dt>
              <dd>{{ selectedLog.category }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted">{{ t('detail.action') }}</dt>
              <dd>{{ selectedLog.action }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted">{{ t('detail.status') }}</dt>
              <dd>
                <UBadge :color="statusTone(selectedLog.status)" variant="subtle" size="sm">
                  {{ selectedLog.status || t('detail.noStatus') }}
                </UBadge>
              </dd>
            </div>
            <div v-if="selectedLog.targetType" class="flex justify-between gap-4">
              <dt class="text-muted">{{ t('detail.target') }}</dt>
              <dd class="font-mono text-xs break-all">
                {{ selectedLog.targetType }}: {{ selectedLog.targetId }}
              </dd>
            </div>
            <div v-if="selectedLog.userId" class="flex justify-between gap-4">
              <dt class="text-muted">{{ t('detail.userId') }}</dt>
              <dd class="font-mono text-xs break-all">{{ selectedLog.userId }}</dd>
            </div>
            <div v-if="selectedLog.details" class="pt-2">
              <dt class="mb-1 text-muted">{{ t('detail.details') }}</dt>
              <dd class="whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-xs">{{ selectedLog.details }}</dd>
            </div>
            <div v-if="selectedLog.ipAddress" class="flex justify-between gap-4">
              <dt class="text-muted">{{ t('detail.ipAddress') }}</dt>
              <dd class="font-mono text-xs">{{ selectedLog.ipAddress }}</dd>
            </div>
          </dl>
        </UCard>
      </template>
    </UModal>
  </BaseCollectionPage>
</template>
