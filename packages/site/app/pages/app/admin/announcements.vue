<i18n src="./announcements.json"></i18n>

<script lang="ts" setup>
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { EditorToolbarItem } from '@nuxt/ui'
import type { Row } from '@tanstack/vue-table'

definePageMeta({
  layout: 'dashboard-layout'
})

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')

const { t } = useI18n()
const toast = useToast()

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
const searchQuery = ref('')
const saving = ref(false)

const filteredAnnouncements = computed(() => {
  if (!searchQuery.value) return announcements.value
  const q = searchQuery.value.toLowerCase()
  return announcements.value.filter(a => a.title.toLowerCase().includes(q))
})

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

function announcementStatus(a: AdminAnnouncement): 'active' | 'scheduled' | 'expired' {
  const now = Date.now()
  if (Date.parse(a.publishAt) > now) return 'scheduled'
  if (a.expiresAt && Date.parse(a.expiresAt) <= now) return 'expired'
  return 'active'
}

function statusColor(status: 'active' | 'scheduled' | 'expired'): 'success' | 'info' | 'neutral' {
  if (status === 'active') return 'success'
  if (status === 'scheduled') return 'info'
  return 'neutral'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
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

function openEdit(a: AdminAnnouncement) {
  editingId.value = a.id
  form.value = {
    title: a.title,
    html: a.html,
    publishLocal: toLocal(a.publishAt),
    expiryLocal: a.expiresAt ? toLocal(a.expiresAt) : '',
    noExpiry: a.expiresAt === null
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
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

function askDelete(a: AdminAnnouncement) {
  pendingDelete.value = a
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
  announcements.value = announcements.value.filter(a => a.id !== target.id)
  pendingDelete.value = null
  try {
    await $fetch(`/api/v1/admin/announcements/${target.id}`, { method: 'DELETE' })
    toast.add({ title: t('toast.deleted'), description: t('toast.deletedDescription'), color: 'success' })
  } catch {
    announcements.value = snapshot
    toast.add({ title: t('toast.error'), description: t('toast.deleteFailed'), color: 'error' })
  }
}

function getRowItems(row: Row<AdminAnnouncement>) {
  return [
    { type: 'label', label: t('menu.title') },
    { label: t('menu.edit'), onSelect: () => openEdit(row.original) },
    { type: 'separator' },
    { label: t('menu.delete'), onSelect: () => askDelete(row.original) }
  ]
}

function getRowId(row: AdminAnnouncement) {
  return row.id
}

const columns: TableColumn<AdminAnnouncement>[] = [
  {
    accessorKey: 'title',
    header: () => t('columns.title'),
    cell: ({ row }) => {
      const a = row.original
      return h('div', null, [
        h('p', { class: 'font-medium text-sm' }, a.title),
        h('p', { class: 'text-xs text-muted-foreground' }, `${t('columns.created')} ${formatDate(a.createdAt)}`)
      ])
    }
  },
  {
    accessorKey: 'publishAt',
    header: () => t('columns.schedule'),
    cell: ({ row }) => {
      const a = row.original
      const range = a.expiresAt
        ? `${formatDate(a.publishAt)} → ${formatDate(a.expiresAt)}`
        : `${formatDate(a.publishAt)} → ∞`
      return h('span', { class: 'text-xs text-muted-foreground' }, range)
    }
  },
  {
    id: 'status',
    header: () => t('columns.status'),
    cell: ({ row }) => {
      const status = announcementStatus(row.original)
      return h(UBadge, { color: statusColor(status), variant: 'subtle', size: 'sm' }, () => t(`status.${status}`))
    }
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
        <UInput v-model="searchQuery" :placeholder="t('searchPlaceholder')" icon="i-heroicons-magnifying-glass"
          size="sm" class="sm:w-64" />
        <UButton icon="i-lucide-megaphone" size="sm" @click="openCreate">
          {{ t('createAnnouncement') }}
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="rounded flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-muted-foreground" />
    </div>

    <div v-else v-motion-fade-visible-once class="shadow rounded overflow-hidden">
      <div v-if="filteredAnnouncements.length === 0" class="text-center py-12 text-muted-foreground">
        {{ t('noAnnouncements') }}
      </div>
      <UTable v-else :data="filteredAnnouncements" :columns="columns" :get-row-id="getRowId" class="flex-1"
        :ui="{ 'tr': 'bg-transparent transition-colors', 'td': 'border-0', 'th': 'border-0' }" />
    </div>

    <UModal v-model:open="showModal" :ui="{ content: 'max-w-3xl' }">
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
                class="w-full rounded-xl border border-default bg-muted/30 p-4 min-h-48">
                <UEditorToolbar :editor="editor" :items="toolbarItems" />
              </UEditor>
            </UFormField>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField :label="t('modal.publishLabel')">
                <UInput v-model="form.publishLocal" type="datetime-local" class="w-full" />
              </UFormField>
              <UFormField :label="t('modal.expiryLabel')">
                <UInput v-model="form.expiryLocal" type="datetime-local" class="w-full" :disabled="form.noExpiry" />
              </UFormField>
            </div>
            <UCheckbox v-model="form.noExpiry" :label="t('modal.noExpiry')" />
            <p class="text-xs text-muted-foreground">{{ t('modal.scheduleHint') }}</p>
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
          <p class="text-sm text-muted-foreground">{{ t('deleteModal.description', { title: pendingDelete.title }) }}</p>
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
