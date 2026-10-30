<i18n src="./knowledge.json"></i18n>

<script setup lang="ts">
/**
 * Knowledge base — folder tree + document collection.
 *
 * The folder tree (drag & drop move, create/delete folder, upload) and the
 * detail panel are unchanged; the document surface now renders through the
 * shared collection shell: one toolbar (search + folder filter + Grid / List /
 * Table) and every view reading the same filtered list.
 */
import type { TreeItem } from '@nuxt/ui'
import { useSortable } from '@vueuse/integrations/useSortable'
import { useTemplateRef } from 'vue'
import type { CollectionTableColumn } from '#layers/BaseUI/app/utils/collection'
import { useCollectionView } from '#layers/BaseUI/app/composables/useCollectionView'

interface Folder {
  id: string
  name: string
  parentId: string | null
  path: string
  createdAt: string
}

interface KBDocument {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  folderId: string | null
  createdAt: string
  metadata?: Record<string, unknown>
  content?: string
}

type KnowledgeView = 'grid' | 'list' | 'table'

const { t } = useI18n()
const toast = useToast()
const uploading = ref(false)
const moveToFolderId = ref<string>('')
const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)

const folders = ref<Folder[]>([])
const documents = ref<KBDocument[]>([])
const loading = ref(true)
const selectedItem = ref<TreeItem | null>(null)
const showDetailPanel = ref(false)
const newFolderName = ref('')
const showNewFolderModal = ref(false)
const treeRef = useTemplateRef<HTMLElement>('tree')

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
} = useCollectionView<KBDocument>({
  key: 'app-ai-tools-knowledge',
  modes: ['grid', 'list', 'table'] satisfies KnowledgeView[],
  defaultView: 'table',
  rows: documents,
  searchFields: doc => [doc.originalName, doc.filename, doc.mimeType, folderPathOf(doc)],
  filterFns: {
    folder: matchesFolder,
  },
})

function matchesFolder(doc: KBDocument, value: string): boolean {
  if (value === 'root') return doc.folderId === null
  return doc.folderId === value
}

const folderFilterOptions = computed(() => [
  { value: 'all', label: t('allFolders') },
  { value: 'root', label: t('root') },
  ...folders.value.map(folder => ({ value: folder.id, label: folder.name })),
])

const toolbarFilters = computed(() => [
  {
    key: 'folder',
    label: t('filterFolder'),
    value: filters.value.folder ?? 'all',
    options: folderFilterOptions.value,
    width: 'w-full sm:w-52',
  },
])

const viewOptions = computed(() => [
  { value: 'grid', label: t('viewGrid'), icon: 'i-lucide-layout-grid' },
  { value: 'list', label: t('viewList'), icon: 'i-lucide-list' },
  { value: 'table', label: t('viewTable'), icon: 'i-lucide-table' },
])

const columns = computed<CollectionTableColumn[]>(() => [
  { key: 'name', label: t('columns.name') },
  { key: 'folder', label: t('columns.folder'), hideBelow: 'md' },
  { key: 'type', label: t('columns.type'), hideBelow: 'lg' },
  { key: 'size', label: t('columns.size'), hideBelow: 'lg', align: 'right' },
  { key: 'created', label: t('columns.created'), hideBelow: 'xl' },
])

const emptyTitle = computed(() => hasActiveFilters.value ? t('noResults') : t('noDocuments'))

const items = ref<TreeItem[]>([])

function getDocumentsInFolder(folderId: string | null) {
  return documents.value.filter(d => d.folderId === folderId)
}

function getChildFolders(parentId: string | null) {
  return folders.value.filter(f => f.parentId === parentId)
}

function buildTreeItems(): TreeItem[] {
  const rootFolders = getChildFolders(null)
  const rootDocs = getDocumentsInFolder(null)

  function buildFolderItem(folder: Folder): TreeItem {
    const children = getChildFolders(folder.id)
    const folderDocs = getDocumentsInFolder(folder.id)

    const treeChildren: TreeItem[] = [
      ...children.map(buildFolderItem),
      ...folderDocs.map(doc => ({
        id: doc.id,
        label: doc.originalName,
        icon: getFileIcon(doc.mimeType),
        isLeaf: true,
        data: { type: 'document', ...doc }
      }))
    ]

    return {
      id: folder.id,
      label: folder.name,
      icon: 'i-heroicons-folder',
      children: treeChildren.length > 0 ? treeChildren : undefined,
      data: { type: 'folder', ...folder }
    }
  }

  const rootChildren: TreeItem[] = [
    ...rootFolders.map(folder => buildFolderItem(folder)),
    ...rootDocs.map(doc => ({
      id: doc.id,
      label: doc.originalName,
      icon: getFileIcon(doc.mimeType),
      isLeaf: true,
      data: { type: 'document', ...doc }
    }))
  ]

  return [{
    id: 'root',
    label: t('allDocuments'),
    icon: 'i-heroicons-home',
    defaultExpanded: true,
    children: rootChildren,
    data: { type: 'root' }
  }]
}

