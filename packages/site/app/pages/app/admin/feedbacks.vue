<i18n src="./feedbacks.json"></i18n>

<script lang="ts" setup>
/**
 * Admin feedback inbox — table and list views on the shared collection shell.
 *
 * `useCollectionView` owns search + status, both views read from the same
 * `filtered` list, and the detail/delete modals keep their original API calls.
 */
import type { CollectionTableColumn } from '#layers/BaseUI/app/utils/collection'

definePageMeta({
  layout: 'dashboard-layout'
})

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

const {
  view,
  setView,
  search,
  setSearch,
  filters,
  setFilter,
  filtered,
  hasActiveFilters,
  resetFilters,
} = useCollectionView<AdminFeedback>({
  key: 'admin-feedbacks',
  modes: ['table', 'list'],
  defaultView: 'table',
  rows: feedbacks,
  searchFields: item => [item.message, item.userName, item.category, item.status],
  filterFns: {
    status: (item, value) => item.status === value,
  },
})

const viewOptions = computed(() => [
  { value: 'table', label: t('views.table'), icon: 'i-lucide-table' },
  { value: 'list', label: t('views.list'), icon: 'i-lucide-list' },
])

const toolbarFilters = computed(() => [
  {
    key: 'status',
    label: t('columns.status'),
    value: filters.value.status || 'all',
    options: filterOptions(),
    width: 'w-full sm:w-44',
  },
])

const columns = computed<CollectionTableColumn[]>(() => [
  { key: 'message', label: t('columns.feedback') },
  { key: 'category', label: t('columns.category'), hideBelow: 'sm', width: '10rem' },
  { key: 'status', label: t('columns.status'), width: '9rem' },
])

function filterOptions() {
  return [
    { label: t('filters.all'), value: 'all' },
    ...statusOptions()
  ]
}

function statusOptions() {
  return [
    { label: t('status.new'), value: 'new' },
    { label: t('status.reviewed'), value: 'reviewed' },
    { label: t('status.resolved'), value: 'resolved' }
  ]
}

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

function handleFilter(key: string, value: string) {
  setFilter(key, value)
}

function handleView(next: string) {
  setView(next)
}

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

function feedbackId(item: Record<string, any>): string {
  return String(item.id)
}

const selectedFeedback = ref<AdminFeedback | null>(null)
const detailForm = ref({ status: 'new' as AdminFeedback['status'], adminNote: '' })

function openDetail(feedback: AdminFeedback) {
  selectedFeedback.value = feedback
  detailForm.value = { status: feedback.status, adminNote: feedback.adminNote || '' }
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

function askDelete(feedback: AdminFeedback) {
  pendingDelete.value = feedback
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
  feedbacks.value = feedbacks.value.filter(item => item.id !== target.id)
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

function menuItems(feedback: AdminFeedback) {
  return [
    [
      { label: t('menu.view'), icon: 'i-lucide-eye', onSelect: () => openDetail(feedback) },
    ],
    [
      { label: t('menu.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => askDelete(feedback) },
    ],
  ]
}
</script>

<template>
  <BaseCollectionPage :title="t('title')" :description="t('description')">
    <template #toolbar>
      <BaseCollectionToolbar
        :search="search"
        :search-placeholder="t('searchPlaceholder')"
        :filters="toolbarFilters"
        :view="view"
        :views="viewOptions"
        :busy="loading"
        @update:search="setSearch"
        @update:filter="handleFilter"
        @update:view="handleView"
      />
    </template>

    <BaseCollectionList
      v-if="view === 'list'"
      :items="filtered"
      :row-key="feedbackId"
      :loading="loading"
      :empty-icon="'i-lucide-message-square'"
      :empty-title="t('noFeedback')"
    >
      <template #item="{ item: feedback }">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-highlighted">{{ truncate(feedback.message) }}</p>
          <p class="truncate text-xs text-muted">
            {{ feedback.userName || t('unknownUser') }} · {{ formatDate(feedback.createdAt) }}
          </p>
        </div>
        <UBadge class="hidden shrink-0 sm:inline-flex" :color="categoryColor(feedback.category)" variant="subtle" size="sm">
          {{ t(`categories.${feedback.category}`) }}
        </UBadge>
        <UBadge class="shrink-0" :color="statusColor(feedback.status)" variant="subtle" size="sm">
          {{ t(`status.${feedback.status}`) }}
        </UBadge>
        <UDropdownMenu :items="menuItems(feedback)" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="t('a11y.actions')"
          />
        </UDropdownMenu>
      </template>

      <template #empty>
        <UButton v-if="hasActiveFilters" variant="ghost" @click="resetFilters">{{ t('clearFilters') }}</UButton>
      </template>
    </BaseCollectionList>

    <BaseDataTable
      v-else
      :rows="filtered"
      :columns="columns"
      :row-key="feedbackId"
      :loading="loading"
    >
      <template #cell-message="{ row }">
        <div class="max-w-md">
          <p class="text-sm">{{ truncate(row.message) }}</p>
          <p class="text-xs text-muted">
            {{ row.userName || t('unknownUser') }} · {{ formatDate(row.createdAt) }}
          </p>
        </div>
      </template>

      <template #cell-category="{ row }">
        <UBadge :color="categoryColor(row.category)" variant="subtle" size="sm">
          {{ t(`categories.${row.category}`) }}
        </UBadge>
      </template>

      <template #cell-status="{ row }">
        <UBadge :color="statusColor(row.status)" variant="subtle" size="sm">
          {{ t(`status.${row.status}`) }}
        </UBadge>
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

      <template #empty>
        <UButton v-if="hasActiveFilters" variant="ghost" :label="t('clearFilters')" @click="resetFilters" />
      </template>
    </BaseDataTable>

    <UModal :open="selectedFeedback !== null" @update:open="handleDetailOpenChange">
      <template #content>
        <UCard v-if="selectedFeedback">
          <template #header>
            <h3 class="text-lg font-semibold">{{ t('detail.title') }}</h3>
            <p class="text-sm text-muted">
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
            <p class="whitespace-pre-wrap text-sm">{{ selectedFeedback.message }}</p>
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
          <p class="text-sm text-muted">{{ t('deleteModal.description') }}</p>
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
  </BaseCollectionPage>
</template>
