<!--  Translation file -->
<i18n src="./MediaGallery.json"></i18n>
<script lang="ts" setup>
import type { Asset } from '#layers/BaseDB/db/schema'

interface Props {
  businessId?: string
  selectable?: boolean
  multiSelect?: boolean
  selectedAssets?: Asset[]
  showUploader?: boolean
  filterType?: 'image' | 'video' | 'document' | 'all'
}

interface Emits {
  (e: 'select', asset: Asset): void
  (e: 'deselect', asset: Asset): void
  (e: 'upload', files: File[]): void
  (e: 'delete', assets: Asset[]): void
  (e: 'preview', asset: Asset): void
  (e: 'open-edit-modal', asset: Asset): void
  (e: 'update:showUploader', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  selectable: false,
  multiSelect: false,
  selectedAssets: () => [],
  showUploader: true,
  filterType: 'all'
})

const router = useRouter()
const emit = defineEmits<Emits>()
const { t } = useI18n()

const {
  assets,
  selectedAssets,
  isLoading,
  error,
  pagination,
  fetchAssets,
  uploadFiles,
  deleteAssets,
  toggleAssetSelection,
  selectAllAssets,
  deselectAllAssets,
  isAssetSelected,
  getAssetsByType,
  getStorageUsage,
  loadMoreAssets
} = useAssetManagement()

const { getAssetType, formatFileSize, getAssetPreviewUrl, getAssetDisplayName } = useAsset()

const viewMode = ref<'masonry' | 'grid' | 'list'>('masonry')
const searchQuery = ref('')
const showDeleteDialog = ref(false)
const assetsToDelete = ref<Asset[]>([])
const showPreviewModal = ref(false)
const previewAsset = ref<Asset | null>(null)
const sortBy = ref<'name' | 'date' | 'size' | 'type'>('date')
const sortOrder = ref<'asc' | 'desc'>('desc')
const showFilters = ref(false)
const selectedTags = ref<string[]>([])
const currentFolder = ref<string>('all')
const showFolderDialog = ref(false)
const newFolderName = ref('')
const folders = ref<string[]>(['all', 'favorites', 'social', 'logos', 'banners'])
const isOptimizing = ref(false)
const optimizationProgress = ref(0)
const isPreviewFullscreen = ref(false)

const filteredAssets = computed(() => {
  let filtered = [...assets.value]
  if (props.filterType !== 'all') {
    filtered = getAssetsByType(props.filterType)
  }
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(asset =>
      getAssetDisplayName(asset).toLowerCase().includes(query)
    )
  }
  if (selectedTags.value.length > 0) {
    filtered = filtered.filter(asset => {
      const metadata = parseAssetMetadata(asset)
      const assetTags = metadata.tags || []
      return selectedTags.value.some(tag => assetTags.includes(tag))
    })
  }
  filtered.sort((a, b) => {
    let comparison = 0
    switch (sortBy.value) {
      case 'name':
        comparison = getAssetDisplayName(a).localeCompare(getAssetDisplayName(b))
        break
      case 'date':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        break
      case 'size':
        comparison = a.size - b.size
        break
      case 'type':
        comparison = a.mimeType.localeCompare(b.mimeType)
        break
    }
    return sortOrder.value === 'asc' ? comparison : -comparison
  })
  return filtered
})

const hasSelectedAssets = computed(() => selectedAssets.value.length > 0)
const storageUsage = computed(() => getStorageUsage())

const sortItems = computed(() => [
  { label: t('date'), value: 'date' },
  { label: t('name'), value: 'name' },
  { label: t('size'), value: 'size' },
  { label: t('type'), value: 'type' }
])

const allTags = computed(() => {
  const tags = new Set<string>()
  assets.value.forEach(asset => {
    const metadata = parseAssetMetadata(asset)
    if (metadata.tags) {
      metadata.tags.forEach((tag: string) => tags.add(tag))
    }
  })
  return Array.from(tags).sort()
})

