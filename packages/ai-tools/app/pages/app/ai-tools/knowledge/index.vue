<i18n src="./knowledge.json"></i18n>

<script setup lang="ts">
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
}

const { t } = useI18n()
const toast = useToast()

const folders = ref<Folder[]>([])
const documents = ref<KBDocument[]>([])
const loading = ref(true)
const selectedFolderId = ref<string | null>(null)
const expandedFolders = ref<Set<string>>(new Set())
const newFolderName = ref('')
const showNewFolderModal = ref(false)
const breadcrumbs = ref<Folder[]>([])

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
  loading.value = false
}

function getDocumentsInFolder(folderId: string | null) {
  return documents.value.filter(d => d.folderId === folderId)
}

function getChildFolders(parentId: string | null) {
  return folders.value.filter(f => f.parentId === parentId)
}

function getBreadcrumbs(): Folder[] {
  const crumbs: Folder[] = []
  let current = selectedFolderId.value ? folders.value.find(f => f.id === selectedFolderId.value) : null

  while (current) {
    crumbs.unshift(current)
    current = current.parentId ? folders.value.find(f => f.id === current!.parentId) : null
  }

  return crumbs
}

function selectFolder(folderId: string | null) {
  selectedFolderId.value = folderId
  breadcrumbs.value = getBreadcrumbs()
}

async function createFolder() {
  if (!newFolderName.value.trim()) {
    toast.add({ title: 'Error', description: 'Folder name is required', color: 'error' })
    return
  }

  try {
    await $fetch('/api/ai-tools/folders', {
      method: 'POST',
      body: {
        name: newFolderName.value,
        parentId: selectedFolderId.value,
        path: selectedFolderId.value
          ? `${folders.value.find(f => f.id === selectedFolderId.value)?.path}/${newFolderName.value}`
          : `/${newFolderName.value}`
      }
    })
    showNewFolderModal.value = false
    newFolderName.value = ''
    await fetchFolders()
    toast.add({ title: t('folderCreated'), color: 'success' })
  } catch (e) {
    toast.add({ title: 'Error', description: 'Failed to create folder', color: 'error' })
  }
}

async function deleteFolder(folderId: string) {
  try {
    await $fetch(`/api/ai-tools/folders/${folderId}`, { method: 'DELETE' })
    if (selectedFolderId.value === folderId) {
      selectFolder(null)
    }
    await fetchFolders()
    toast.add({ title: t('folderDeleted'), color: 'success' })
  } catch (e) {
    toast.add({ title: 'Error', description: 'Failed to delete folder', color: 'error' })
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function getFileIcon(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'i-heroicons-document-text'
  if (mimeType.includes('word') || mimeType.includes('docx')) return 'i-heroicons-document'
  if (mimeType.includes('image')) return 'i-heroicons-photo'
  if (mimeType.includes('text')) return 'i-heroicons-document-text'
  return 'i-heroicons-document'
}

function toggleFolderExpand(folderId: string) {
  if (expandedFolders.value.has(folderId)) {
    expandedFolders.value.delete(folderId)
  } else {
    expandedFolders.value.add(folderId)
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <h1 class="text-xl font-semibold">{{ t('title') }}</h1>
      </div>
      <UButton color="primary" @click="showNewFolderModal = true">
        <UIcon name="i-heroicons-folder-plus" class="mr-1" />
        {{ t('newFolder') }}
      </UButton>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <UProgress indicator />
    </div>

    <div v-else class="flex-1 flex overflow-hidden">
      <div class="w-64 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div class="p-2">
          <UButton variant="ghost" :color="selectedFolderId === null ? 'primary' : 'neutral'"
            class="w-full justify-start" @click="selectFolder(null)">
            <UIcon name="i-heroicons-home" class="mr-2" />
            {{ t('allDocuments') }}
          </UButton>
        </div>

        <div class="flex-1 overflow-y-auto p-2">
          <div v-for="folder in getChildFolders(null)" :key="folder.id" class="mb-1">
            <div class="flex items-center gap-1 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              :class="{ 'bg-primary-50 dark:bg-primary-900/20': selectedFolderId === folder.id }"
              @click="selectFolder(folder.id)">
              <button v-if="getChildFolders(folder.id).length > 0" @click.stop="toggleFolderExpand(folder.id)"
                class="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                <UIcon :name="expandedFolders.has(folder.id) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
                  class="w-4 h-4" />
              </button>
              <UIcon v-else name="i-heroicons-blank" class="w-4" />
              <UIcon name="i-heroicons-folder" class="w-5 h-5 text-yellow-500" />
              <span class="flex-1 truncate">{{ folder.name }}</span>
            </div>

            <div v-if="expandedFolders.has(folder.id)" class="ml-4">
              <div v-for="child in getChildFolders(folder.id)" :key="child.id"
                class="flex items-center gap-1 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                :class="{ 'bg-primary-50 dark:bg-primary-900/20': selectedFolderId === child.id }"
                @click="selectFolder(child.id)">
                <UIcon name="i-heroicons-folder" class="w-5 h-5 text-yellow-500" />
                <span class="flex-1 truncate">{{ child.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex-1 flex flex-col overflow-hidden">
        <div v-if="breadcrumbs.length > 0"
          class="flex items-center gap-1 p-3 border-b border-gray-200 dark:border-gray-700 text-sm">
          <button class="hover:text-primary-500" @click="selectFolder(null)">
            {{ t('root') }}
          </button>
          <template v-for="crumb in breadcrumbs" :key="crumb.id">
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
            <button class="hover:text-primary-500" @click="selectFolder(crumb.id)">
              {{ crumb.name }}
            </button>
          </template>
        </div>

        <div class="p-4 flex-1 overflow-y-auto">
          <div v-if="getDocumentsInFolder(selectedFolderId).length === 0" class="text-center py-12">
            <UIcon name="i-heroicons-folder-open" class="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p class="text-gray-500">{{ t('emptyFolder') }}</p>
          </div>

          <div v-else class="grid gap-2">
            <div v-for="doc in getDocumentsInFolder(selectedFolderId)" :key="doc.id"
              class="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              <UIcon :name="getFileIcon(doc.mimeType)" class="w-8 h-8 text-gray-400" />
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">{{ doc.originalName }}</p>
                <p class="text-sm text-gray-500">{{ formatSize(doc.size) }}</p>
              </div>
              <span class="text-xs text-gray-400">
                {{ new Date(doc.createdAt).toLocaleDateString() }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <UModal v-model:open="showNewFolderModal" :title="t('createFolder')">
      <template #content>
        <div class="p-4">
          <UInput v-model="newFolderName" :placeholder="t('folderNamePlaceholder')" @keyup.enter="createFolder" />
        </div>
        <section class="flex gap-4 justify-end  p-4 border-t border-gray-200 dark:border-gray-700">
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
