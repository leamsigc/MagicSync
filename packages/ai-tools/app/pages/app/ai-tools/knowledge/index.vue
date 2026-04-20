<i18n src="./knowledge.json"></i18n>

<script setup lang="ts">
import type { TreeItem } from '@nuxt/ui'
import { useSortable } from '@vueuse/integrations/useSortable'
import { useTemplateRef } from 'vue'

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
    label: 'All Documents',
    icon: 'i-heroicons-home',
    defaultExpanded: true,
    children: rootChildren,
    data: { type: 'root' }
  }]
}

const items = ref<TreeItem[]>([])

async function fetchFolders() {
  try {
    const data = await $fetch<Folder[]>('/api/ai-tools/folders')
    folders.value = data || []
  } catch (e) {
    toast.add({ title: 'Error', description: 'Failed to load folders', color: 'error' })
  }
}

async function fetchDocuments() {
  try {
    const data = await $fetch<KBDocument[]>('/api/ai-tools/documents')
    documents.value = data || []
  } catch (e) {
    toast.add({ title: 'Error', description: 'Failed to load documents', color: 'error' })
  }
}

async function loadData() {
  loading.value = true
  await Promise.all([fetchFolders(), fetchDocuments()])
  items.value = buildTreeItems()
  loading.value = false
}

function flatten(
  treeItems: TreeItem[],
  parent = treeItems
): { item: TreeItem; parent: TreeItem[]; index: number }[] {
  return treeItems.flatMap((item, index) => [
    { item, parent, index },
    ...(item.children?.length && item.defaultExpanded ? flatten(item.children, item.children) : [])
  ])
}


async function moveItem(oldIndex: number, newIndex: number) {
  if (oldIndex === newIndex) return

  const flat = flatten(items.value)
  const source = flat[oldIndex]
  const target = flat[newIndex]

  if (!source || !target) return

  const sourceItem = source.item
  const targetItem = target.item

  if (sourceItem.data?.type !== 'document') return
  if (targetItem.data?.type !== 'folder') return

  const doc = sourceItem.data as KBDocument
  const targetFolder = targetItem.data as Folder

  try {
    await $fetch(`/api/ai-tools/documents/${doc.id}/move`, {
      method: 'PATCH',
      body: { folderId: targetFolder.id }
    })
    await loadData()
    toast.add({ title: t('fileMoved'), color: 'success' })
  } catch (e) {
    toast.add({ title: 'Error', description: 'Failed to move file', color: 'error' })
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
    toast.add({ title: 'Error', description: 'Folder name is required', color: 'error' })
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
  } catch (e) {
    toast.add({ title: 'Error', description: 'Failed to create folder', color: 'error' })
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
  } catch (e) {
    toast.add({ title: 'Error', description: 'Failed to delete folder', color: 'error' })
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
    } catch (e: any) {
      const msg = e?.data?.statusMessage || t('uploadError')
      toast.add({ title: msg, color: 'error' })
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

const folderOptions = computed(() => {
  const opts = [{ label: 'Root (No Folder)', value: '' }]
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
  } catch (e) {
    toast.add({ title: 'Error', description: 'Failed to move file', color: 'error' })
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
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <h1 class="text-xl font-semibold">{{ t('title') }}</h1>
      </div>
      <div class="flex items-center gap-2">
        <input ref="fileInput" type="file" class="hidden" accept=".pdf,.txt,.md,.html,.docx,.csv,.json" multiple
          @change="handleUpload(($event.target as HTMLInputElement).files)" />
        <UButton color="primary" :loading="uploading" @click="fileInput?.click()">
          <UIcon name="i-heroicons-arrow-up-tray" class="mr-1" />
          {{ t('upload') }}
        </UButton>
        <UButton color="primary" @click="showNewFolderModal = true">
          <UIcon name="i-heroicons-folder-plus" class="mr-1" />
          {{ t('newFolder') }}
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <UProgress indicator />
    </div>

    <div v-else class="flex-1 flex overflow-hidden">
      <div class="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col" @drop.prevent="onDrop"
        @dragover="onDragOver" @dragleave="onDragLeave">
        <UTree ref="tree" :items="items" @select="onTreeSelect" class="flex-1 overflow-y-auto p-2" />
        <div v-if="dragOver"
          class="absolute inset-0 bg-primary-50/90 dark:bg-primary-900/50 flex items-center justify-center border-2 border-dashed border-primary-500 rounded-lg m-2">
          <p class="text-primary-600 dark:text-primary-400 font-medium">{{ t('dropHere') }}</p>
        </div>
      </div>

      <div v-if="showDetailPanel"
        class="w-96 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-semibold">File Details</h2>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <div v-if="getSelectedDocument()">
            <div class="flex items-center gap-3 mb-4">
              <UIcon :name="getFileIcon(getSelectedDocument()!.mimeType)" class="w-12 h-12 text-gray-400" />
              <div>
                <p class="font-medium">{{ getSelectedDocument()!.originalName }}</p>
                <p class="text-sm text-gray-500">{{ getSelectedDocument()!.filename }}</p>
              </div>
            </div>

            <div class="space-y-3 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Size</span>
                <span>{{ formatSize(getSelectedDocument()!.size) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Type</span>
                <span>{{ getSelectedDocument()!.mimeType }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Created</span>
                <span>{{ new Date(getSelectedDocument()!.createdAt).toLocaleString() }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Path</span>
                <span class="truncate">{{getSelectedDocument()!.folderId ? folders.find(f => f.id ===
                  getSelectedDocument()!.folderId)?.path : '/'}}</span>
              </div>

              <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <label class="text-sm text-gray-500 block mb-2">Move to folder</label>
                <USelect v-model="moveToFolderId" :items="folderOptions" :placeholder="t('selectFolder')"
                  @update:model-value="handleMoveToFolder" />
              </div>
            </div>

            <div v-if="getSelectedDocument()!.metadata" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 class="font-medium mb-2">Metadata</h3>
              <div class="space-y-2 text-sm">
                <div v-for="(value, key) in getSelectedDocument()!.metadata" :key="key" class="flex justify-between">
                  <span class="text-gray-500">{{ key }}</span>
                  <span>{{ value }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="flex-1 flex items-center justify-center text-gray-500">
        <div class="text-center">
          <UIcon name="i-heroicons-folder-open" class="w-16 h-16 text-gray-400 mx-auto mb-3" />
          <p>Select a file to view details</p>
          <p class="text-sm mt-2">Drag and drop files to move them to folders</p>
        </div>
      </div>
    </div>

    <UModal v-model:open="showNewFolderModal" :title="t('createFolder')">
      <template #content>
        <div class="p-4">
          <UInput v-model="newFolderName" :placeholder="t('folderNamePlaceholder')" @keyup.enter="createFolder" />
        </div>
        <section class="flex gap-4 justify-end p-4 border-t border-gray-200 dark:border-gray-700">
          <UButton @click="showNewFolderModal = false" variant="ghost">
            {{ t('cancel') }}
          </UButton>
          <UButton @click="createFolder" color="primary">
            {{ t('create') }}
          </UButton>
        </section>
      </template>
    </UModal>
  </div>
</template>
