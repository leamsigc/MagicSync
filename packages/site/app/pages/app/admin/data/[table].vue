<i18n src="./[table].json"></i18n>

<script lang="ts" setup>
/**
 * Generic admin table browser — one page for every registry table.
 *
 * Columns come from the admin registry, so they are mapped to
 * `CollectionTableColumn` descriptors and each value renders through a dynamic
 * `#cell-<key>` slot (booleans/enums become badges). Search + enum filters go
 * to the server through `useAdminDataTable`; selection stays key-based
 * (`_key`) so bulk delete keeps working across pagination.
 */
import type { CollectionTableColumn } from '#layers/BaseUI/app/utils/collection'
import type { AdminColumnMeta } from '#layers/BaseDB/server/services/admin-data.service'
import { useAdminDataTable, type AdminTableRow } from '~/composables/useAdminDataTable'
import { formatAdminCellValue, type AdminFormValues } from '~/utils/admin-data'

definePageMeta({
  layout: 'dashboard-layout',
})

type BadgeTone = 'success' | 'error' | 'warning' | 'neutral'

/** Nuxt UI forbids empty-string SelectItem values, so "All" uses a sentinel. */
const FILTER_ALL_VALUE = '__all__'

/** Extra registry columns fold away on narrow screens, keeping the pk visible. */
const HIDE_BELOW: Array<CollectionTableColumn['hideBelow']> = ['lg', 'lg', 'xl', 'xl']

const STATUS_TONES: Record<string, BadgeTone> = {
  published: 'success',
  failed: 'error',
  pending: 'warning',
  active: 'success',
  banned: 'error',
}

const route = useRoute()
const { t } = useI18n()
const toast = useToast()

const tableKey = computed(() => String(route.params.table ?? ''))
const {
  table: tableInfo,
  columns: registryColumns,
  rows,
  pagination,
  loading,
  loadError,
  searchInput,
  rowSelection,
  selectedKeys,
  selectedCount,
  fetchRows,
  setFilter: setServerFilter,
  setPage,
  clearSelection,
  updateRow,
  deleteRows,
} = useAdminDataTable(tableKey)

const {
  search,
  setSearch,
  filters,
  setFilter,
  filtered,
} = useCollectionView<AdminTableRow>({
  key: 'admin-data',
  modes: ['table'],
  rows,
  searchFields: row => Object.values(row).map(value => String(value ?? '')),
})

/** Server owns search on this page; mirror the toolbar term into the fetcher. */
watch(search, value => {
  searchInput.value = value
})

/** Switching tables inside the same route component must not keep the old term. */
watch(tableKey, () => {
  setSearch('')
})

const tableLabel = computed(() => tableInfo.value?.label ?? tableKey.value)
const editableCount = computed(() => registryColumns.value.filter(column => column.editable).length)
const enumColumns = computed(() =>
  registryColumns.value.filter(column => column.type === 'enum' && (column.enumValues?.length ?? 0) > 0),
)

const previewColumns = computed(() => {
  const pkColumns = registryColumns.value.filter(column => column.pk)
  const sampleColumns = registryColumns.value.filter(column => !column.pk && column.type !== 'json').slice(0, 4)
  return [...pkColumns, ...sampleColumns]
})

const columns = computed<CollectionTableColumn[]>(() =>
  previewColumns.value.map((column, index) => ({
    key: column.key,
    label: column.label,
    hideBelow: HIDE_BELOW[index],
  })),
)

const toolbarFilters = computed(() =>
  enumColumns.value.map(column => ({
    key: column.key,
    label: column.label,
    value: filters.value[column.key] || FILTER_ALL_VALUE,
    options: filterItems(column),
    width: 'w-full sm:w-44',
  })),
)

/** Registry selection is keyed by `_key`; the table speaks `string[]`. */
const selectedModel = computed<string[]>({
  get: () => selectedKeys.value,
  set: keys => {
    rowSelection.value = Object.fromEntries(keys.map(key => [key, true]))
  },
})

const currentPage = computed({
  get: () => pagination.value.page,
  set: page => setPage(page),
})

function filterItems(column: AdminColumnMeta) {
  return [
    { label: t('all'), value: FILTER_ALL_VALUE },
    ...(column.enumValues ?? []).map(value => ({ label: value, value })),
  ]
}

function rowKey(row: Record<string, any>): string {
  return String(row._key)
}