async function fetchFolders() {
  try {
    const data = await $fetch<Folder[]>('/api/ai-tools/folders')
    folders.value = data || []
  } catch {
    toast.add({ title: t('errorTitle'), description: t('loadFoldersFailed'), color: 'error' })
  }
}

async function fetchDocuments() {
  try {
    const data = await $fetch<KBDocument[]>('/api/ai-tools/documents')
    documents.value = data || []
  } catch {
    toast.add({ title: t('errorTitle'), description: t('loadDocumentsFailed'), color: 'error' })
  }
}

async function loadData() {
  loading.value = true
  await Promise.all([fetchFolders(), fetchDocuments()])
  items.value = buildTreeItems()
  loading.value = false
}

interface FlatTreeEntry {
  item: TreeItem
  parent: TreeItem[]
  index: number
}

interface DocumentMove {
  doc: KBDocument
  folderId: string
}

function flatten(
  treeItems: TreeItem[],
  parent = treeItems
): FlatTreeEntry[] {
  return treeItems.flatMap((item, index) => [
    { item, parent, index },
    ...(item.children?.length && item.defaultExpanded ? flatten(item.children, item.children) : [])
  ])
}

function resolveDocumentMove(flat: FlatTreeEntry[], oldIndex: number, newIndex: number): DocumentMove | null {
  const source = flat[oldIndex]
  const target = flat[newIndex]
  if (!source || !target) return null
  if (source.item.data?.type !== 'document') return null
  if (target.item.data?.type !== 'folder') return null
  const folder = target.item.data as Folder
  return { doc: source.item.data as KBDocument, folderId: folder.id }
}

async function moveItem(oldIndex: number, newIndex: number) {
  if (oldIndex === newIndex) return

  const move = resolveDocumentMove(flatten(items.value), oldIndex, newIndex)
  if (!move) return

  try {
    await $fetch(`/api/ai-tools/documents/${move.doc.id}/move`, {
      method: 'PATCH',
      body: { folderId: move.folderId }
    })
    await loadData()
    toast.add({ title: t('fileMoved'), color: 'success' })
  } catch {
    toast.add({ title: t('errorTitle'), description: t('moveFileFailed'), color: 'error' })
  }
}

function onTreeSelect(item: TreeItem) {
  selectedItem.value = item

  if (item.data?.type === 'document') {
    showDetailPanel.value = true
  } else if (item.data?.type === 'folder') {
    showDetailPanel.value = false
  }
}

function handleOpenDocument(doc: Record<string, any>) {
  const target = doc as KBDocument
  selectedItem.value = { id: target.id, label: target.originalName, data: { type: 'document', ...target } }
  showDetailPanel.value = true
}

function getSelectedDocument(): KBDocument | null {
  if (selectedItem.value?.data?.type === 'document') {
    return selectedItem.value.data as KBDocument
  }
  return null
}

function getSelectedFolder(): Folder | null {
  if (selectedItem.value?.data?.type === 'folder') {
    return selectedItem.value.data as Folder
  }
  return null
}

async function createFolder() {
  const folder = getSelectedFolder()
  const parentId = folder?.id ?? null

  if (!newFolderName.value.trim()) {
    toast.add({ title: t('errorTitle'), description: t('folderNameRequired'), color: 'error' })
    return
  }

  try {
    await $fetch('/api/ai-tools/folders', {
      method: 'POST',
      body: {
        name: newFolderName.value,
        parentId,
        path: parentId
          ? `${folders.value.find(f => f.id === parentId)?.path}/${newFolderName.value}`
          : `/${newFolderName.value}`
      }
    })
    showNewFolderModal.value = false
    newFolderName.value = ''
    await fetchFolders()
    items.value = buildTreeItems()
    toast.add({ title: t('folderCreated'), color: 'success' })
  } catch {
    toast.add({ title: t('errorTitle'), description: t('createFolderFailed'), color: 'error' })
  }
}