const parseAssetMetadata = (asset: Asset) => {
  if (!asset.metadata) return {}
  try {
    return typeof asset.metadata === 'string'
      ? JSON.parse(asset.metadata)
      : asset.metadata
  } catch {
    return {}
  }
}

const handleAssetClick = (asset: Asset) => {
  if (props.selectable) {
    toggleAssetSelection(asset)
    if (isAssetSelected(asset)) {
      emit('select', asset)
    } else {
      emit('deselect', asset)
    }
  } else {
    previewAsset.value = asset
    showPreviewModal.value = true
    emit('preview', asset)
  }
}

const handleDeleteSelected = () => {
  assetsToDelete.value = [...selectedAssets.value]
  showDeleteDialog.value = true
}

const confirmDelete = async () => {
  const assetIds = assetsToDelete.value.map(asset => asset.id)
  const success = await deleteAssets(assetIds)
  if (success) {
    emit('delete', assetsToDelete.value)
  }
  showDeleteDialog.value = false
  assetsToDelete.value = []
}

const loadMore = () => {
  if (pagination.value.page < pagination.value.totalPages && props.businessId) {
    loadMoreAssets(props.businessId)
  }
}

const toggleTag = (tag: string) => {
  const index = selectedTags.value.indexOf(tag)
  if (index === -1) {
    selectedTags.value.push(tag)
  } else {
    selectedTags.value.splice(index, 1)
  }
}

const clearFilters = () => {
  selectedTags.value = []
  searchQuery.value = ''
}

onMounted(() => {
  fetchAssets(props.businessId || '0')
})

watch(() => props.businessId, (newBusinessId) => {
  if (newBusinessId) {
    fetchAssets(newBusinessId)
  }
})

const handleOpedEditModal = (asset: Asset) => {
  router.push({
    path: '/tools/image-editor',
    query: { imageId: asset.filename }
  })
}

const handleOpenInNewTab = (asset: Asset) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = asset.url
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    ctx?.drawImage(img, 0, 0)
    const dataURL = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = getAssetDisplayName(asset)
    link.href = dataURL
    link.click()
  }
}

const handleOptimizeAssets = () => {
  isOptimizing.value = true
  optimizationProgress.value = 0
  const intervalId = setInterval(() => {
    optimizationProgress.value += 5
    if (optimizationProgress.value >= 100) {
      clearInterval(intervalId)
      setTimeout(() => {
        isOptimizing.value = false
      }, 500)
    }
  }, 300)
}

const createNewFolder = () => {
  if (newFolderName.value.trim()) {
    folders.value.push(newFolderName.value.trim().toLowerCase())
    currentFolder.value = newFolderName.value.trim().toLowerCase()
    newFolderName.value = ''
    showFolderDialog.value = false
  }
}

const handleDeleteAsset = (asset: Asset) => {
  assetsToDelete.value = [asset]
  showDeleteDialog.value = true
}
</script>

