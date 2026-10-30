<i18n src="./announcements.json"></i18n>

<script lang="ts" setup>
/**
 * Admin announcements — table and list views on the shared collection shell.
 *
 * `useCollectionView` owns search + the derived active/scheduled/expired
 * filter; the create/edit/delete flows keep their original API calls.
 */
import type { EditorToolbarItem } from '@nuxt/ui'
import type { CollectionTableColumn } from '#layers/BaseUI/app/utils/collection'

definePageMeta({
  layout: 'dashboard-layout'
})

const { t } = useI18n()
const toast = useToast()

type AnnouncementStatus = 'active' | 'scheduled' | 'expired'

interface AdminAnnouncement {
  id: string
  title: string
  html: string
  publishAt: string
  expiresAt: string | null
  createdBy: string
  createdAt: string
}

const toolbarItems: EditorToolbarItem[] = [
  { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold' },
  { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic' },
  { kind: 'heading', level: 2, icon: 'i-lucide-heading-2' },
  { kind: 'bulletList', icon: 'i-lucide-list' },
  { kind: 'orderedList', icon: 'i-lucide-list-ordered' },
  { kind: 'link', icon: 'i-lucide-link' }
]

const announcements = ref<AdminAnnouncement[]>([])
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
} = useCollectionView<AdminAnnouncement>({
  key: 'admin-announcements',
  modes: ['table', 'list'],
  defaultView: 'table',
  rows: announcements,
  searchFields: item => [item.title],
  filterFns: {
    status: (item, value) => announcementStatus(item) === value,
  },
})

const viewOptions = computed(() => [
  { value: 'table', label: t('views.table'), icon: 'i-lucide-table' },
  { value: 'list', label: t('views.list'), icon: 'i-lucide-list' },
])

const statusFilterOptions = computed(() => [
  { label: t('filters.all'), value: 'all' },
  { label: t('status.active'), value: 'active' },
  { label: t('status.scheduled'), value: 'scheduled' },
  { label: t('status.expired'), value: 'expired' },
])

const toolbarFilters = computed(() => [
  {
    key: 'status',
    label: t('columns.status'),
    value: filters.value.status || 'all',
    options: statusFilterOptions.value,
    width: 'w-full sm:w-44',
  },
])

const columns = computed<CollectionTableColumn[]>(() => [
  { key: 'title', label: t('columns.title') },
  { key: 'publishAt', label: t('columns.schedule'), hideBelow: 'md' },
  { key: 'status', label: t('columns.status'), width: '9rem' },
])

async function fetchAnnouncements() {
  loading.value = true
  try {
    const data = await $fetch<{ announcements: AdminAnnouncement[] }>('/api/v1/admin/announcements')
    announcements.value = data.announcements
  } catch {
    toast.add({ title: t('toast.error'), description: t('toast.loadFailed'), color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(fetchAnnouncements)

function handleFilter(key: string, value: string) {
  setFilter(key, value)
}

function handleView(next: string) {
  setView(next)
}

function announcementStatus(announcement: AdminAnnouncement): AnnouncementStatus {
  const now = Date.now()
  if (Date.parse(announcement.publishAt) > now) return 'scheduled'
  if (announcement.expiresAt && Date.parse(announcement.expiresAt) <= now) return 'expired'
  return 'active'
}

function statusColor(status: AnnouncementStatus): 'success' | 'info' | 'neutral' {
  if (status === 'active') return 'success'
  if (status === 'scheduled') return 'info'
  return 'neutral'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

function scheduleRange(announcement: AdminAnnouncement): string {
  if (!announcement.expiresAt) return `${formatDate(announcement.publishAt)} → ∞`
  return `${formatDate(announcement.publishAt)} → ${formatDate(announcement.expiresAt)}`
}

function announcementId(item: Record<string, any>): string {
  return String(item.id)
}

function toLocal(iso: string): string {
  return iso.slice(0, 16)
}

function toIso(local: string): string | null {
  const time = Date.parse(local)
  if (Number.isNaN(time)) return null
  return new Date(time).toISOString()
}

function nowLocal(): string {
  const now = new Date()
  now.setSeconds(0, 0)
  return toLocal(now.toISOString())
}

const showModal = ref(false)
const editingId = ref<string | null>(null)
const form = ref({
  title: '',
  html: '',
  publishLocal: '',
  expiryLocal: '',
  noExpiry: true
})

function openCreate() {
  editingId.value = null
  form.value = { title: '', html: '', publishLocal: nowLocal(), expiryLocal: '', noExpiry: true }
  showModal.value = true
}

function openEdit(announcement: AdminAnnouncement) {
  editingId.value = announcement.id
  form.value = {
    title: announcement.title,
    html: announcement.html,
    publishLocal: toLocal(announcement.publishAt),
    expiryLocal: announcement.expiresAt ? toLocal(announcement.expiresAt) : '',
    noExpiry: announcement.expiresAt === null
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

function handleModalOpen(open: boolean) {
  if (!open) closeModal()
}

function validateForm(): string | null {
  if (!form.value.title.trim()) return t('toast.titleRequired')
  if (!form.value.html.trim() || form.value.html.trim() === '<p></p>') return t('toast.contentRequired')
  if (!toIso(form.value.publishLocal)) return t('toast.scheduleRequired')
  return null
}

async function saveAnnouncement() {
  const validationError = validateForm()
  if (validationError) {
    toast.add({ title: t('toast.error'), description: validationError, color: 'error' })
    return
  }
  const publishAt = toIso(form.value.publishLocal) as string
  const expiresAt = form.value.noExpiry ? null : toIso(form.value.expiryLocal)
  const body = { title: form.value.title.trim(), html: form.value.html, publishAt, expiresAt }
  saving.value = true
  try {
    if (editingId.value) {
      await $fetch(`/api/v1/admin/announcements/${editingId.value}`, { method: 'PUT', body })
      toast.add({ title: t('toast.updated'), description: t('toast.updatedDescription'), color: 'success' })
    } else {
      await $fetch('/api/v1/admin/announcements', { method: 'POST', body })
      toast.add({ title: t('toast.created'), description: t('toast.createdDescription'), color: 'success' })
    }
    showModal.value = false
    await fetchAnnouncements()
  } catch {
    toast.add({ title: t('toast.error'), description: t('toast.saveFailed'), color: 'error' })
  } finally {
    saving.value = false
  }
}

const pendingDelete = ref<AdminAnnouncement | null>(null)

function askDelete(announcement: AdminAnnouncement) {
  pendingDelete.value = announcement
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
  const snapshot = [...announcements.value]
  announcements.value = announcements.value.filter(item => item.id !== target.id)
  pendingDelete.value = null
  try {
    await $fetch(`/api/v1/admin/announcements/${target.id}`, { method: 'DELETE' })
    toast.add({ title: t('toast.deleted'), description: t('toast.deletedDescription'), color: 'success' })
  } catch {
    announcements.value = snapshot
    toast.add({ title: t('toast.error'), description: t('toast.deleteFailed'), color: 'error' })
  }
}

function menuItems(announcement: AdminAnnouncement) {
  return [
    [
      { label: t('menu.edit'), icon: 'i-lucide-pencil', onSelect: () => openEdit(announcement) },
    ],
    [
      { label: t('menu.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => askDelete(announcement) },
    ],
  ]
}
</script>

<template>
  <BaseCollectionPage :title="t('title')" :description="t('description')">
    <template #actions>
      <UButton icon="i-lucide-megaphone" @click="openCreate">
        {{ t('createAnnouncement') }}
      </UButton>
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
        @update:filter="handleFilter"
        @update:view="handleView"
      />
    </template>

    <BaseCollectionList
      v-if="view === 'list'"
      :items="filtered"
      :row-key="announcementId"
      :loading="loading"
      :empty-icon="'i-lucide-megaphone'"
      :empty-title="t('noAnnouncements')"
    >
      <template #item="{ item: announcement }">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-highlighted">{{ announcement.title }}</p>
          <p class="truncate text-xs text-muted">
            {{ t('columns.created') }} {{ formatDate(announcement.createdAt) }}
          </p>
        </div>
        <span class="hidden shrink-0 text-xs text-muted md:block">{{ scheduleRange(announcement) }}</span>
        <UBadge class="shrink-0" :color="statusColor(announcementStatus(announcement))" variant="subtle" size="sm">
          {{ t(`status.${announcementStatus(announcement)}`) }}
        </UBadge>
        <UDropdownMenu :items="menuItems(announcement)" :content="{ align: 'end' }">
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
      :row-key="announcementId"
      :loading="loading"
    >
      <template #cell-title="{ row }">
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-highlighted">{{ row.title }}</p>
          <p class="text-xs text-muted">{{ t('columns.created') }} {{ formatDate(row.createdAt) }}</p>
        </div>
      </template>

      <template #cell-publishAt="{ row }">
        <span class="whitespace-nowrap text-xs text-muted">{{ scheduleRange(row) }}</span>
      </template>

      <template #cell-status="{ row }">
        <UBadge :color="statusColor(announcementStatus(row))" variant="subtle" size="sm">
          {{ t(`status.${announcementStatus(row)}`) }}
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

    <UModal :open="showModal" :ui="{ content: 'max-w-3xl' }" @update:open="handleModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">
              {{ editingId ? t('modal.editTitle') : t('modal.createTitle') }}
            </h3>
          </template>
          <div class="space-y-4">
            <UFormField :label="t('modal.titleLabel')">
              <UInput v-model="form.title" :placeholder="t('modal.titlePlaceholder')" class="w-full" />
            </UFormField>
            <UFormField :label="t('modal.contentLabel')">
              <UEditor v-slot="{ editor }" v-model="form.html" content-type="html"
                class="min-h-48 w-full rounded-xl border border-default bg-muted/30 p-4">
                <UEditorToolbar :editor="editor" :items="toolbarItems" />
              </UEditor>
            </UFormField>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UFormField :label="t('modal.publishLabel')">
                <UInput v-model="form.publishLocal" type="datetime-local" class="w-full" />
              </UFormField>
              <UFormField :label="t('modal.expiryLabel')">
                <UInput v-model="form.expiryLocal" type="datetime-local" class="w-full" :disabled="form.noExpiry" />
              </UFormField>
            </div>
            <UCheckbox v-model="form.noExpiry" :label="t('modal.noExpiry')" />
            <p class="text-xs text-muted">{{ t('modal.scheduleHint') }}</p>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="neutral" @click="closeModal">{{ t('modal.cancel') }}</UButton>
              <UButton color="primary" :loading="saving" @click="saveAnnouncement">{{ t('modal.submit') }}</UButton>
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
          <p class="text-sm text-muted">{{ t('deleteModal.description', { title: pendingDelete.title }) }}</p>
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
