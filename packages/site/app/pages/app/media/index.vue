<!--  Translation file -->
<i18n src="./index.json"></i18n>

<script lang="ts" setup>
/**
 * Page Description: Asset Gallery Management
 *
 * Comprehensive asset gallery for browsing, uploading, and managing media files
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the page
 * @todo [ ] Integration test
 * @todo [✔] Update the typescript
 */

import type { Asset } from '#layers/BaseDB/db/schema'
import type { FolderScope } from '#layers/BaseShared/shared/utils/asset-folders'
import MediaFilters from '#layers/BaseAssets/app/components/assets/media/components/MediaFilters.vue'
import MediaPageHeader from '#layers/BaseAssets/app/components/assets/media/components/MediaPageHeader.vue'
import MediaStats from '#layers/BaseAssets/app/components/assets/media/components/MediaStats.vue'

// Translation composable
const { t } = useI18n()
const toast = useToast()

// App-wide active business, populated by the connect global business-check middleware
const activeBusinessId = useState<string | undefined>('business:id')

// Composables
const {
  assets,
  selectedAssets,
  error,
  assetFolders,
  folderScope,
  deleteAssets,
  getStorageUsage,
  clearError,
  refreshAssets,
  fetchFolders,
  createFolder,
  deleteFolder,
  moveAssets,
  setFolderScope
} = useAssetManagement()

// Local state
const showUploader = ref(false)
const showEditor = ref(false)
const selectedTab = ref('library')
const selectedAssetForEdit = ref<Asset | null>(null)
const filterType = ref<'all' | 'image' | 'video' | 'document'>('all')
const searchQuery = ref('')
const viewMode = ref<'grid' | 'list'>('grid')
const showCreateFolder = ref(false)
const newFolderName = ref('')
const isCreatingFolder = ref(false)
const isDeletingFolder = ref(false)
const activeScope = ref<FolderScope>({ kind: 'unfiled' })

// Computed
const selectedBusinessId = ref<string | undefined>(activeBusinessId.value)
const hasSelectedBusiness = computed(() => !!selectedBusinessId.value)
const storageUsage = computed(() => getStorageUsage())

// Keep the selected business in sync with the app-wide active business
watch(activeBusinessId, (id) => {
  selectedBusinessId.value = id
})

// Folders belong to a business, so they are refetched whenever it changes.
watch(selectedBusinessId, (id) => {
  if (id) fetchFolders(id)
}, { immediate: true })

const handleFolderScopeChange = (scope: FolderScope) => {
  activeScope.value = scope
  setFolderScope(scope)
}

const handleCreateFolder = () => {
  showCreateFolder.value = true
}

const closeCreateFolder = () => {
  showCreateFolder.value = false
  newFolderName.value = ''
}

const submitCreateFolder = async () => {
  if (!selectedBusinessId.value) return
  isCreatingFolder.value = true
  const created = await createFolder(selectedBusinessId.value, newFolderName.value)
  isCreatingFolder.value = false
  closeCreateFolder()
  if (!created) {
    toast.add({ title: t('alerts.error'), description: error.value ?? '', color: 'error' })
    return
  }
  toast.add({ title: t('messages.folder_created', { name: created.name }), color: 'success' })
}

const activeFolderId = computed(() =>
  activeScope.value.kind === 'folder' ? activeScope.value.id : undefined,
)

const activeFolderName = computed(() =>
  assetFolders.value.find(folder => folder.id === activeFolderId.value)?.name,
)

const handleDeleteFolder = async () => {
  if (!selectedBusinessId.value || !activeFolderId.value) return
  isDeletingFolder.value = true
  const unfiledCount = await deleteFolder(activeFolderId.value, selectedBusinessId.value)
  isDeletingFolder.value = false
  if (unfiledCount === null) {
    toast.add({ title: t('alerts.error'), description: error.value ?? '', color: 'error' })
    return
  }
  const name = activeFolderName.value ?? ''
  handleFolderScopeChange({ kind: 'unfiled' })
  toast.add({
    title: t('messages.folder_deleted', { name, count: unfiledCount }),
    color: 'success',
  })
}

