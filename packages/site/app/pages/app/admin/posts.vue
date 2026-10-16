<i18n src="./posts.json"></i18n>

<script lang="ts" setup>
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/vue-table'
import type { AdminColumnMeta } from '#layers/BaseDB/server/services/admin-data.service'
import { useAdminDataTable, type AdminTableRow } from '~/composables/useAdminDataTable'
import { formatAdminCellValue, type AdminFormValues } from '~/utils/admin-data'

definePageMeta({
  layout: 'dashboard-layout',
})

const { t } = useI18n()
const toast = useToast()

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UCheckbox = resolveComponent('UCheckbox')
const UDropdownMenu = resolveComponent('UDropdownMenu')

const {
  columns,
  rows,
  pagination,
  loading,
  loadError,
  searchInput,
  filters,
  rowSelection,
  selectedKeys,
  selectedCount,
  fetchRows,
  setFilter,
  setPage,
  getRowKey,
  clearSelection,
  updateRow,
  deleteRows,
} = useAdminDataTable('posts')

const POST_PREVIEW_KEYS = [
  'content',
  'status',
  'postFormat',
  'scheduledAt',
  'publishedAt',
  'businessId',
  'userId',
]

const previewColumns = computed(() =>
  POST_PREVIEW_KEYS
    .map(key => columns.value.find(column => column.key === key))
    .filter((column): column is AdminColumnMeta => !!column),
)

const STATUS_COLORS: Record<string, 'success' | 'error' | 'warning' | 'neutral'> = {
  published: 'success',
  failed: 'error',
  pending: 'warning',
}

const statusTabs = computed(() => [
  { label: t('status.all'), value: 'all' },
  { label: t('status.draft'), value: 'draft' },
  { label: t('status.pending'), value: 'pending' },
  { label: t('status.published'), value: 'published' },
  { label: t('status.failed'), value: 'failed' },
])

const activeStatus = ref('all')

function handleStatusTab(value: string | number) {
  const status = String(value)
  activeStatus.value = status
  setFilter('status', status === 'all' ? '' : status)
}

function renderContentCell(column: AdminColumnMeta, row: AdminTableRow) {
  return h('span', { class: 'line-clamp-2 block max-w-[320px] text-sm' }, formatAdminCellValue(column, row[column.key]))
}

function renderEnumCell(value: unknown, text: string) {
  return h(UBadge, { color: STATUS_COLORS[String(value)] ?? 'neutral', variant: 'subtle', size: 'sm' }, () => text)
}

function renderValueCell(column: AdminColumnMeta, row: AdminTableRow) {
  const text = formatAdminCellValue(column, row[column.key])
  if (column.type === 'enum') return renderEnumCell(row[column.key], text)
  return h('span', { class: 'block max-w-[220px] truncate text-sm' }, text)
}

interface RowActionItem {
  type?: 'label' | 'separator'
  label?: string
  icon?: string
  color?: 'error'
  onSelect?: () => void
}

function getRowItems(row: Row<AdminTableRow>): RowActionItem[] {
  return [
    { type: 'label', label: t('actions.label') },
    { label: t('actions.view'), icon: 'i-lucide-eye', onSelect: () => openDetail(row.original) },
    { label: t('actions.edit'), icon: 'i-lucide-pencil', onSelect: () => openEdit(row.original) },
    { type: 'separator' },
    { label: t('actions.delete'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => confirmDeleteRows([row.original._key]) },
  ]
}

const tableColumns = computed<TableColumn<AdminTableRow>[]>(() => {
  const selectionColumn: TableColumn<AdminTableRow> = {
    id: 'select',
    header: ({ table }) =>
      h(UCheckbox, {
        modelValue: table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
          table.toggleAllPageRowsSelected(!!value),
        'aria-label': t('a11y.selectAll'),
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        'aria-label': t('a11y.selectRow'),
      }),
  }

  const valueColumns = previewColumns.value.map(column => ({
    id: column.key,
    header: column.label,
    cell: ({ row }: { row: Row<AdminTableRow> }) =>
      column.key === 'content' ? renderContentCell(column, row.original) : renderValueCell(column, row.original),
  })) as TableColumn<AdminTableRow>[]

  const actionsColumn: TableColumn<AdminTableRow> = {
    id: 'actions',
    header: () => h('div', { class: 'text-right' }, t('actions.label')),
    cell: ({ row }) =>
      h('div', { class: 'text-right' }, [
        h(
          UDropdownMenu,
          { content: { align: 'end' }, items: getRowItems(row), 'aria-label': t('a11y.actions') },
          () => h(UButton, { variant: 'ghost', icon: 'i-lucide-ellipsis-vertical', size: 'sm' }),
        ),
      ]),
  }

  return [selectionColumn, ...valueColumns, actionsColumn]
})

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
  <UContainer class="space-y-6 py-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('title') }}</h1>
        <p class="text-muted-foreground">
          {{ t('description', { total: pagination.total, plural: pagination.total === 1 ? '' : 's' }) }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton to="/app/admin/data/posts" variant="outline" icon="lucide:database">
          {{ t('rawTable') }}
        </UButton>
        <UButton
          variant="outline"
          icon="lucide:refresh-cw"
          :loading="loading"
          @click="fetchRows"
        >
          {{ t('refresh') }}
        </UButton>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <UTabs
        :model-value="activeStatus"
        :items="statusTabs"
        @update:model-value="handleStatusTab"
      />
      <UInput
        v-model="searchInput"
        icon="lucide:search"
        :placeholder="t('searchPlaceholder')"
        class="max-w-sm"
      />
    </div>

    <UAlert
      v-if="loadError"
      color="error"
      variant="soft"
      icon="lucide:triangle-alert"
      :title="t('loadFailed')"
    >
      <template #actions>
        <UButton variant="outline" size="sm" @click="fetchRows">
          {{ t('retry') }}
        </UButton>
      </template>
    </UAlert>

    <UCard v-else variant="soft">
      <UTable
        v-model:row-selection="rowSelection"
        :data="rows"
        :columns="tableColumns"
        :loading="loading"
        :get-row-id="getRowKey"
        :empty="t('empty')"
      />
      <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p class="text-sm text-muted-foreground">
          {{ t('footer.selected', { selected: selectedCount, total: pagination.total }) }}
        </p>
        <UPagination
          v-model="currentPage"
          :items-per-page="pagination.limit"
          :total="pagination.total"
        />
      </div>
    </UCard>

    <div
      v-if="selectedCount > 0"
      v-motion-slide-bottom
      :duration="200"
      class="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-inverted px-4 py-3 text-inverted shadow-lg"
    >
      <p class="text-sm font-medium">{{ t('bulk.selected', { count: selectedCount }) }}</p>
      <div class="flex items-center gap-2">
        <UButton color="error" size="sm" @click="handleBulkDelete">
          <UIcon name="lucide:trash-2" class="mr-2 h-4 w-4" />
          {{ t('bulk.delete') }}
        </UButton>
        <UButton variant="ghost" size="sm" color="neutral" @click="clearSelection">
          {{ t('bulk.clear') }}
        </UButton>
      </div>
    </div>

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
  </UContainer>
</template>
