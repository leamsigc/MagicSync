<i18n src="./feedbacks.json"></i18n>

<script lang="ts" setup>
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/vue-table'

definePageMeta({
  layout: 'dashboard-layout'
})

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')

const { t } = useI18n()
const toast = useToast()

interface AdminFeedback {
  id: string
  userId: string
  userName: string | null
  category: string
  message: string
  status: 'new' | 'reviewed' | 'resolved'
  adminNote: string | null
  createdAt: string
}

const feedbacks = ref<AdminFeedback[]>([])
const loading = ref(true)
const saving = ref(false)
const searchQuery = ref('')
const statusFilter = ref<'all' | AdminFeedback['status']>('all')

const filteredFeedbacks = computed(() => {
  const byStatus = statusFilter.value === 'all'
    ? feedbacks.value
    : feedbacks.value.filter(f => f.status === statusFilter.value)
  if (!searchQuery.value) return byStatus
  const q = searchQuery.value.toLowerCase()
  return byStatus.filter(f =>
    f.message.toLowerCase().includes(q) ||
    f.userName?.toLowerCase().includes(q) ||
    f.category.toLowerCase().includes(q)
  )
})

async function fetchFeedbacks() {
  loading.value = true
  try {
    const data = await $fetch<{ feedbacks: AdminFeedback[] }>('/api/v1/admin/feedbacks')
    feedbacks.value = data.feedbacks
  } catch {
    toast.add({ title: t('toast.error'), description: t('toast.loadFailed'), color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(fetchFeedbacks)

function statusColor(status: AdminFeedback['status']): 'error' | 'info' | 'success' {
  if (status === 'new') return 'error'
  if (status === 'reviewed') return 'info'
  return 'success'
}

function categoryColor(category: string): 'warning' | 'primary' | 'success' | 'neutral' {
  if (category === 'bug') return 'warning'
  if (category === 'feature') return 'primary'
  if (category === 'praise') return 'success'
  return 'neutral'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

function truncate(message: string): string {
  if (message.length <= 90) return message
  return `${message.slice(0, 90)}…`
}

function statusOptions() {
  return [
    { label: t('status.new'), value: 'new' },
    { label: t('status.reviewed'), value: 'reviewed' },
    { label: t('status.resolved'), value: 'resolved' }
  ]
}

function filterOptions() {
  return [
    { label: t('filters.all'), value: 'all' },
    ...statusOptions()
  ]
}

const selectedFeedback = ref<AdminFeedback | null>(null)
const detailForm = ref({ status: 'new' as AdminFeedback['status'], adminNote: '' })

function openDetail(fb: AdminFeedback) {
  selectedFeedback.value = fb
  detailForm.value = { status: fb.status, adminNote: fb.adminNote || '' }
}

function closeDetail() {
  selectedFeedback.value = null
}

function handleDetailOpenChange(open: boolean) {
  if (!open) closeDetail()
}

function patchFeedback(id: string, patch: Partial<AdminFeedback>) {
  const index = feedbacks.value.findIndex(item => item.id === id)
  if (index !== -1) {
    feedbacks.value[index] = { ...feedbacks.value[index], ...patch }
  }
}

async function saveDetail() {
  if (!selectedFeedback.value) return
  const target = selectedFeedback.value
  const prev = { status: target.status, adminNote: target.adminNote }
  const next = { status: detailForm.value.status, adminNote: detailForm.value.adminNote.trim() || null }
  patchFeedback(target.id, next)
  saving.value = true
  try {
    await $fetch(`/api/v1/admin/feedbacks/${target.id}`, { method: 'PUT', body: next })
    toast.add({ title: t('toast.updated'), description: t('toast.updatedDescription'), color: 'success' })
    closeDetail()
  } catch {
    patchFeedback(target.id, prev)
    toast.add({ title: t('toast.error'), description: t('toast.updateFailed'), color: 'error' })
  } finally {
    saving.value = false
  }
}

const pendingDelete = ref<AdminFeedback | null>(null)

function askDelete(fb: AdminFeedback) {
  pendingDelete.value = fb
}

function closeDeleteModal() {
  pendingDelete.value = null
}

function handleDeleteOpenChange(open: boolean) {
  if (!open) closeDeleteModal()
}

async function confirmDelete() {
  const target = pendingDelete.value
  if (!target) return
  const snapshot = [...feedbacks.value]
  feedbacks.value = feedbacks.value.filter(f => f.id !== target.id)
  pendingDelete.value = null
  if (selectedFeedback.value?.id === target.id) {
    selectedFeedback.value = null
  }
  try {
    await $fetch(`/api/v1/admin/feedbacks/${target.id}`, { method: 'DELETE' })
    toast.add({ title: t('toast.deleted'), description: t('toast.deletedDescription'), color: 'success' })
  } catch {
    feedbacks.value = snapshot
    toast.add({ title: t('toast.error'), description: t('toast.deleteFailed'), color: 'error' })
  }
}

function getRowItems(row: Row<AdminFeedback>) {
  return [
    { type: 'label', label: t('menu.title') },
    { label: t('menu.view'), onSelect: () => openDetail(row.original) },
    { type: 'separator' },
    { label: t('menu.delete'), onSelect: () => askDelete(row.original) }
  ]
}

function getRowId(row: AdminFeedback) {
  return row.id
}

const columns: TableColumn<AdminFeedback>[] = [
  {
    accessorKey: 'message',
    header: () => t('columns.feedback'),
    cell: ({ row }) => {
      const fb = row.original
      return h('div', { class: 'max-w-md' }, [
        h('p', { class: 'text-sm' }, truncate(fb.message)),
        h('p', { class: 'text-xs text-muted-foreground' }, `${fb.userName || t('unknownUser')} · ${formatDate(fb.createdAt)}`)
      ])
    }
  },
  {
    accessorKey: 'category',
    header: () => t('columns.category'),
    cell: ({ row }) =>
      h(UBadge, { color: categoryColor(row.original.category), variant: 'subtle', size: 'sm' }, () =>
        t(`categories.${row.original.category}`)
      )
  },
  {
    accessorKey: 'status',
    header: () => t('columns.status'),
    cell: ({ row }) =>
      h(UBadge, { color: statusColor(row.original.status), variant: 'subtle', size: 'sm' }, () =>
        t(`status.${row.original.status}`)
      )
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'text-right' }, t('columns.actions')),
    cell: ({ row }) =>
      h('div', { class: 'text-right' }, [
        h(UDropdownMenu, {
          content: { align: 'end' },
          items: getRowItems(row),
          'aria-label': t('a11y.actions')
        }, () =>
          h(UButton, {
            icon: 'i-lucide-ellipsis-vertical',
            color: 'neutral',
            variant: 'ghost',
            size: 'sm',
            'aria-label': t('a11y.actions')
          })
        )
      ])
  }
]
</script>

<template>
  <div class="space-y-6">
    <div v-motion-fade-visible-once class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('title') }}</h1>
        <p class="text-muted-foreground">{{ t('description') }}</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-2">
        <USelect v-model="statusFilter" :items="filterOptions()" size="sm" class="sm:w-44" />
        <UInput v-model="searchQuery" :placeholder="t('searchPlaceholder')" icon="i-heroicons-magnifying-glass"
          size="sm" class="sm:w-64" />
      </div>
    </div>

    <div v-if="loading" class="rounded flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-muted-foreground" />
    </div>

    <div v-else v-motion-fade-visible-once class="shadow rounded overflow-hidden">
      <div v-if="filteredFeedbacks.length === 0" class="text-center py-12 text-muted-foreground">
        {{ t('noFeedback') }}
      </div>
      <UTable v-else :data="filteredFeedbacks" :columns="columns" :get-row-id="getRowId" class="flex-1"
        :ui="{ 'tr': 'bg-transparent transition-colors', 'td': 'border-0', 'th': 'border-0' }" />
    </div>

    <UModal :open="selectedFeedback !== null" @update:open="handleDetailOpenChange">
      <template #content>
        <UCard v-if="selectedFeedback">
          <template #header>
            <h3 class="text-lg font-semibold">{{ t('detail.title') }}</h3>
            <p class="text-sm text-muted-foreground">
              {{ selectedFeedback.userName || t('unknownUser') }} · {{ formatDate(selectedFeedback.createdAt) }}
            </p>
          </template>
          <div class="space-y-4">
            <div class="flex gap-2">
              <UBadge :color="categoryColor(selectedFeedback.category)" variant="subtle">
                {{ t(`categories.${selectedFeedback.category}`) }}
              </UBadge>
              <UBadge :color="statusColor(selectedFeedback.status)" variant="subtle">
                {{ t(`status.${selectedFeedback.status}`) }}
              </UBadge>
            </div>
            <p class="text-sm whitespace-pre-wrap">{{ selectedFeedback.message }}</p>
            <UFormField :label="t('detail.status')">
              <USelect v-model="detailForm.status" :items="statusOptions()" class="w-full" />
            </UFormField>
            <UFormField :label="t('detail.adminNote')">
              <UTextarea v-model="detailForm.adminNote" :placeholder="t('detail.adminNotePlaceholder')" :rows="3"
                class="w-full" />
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-between gap-3">
              <UButton color="error" variant="outline" @click="askDelete(selectedFeedback)">
                {{ t('detail.delete') }}
              </UButton>
              <div class="flex gap-3">
                <UButton variant="ghost" color="neutral" @click="closeDetail">{{ t('detail.cancel') }}</UButton>
                <UButton color="primary" :loading="saving" @click="saveDetail">{{ t('detail.save') }}</UButton>
              </div>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal :open="pendingDelete !== null" @update:open="handleDeleteOpenChange">
      <template #content>
        <UCard v-if="pendingDelete">
          <template #header>
            <h3 class="text-lg font-semibold">{{ t('deleteModal.title') }}</h3>
          </template>
          <p class="text-sm text-muted-foreground">{{ t('deleteModal.description') }}</p>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="neutral" @click="closeDeleteModal">{{ t('deleteModal.cancel') }}
              </UButton>
              <UButton color="error" @click="confirmDelete">{{ t('deleteModal.confirm') }}</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
