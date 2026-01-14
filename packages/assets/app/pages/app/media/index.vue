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
import MediaFilters from './components/MediaFilters.vue'
import MediaPageHeader from './components/MediaPageHeader.vue'
import MediaStats from './components/MediaStats.vue'

// Translation composable
const { t } = useI18n()
const toast = useToast()

// Composables
const {
  assets,
  selectedAssets,
  isLoading,
  error,
  pagination,
  fetchAssets,
  uploadFiles,
  deleteAssets,
  getStorageUsage,
  clearError
} = useAssetManagement()

// Local state
const showUploader = ref(false)
const showEditor = ref(false)
const selectedAssetForEdit = ref<Asset | null>(null)
const filterType = ref<'all' | 'image' | 'video' | 'document'>('all')
const searchQuery = ref('')
const viewMode = ref<'grid' | 'list'>('grid')

// Computed
const selectedBusinessId = ref<string>()
const hasSelectedBusiness = computed(() => !!selectedBusinessId.value)
const storageUsage = computed(() => getStorageUsage())

const filteredAssets = computed(() => {
  let filtered = assets.value

  // Filter by type
  if (filterType.value !== 'all') {
    filtered = filtered.filter(asset => {
      if (filterType.value === 'image') return asset.mimeType.startsWith('image/')
      if (filterType.value === 'video') return asset.mimeType.startsWith('video/')
      if (filterType.value === 'document') return !asset.mimeType.startsWith('image/') && !asset.mimeType.startsWith('video/')
      return true
    })
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(asset =>
      asset.originalName.toLowerCase().includes(query) ||
      asset.filename.toLowerCase().includes(query)
    )
  }

  return filtered
})

const assetStats = computed(() => {
  return {
    total: assets.value.length,
    images: assets.value.filter(a => a.mimeType.startsWith('image/')).length,
    videos: assets.value.filter(a => a.mimeType.startsWith('video/')).length,
    documents: assets.value.filter(a => !a.mimeType.startsWith('image/') && !a.mimeType.startsWith('video/')).length
  }
})

// Methods
const loadAssets = async () => {
  if (!selectedBusinessId.value) return
  await fetchAssets(selectedBusinessId.value)
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


// Initialize
onMounted(async () => {
  // await ensureInitialized()
  if (selectedBusinessId.value) {
    await loadAssets()
  }
})

// Watch for business changes
watch(selectedBusinessId, async (newBusinessId) => {
  if (newBusinessId) {
    await loadAssets()
  }
})

const handleOpenEditModal = (asset: Asset) => {
  selectedAssetForEdit.value = asset
  showEditor.value = true
}
const handleDeleteAsset = (asset: Asset[]) => {
  // Show toast
  toast.add({
    title: 'Success',
    description: 'Deleted media content successfully.',
    color: 'success'
  })
}
</script>

<template>
  <UContainer class="py-6 space-y-6 max-w-4xl">
    <!-- Header -->
    <MediaPageHeader :selected-assets-count="selectedAssets.length" @delete-selected="handleDeleteSelected"
      @upload-assets="showUploader = true" />

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

      <!-- Filters and Search -->
      <MediaFilters v-model:filter-type="filterType" v-model:search-query="searchQuery" v-model:view-mode="viewMode"
        hide-view-mode />

      <!-- Asset Gallery -->
      <UCard class="p-6">
        <MediaGallery :business-id="selectedBusinessId" :selectable="true" :multi-select="true" :show-uploader="false"
          :filter-type="filterType" @select="(asset: Asset) => console.log('Selected:', asset)"
          @deselect="(asset: Asset) => console.log('Deselected:', asset)" @upload="handleFileUpload"
          @delete="handleDeleteAsset" @open-edit-modal="handleOpenEditModal" />
      </UCard>
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
        <MediaUploader :business-id="selectedBusinessId" @upload="handleFileUpload" />
      </template>

      <template #footer>
        <UButton variant="outline" @click="showUploader = false">
          {{ t('buttons.close') }}
        </UButton>
      </template>
    </UModal>

    <!-- Asset Editor Dialog -->
    <!-- <AssetEditor v-if="selectedAssetForEdit" v-model:open="showEditor" :asset="selectedAssetForEdit"
      @save="handleEditorSave" @close="handleEditorClose" /> -->
  </UContainer>
</template>