const handleMoveSelected = async (folderId: string | null) => {
  if (!selectedBusinessId.value) return
  const ids = selectedAssets.value.map(asset => asset.id)
  const result = await moveAssets(selectedBusinessId.value, ids, folderId)
  if (!result) {
    toast.add({ title: t('alerts.error'), description: error.value ?? '', color: 'error' })
    return
  }
  if (result.rejected.length > 0) {
    toast.add({
      title: t('messages.move_partial', { moved: result.moved, total: ids.length }),
      color: 'warning',
    })
    return
  }
  toast.add({ title: t('messages.assets_moved', { count: result.moved }), color: 'success' })
}

const assetStats = computed(() => {
  const list = assets.value ?? []
  return {
    total: list.length,
    images: list.filter(a => a.mimeType.startsWith('image/')).length,
    videos: list.filter(a => a.mimeType.startsWith('video/')).length,
    documents: list.filter(a => !a.mimeType.startsWith('image/') && !a.mimeType.startsWith('video/')).length
  }
})

// Methods
const handleAssetSelected = (asset: Asset) => {
  log.debug({ message: 'asset selected', assetId: asset.id, filename: asset.filename })
}

const handleAssetDeselected = (asset: Asset) => {
  log.debug({ message: 'asset deselected', assetId: asset.id, filename: asset.filename })
}

const handleFileUpload = async (files: File[]) => {

  useToast().add({
    title: t('messages.upload_complete', {
      count: files.length,
      plural: files.length !== 1 ? 's' : ''
    }),
    color: 'success'
  })
  // showUploader.value = false
}

const handleDeleteSelected = async () => {
  if (selectedAssets.value.length === 0) return

  const confirmed = confirm(t('messages.delete_confirm', {
    count: selectedAssets.value.length,
    plural: selectedAssets.value.length !== 1 ? 's' : ''
  }))
  if (!confirmed) return

  const assetIds = selectedAssets.value.map(asset => asset.id)
  const success = await deleteAssets(assetIds)

  if (success) {
    useToast().add({
      title: t('messages.assets_deleted', {
        count: selectedAssets.value.length,
        plural: selectedAssets.value.length !== 1 ? 's' : ''
      }),
      color: 'success'
    })
  }
}


const handleOpenEditModal = (asset: Asset) => {
  selectedAssetForEdit.value = asset
  showEditor.value = true
}
const handleDeleteAsset = (asset: Asset[]) => {
  // Show toast
  const count = asset.length
  toast.add({
    title: 'Success',
    description: t('messages.assets_deleted', {
      count,
      plural: count !== 1 ? 's' : ''
    }),
    color: 'success'
  })
}

const handleUploadError = (message: string) => {
  toast.add({
    title: t('alerts.error'),
    description: t('messages.upload_failed', { message }),
    color: 'error'
  })
}

const mediaTabs = computed(() => [{
  label: t('tabs.library'),
  icon: 'lucide:folder',
  value: 'library',
  slot: 'library' as const
}, {
  label: t('tabs.googleDrive'),
  icon: 'lucide:folder-open',
  value: 'google-drive',
  slot: 'google-drive' as const
}])

const handleDriveImport = async (imported: Asset[]) => {
  toast.add({
    title: 'Success',
    description: t('messages.drive_imported', {
      count: imported.length,
      plural: imported.length !== 1 ? 's' : ''
    }),
    color: 'success'
  })
  if (selectedBusinessId.value) {
    await refreshAssets(selectedBusinessId.value)
  }
}
</script>