function statusTone(value: unknown): BadgeTone {
  return STATUS_TONES[String(value)] ?? 'neutral'
}

function handleFilter(key: string, value: string) {
  const isAll = value === FILTER_ALL_VALUE
  setFilter(key, isAll ? 'all' : value)
  setServerFilter(key, isAll ? '' : value)
}

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

interface RowActionItem {
  type?: 'label' | 'separator'
  label?: string
  icon?: string
  color?: 'error'
  onSelect?: () => void
}

function menuItems(row: AdminTableRow): RowActionItem[] {
  const items: RowActionItem[] = [
    { type: 'label', label: t('actions.label') },
    { label: t('actions.view'), icon: 'i-lucide-eye', onSelect: () => openDetail(row) },
  ]
  if (editableCount.value > 0) {
    items.push({ label: t('actions.edit'), icon: 'i-lucide-pencil', onSelect: () => openEdit(row) })
  }
  items.push(
    { type: 'separator' },
    { label: t('actions.delete'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => confirmDeleteRows([row._key]) },
  )
  return items
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
  <BaseCollectionPage
    :title="tableLabel"
    :description="t('description', { total: pagination.total, plural: pagination.total === 1 ? '' : 's' })"
    back-to="/app/admin/data"
  >
    <template #actions>
      <UButton variant="outline" icon="i-lucide-refresh-cw" :loading="loading" @click="fetchRows">
        {{ t('refresh') }}
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

    <UAlert
      v-if="loadError"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      :title="t('loadFailed')"
    >
      <template #actions>
        <UButton variant="outline" size="sm" @click="fetchRows">
          {{ t('retry') }}
        </UButton>
      </template>
    </UAlert>

    <BaseDataTable
      v-else
      v-model:selected="selectedModel"
      :rows="filtered"
      :columns="columns"
      :row-key="rowKey"
      :loading="loading"
      :selectable="true"
      :empty-title="t('empty')"
      empty-icon="i-lucide-table"
      min-width="56rem"
    >
      <template
        v-for="column in previewColumns"
        :key="column.key"
        #[`cell-${column.key}`]="{ row }"
      >
        <UBadge
          v-if="column.type === 'boolean'"
          :color="row[column.key] ? 'success' : 'neutral'"
          variant="subtle"
          size="sm"
        >
          {{ formatAdminCellValue(column, row[column.key]) }}
        </UBadge>
        <UBadge v-else-if="column.type === 'enum'" :color="statusTone(row[column.key])" variant="subtle" size="sm">
          {{ formatAdminCellValue(column, row[column.key]) }}
        </UBadge>
        <span v-else class="block max-w-[260px] truncate text-sm">
          {{ formatAdminCellValue(column, row[column.key]) }}
        </span>
      </template>

      <template #bulk>
        <p class="text-sm font-medium">{{ t('bulk.selected', { count: selectedCount }) }}</p>
        <div class="ms-auto flex items-center gap-2">
          <UButton color="error" size="xs" icon="i-lucide-trash-2" @click="handleBulkDelete">
            {{ t('bulk.delete') }}
          </UButton>
          <UButton variant="ghost" color="neutral" size="xs" @click="clearSelection">
            {{ t('bulk.clear') }}
          </UButton>
        </div>
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
        <div class="flex flex-wrap items-center justify-between gap-3 px-1 py-3">
          <p class="text-sm text-muted">
            {{ t('footer.selected', { selected: selectedCount, total: pagination.total }) }}
          </p>
          <UPagination
            v-model="currentPage"
            :items-per-page="pagination.limit"
            :total="pagination.total"
          />
        </div>
      </template>
    </BaseDataTable>

    <AdminRowDetailModal
      :open="detailRow !== null"
      :table-label="tableLabel"
      :columns="registryColumns"
      :row="detailRow"
      @update:open="handleDetailOpen"
      @edit="editFromDetail"
      @remove="deleteFromDetail"
    />

    <AdminRowEditModal
      :open="editRow !== null"
      :table-label="tableLabel"
      :columns="registryColumns"
      :row="editRow"
      :saving="saving"
      @update:open="handleEditOpen"
      @save="saveEdit"
    />

    <AdminBulkDeleteModal
      :open="deleteTarget !== null"
      :table-label="tableLabel"
      :count="deleteTarget?.length ?? 0"
      :busy="deleting"
      @update:open="handleDeleteOpen"
      @confirm="applyDelete"
    />
  </BaseCollectionPage>
</template>
