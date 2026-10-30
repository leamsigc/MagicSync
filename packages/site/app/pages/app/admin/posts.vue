<i18n src="./posts.json"></i18n>

<script lang="ts" setup>
/**
 * Admin → Posts.
 *
 * Table + list over every post across businesses. The generic admin table
 * (`useAdminDataTable`) still owns fetching, pagination and mutations; the
 * shared collection toolbar owns the visible search / status / platform state.
 * Search and status are server-side (debounced refetch); platform is derived
 * from `targetPlatforms` on the loaded page.
 */
import type { AdminColumnMeta } from '#layers/BaseDB/server/services/admin-data.service'
import type { CollectionTableColumn } from '#layers/BaseUI/app/utils/collection'
import { useAdminDataTable, type AdminTableRow } from '~/composables/useAdminDataTable'
import { formatAdminCellValue, type AdminFormValues } from '~/utils/admin-data'

definePageMeta({
  layout: 'dashboard-layout',
})

const POST_PREVIEW_KEYS = [
  'content',
  'status',
  'postFormat',
  'scheduledAt',
  'publishedAt',
  'businessId',
  'userId',
]

const HIDE_BELOW: Record<string, CollectionTableColumn['hideBelow']> = {
  postFormat: 'lg',
  scheduledAt: 'xl',
  publishedAt: 'xl',
  businessId: 'xl',
  userId: 'lg',
}

const STATUS_COLORS: Record<string, 'success' | 'error' | 'warning' | 'neutral'> = {
  published: 'success',
  failed: 'error',
  pending: 'warning',
}

const { t } = useI18n()
const toast = useToast()

const {
  columns,
  rows,
  pagination,
  loading,
  loadError,
  searchInput,
  rowSelection,
  selectedKeys,
  fetchRows,
  setFilter: setServerFilter,
  setPage,
  clearSelection,
  updateRow,
  deleteRows,
} = useAdminDataTable('posts')

const {
  view,
  setView,
  search,
  setSearch,
  filters,
  setFilter,
  filtered,
  isAll,
} = useCollectionView<AdminTableRow>({
  key: 'admin-posts',
  modes: ['table', 'list'],
  defaultView: 'table',
  rows,
  searchFields: row => rowSearchValues(row),
  filterFns: {
    status: (row, value) => String(row.status ?? '') === value,
    platform: (row, value) => platformsOf(row).includes(value),
  },
})

// The toolbar owns the visible search box; the debounced server fetch listens
// to `searchInput`, so mirror every keystroke into it.
watch(search, value => {
  searchInput.value = value
})

watch(
  () => filters.value.status,
  value => {
    setServerFilter('status', isAll(value) ? '' : value)
  },
)

const rowKey = (row: AdminTableRow): string => row._key

/** Selection is a plain id list; the composable keeps it page-scoped. */
const selected = computed<string[]>({
  get: () => selectedKeys.value,
  set: ids => {
    const next: Record<string, boolean> = {}
    for (const id of ids) next[id] = true
    rowSelection.value = next
  },
})

function rowSearchValues(row: AdminTableRow): string[] {
  return Object.values(row).map(value => (typeof value === 'string' ? value : ''))
}

function parsePlatformList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw !== 'string' || !raw) return []
  return parsePlatformJson(raw)
}

function parsePlatformJson(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : [raw]
  } catch {
    return [raw]
  }
}

function platformsOf(row: AdminTableRow): string[] {
  return parsePlatformList(row.targetPlatforms)
}

