<script lang="ts" setup>
import { h, resolveComponent, useTemplateRef } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/vue-table'

definePageMeta({
  layout: 'dashboard-layout'
})

const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UCheckbox = resolveComponent('UCheckbox')
const UButton = resolveComponent('UButton')

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

const logs = ref<AuditEntry[]>([])
const loading = ref(true)
const selectedLog = ref<AuditEntry | null>(null)
const rowSelection = ref<Record<string, boolean>>({})

const table = useTemplateRef('table')

const showDetail = computed({
  get: () => !!selectedLog.value,
  set: (val) => { if (!val) selectedLog.value = null }
})

const statusColor: Record<string, 'success' | 'error' | 'warning' | 'neutral'> = {
  success: 'success',
  failure: 'error',
  pending: 'warning'
}

async function fetchLogs() {
  loading.value = true
  try {
    const data = await $fetch<{ logs: AuditEntry[] }>('/api/v1/admin/audit-log')
    logs.value = data.logs
  } catch {
    toast.add({ title: 'Error', description: 'Failed to load audit log', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(fetchLogs)

async function deleteLog(log: AuditEntry) {
  try {
    await $fetch(`/api/v1/admin/audit-log/${log.id}`, { method: 'DELETE' })
    toast.add({ title: 'Log Deleted', description: `Audit log entry #${log.id} has been deleted`, color: 'success' })
    await fetchLogs()
  } catch {
    toast.add({ title: 'Error', description: 'Failed to delete log', color: 'error' })
  }
}

function confirmDelete(log: AuditEntry) {
  toast.add({
    title: 'Delete Log',
    description: `Are you sure you want to delete audit log entry #${log.id}?`,
    color: 'error',
    actions: [
      { label: 'Delete', color: 'error', variant: 'solid', onClick: () => deleteLog(log) },
      { label: 'Cancel', color: 'neutral', variant: 'outline' }
    ]
  })
}

async function deleteSelected() {
  const selectedRows = table.value?.tableApi?.getFilteredSelectedRowModel().rows || []
  if (selectedRows.length === 0) return
  const ids = selectedRows.map(row => row.original.id)
  try {
    await $fetch('/api/v1/admin/audit-log', { method: 'DELETE', body: { ids } })
    toast.add({ title: 'Logs Deleted', description: `${ids.length} audit log entries deleted`, color: 'success' })
    rowSelection.value = {}
    await fetchLogs()
  } catch {
    toast.add({ title: 'Error', description: 'Failed to delete selected logs', color: 'error' })
  }
}

async function deleteAll() {
  if (logs.value.length === 0) return
  toast.add({
    title: 'Delete All Logs',
    description: `Are you sure you want to delete all ${logs.value.length} audit log entries? This cannot be undone.`,
    color: 'error',
    actions: [
      {
        label: 'Delete All',
        color: 'error',
        variant: 'solid',
        onClick: async () => {
          try {
            await $fetch('/api/v1/admin/audit-log', { method: 'DELETE', body: { all: true } })
            toast.add({ title: 'Logs Deleted', description: 'All audit log entries deleted', color: 'success' })
            rowSelection.value = {}
            await fetchLogs()
          } catch {
            toast.add({ title: 'Error', description: 'Failed to delete all logs', color: 'error' })
          }
        }
      },
      { label: 'Cancel', color: 'neutral', variant: 'outline' }
    ]
  })
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function openDetail(log: AuditEntry) {
  selectedLog.value = log
}

function getRowItems(row: Row<AuditEntry>) {
  return [
    { type: 'label', label: 'Actions' },
    { label: 'View details', onSelect: () => openDetail(row.original) },
    { type: 'separator' },
    { label: 'Delete', onSelect: () => confirmDelete(row.original) }
  ]
}

const columns: TableColumn<AuditEntry>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h(UCheckbox, {
        modelValue: table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
          table.toggleAllPageRowsSelected(!!value),
        'aria-label': 'Select all'
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        'aria-label': 'Select row'
      })
  },
  {
    accessorKey: 'createdAt',
    header: 'Time',
    cell: ({ row }) => h('span', { class: 'text-xs text-muted-foreground' }, formatDate(row.original.createdAt))
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => h('span', { class: 'text-xs font-mono' }, row.original.category)
  },
  {
    accessorKey: 'action',
    header: 'Action',
    cell: ({ row }) => h('span', { class: 'text-sm' }, row.original.action)
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) =>
      h(UBadge, { color: statusColor[row.original.status || ''] || 'neutral', variant: 'subtle', size: 'sm' }, () =>
        row.original.status
      )
  },
  {
    accessorKey: 'details',
    header: 'Details',
    cell: ({ row }) =>
      h('span', { class: 'text-xs text-muted-foreground truncate block max-w-[220px]' }, row.original.details)
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'text-right' }, 'Actions'),
    cell: ({ row }) =>
      h('div', { class: 'text-right' }, [
        h(UDropdownMenu, {
          content: { align: 'end' },
          items: getRowItems(row),
          'aria-label': 'Actions dropdown'
        }, () =>
          h(UButton, {
            icon: 'i-lucide-ellipsis-vertical',
            color: 'neutral',
            variant: 'ghost',
            size: 'sm',
            'aria-label': 'Actions dropdown'
          })
        )
      ])
  }
]
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p class="text-muted-foreground">Review system activity and events</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton v-if="(table?.tableApi?.getFilteredSelectedRowModel().rows.length || 0) > 0" color="error"
          variant="outline" size="sm" icon="i-lucide-trash-2" @click="deleteSelected">
          Delete Selected
        </UButton>
        <UButton v-if="logs.length > 0" color="error" variant="ghost" size="sm" icon="i-lucide-trash-2"
          @click="deleteAll">
          Delete All
        </UButton>
        <UButton color="neutral" variant="ghost" size="sm" icon="i-heroicons-arrow-path" @click="fetchLogs">
          Refresh
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="rounded flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-muted-foreground" />
    </div>

    <div v-else-if="logs.length === 0" class="rounded text-center py-12 text-muted-foreground">
      No log entries found
    </div>

    <div v-else class="rounded overflow-hidden">
      <UTable ref="table" v-model:row-selection="rowSelection" :data="logs" :columns="columns" class="flex-1"
        :ui="{ 'tr': 'bg-transparent', 'td': 'border-0', 'th': 'border-0' }" />

      <div class="px-5 py-4  text-sm text-muted flex items-center justify-between">
        <span>
          {{ table?.tableApi?.getFilteredSelectedRowModel().rows.length || 0 }} of
          {{ table?.tableApi?.getFilteredRowModel().rows.length || 0 }} row(s) selected.
        </span>
      </div>
    </div>

    <UModal v-model:open="showDetail" :ui="{ content: 'md:min-w-[900px]' }">
      <template #content>
        <UCard v-if="selectedLog">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">Log Details</h3>
              <UButton variant="ghost" color="neutral" icon="i-heroicons-x-mark"
                @click="() => { selectedLog = null }" />
            </div>
          </template>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between">
              <dt class="text-muted-foreground">ID</dt>
              <dd class="font-mono">{{ selectedLog.id }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Category</dt>
              <dd>{{ selectedLog.category }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Action</dt>
              <dd>{{ selectedLog.action }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Status</dt>
              <dd>
                <UBadge :color="statusColor[selectedLog.status || ''] || 'neutral'" variant="subtle" size="sm">
                  {{ selectedLog.status }}
                </UBadge>
              </dd>
            </div>
            <div v-if="selectedLog.targetType" class="flex justify-between">
              <dt class="text-muted-foreground">Target</dt>
              <dd class="font-mono text-xs break-all">
                {{ selectedLog.targetType }}:
                {{ selectedLog.targetId }}
              </dd>
            </div>
            <div v-if="selectedLog.userId" class="flex justify-between">
              <dt class="text-muted-foreground">User ID</dt>
              <dd class="font-mono text-xs">{{ selectedLog.userId }}</dd>
            </div>
            <div v-if="selectedLog.details" class="pt-2">
              <dt class="text-muted-foreground mb-1">Details</dt>
              <dd class="bg-muted p-3 rounded-lg text-xs font-mono whitespace-pre-wrap">{{ selectedLog.details }}</dd>
            </div>
            <div v-if="selectedLog.ipAddress" class="flex justify-between">
              <dt class="text-muted-foreground">IP Address</dt>
              <dd class="font-mono text-xs">{{ selectedLog.ipAddress }}</dd>
            </div>
          </dl>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