async function deleteFolder(folderId: string) {
  try {
    await $fetch(`/api/ai-tools/folders/${folderId}`, { method: 'DELETE' })
    if (selectedItem.value?.id === folderId) {
      selectedItem.value = null
      showDetailPanel.value = false
    }
    await fetchFolders()
    items.value = buildTreeItems()
    toast.add({ title: t('folderDeleted'), color: 'success' })
  } catch {
    toast.add({ title: t('errorTitle'), description: t('deleteFolderFailed'), color: 'error' })
  }
}

function getSelectedFolderId(): string | null {
  const folder = getSelectedFolder()
  if (folder) return folder.id
  if (selectedItem.value?.data?.type === 'root') return null
  return null
}

async function handleUpload(files: FileList | null) {
  if (!files?.length) return

  const folderId = getSelectedFolderId()
  uploading.value = true

  for (const file of files) {
    const formData = new FormData()
    formData.append('file', file)
    if (folderId) {
      formData.append('folderId', folderId)
    }

    try {
      await $fetch('/api/ai-tools/documents/upload', {
        method: 'POST',
        body: formData,
      })
      toast.add({ title: t('uploadSuccess'), color: 'success' })
    } catch (err: unknown) {
      const failure = err as { data?: { statusMessage?: string } }
      toast.add({ title: failure?.data?.statusMessage || t('uploadError'), color: 'error' })
    }
  }
  uploading.value = false
  await loadData()
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  handleUpload(event.dataTransfer?.files || null)
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  dragOver.value = true
}

function onDragLeave() {
  dragOver.value = false
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString()
}

function folderPathOf(doc: { folderId?: string | null }): string {
  if (!doc.folderId) return '/'
  return folders.value.find(folder => folder.id === doc.folderId)?.path ?? '/'
}

const folderOptions = computed(() => {
  const opts = [{ label: t('noFolder'), value: '' }]
  for (const folder of folders.value) {
    opts.push({ label: folder.name, value: folder.id })
  }
  return opts
})

async function handleMoveToFolder() {
  const doc = getSelectedDocument()
  if (!doc || !moveToFolderId.value) return

  try {
    await $fetch(`/api/ai-tools/documents/${doc.id}/move`, {
      method: 'PATCH',
      body: { folderId: moveToFolderId.value || null }
    })
    await loadData()
    toast.add({ title: t('fileMoved'), color: 'success' })
    moveToFolderId.value = ''
  } catch {
    toast.add({ title: t('errorTitle'), description: t('moveFileFailed'), color: 'error' })
  }
}

function getFileIcon(mimeType: string): string {
  const type = mimeType.toLowerCase()
  if (type.includes('pdf')) return 'i-heroicons-document-text'
  if (type.includes('word') || type.includes('docx')) return 'i-heroicons-document'
  if (type.includes('image')) return 'i-heroicons-photo'
  if (type.includes('text') || type.includes('txt') || type === 'application/octet-stream') return 'i-heroicons-document-text'
  if (type.includes('markdown') || type.includes('md')) return 'i-heroicons-document-text'
  return 'i-heroicons-document'
}

function handleViewChange(next: KnowledgeView) {
  setView(next)
}

function handleUploadClick() {
  fileInput.value?.click()
}

function handleFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  void handleUpload(input.files)
}

function handleOpenFolderModal() {
  showNewFolderModal.value = true
}

function handleCloseFolderModal() {
  showNewFolderModal.value = false
}

onMounted(() => {
  loadData()
})

useSortable(treeRef, items, {
  animation: 150,
  ghostClass: 'opacity-50',
  onUpdate: (e: any) => moveItem(e.oldIndex, e.newIndex)
})
</script>