<template>
  <div class="w-full">
    <div class="bg-card  rounded-xl p-4 mb-8">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <UButton variant="outline" size="sm" @click="selectAllAssets">
            {{ t('toolbar.select_all') }}
          </UButton>
          <UButton variant="outline" size="sm" :disabled="!hasSelectedAssets" @click="deselectAllAssets">
            {{ t('toolbar.deselect_all') }}
          </UButton>
          <span class="text-sm text-muted-foreground">
            {{ t('file_count_badge', { count: selectedAssets.length }) }}
          </span>
          <UButton v-if="hasSelectedAssets" variant="solid" color="error" size="sm" @click="handleDeleteSelected">
            <Icon name="lucide:trash-2" class="w-4 h-4" />
          </UButton>
        </div>
        <div class="flex rounded-lg  overflow-hidden">
          <UButton variant="ghost" size="sm"
            :class="{ 'bg-accent text-accent-foreground': viewMode === 'masonry' }"
            @click="viewMode = 'masonry'">
            <Icon name="lucide:layout-grid" class="w-4 h-4" />
          </UButton>
          <UButton variant="ghost" size="sm"
            :class="{ 'bg-accent text-accent-foreground': viewMode === 'grid' }"
            @click="viewMode = 'grid'">
            <Icon name="lucide:grid-3x3" class="w-4 h-4" />
          </UButton>
          <UButton variant="ghost" size="sm"
            :class="{ 'bg-accent text-accent-foreground': viewMode === 'list' }"
            @click="viewMode = 'list'">
            <Icon name="lucide:list" class="w-4 h-4" />
          </UButton>
        </div>
      </div>
    </div>

    <div v-if="isLoading && assets.length === 0" class="flex items-center justify-center py-12">
      <div class="text-center">
        <Icon name="lucide:loader-2" class="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
        <p class="text-muted-foreground">{{ t('states.loading') }}</p>
      </div>
    </div>

    <div v-else-if="error" class="text-center py-12">
      <Icon name="lucide:alert-circle" class="w-12 h-12 text-destructive mx-auto mb-4" />
      <h3 class="text-lg font-semibold mb-2">{{ t('states.error_title') }}</h3>
      <p class="text-muted-foreground mb-4">{{ error }}</p>
      <UButton @click="fetchAssets(props.businessId)" v-if="props.businessId">
        {{ t('states.try_again') }}
      </UButton>
    </div>

    <div v-else-if="filteredAssets.length === 0" class="text-center py-12">
      <Icon name="lucide:image" class="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <h3 class="text-lg font-semibold mb-2">{{ t('states.no_assets_title') }}</h3>
      <p class="text-muted-foreground mb-4">
        {{ searchQuery ? t('states.no_assets_search') : t('states.no_assets_empty') }}
      </p>
    </div>

    <div v-if="viewMode === 'masonry'" class="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
      <div v-for="(asset, index) in filteredAssets" :key="asset.id"
        class="break-inside-avoid mb-4 group cursor-pointer" @click="handleAssetClick(asset)">
        <div class="bg-card  rounded-xl overflow-hidden transition-shadow hover:shadow-md"
          :class="{ 'ring-2 ring-primary': props.selectable && isAssetSelected(asset) }">
          <div class="relative overflow-hidden">
            <div class="relative w-full">
              <video v-if="getAssetType(asset.mimeType) === 'video'"
                :src="asset.url" :alt="getAssetDisplayName(asset)"
                class="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105 aspect-video"
                loading="lazy" />
              <img v-else-if="getAssetType(asset.mimeType) === 'image'" :src="getAssetPreviewUrl(asset)"
                :alt="getAssetDisplayName(asset)"
                class="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy" />
              <div v-else
                class="aspect-square bg-muted flex items-center justify-center relative">
                <div class="text-center p-6">
                  <Icon name="lucide:file"
                    class="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                  <p class="text-sm text-muted-foreground font-medium">
                    {{ getAssetDisplayName(asset) }}
                  </p>
                </div>
              </div>
            </div>

            <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center bg-black/90">
              <div class="flex items-center justify-center gap-2">
                <UButton size="sm" variant="outline"
                  @click.stop="() => { previewAsset = asset; showPreviewModal = true; }">
                  <Icon name="lucide:eye" class="w-4 h-4" />
                </UButton>
                <UButton size="sm" variant="outline"
                  @click.stop="handleOpenInNewTab(asset)">
                  <Icon name="lucide:download" class="w-4 h-4" />
                </UButton>
                <UButton v-if="getAssetType(asset.mimeType) === 'image'" size="sm" variant="outline"
                  @click.stop="handleOpedEditModal(asset)">
                  <Icon name="lucide:edit" class="w-4 h-4" />
                </UButton>
                <UButton size="sm" variant="outline"
                  @click.stop="handleDeleteAsset(asset)">
                  <Icon name="lucide:trash-2" class="w-4 h-4" />
                </UButton>
              </div>
            </div>

            <div v-if="props.selectable"
              class="absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 z-10"
              :class="{
                'bg-primary border-primary': isAssetSelected(asset),
                'border-border bg-background': !isAssetSelected(asset)
              }">
              <Icon v-if="isAssetSelected(asset)" name="lucide:check" class="text-primary-foreground" size="14" />
            </div>

            <div v-if="isOptimizing && Math.random() > 0.7" class="absolute bottom-2 left-2">
              <Icon name="lucide:sparkles" class="w-3 h-3 text-primary animate-spin" />
            </div>
          </div>

          <div class="p-3">
            <h3 class="font-medium text-sm truncate mb-1 text-foreground">
              {{ getAssetDisplayName(asset) }}
            </h3>
            <div class="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span class="flex items-center gap-1">
                <Icon name="lucide:hard-drive" class="w-3 h-3" />
                {{ formatFileSize(asset.size) }}
              </span>
              <span class="flex items-center gap-1">
                <Icon name="lucide:calendar" class="w-3 h-3" />
                {{ new Date(asset.createdAt).toLocaleDateString() }}
              </span>
            </div>

            <div v-if="parseAssetMetadata(asset).tags?.length" class="flex flex-wrap gap-1">
              <UBadge v-for="(tag, tagIndex) in parseAssetMetadata(asset).tags?.slice(0, 2)" :key="tag"
                variant="outline" size="xs">
                {{ tag }}
              </UBadge>
              <UBadge v-if="parseAssetMetadata(asset).tags?.length > 2" variant="outline" size="xs">
                +{{ parseAssetMetadata(asset).tags.length - 2 }}
              </UBadge>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="viewMode === 'grid'" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <div v-for="(asset, index) in filteredAssets" :key="asset.id"
        class="group cursor-pointer" @click="handleAssetClick(asset)">
        <div class="bg-card  rounded-xl overflow-hidden transition-shadow hover:shadow-md"
          :class="{ 'ring-2 ring-primary': props.selectable && isAssetSelected(asset) }">
          <div class="aspect-square bg-muted relative overflow-hidden">
            <div class="relative w-full h-full">
              <video v-if="getAssetType(asset.mimeType) === 'video'"
                :src="asset.url" :alt="getAssetDisplayName(asset)"
                class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
              <img v-else-if="getAssetType(asset.mimeType) === 'image'" :src="getAssetPreviewUrl(asset)"
                :alt="getAssetDisplayName(asset)"
                class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                loading="lazy" />
              <div v-else class="flex items-center justify-center h-full">
                <div class="text-center p-2">
                  <Icon name="lucide:file" class="w-8 h-8 text-muted-foreground mx-auto mb-1" />
                  <p class="text-xs text-muted-foreground truncate font-medium">
                    {{ getAssetDisplayName(asset) }}
                  </p>
                </div>
              </div>
              <div
                class="absolute top-1 start-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-background/80 text-foreground  z-20">
                {{ getAssetType(asset.mimeType) }}
              </div>
            </div>

            <div v-if="props.selectable"
              class="absolute top-2 left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200"
              :class="{
                'bg-primary border-primary': isAssetSelected(asset),
                'border-border bg-background': !isAssetSelected(asset)
              }">
              <Icon v-if="isAssetSelected(asset)" name="lucide:check" class="text-primary-foreground" size="14" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="space-y-2">
      <div v-for="asset in filteredAssets" :key="asset.id"
        class="flex items-center gap-4 p-3  rounded-lg hover:bg-accent cursor-pointer"
        :class="{ 'bg-primary/5 border-primary': props.selectable && isAssetSelected(asset) }"
        @click="handleAssetClick(asset)">
        <UCheckbox v-if="props.selectable" :checked="isAssetSelected(asset)" @click.stop="handleAssetClick(asset)" />

        <div class="w-12 h-12 bg-muted rounded flex items-center justify-center shrink-0 overflow-hidden">
          <div class="relative w-full h-full">
            <video v-if="getAssetType(asset.mimeType) === 'video'"
              :src="asset.url" :alt="getAssetDisplayName(asset)"
              class="w-full h-full object-cover" />
            <img v-else-if="getAssetType(asset.mimeType) === 'image'" :src="getAssetPreviewUrl(asset)"
              :alt="getAssetDisplayName(asset)" class="w-full h-full object-cover" />
            <Icon v-else name="lucide:file" class="w-6 h-6 text-muted-foreground" />
            <div
              class="absolute -top-1 -end-1 px-1 py-0.5 rounded text-[8px] font-semibold uppercase bg-background/80 text-foreground ">
              {{ getAssetType(asset.mimeType) }}
            </div>
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <p class="font-medium truncate text-foreground">{{ getAssetDisplayName(asset) }}</p>
          <p class="text-sm text-muted-foreground">
            {{ formatFileSize(asset.size) }} &middot; {{ getAssetType(asset.mimeType) }}
          </p>
        </div>

        <div class="text-sm text-muted-foreground shrink-0">
          {{ new Date(asset.createdAt).toLocaleDateString() }}
        </div>
      </div>
    </div>

    <div v-if="pagination.page < pagination.totalPages" class="text-center mt-8">
      <UButton variant="outline" :disabled="isLoading" @click="loadMore">
        <Icon v-if="isLoading" name="lucide:loader-2" class="w-4 h-4 animate-spin mr-2" />
        {{ t('buttons.load_more') }}
      </UButton>
    </div>

    <UModal v-model:open="showPreviewModal" :fullscreen="isPreviewFullscreen">
      <template #header>
        <div class="flex items-center justify-between w-full flex-wrap gap-2">
          <div class="flex items-center gap-3">
            <UBadge v-if="previewAsset" variant="outline">
              {{ getAssetType(previewAsset.mimeType) }}
            </UBadge>
            <h3 class="text-lg font-semibold">{{ previewAsset ? getAssetDisplayName(previewAsset) : '' }}</h3>
          </div>
          <div class="flex items-center gap-2">
            <UButton variant="outline" size="sm">
              <Icon name="lucide:download" class="w-4 h-4" />
              {{ t('buttons.download') }}
            </UButton>
            <UButton variant="outline" size="sm"
              :disabled="!previewAsset || getAssetType(previewAsset.mimeType) !== 'image'"
              @click="handleOpedEditModal(previewAsset!)">
              <Icon name="lucide:edit" class="w-4 h-4" />
              {{ t('buttons.edit') }}
            </UButton>
            <UButton variant="ghost" size="sm" @click="isPreviewFullscreen = !isPreviewFullscreen">
              <Icon name="lucide:fullscreen" class="w-4 h-4" />
            </UButton>
          </div>
        </div>
      </template>

      <template #body>
        <div class="flex-1 flex items-center justify-center p-4">
          <img v-if="previewAsset && getAssetType(previewAsset.mimeType) === 'image'"
            :src="getAssetPreviewUrl(previewAsset)" :alt="getAssetDisplayName(previewAsset)"
            class="max-w-full max-h-[70vh] object-contain rounded-lg" />
          <div v-else-if="previewAsset && getAssetType(previewAsset.mimeType) === 'video'"
            class="w-full max-w-2xl">
            <video :src="previewAsset.url" controls class="w-full aspect-video rounded-lg"></video>
          </div>
          <div v-else-if="previewAsset" class="w-64 h-64 bg-muted rounded-lg flex items-center justify-center">
            <div class="text-center">
              <Icon name="lucide:file" class="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p class="text-muted-foreground">{{ getAssetDisplayName(previewAsset) }}</p>
            </div>
          </div>
        </div>

        <div v-if="previewAsset" class="px-6 py-4 space-y-3 border-t border-border">
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-muted-foreground">{{ t('preview_modal.size') }}</span>
              <span class="ml-2 font-medium">{{ formatFileSize(previewAsset.size) }}</span>
            </div>
            <div>
              <span class="text-muted-foreground">{{ t('preview_modal.type') }}</span>
              <span class="ml-2 font-medium">{{ previewAsset.mimeType }}</span>
            </div>
            <div>
              <span class="text-muted-foreground">{{ t('preview_modal.created') }}</span>
              <span class="ml-2 font-medium">{{ new Date(previewAsset.createdAt).toLocaleDateString() }}</span>
            </div>
            <div v-if="parseAssetMetadata(previewAsset).width">
              <span class="text-muted-foreground">{{ t('preview_modal.dimensions') }}</span>
              <span class="ml-2 font-medium">
                {{ parseAssetMetadata(previewAsset).width }} x {{ parseAssetMetadata(previewAsset).height }}
              </span>
            </div>
          </div>
          <div v-if="parseAssetMetadata(previewAsset).tags?.length">
            <span class="text-sm text-muted-foreground block mb-1">{{ t('asset_info.tags') }}:</span>
            <div class="flex flex-wrap gap-2">
              <UBadge v-for="tag in parseAssetMetadata(previewAsset).tags" :key="tag" variant="outline">
                {{ tag }}
              </UBadge>
            </div>
          </div>
        </div>
      </template>

      <template #footer="{ close }">
        <div class="flex justify-end gap-2">
          <UButton variant="outline" @click="close">{{ t('common.close') }}</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showDeleteDialog">
      <template #header>
        <div class="flex items-center gap-3">
          <Icon name="lucide:trash-2" class="w-6 h-6 text-destructive" />
          <h3 class="font-semibold">{{ t('delete_dialog.title') }}</h3>
        </div>
      </template>
      <template #body>
        <p class="text-muted-foreground">{{ t('delete_dialog.description', { count: assetsToDelete.length }) }}</p>
      </template>
      <template #footer="{ close }">
        <div class="flex items-center gap-2 justify-end">
          <UButton variant="outline" @click="close">{{ t('delete_dialog.cancel') }}</UButton>
          <UButton variant="solid" color="error" @click="confirmDelete">
            <Icon name="lucide:trash-2" class="w-4 h-4 mr-2" />
            {{ t('delete_dialog.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showFolderDialog">
      <template #header>
        <div class="flex items-center gap-3">
          <Icon name="lucide:folder-plus" class="w-6 h-6 text-primary" />
          <h3 class="text-lg font-semibold">{{ t('folder_dialog.title') }}</h3>
        </div>
      </template>
      <template #body>
        <div class="space-y-4">
          <p class="text-muted-foreground text-sm">{{ t('folder_dialog.description') }}</p>
          <UInput v-model="newFolderName" :placeholder="t('folder_name_placeholder')" />
        </div>
      </template>
      <template #footer="{ close }">
        <div class="flex justify-end gap-2">
          <UButton variant="outline" @click="close">{{ t('folder_dialog.cancel') }}</UButton>
          <UButton :disabled="!newFolderName.trim()" @click="createNewFolder">
            <Icon name="lucide:folder-plus" class="w-4 h-4 mr-2" />
            {{ t('folder_dialog.create') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="isOptimizing">
      <template #header>
        <div class="flex items-center gap-3">
          <Icon name="lucide:sparkles" class="w-6 h-6 text-primary" />
          <h3 class="text-lg font-semibold">{{ t('optimization_dialog.title') }}</h3>
        </div>
      </template>
      <template #body>
        <div class="space-y-6">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">{{ t('optimization_dialog.progress') }}</span>
              <span class="text-sm text-primary font-medium">{{ optimizationProgress }}%</span>
            </div>
            <div class="h-2 bg-muted rounded-full overflow-hidden">
              <div class="h-full bg-primary rounded-full transition-all duration-300"
                :style="{ width: `${optimizationProgress}%` }">
              </div>
            </div>
          </div>
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <div class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon name="lucide:check" class="w-3 h-3 text-primary" />
              </div>
              <p class="text-sm font-medium">{{ t('optimization_dialog.converting_webp') }}</p>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon name="lucide:check" class="w-3 h-3 text-primary" />
              </div>
              <p class="text-sm font-medium">{{ t('optimization_dialog.compressing') }}</p>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon name="lucide:loader-2" class="w-3 h-3 text-primary animate-spin" />
              </div>
              <p class="text-sm font-medium">{{ t('optimization_dialog.thumbnails') }}</p>
            </div>
          </div>
        </div>
      </template>
      <template #footer="{ close }">
        <div class="flex justify-end">
          <UButton variant="outline" @click="close">{{ t('optimization_dialog.run_background') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>