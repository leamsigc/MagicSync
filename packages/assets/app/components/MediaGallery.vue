<!--  Translation file -->
<i18n src="./MediaGallery.json"></i18n>
<script lang="ts" setup>
import type { header } from '#build/ui'
import type { Asset } from '#layers/BaseDB/db/schema'

/**
 * Elegant Asset Gallery Component: Premium masonry layout with luxury animations
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test
 * @todo [✔] Update the typescript
 */

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

// Local state
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

// Computed
const filteredAssets = computed(() => {
  let filtered = [...assets.value]

  // Filter by type
  if (props.filterType !== 'all') {
    filtered = getAssetsByType(props.filterType)
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(asset =>
      getAssetDisplayName(asset).toLowerCase().includes(query)
    )
  }

  // Filter by tags
  if (selectedTags.value.length > 0) {
    filtered = filtered.filter(asset => {
      const metadata = parseAssetMetadata(asset)
      const assetTags = metadata.tags || []
      return selectedTags.value.some(tag => assetTags.includes(tag))
    })
  }

  // Sort assets
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

// Methods
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
    // Open preview modal
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

// Lifecycle
onMounted(() => {
  fetchAssets(props.businessId || '0')
})

watch(() => props.businessId, (newBusinessId) => {
  if (newBusinessId) {
    fetchAssets(newBusinessId)
  }
})

const handleOpedEditModal = (asset: Asset) => {
  // router push
  router.push({
    path: '/tools/image-editor',
    query: {
      imageId: asset.filename
    }
  })
}
const handleOpenInNewTab = (asset: Asset) => {
  const url = asset.url
  // Get the image then transform to base64
  const img = new Image()
  img.src = url
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
    <!-- Premium Header with Glass Morphism -->
    <div class="glass-card  mb-8 animate-fade-in-up">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <UButton variant="outline" size="sm" @click="selectAllAssets">
              {{ t('toolbar.select_all') }}
            </UButton>
            <UButton variant="outline" size="sm" @click="deselectAllAssets" :disabled="!hasSelectedAssets">
              {{ t('toolbar.deselect_all') }}
            </UButton>
            <span class="text-sm text-muted-foreground">
              {{ t('file_count_badge', { count: selectedAssets.length }) }}
            </span>
          </div>

          <div class="flex items-center gap-2" v-if="hasSelectedAssets">
            <UButton variant="outline" color="error" size="sm" :disabled="!hasSelectedAssets"
              @click="handleDeleteSelected">
              <Icon name="lucide:trash-2" class="w-4 h-4 mr-2" />
              {{ t('toolbar.delete_selected') }}
            </UButton>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- View Mode Toggle -->
          <div class="flex border rounded-lg glass-button-group">
            <UButton variant="ghost" size="sm" class="glass-button-item hover-scale-105"
              :class="{ 'bg-primary text-white dark:text-primary-foreground': viewMode === 'masonry' }"
              @click="viewMode = 'masonry'">
              <Icon name="lucide:layout-grid" class="w-4 h-4" />
            </UButton>
            <UButton variant="ghost" size="sm" class="glass-button-item hover-scale-105"
              :class="{ 'bg-primary text-white dark:text-primary-foreground': viewMode === 'grid' }"
              @click="viewMode = 'grid'">
              <Icon name="lucide:grid-3x3" class="w-4 h-4" />
            </UButton>
            <UButton variant="ghost" size="sm" class="glass-button-item hover-scale-105"
              :class="{ 'bg-primary text-white dark:text-primary-foreground': viewMode === 'list' }"
              @click="viewMode = 'list'">
              <Icon name="lucide:list" class="w-4 h-4" />
            </UButton>
          </div>
        </div>
      </div>
    </div>


    <!-- Loading State -->
    <div v-if="isLoading && assets.length === 0" class="flex items-center justify-center py-12">
      <div class="text-center">
        <Icon name="lucide:loader-2" class="w-8 h-8 animate-spin mx-auto mb-2" />
        <p class="text-muted-foreground">{{ t('states.loading') }}</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12">
      <Icon name="lucide:alert-circle" class="w-12 h-12 text-destructive mx-auto mb-4" />
      <h3 class="text-lg font-semibold mb-2">{{ t('states.error_title') }}</h3>
      <p class="text-muted-foreground mb-4">{{ error }}</p>
      <UButton @click="fetchAssets(props.businessId)" v-if="props.businessId">
        {{ t('states.try_again') }}
      </UButton>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredAssets.length === 0" class="text-center py-12">
      <Icon name="lucide:image" class="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <h3 class="text-lg font-semibold mb-2">{{ t('states.no_assets_title') }}</h3>
      <p class="text-muted-foreground mb-4">
        {{ searchQuery ? t('states.no_assets_search') : t('states.no_assets_empty') }}
      </p>
    </div>
    <!-- Galley view -->
    <div v-if="viewMode === 'masonry'" class="masonry-grid ">
      <div v-for="(asset, index) in filteredAssets" :key="asset.id"
        class="masonry-item group cursor-pointer animate-fade-in-up hover-lift"
        :class="`animate-stagger-${Math.min(index % 5 + 1, 5)}`" @click="handleAssetClick(asset)">
        <div class="asset-card glass-card overflow-hidden relative asset-card-shimmer rounded-2xl" :class="{
          'ring-2 ring-primary shadow-primary/30 hover-glow': props.selectable && isAssetSelected(asset)
        }">
          <!-- Premium Shimmer Effect -->
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <div
              class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 animate-shimmer">
            </div>
          </div>

          <!-- Asset Preview with Enhanced Overlay -->
          <div class="relative overflow-hidden">
            <img v-if="getAssetType(asset.mimeType) === 'image'" :src="getAssetPreviewUrl(asset)"
              :alt="getAssetDisplayName(asset)"
              class="asset-image w-full h-auto object-cover transition-all duration-500 group-hover:scale-110 asset-image-hover-scale"
              loading="lazy" />
            <div v-else
              class="aspect-square bg-linear-to-br from-muted via-muted/80 to-muted/50 flex items-center justify-center relative">
              <!-- Animated Background Pattern -->
              <div class="absolute inset-0 opacity-20">
                <div class="absolute top-4 left-4 w-8 h-8 bg-primary/20 rounded-full animate-float-1"></div>
                <div class="absolute bottom-6 right-6 w-6 h-6 bg-primary/15 rounded-full animate-float-2"></div>
                <div class="absolute top-1/2 left-1/2 w-4 h-4 bg-primary/10 rounded-full animate-float-3"></div>
              </div>

              <div class="text-center p-6 relative z-10">
                <div class="relative mb-4">
                  <div class="absolute inset-0 bg-primary/10 rounded-full blur-xl animate-pulse-slow"></div>
                  <Icon :name="getAssetType(asset.mimeType) === 'video' ? 'lucide:video' : 'lucide:file'"
                    class="w-12 h-12 text-primary mx-auto relative z-10 group-hover:scale-110 transition-transform duration-300" />
                </div>
                <p class="text-sm text-muted-foreground font-medium">
                  {{ getAssetDisplayName(asset) }}
                </p>
              </div>
            </div>

            <!-- Enhanced Hover Overlay with Gradient -->
            <div class="asset-overlay z-10">
              <div class="flex items-center justify-center gap-3">
                <UButton size="sm" variant="outline"
                  class="asset-overlay-button glass-button hover-scale-110 backdrop-blur-md"
                  @click.stop="() => { previewAsset = asset; showPreviewModal = true; }">
                  <Icon name="lucide:eye" class="w-4 h-4" />
                </UButton>
                <UButton size="sm" variant="outline"
                  class="asset-overlay-button glass-button hover-scale-110 backdrop-blur-md"
                  @click.stop="handleOpenInNewTab(asset)">
                  <Icon name="lucide:download" class="w-4 h-4" />
                </UButton>
                <UButton v-if="getAssetType(asset.mimeType) === 'image'" size="sm" variant="outline"
                  class="asset-overlay-button glass-button hover-scale-110 backdrop-blur-md"
                  @click.stop="handleOpedEditModal(asset)">
                  <Icon name="lucide:edit" class="w-4 h-4" />
                </UButton>
                <UButton size="sm" variant="outline"
                  class="asset-overlay-button glass-button hover-scale-110 backdrop-blur-md"
                  @click.stop="handleDeleteAsset(asset)">
                  <Icon name="lucide:trash-2" class="w-4 h-4" />
                </UButton>
              </div>
            </div>

            <!-- Enhanced Selection Indicator -->
            <div v-if="props.selectable" class="asset-selection-indicator" :class="{
              'selected': isAssetSelected(asset)
            }">
              <Icon v-if="isAssetSelected(asset)" name="lucide:check" class="w-3 h-3 text-white animate-scale-in" />
            </div>

            <!-- Premium Asset Type Badge -->
            <section class="mx-2">
              <UBadge :label="getAssetType(asset.mimeType).toUpperCase()" size="xs" />
            </section>


            <!-- Optimization Indicator -->
            <div v-if="isOptimizing && Math.random() > 0.7" class="absolute bottom-2 left-2 optimization-indicator">
              <Icon name="lucide:sparkles" class="w-3 h-3 text-primary animate-spin" />
              <span class="text-xs text-primary font-medium">Optimizing...</span>
            </div>
          </div>

          <!-- Enhanced Asset Info Panel -->
          <div class="p-4 bg-linear-to-t from-background/95 to-background/80 backdrop-blur-sm">
            <h3 class="font-semibold text-sm truncate mb-2 group-hover:text-primary transition-colors duration-300">
              {{ getAssetDisplayName(asset) }}
            </h3>
            <div class="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span class="flex items-center gap-1">
                <Icon name="lucide:hard-drive" class="w-3 h-3" />
                {{ formatFileSize(asset.size) }}
              </span>
              <span class="flex items-center gap-1">
                <Icon name="lucide:calendar" class="w-3 h-3" />
                {{ new Date(asset.createdAt).toLocaleDateString() }}
              </span>
            </div>

            <!-- Enhanced Tags with Animation -->
            <div v-if="parseAssetMetadata(asset).tags?.length" class="flex flex-wrap gap-1">
              <UBadge v-for="(tag, tagIndex) in parseAssetMetadata(asset).tags?.slice(0, 2)" :key="tag"
                variant="outline"
                class="text-xs glass-badge hover-scale-105 transition-all duration-200 animate-fade-in-up"
                :class="`animate-stagger-${tagIndex + 1}`">
                <Icon name="lucide:tag" class="w-2.5 h-2.5 mr-1" />
                {{ tag }}
              </UBadge>
              <UBadge v-if="parseAssetMetadata(asset).tags?.length > 2" variant="outline"
                class="text-xs glass-badge opacity-60">
                +{{ parseAssetMetadata(asset).tags.length - 2 }}
              </UBadge>
            </div>

            <!-- Asset Quality Indicator -->
            <div class="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
              <div class="flex items-center gap-1 text-xs">
                <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse-slow"></div>
                {{ t('asset_quality') }}
              </div>
              <div v-if="parseAssetMetadata(asset).width" class="text-xs text-muted-foreground">
                {{ parseAssetMetadata(asset).width }}×{{ parseAssetMetadata(asset).height }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="viewMode === 'grid'" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
      <div v-for="(asset, index) in filteredAssets" :key="asset.id"
        class="group cursor-pointer animate-fade-in-up hover-translate-y-1 rounded-2xl bg-neutral-700/30 hover-glow"
        :class="`animate-stagger-${Math.min(index % 5 + 1, 5)}`" @click="handleAssetClick(asset)">
        <div
          class="glass-card overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 rounded-2xl"
          :class="{
            'ring-2 ring-primary shadow-primary/20': props.selectable && isAssetSelected(asset)
          }">
          <!-- Asset Preview -->
          <div
            class="aspect-square bg-linear-to-br from-muted to-muted/50 flex items-center justify-center relative overflow-hidden">
            <img v-if="getAssetType(asset.mimeType) === 'image'" :src="getAssetPreviewUrl(asset)"
              :alt="getAssetDisplayName(asset)"
              class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy" />
            <div v-else class="text-center p-4">
              <Icon :name="getAssetType(asset.mimeType) === 'video' ? 'lucide:video' : 'lucide:file'"
                class="w-8 h-8 text-muted-foreground mx-auto mb-2 group-hover:scale-110 transition-transform duration-300" />
              <p class="text-xs text-muted-foreground truncate font-medium">
                {{ getAssetDisplayName(asset) }}
              </p>
            </div>

            <!-- Selection Indicator -->
            <div v-if="props.selectable"
              class="absolute top-2 left-2 w-5 h-5 rounded-full border-2 backdrop-blur-sm flex items-center justify-center transition-all duration-200"
              :class="{
                'bg-primary border-primary scale-110': isAssetSelected(asset),
                'border-white/80 bg-white/90': !isAssetSelected(asset)
              }">
              <Icon v-if="isAssetSelected(asset)" name="lucide:check" class="text-white font-extrabold" size="32" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="space-y-2">
      <div v-for="asset in filteredAssets" :key="asset.id"
        class="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer" :class="{
          'bg-primary/10 border-primary': props.selectable && isAssetSelected(asset)
        }" @click="handleAssetClick(asset)">
        <!-- Selection Checkbox -->
        <UCheckbox v-if="props.selectable" :checked="isAssetSelected(asset)" @click.stop="handleAssetClick(asset)" />

        <!-- Asset Thumbnail -->
        <div class="w-12 h-12 bg-muted rounded flex items-center justify-center flex-shrink-0">
          <img v-if="getAssetType(asset.mimeType) === 'image'" :src="getAssetPreviewUrl(asset)"
            :alt="getAssetDisplayName(asset)" class="w-full h-full object-cover rounded" />
          <Icon v-else :name="getAssetType(asset.mimeType) === 'video' ? 'lucide:video' : 'lucide:file'"
            class="w-6 h-6 text-muted-foreground" />
        </div>

        <!-- Asset Details -->
        <div class="flex-1 min-w-0">
          <p class="font-medium truncate">{{ getAssetDisplayName(asset) }}</p>
          <p class="text-sm text-muted-foreground">
            {{ formatFileSize(asset.size) }} • {{ getAssetType(asset.mimeType) }}
          </p>
        </div>

        <!-- Upload Date -->
        <div class="text-sm text-muted-foreground">
          {{ new Date(asset.createdAt).toLocaleDateString() }}
        </div>
      </div>
    </div>

    <!-- Galley view end -->
    <!-- Load More -->
    <div v-if="pagination.page < pagination.totalPages" class="text-center mt-8">
      <UButton variant="outline" :disabled="isLoading" @click="loadMore">
        <Icon v-if="isLoading" name="lucide:loader-2" class="w-4 h-4 animate-spin mr-2" />
        {{ t('buttons.load_more') }}
      </UButton>
    </div>

    <!-- Premium Asset Preview Modal -->
    <UModal v-model:open="showPreviewModal" :ui="{ body: 'border-0', header: 'border-0' }"
      :fullscreen="isPreviewFullscreen">
      <template #header>
        <div class="flex items-center justify-between w-full">
          <div class="flex items-center gap-3">
            <UBadge v-if="previewAsset" variant="outline" class="glass-badge">
              {{ getAssetType(previewAsset.mimeType) }}
            </UBadge>
            <h3 class="text-lg font-semibold">{{ previewAsset ? getAssetDisplayName(previewAsset) : '' }}</h3>
          </div>
          <div class="flex items-center gap-2 ml-auto">
            <UButton v-if="previewAsset" variant="ghost" size="sm" class="glass-button">
              <Icon name="lucide:download" class="w-4 h-4 mr-2" />
              {{ t('buttons.download') }}
            </UButton>
            <UButton v-if="previewAsset" variant="ghost" size="sm" class="glass-button"
              :disabled="getAssetType(previewAsset!.mimeType) !== 'image'" @click="handleOpedEditModal(previewAsset!)">
              <Icon name="lucide:edit" class="w-4 h-4 mr-2" />
              {{ t('buttons.edit') }}
            </UButton>
            <UButton variant="ghost" size="sm" class="glass-button" @click="isPreviewFullscreen = !isPreviewFullscreen">
              <Icon name="lucide:fullscreen" class="w-4 h-4" />
            </UButton>
          </div>
        </div>
      </template>

      <template #body>
        <div class="flex-1 flex items-center justify-center">
          <div class="max-w-full max-h-full">
            <img v-if="previewAsset && getAssetType(previewAsset.mimeType) === 'image'"
              :src="getAssetPreviewUrl(previewAsset)" :alt="getAssetDisplayName(previewAsset)"
              class="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />

            <div v-else-if="previewAsset && getAssetType(previewAsset.mimeType) === 'video'"
              class="flex items-center justify-center  bg-muted rounded-lg max-w-2xl">
              <video :src="previewAsset.url" controls class="aspect-video"></video>
            </div>
            <div v-else-if="previewAsset" class="flex items-center justify-center w-64 h-64 bg-muted rounded-lg">
              <div class="text-center">
                <Icon :name="getAssetType(previewAsset.mimeType) === 'video' ? 'lucide:video' : 'lucide:file'"
                  class="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p class="text-muted-foreground">{{ getAssetDisplayName(previewAsset) }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Asset Details -->
        <div class="py-6 space-y-4">
          <div v-if="previewAsset" class="grid grid-cols-2  gap-2 text-sm">
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

          <!-- Tags -->
          <div v-if="previewAsset && parseAssetMetadata(previewAsset).tags?.length" class="mt-4">
            <span class="text-sm text-muted-foreground mb-2 block">{{ t('asset_info.tags') }}:</span>
            <div class="flex flex-wrap gap-2">
              <UBadge v-for="tag in parseAssetMetadata(previewAsset).tags" :key="tag" variant="outline"
                class="glass-badge">
                {{ tag }}
              </UBadge>
            </div>
          </div>
        </div>
      </template>

      <template #footer="{ close }">
        <div class="flex gap-2 ">
          <UButton variant="outline" @click="close">
            {{ t('common.close') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="showDeleteDialog" :ui="{ body: 'border-0', header: 'border-0' }">
      <template #header>
        <div class="flex items-center gap-3 ">
          <Icon name="lucide:trash-2" class="w-6 h-6 text-destructive" />
          <div>
            <h3 class="font-semibold">{{ t('delete_dialog.title') }}</h3>
          </div>
        </div>
      </template>
      <template #body>
        <p class="text-muted-foreground">{{ t('delete_dialog.description', { count: assetsToDelete.length }) }}</p>
      </template>

      <template #footer="{ close }">
        <div class="flex items-center gap-2 ">
          <UButton variant="outline" @click="close">{{ t('delete_dialog.cancel') }}</UButton>
          <UButton variant="solid" style="background-color: rgb(239 68 68); color: white;" @click="confirmDelete"
            class="cursor-pointer">
            <Icon name="lucide:trash-2" class="w-4 h-4 mr-2" />
            {{ t('delete_dialog.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- New Folder Modal -->
    <UModal v-model:open="showFolderDialog">
      <template #header>
        <div class="flex items-center gap-3 p-6 border-b glass-border">
          <Icon name="lucide:folder-plus" class="w-6 h-6 text-primary" />
          <div>
            <h3 class="text-lg font-semibold">{{ t('folder_dialog.title') }}</h3>
            <p class="text-muted-foreground">{{ t('folder_dialog.description') }}</p>
          </div>
        </div>
      </template>

      <template #body>
        <div class="p-6">
          <div class="space-y-4">
            <div class="space-y-2">
              <label for="folder-name">{{ t('folder_name_label') }}</label>
              <UInput id="folder-name" v-model="newFolderName" :placeholder="t('folder_name_placeholder')"
                class="glass-input" />
            </div>
          </div>
        </div>
      </template>

      <template #footer="{ close }">
        <div class="flex justify-end gap-2 p-6 border-t">
          <UButton variant="outline" @click="close">{{ t('folder_dialog.cancel') }}</UButton>
          <UButton class="bg-linear-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            :disabled="!newFolderName.trim()" @click="createNewFolder">
            <Icon name="lucide:folder-plus" class="w-4 h-4 mr-2" />
            {{ t('folder_dialog.create') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Image Optimization Modal -->
    <UModal v-model:open="isOptimizing">
      <template #header>
        <div class="flex items-center gap-3 p-6 border-b glass-border">
          <Icon name="lucide:sparkles" class="w-6 h-6 text-primary" />
          <div>
            <h3 class="text-lg font-semibold">{{ t('optimization_dialog.title') }}</h3>
            <p class="text-muted-foreground">{{ t('optimization_dialog.description') }}</p>
          </div>
        </div>
      </template>

      <template #body>
        <div class="p-6">
          <div class="space-y-6">
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium">{{ t('optimization_dialog.progress') }}</span>
                <span class="text-sm text-primary font-medium">{{ optimizationProgress }}%</span>
              </div>
              <div class="h-2 bg-muted rounded-full overflow-hidden">
                <div class="h-full bg-linear-to-r from-primary to-primary/60 rounded-full transition-all duration-300"
                  :style="{ width: `${optimizationProgress}%` }">
                  <div class="h-full bg-white/20 animate-shimmer"></div>
                </div>
              </div>
            </div>

            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon name="lucide:check" class="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p class="text-sm font-medium">{{ t('optimization_dialog.converting_webp') }}</p>
                  <p class="text-xs text-muted-foreground">{{ t('optimization_dialog.converting_webp_desc') }}</p>
                </div>
              </div>

              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon name="lucide:check" class="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p class="text-sm font-medium">{{ t('optimization_dialog.compressing') }}</p>
                  <p class="text-xs text-muted-foreground">{{ t('optimization_dialog.compressing_desc') }}</p>
                </div>
              </div>

              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon name="lucide:loader-2" class="w-4 h-4 text-primary animate-spin" />
                </div>
                <div>
                  <p class="text-sm font-medium">{{ t('optimization_dialog.thumbnails') }}</p>
                  <p class="text-xs text-muted-foreground">{{ t('optimization_dialog.thumbnails_desc') }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template #footer="{ close }">
        <div class="flex justify-end p-6 border-t">
          <UButton variant="outline" @click="close">{{ t('optimization_dialog.run_background') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
/* Premium Hover Effects */
.hover-scale-105:hover {
  transform: scale(1.05);
}

.hover-translate-y-1:hover {
  transform: translateY(-0.25rem);
}

.hover-rotate-3:hover {
  transform: rotate(3deg);
}

/* Animation Delays */
.animate-stagger-1 {
  animation-delay: 0.1s;
}

.animate-stagger-2 {
  animation-delay: 0.2s;
}

.animate-stagger-3 {
  animation-delay: 0.3s;
}

.animate-stagger-4 {
  animation-delay: 0.4s;
}

.animate-stagger-5 {
  animation-delay: 0.5s;
}

/* Custom Animations */
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

@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes slide-down {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.animate-scale-in {
  animation: scale-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.animate-slide-down {
  animation: slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
