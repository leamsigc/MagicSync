<i18n src="./assets.json"></i18n>

<script setup lang="ts">
interface Folder {
  id: string
  name: string
  parentId: string | null
  path: string
}

interface Document {
  id: string
  originalName: string
  mimeType: string
  size: number
  status: 'pending' | 'processing' | 'storing' | 'completed' | 'failed'
  chunkCount: number
  errorMessage?: string
  createdAt: string
}

const { t } = useI18n()
const toast = useToast()

const folders = ref<Folder[]>([])
const selectedFolderId = ref<string | null>(null)
const documents = ref<Document[]>([])
const loading = ref(true)
const uploading = ref(false)
const ingesting = ref<Record<string, { message: string; progress?: number }>>({})
const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)
const showDeleteModal = ref(false)
const documentToDelete = ref<Document | null>(null)

async function fetchFolders() {
  try {
    const data = await $fetch<Folder[]>('/api/ai-tools/folders')
    folders.value = data || []
  } catch (e) {
    // ignore
  }
}

async function fetchDocuments() {
  loading.value = true
  try {
    const params = selectedFolderId.value ? { folderId: selectedFolderId.value } : {}
    const data = await $fetch<Document[]>('/api/ai-tools/documents', { query: params })
    documents.value = data || []
  } catch (e) {
    toast.add({ title: 'Error', description: 'Failed to load documents', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function loadData() {
  await Promise.all([fetchFolders(), fetchDocuments()])
}

async function handleUpload(files: FileList | null) {
  if (!files?.length) return

  uploading.value = true
  for (const file of files) {
    const formData = new FormData()
    formData.append('file', file)
    if (selectedFolderId.value) {
      formData.append('folderId', selectedFolderId.value)
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
  await fetchDocuments()
}

function onDrop(event: DragEvent) {
  dragOver.value = false
  handleUpload(event.dataTransfer?.files || null)
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  dragOver.value = true
}

function onDragLeave() {
  dragOver.value = false
}

async function handleIngest(doc: Document) {
  ingesting.value[doc.id] = { message: t('ingestionProgress') }

  try {
    const response = await fetch(`/api/ai-tools/documents/${doc.id}/ingest`, {
      method: 'POST',
    })

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          const json = line.replace('data: ', '')
          if (json === '[DONE]') {
            delete ingesting.value[doc.id]
            toast.add({ title: t('ingestSuccess'), color: 'success' })
            await fetchDocuments()
            return
          }
          try {
            const event = JSON.parse(json)
            ingesting.value[doc.id] = {
              message: event.message,
              progress: event.progress,
            }
            if (event.status === 'skipped') {
              delete ingesting.value[doc.id]
              toast.add({ title: t('noChanges'), description: event.message, color: 'info' })
              await fetchDocuments()
              return
            }
            if (event.status === 'failed') {
              delete ingesting.value[doc.id]
              toast.add({ title: event.message || t('ingestError'), color: 'error' })
              await fetchDocuments()
              return
            }
          } catch {
            // skip invalid json
          }
        }
      }
    }
  } catch (e: any) {
    delete ingesting.value[doc.id]
    toast.add({ title: t('ingestError'), color: 'error' })
  }
  await fetchDocuments()
}

function cancelIngest(docId: string) {
  delete ingesting.value[docId]
}

async function handleDelete(doc: Document) {
  documentToDelete.value = doc
  showDeleteModal.value = true
}

async function confirmDelete() {
  if (!documentToDelete.value) return
  
  try {
    await $fetch(`/api/ai-tools/documents/${documentToDelete.value.id}`, { method: 'DELETE' })
    toast.add({ title: t('deleteSuccess'), color: 'success' })
    documents.value = documents.value.filter(d => d.id !== documentToDelete.value!.id)
  } catch (e) {
    toast.add({ title: t('deleteError'), color: 'error' })
  } finally {
    showDeleteModal.value = false
    documentToDelete.value = null
  }
}

function cancelDelete() {
  showDeleteModal.value = false
  documentToDelete.value = null
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getStatusColor(status: Document['status']): 'primary' | 'success' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'completed': return 'success'
    case 'processing': case 'storing': return 'warning'
    case 'failed': return 'error'
    default: return 'neutral'
  }
}

function getMimeTypeLabel(mime: string): string {
  if (mime.includes('pdf')) return 'PDF'
  if (mime.includes('plain')) return 'TXT'
  if (mime.includes('markdown')) return 'MD'
  if (mime.includes('html')) return 'HTML'
  if (mime.includes('wordprocessingml')) return 'DOCX'
  if (mime.includes('csv')) return 'CSV'
  if (mime.includes('json')) return 'JSON'
  return mime.split('/').pop()?.toUpperCase() || 'FILE'
}

const folderOptions = computed(() => [
  { id: null, label: t('allFolders') },
  ...folders.value.map(f => ({ id: f.id, label: f.path }))
])

watch(selectedFolderId, () => {
  fetchDocuments()
})

onMounted(loadData)
</script>

<template>
  <div class="max-w-5xl mx-auto p-6">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">{{ t('title') }}</h1>
        <p class="text-neutral-500 mt-1">{{ t('description') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <USelect v-model="selectedFolderId" :items="folderOptions" labelKey="label" valueKey="id"
          :placeholder="t('selectFolder')" class="w-48" />
      </div>
    </div>

    <!-- Upload Zone -->
    <div class="border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-colors"
      :class="dragOver ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-neutral-300 dark:border-neutral-700'"
      @drop.prevent="onDrop" @dragover="onDragOver" @dragleave="onDragLeave">
      <UIcon name="i-heroicons-document-arrow-up" class="w-10 h-10 text-neutral-400 mb-3" />
      <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{{ t('dropzone') }}</p>
      <p class="text-xs text-neutral-400 mb-4">{{ t('supportedFormats') }}</p>
      <input ref="fileInput" type="file" class="hidden" accept=".pdf,.txt,.md,.html,.docx,.csv,.json" multiple
        @change="handleUpload(($event.target as HTMLInputElement).files)" />
      <UButton :label="t('upload')" icon="i-heroicons-arrow-up-tray" color="primary" :loading="uploading"
        @click="fileInput?.click()" />
    </div>

    <!-- Documents Table -->
    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-neutral-400" />
    </div>

    <div v-else-if="!documents.length" class="text-center py-12 text-neutral-500">
      <UIcon name="i-heroicons-document-text" class="w-12 h-12 mx-auto mb-3 text-neutral-300" />
      <p>{{ t('noDocuments') }}</p>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-neutral-200 dark:border-neutral-700 text-left">
            <th class="pb-3 font-medium">{{ t('columns.name') }}</th>
            <th class="pb-3 font-medium">{{ t('columns.type') }}</th>
            <th class="pb-3 font-medium">{{ t('columns.size') }}</th>
            <th class="pb-3 font-medium">{{ t('columns.chunks') }}</th>
            <th class="pb-3 font-medium">{{ t('columns.status') }}</th>
            <th class="pb-3 font-medium text-right">{{ t('columns.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="doc in documents" :key="doc.id" class="border-b border-neutral-100 dark:border-neutral-800">
            <td class="py-4 pr-4">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-neutral-400 shrink-0" />
                <span class="font-medium truncate max-w-[200px]">{{ doc.originalName }}</span>
              </div>
            </td>
            <td class="py-4">
              <UBadge :label="getMimeTypeLabel(doc.mimeType)" variant="soft" size="sm" />
            </td>
            <td class="py-4 text-neutral-500">{{ formatSize(doc.size) }}</td>
            <td class="py-4 text-neutral-500">{{ doc.chunkCount || 0 }}</td>
            <td class="py-4">
              <div v-if="ingesting[doc.id]" class="flex items-center gap-2">
                <UProgress :value="ingesting[doc.id].progress" size="xs" class="w-24" />
                <span class="text-xs text-neutral-500">{{ ingesting[doc.id].message }}</span>
              </div>
              <UBadge v-else :label="t(`status.${doc.status}`)" :color="getStatusColor(doc.status)" variant="soft"
                size="sm" />
            </td>
            <td class="py-4">
              <div class="flex items-center justify-end gap-1">
                <UButton v-if="doc.status === 'pending' || doc.status === 'failed'"
                  :label="doc.status === 'failed' ? t('actions.reingest') : t('actions.ingest')"
                  icon="i-heroicons-sparkles" color="primary" variant="soft" size="xs" :disabled="!!ingesting[doc.id]"
                  @click="handleIngest(doc)" />
                <UButton v-if="ingesting[doc.id]" :label="t('actions.cancel')" icon="i-heroicons-x-mark" color="neutral"
                  variant="soft" size="xs" @click="cancelIngest(doc.id)" />
                <UButton v-if="doc.status === 'completed'" :label="t('actions.reingest')" icon="i-heroicons-arrow-path"
                  color="neutral" variant="ghost" size="xs" @click="handleIngest(doc)" />
                <UButton icon="i-heroicons-trash" color="error" variant="ghost" size="xs" @click="handleDelete(doc)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="showDeleteModal" :title="t('deleteConfirmTitle')" :description="t('deleteConfirmDescription')">
      <template #footer>
        <UButton color="neutral" variant="ghost" @click="cancelDelete">{{ t('cancel') }}</UButton>
        <UButton color="error" @click="confirmDelete">{{ t('delete') }}</UButton>
      </template>
    </UModal>
  </div>
</template>