<template>
  <BaseCollectionPage :title="t('title')" :description="t('description')" container="full">
    <template #actions>
      <div class="flex flex-wrap items-center gap-2">
        <input ref="fileInput" type="file" class="hidden" accept=".pdf,.txt,.md,.html,.docx,.csv,.json" multiple
          @change="handleFileInputChange">
        <UButton color="primary" icon="i-heroicons-arrow-up-tray" :loading="uploading" @click="handleUploadClick">
          {{ t('upload') }}
        </UButton>
        <UButton color="neutral" variant="outline" icon="i-heroicons-folder-plus" @click="handleOpenFolderModal">
          {{ t('newFolder') }}
        </UButton>
      </div>
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
        @update:filter="setFilter"
        @update:view="handleViewChange"
      />
    </template>

    <div class="flex flex-col gap-4 lg:flex-row">
      <aside
        class="relative flex min-h-80 w-full flex-col rounded-2xl border border-default lg:w-72 lg:shrink-0"
        @drop.prevent="onDrop"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
      >
        <div class="flex items-center gap-2 border-b border-default px-3 py-2 text-sm font-medium">
          <UIcon name="i-heroicons-folder" class="size-4" />
          {{ t('folders') }}
        </div>
        <div v-if="getSelectedFolder()" class="flex items-center justify-between gap-2 border-b border-default px-3 py-2">
          <span class="truncate text-sm text-muted">{{ getSelectedFolder()!.name }}</span>
          <UTooltip :text="t('deleteFolder')">
            <UButton size="xs" color="error" variant="ghost" icon="i-heroicons-trash" :aria-label="t('deleteFolder')"
              @click="() => deleteFolder(getSelectedFolder()!.id)" />
          </UTooltip>
        </div>
        <UTree ref="tree" :items="items" class="flex-1 overflow-y-auto p-2" @select="onTreeSelect" />
        <div v-if="dragOver"
          class="absolute inset-2 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10">
          <p class="text-sm font-medium text-primary">{{ t('dropHere') }}</p>
        </div>
      </aside>

      <div class="min-w-0 flex-1">
        <BaseCollectionGrid
          v-if="view === 'grid'"
          :items="filtered"
          row-key="id"
          :loading="loading"
          :empty-title="emptyTitle"
          empty-icon="i-heroicons-document-text"
        >
          <template #item="{ item: doc }">
            <BaseCollectionCard
              :title="doc.originalName"
              :description="folderPathOf(doc)"
              :icon="getFileIcon(doc.mimeType)"
              :badge="formatSize(doc.size)"
            >
              <template #meta>
                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-calendar" class="size-3.5" />
                  {{ formatDate(doc.createdAt) }}
                </span>
                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-tag" class="size-3.5" />
                  {{ doc.mimeType }}
                </span>
              </template>
              <template #footer>
                <UButton variant="soft" size="xs" icon="i-lucide-eye" @click="() => handleOpenDocument(doc)">
                  {{ t('open') }}
                </UButton>
              </template>
            </BaseCollectionCard>
          </template>

          <template #empty>
            <UButton v-if="hasActiveFilters" variant="ghost" icon="i-lucide-filter-x" @click="resetFilters">
              {{ t('clearFilters') }}
            </UButton>
            <UButton v-else icon="i-heroicons-arrow-up-tray" @click="handleUploadClick">{{ t('upload') }}</UButton>
          </template>
        </BaseCollectionGrid>

        <BaseCollectionList
          v-else-if="view === 'list'"
          :items="filtered"
          row-key="id"
          :loading="loading"
          :empty-title="emptyTitle"
          empty-icon="i-heroicons-document-text"
        >
          <template #item="{ item: doc }">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-elevated">
              <UIcon :name="getFileIcon(doc.mimeType)" class="size-4" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-highlighted">{{ doc.originalName }}</p>
              <p class="truncate text-xs text-muted">{{ folderPathOf(doc) }}</p>
            </div>
            <span class="hidden shrink-0 text-xs text-muted sm:block">{{ formatSize(doc.size) }}</span>
            <span class="hidden shrink-0 text-xs text-muted lg:block">{{ formatDate(doc.createdAt) }}</span>
            <UButton variant="ghost" size="xs" icon="i-lucide-eye" :aria-label="t('open')"
              @click="() => handleOpenDocument(doc)" />
          </template>

          <template #empty>
            <UButton v-if="hasActiveFilters" variant="ghost" icon="i-lucide-filter-x" @click="resetFilters">
              {{ t('clearFilters') }}
            </UButton>
            <UButton v-else icon="i-heroicons-arrow-up-tray" @click="handleUploadClick">{{ t('upload') }}</UButton>
          </template>
        </BaseCollectionList>

        <BaseDataTable
          v-else
          :rows="filtered"
          :columns="columns"
          row-key="id"
          :loading="loading"
          :empty-title="emptyTitle"
          empty-icon="i-heroicons-document-text"
          min-width="40rem"
          clickable
          @row-click="handleOpenDocument"
        >
          <template #cell-name="{ row }">
            <div class="flex items-center gap-3">
              <UIcon :name="getFileIcon(row.mimeType)" class="size-5 shrink-0 text-muted" />
              <span class="truncate font-medium text-highlighted">{{ row.originalName }}</span>
            </div>
          </template>
          <template #cell-folder="{ row }">
            <span class="truncate text-muted">{{ folderPathOf(row) }}</span>
          </template>
          <template #cell-type="{ row }">
            <UBadge color="neutral" variant="subtle" size="sm">{{ row.mimeType }}</UBadge>
          </template>
          <template #cell-size="{ row }">
            <span class="tabular-nums text-muted">{{ formatSize(row.size) }}</span>
          </template>
          <template #cell-created="{ row }">
            <span class="whitespace-nowrap text-muted">{{ formatDate(row.createdAt) }}</span>
          </template>

          <template #row-actions="{ row }">
            <UButton variant="ghost" size="xs" icon="i-lucide-eye" :aria-label="t('open')"
              @click="() => handleOpenDocument(row)" />
          </template>

          <template #empty>
            <UButton v-if="hasActiveFilters" variant="ghost" icon="i-lucide-filter-x" @click="resetFilters">
              {{ t('clearFilters') }}
            </UButton>
            <UButton v-else icon="i-heroicons-arrow-up-tray" @click="handleUploadClick">{{ t('upload') }}</UButton>
          </template>
        </BaseDataTable>
      </div>

      <aside v-if="showDetailPanel" class="w-full rounded-2xl border border-default lg:w-96 lg:shrink-0">
        <div class="border-b border-default px-4 py-3">
          <h2 class="text-base font-semibold">{{ t('fileDetails') }}</h2>
        </div>

        <div v-if="getSelectedDocument()" class="space-y-4 p-4">
          <div class="flex items-center gap-3">
            <UIcon :name="getFileIcon(getSelectedDocument()!.mimeType)" class="size-10 text-muted" />
            <div class="min-w-0">
              <p class="truncate font-medium">{{ getSelectedDocument()!.originalName }}</p>
              <p class="truncate text-sm text-muted">{{ getSelectedDocument()!.filename }}</p>
            </div>
          </div>

          <dl class="space-y-3 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-muted">{{ t('size') }}</dt>
              <dd>{{ formatSize(getSelectedDocument()!.size) }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted">{{ t('type') }}</dt>
              <dd class="truncate">{{ getSelectedDocument()!.mimeType }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted">{{ t('created') }}</dt>
              <dd>{{ formatDate(getSelectedDocument()!.createdAt) }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted">{{ t('path') }}</dt>
              <dd class="truncate">{{ folderPathOf(getSelectedDocument()!) }}</dd>
            </div>
          </dl>

          <div class="border-t border-default pt-4">
            <label class="mb-2 block text-sm text-muted">{{ t('moveToFolder') }}</label>
            <USelect v-model="moveToFolderId" :items="folderOptions" :placeholder="t('selectFolder')"
              @update:model-value="handleMoveToFolder" />
          </div>

          <div v-if="getSelectedDocument()!.metadata" class="border-t border-default pt-4">
            <h3 class="mb-2 font-medium">{{ t('metadata') }}</h3>
            <div class="space-y-2 text-sm">
              <div v-for="(value, key) in getSelectedDocument()!.metadata" :key="key" class="flex justify-between gap-4">
                <span class="text-muted">{{ key }}</span>
                <span class="truncate">{{ value }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="p-6 text-center text-sm text-muted">
          <UIcon name="i-heroicons-folder-open" class="mx-auto mb-3 size-10 text-dimmed" />
          <p>{{ t('selectFileTitle') }}</p>
          <p class="mt-2">{{ t('selectFileHint') }}</p>
        </div>
      </aside>
    </div>

    <UModal v-model:open="showNewFolderModal" :title="t('createFolder')">
      <template #body>
        <UInput v-model="newFolderName" :placeholder="t('folderNamePlaceholder')" @keyup.enter="createFolder" />
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" @click="handleCloseFolderModal">
            {{ t('cancel') }}
          </UButton>
          <UButton color="primary" @click="createFolder">
            {{ t('create') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </BaseCollectionPage>
</template>