<template>
  <UContainer class="py-6 space-y-6 ">
    <!-- Header -->
    <MediaPageHeader :selected-assets-count="selectedAssets.length" @delete-selected="handleDeleteSelected"
      @upload-assets="showUploader = true" @create-folder="handleCreateFolder" data-tour="add-assets-step-0" />

    <!-- Business Selection Warning -->
    <UAlert v-if="!hasSelectedBusiness" color="neutral" variant="soft" icon="lucide:info" class="mb-4">
      <template #title>
        {{ t('alerts.select_business.title') }}
      </template>
      <template #description>
        {{ t('alerts.select_business.description') }}
        <NuxtLink to="/app/businesses" class="underline ml-2">{{ t('alerts.select_business.link_text') }}</NuxtLink>
      </template>
    </UAlert>
    <!-- Error Alert -->
    <UAlert v-if="error" color="error" variant="soft" icon="lucide:triangle-alert">
      <template #title>
        {{ t('alerts.error') }}
      </template>
      <template #description>
        {{ error }}
      </template>
      <template #actions>
        <UButton variant="outline" size="sm" @click="clearError">
          {{ t('buttons.dismiss') }}
        </UButton>
      </template>
    </UAlert>

    <!-- Stats and Filters -->
    <div class="space-y-4">
      <!-- Stats -->
      <MediaStats :asset-stats="assetStats" :storage-usage="storageUsage" />

      <!-- Library / Google Drive tabs -->
      <UTabs v-model="selectedTab" :items="mediaTabs" class="w-full">
        <template #default="{ item }">
          <div class="flex items-center gap-2 relative">
            <span class="truncate">{{ item.label }}</span>
          </div>
        </template>

        <template #library>
          <div class="space-y-4 mt-4">
            <!-- Filters and Search -->
            <MediaFilters v-model:filter-type="filterType" v-model:search-query="searchQuery" v-model:view-mode="viewMode"
              v-model:folder-scope="activeScope" :folders="assetFolders" hide-view-mode data-tour="add-assets-step-1" />

            <!-- Delete the selected folder. Its assets fall back to the unfiled bucket. -->
            <div
              v-if="activeFolderId"
              class="flex justify-end"
              v-motion-fade
              :duration="250"
            >
              <UButton
                variant="outline"
                color="error"
                size="sm"
                :loading="isDeletingFolder"
                :disabled="!selectedBusinessId"
                @click="handleDeleteFolder"
              >
                <Icon name="lucide:folder-x" class="mr-2 h-4 w-4" />
                {{ t('buttons.delete_folder', { name: activeFolderName }) }}
              </UButton>
            </div>

            <!-- Asset Gallery -->
            <UCard class="p-6" variant="soft" data-tour="add-assets-step-2">
              <MediaGallery :business-id="selectedBusinessId" :selectable="true" :multi-select="true" :show-uploader="false"
                :filter-type="filterType" :folder-scope="activeScope" :folders="assetFolders" @select="handleAssetSelected"
                @deselect="handleAssetDeselected" @upload="handleFileUpload" @delete="handleDeleteAsset"
                @open-edit-modal="handleOpenEditModal" @move-selected="handleMoveSelected" />
            </UCard>
          </div>
        </template>

        <template #google-drive>
          <UCard class="p-6 mt-4" variant="soft">
            <GoogleDriveGallery @select-images="handleDriveImport" />
          </UCard>
        </template>
      </UTabs>
    </div>

    <!-- Upload Dialog -->
    <UModal v-model:open="showUploader" modal :ui="{ content: 'max-w-3xl' }">
      <template #title>
        {{ t('dialogs.upload_assets.title') }}
      </template>
      <template #description>
        {{ t('dialogs.upload_assets.description') }}
      </template>
      <UButton :label="t('buttons.upload_assets')" />

      <template #body>
        <MediaUploader :business-id="selectedBusinessId" @upload="handleFileUpload" @error="handleUploadError" />
      </template>

      <template #footer>
        <UButton variant="outline" @click="showUploader = false">
          {{ t('buttons.close') }}
        </UButton>
      </template>
    </UModal>

    <!-- Create Folder Dialog -->
    <UModal v-model:open="showCreateFolder">
      <template #header>
        <div class="flex items-center gap-3">
          <Icon name="lucide:folder-plus" class="h-6 w-6 text-primary" />
          <h3 class="font-semibold">{{ t('dialogs.create_folder.title') }}</h3>
        </div>
      </template>
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-muted-foreground">{{ t('dialogs.create_folder.description') }}</p>
          <UInput v-model="newFolderName" :placeholder="t('dialogs.create_folder.placeholder')" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="outline" @click="closeCreateFolder">
            {{ t('dialogs.create_folder.cancel') }}
          </UButton>
          <UButton
            :loading="isCreatingFolder"
            :disabled="!newFolderName.trim() || !selectedBusinessId"
            @click="submitCreateFolder"
          >
            <Icon name="lucide:folder-plus" class="mr-2 h-4 w-4" />
            {{ t('dialogs.create_folder.create') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Asset Editor Dialog -->
    <!-- <AssetEditor v-if="selectedAssetForEdit" v-model:open="showEditor" :asset="selectedAssetForEdit"
      @save="handleEditorSave" @close="handleEditorClose" /> -->
  </UContainer>
</template>