function platformLabel(value: string): string {
  const words = value.replace(/[-_]/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function platformText(row: AdminTableRow): string {
  const labels = platformsOf(row).map(platformLabel)
  return labels.length > 0 ? labels.join(', ') : '—'
}

function statusTone(value: unknown): 'success' | 'error' | 'warning' | 'neutral' {
  return STATUS_COLORS[String(value)] ?? 'neutral'
}

function previewColumn(key: string): AdminColumnMeta | undefined {
  return columns.value.find(column => column.key === key)
}

function formatCell(key: string, row: AdminTableRow): string {
  const column = previewColumn(key)
  return column ? formatAdminCellValue(column, row[key]) : String(row[key] ?? '')
}

const previewColumns = computed(() =>
  POST_PREVIEW_KEYS
    .map(key => previewColumn(key))
    .filter((column): column is AdminColumnMeta => !!column),
)

const tableColumns = computed<CollectionTableColumn[]>(() =>
  previewColumns.value.map(column => ({
    key: column.key,
    label: column.label,
    hideBelow: HIDE_BELOW[column.key],
  })),
)

const subtitle = computed(() =>
  t('description', { total: pagination.value.total, plural: pagination.value.total === 1 ? '' : 's' }),
)

const statusOptions = computed(() => [
  { value: 'all', label: t('status.all') },
  { value: 'draft', label: t('status.draft') },
  { value: 'pending', label: t('status.pending') },
  { value: 'published', label: t('status.published') },
  { value: 'failed', label: t('status.failed') },
])

const platformOptions = computed(() => {
  const ids = new Set(rows.value.flatMap(row => platformsOf(row)))
  const options = [...ids]
    .sort((a, b) => platformLabel(a).localeCompare(platformLabel(b)))
    .map(id => ({ value: id, label: platformLabel(id) }))
  return [{ value: 'all', label: t('filters.allPlatforms') }, ...options]
})

const viewOptions = computed(() => [
  { value: 'table', label: t('views.table'), icon: 'i-lucide-table' },
  { value: 'list', label: t('views.list'), icon: 'i-lucide-list' },
])

const toolbarFilters = computed(() => [
  {
    key: 'status',
    label: t('filters.status'),
    value: filters.value.status || 'all',
    options: statusOptions.value,
    width: 'w-full sm:w-40',
  },
  {
    key: 'platform',
    label: t('filters.platform'),
    value: filters.value.platform || 'all',
    options: platformOptions.value,
    width: 'w-full sm:w-44',
  },
])

const currentPage = computed({
  get: () => pagination.value.page,
  set: page => setPage(page),
})

const detailRow = ref<AdminTableRow | null>(null)
const editRow = ref<AdminTableRow | null>(null)
const deleteTarget = ref<string[] | null>(null)
const saving = ref(false)
const deleting = ref(false)

function openDetail(row: AdminTableRow) {
  detailRow.value = row
}

function handleDetailOpen(open: boolean) {
  if (!open) detailRow.value = null
}

function openEdit(row: AdminTableRow) {
  editRow.value = row
}

function handleEditOpen(open: boolean) {
  if (!open) editRow.value = null
}

function editFromDetail() {
  const row = detailRow.value
  detailRow.value = null
  if (row) openEdit(row)
}

function deleteFromDetail() {
  const row = detailRow.value
  detailRow.value = null
  if (row) confirmDeleteRows([row._key])
}

function confirmDeleteRows(keys: string[]) {
  if (keys.length === 0) return
  deleteTarget.value = keys
}

function handleDeleteOpen(open: boolean) {
  if (!open) deleteTarget.value = null
}

function handleBulkDelete() {
  confirmDeleteRows(selectedKeys.value)
}

function menuItems(row: AdminTableRow) {
  return [
    { label: t('actions.view'), icon: 'i-lucide-eye', onSelect: () => openDetail(row) },
    { label: t('actions.edit'), icon: 'i-lucide-pencil', onSelect: () => openEdit(row) },
    {
      label: t('actions.delete'),
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect: () => confirmDeleteRows([row._key]),
    },
  ]
}

async function saveEdit(values: AdminFormValues) {
  const row = editRow.value
  if (!row) return
  saving.value = true
  const error = await updateRow(row._key, values)
  saving.value = false
  editRow.value = null
  if (error) {
    toast.add({ title: t('toasts.updateFailed'), description: error, color: 'error' })
    return
  }
  toast.add({ title: t('toasts.updated'), color: 'success' })
}

async function applyDelete() {
  const keys = deleteTarget.value ?? []
  deleteTarget.value = null
  if (keys.length === 0) return
  deleting.value = true
  const error = await deleteRows(keys)
  deleting.value = false
  if (error) {
    toast.add({ title: t('toasts.deleteFailed'), description: error, color: 'error' })
    return
  }
  toast.add({
    title: t('toasts.deleted', { count: keys.length, plural: keys.length === 1 ? '' : 's' }),
    color: 'success',
  })
}
</script>

<template>
  <BaseCollectionPage :title="t('title')" :description="subtitle">
    <template #actions>
      <UButton to="/app/admin/data/posts" variant="outline" icon="lucide:database" :label="t('rawTable')" />
      <UButton
        variant="outline"
        icon="lucide:refresh-cw"
        :loading="loading"
        :label="t('refresh')"
        @click="fetchRows"
      />
    </template>

    <template #toolbar>
      <BaseCollectionToolbar
        :search="search"
        :search-placeholder="t('searchPlaceholder')"
        :filters="toolbarFilters"
        :view="view"
        :views="viewOptions"
        :busy="loading"
        @update:search="setSearch"
        @update:filter="(key: string, value: string) => setFilter(key, value)"
        @update:view="setView"
      />
    </template>

    <UAlert
      v-if="loadError"
      color="error"
      variant="soft"
      icon="lucide:triangle-alert"
      :title="t('loadFailed')"
    >
      <template #actions>
        <UButton variant="outline" size="sm" :label="t('retry')" @click="fetchRows" />
      </template>
    </UAlert>

    <BaseDataTable
      v-else-if="view === 'table'"
      v-model:selected="selected"
      :rows="filtered"
      :columns="tableColumns"
      :row-key="rowKey"
      :loading="loading"
      selectable
      :empty-title="t('empty')"
      empty-icon="i-lucide-file-text"
    >
      <template #bulk>
        <span class="text-sm font-medium">{{ t('bulk.selected', { count: selected.length }) }}</span>
        <div class="ms-auto flex items-center gap-2">
          <UButton
            color="error"
            size="xs"
            icon="i-lucide-trash-2"
            :label="t('bulk.delete')"
            @click="handleBulkDelete"
          />
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            :label="t('bulk.clear')"
            @click="clearSelection"
          />
        </div>
      </template>

      <template #cell-content="{ row }">
        <span class="line-clamp-2 block max-w-80 text-sm">{{ formatCell('content', row) }}</span>
      </template>
      <template #cell-status="{ row }">
        <UBadge :color="statusTone(row.status)" variant="subtle" size="sm">{{ formatCell('status', row) }}</UBadge>
      </template>
      <template #cell-postFormat="{ row }">
        <span class="text-sm text-muted">{{ formatCell('postFormat', row) }}</span>
      </template>
      <template #cell-scheduledAt="{ row }">
        <span class="whitespace-nowrap text-sm text-muted">{{ formatCell('scheduledAt', row) }}</span>
      </template>
      <template #cell-publishedAt="{ row }">
        <span class="whitespace-nowrap text-sm text-muted">{{ formatCell('publishedAt', row) }}</span>
      </template>
      <template #cell-businessId="{ row }">
        <span class="block max-w-44 truncate text-xs text-muted">{{ formatCell('businessId', row) }}</span>
      </template>
      <template #cell-userId="{ row }">
        <span class="block max-w-44 truncate text-xs text-muted">{{ formatCell('userId', row) }}</span>
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

      <template #footer>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <p class="text-sm text-muted">
            {{ t('footer.selected', { selected: selected.length, total: pagination.total }) }}
          </p>
          <UPagination
            v-model="currentPage"
            :items-per-page="pagination.limit"
            :total="pagination.total"
          />
        </div>
      </template>
    </BaseDataTable>

    <BaseCollectionList
      v-else
      :items="filtered"
      :row-key="rowKey"
      :loading="loading"
      :empty-title="t('empty')"
      empty-icon="i-lucide-file-text"
    >
      <template #item="{ item: row }">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-elevated">
          <UIcon name="i-lucide-file-text" class="size-4" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-highlighted">{{ formatCell('content', row) }}</p>
          <p class="truncate text-xs text-muted">{{ platformText(row) }}</p>
        </div>
        <UBadge class="hidden shrink-0 sm:inline-flex" :color="statusTone(row.status)" variant="subtle" size="sm">
          {{ formatCell('status', row) }}
        </UBadge>
        <span class="hidden w-40 text-right text-xs text-muted lg:block">
          {{ formatCell('scheduledAt', row) }}
        </span>
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
    </BaseCollectionList>

    <AdminRowDetailModal
      :open="detailRow !== null"
      :table-label="t('tableLabel')"
      :columns="columns"
      :row="detailRow"
      @update:open="handleDetailOpen"
      @edit="editFromDetail"
      @remove="deleteFromDetail"
    />

    <AdminRowEditModal
      :open="editRow !== null"
      :table-label="t('tableLabel')"
      :columns="columns"
      :row="editRow"
      :saving="saving"
      @update:open="handleEditOpen"
      @save="saveEdit"
    />

    <AdminBulkDeleteModal
      :open="deleteTarget !== null"
      :table-label="t('tableLabel')"
      :count="deleteTarget?.length ?? 0"
      :busy="deleting"
      @update:open="handleDeleteOpen"
      @confirm="applyDelete"
    />
  </BaseCollectionPage>
</template>
