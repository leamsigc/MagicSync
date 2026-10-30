<!--  Translation file -->
<i18n src="./MediaGallery.json"></i18n>
<script lang="ts" setup>
import type { Asset } from '#layers/BaseDB/db/schema'
import type { AssetFolderSummary, FolderScope } from '#layers/BaseShared/shared/utils/asset-folders'

const UNFILED_TOKEN = 'unfiled'

interface Props {
  businessId?: string
  selectable?: boolean
  multiSelect?: boolean
  selectedAssets?: Asset[]
  showUploader?: boolean
  filterType?: 'image' | 'video' | 'document' | 'all'
  /** Search term owned by the page toolbar; the filter itself runs here. */
  searchQuery?: string
  /** View mode owned by the page toolbar; masonry/grid/list rendering stays here. */
  viewMode?: 'masonry' | 'grid' | 'list' | 'carousel'
  /** Which bucket to list. Passed down rather than fetched again. */
  folderScope?: FolderScope
  folders?: AssetFolderSummary[]
}

interface Emits {
  (e: 'select', asset: Asset): void
  (e: 'deselect', asset: Asset): void
  (e: 'upload', files: File[]): void
  (e: 'preview', asset: Asset): void
  (e: 'open-edit-modal', asset: Asset): void
  (e: 'move-selected', folderId: string | null): void
  (e: 'update:showUploader', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  selectable: false,
  multiSelect: false,
  selectedAssets: () => [],
  showUploader: true,
  filterType: 'all',
  searchQuery: '',
  viewMode: 'masonry',
  folderScope: () => ({ kind: 'unfiled' }),
  folders: () => [],
})

const router = useRouter()
const emit = defineEmits<Emits>()
const { t } = useI18n()

const {
  assets,
  selectedAssets,
  isLoading,
  isLoadingMore,
  error,
  pagination,
  fetchAssets,
  uploadFiles,
  deleteAssets,
  isDeletingAssets,
  toggleAssetSelection,
  selectAllAssets,
  deselectAllAssets,
  isAssetSelected,
  getAssetsByType,
  loadMoreAssets,
  setFolderScope
} = useAssetManagement()

const { getAssetType, formatFileSize, getAssetPreviewUrl, getAssetDisplayName } = useAsset()

const showDeleteDialog = ref(false)
const assetsToDelete = ref<Asset[]>([])
const showPreviewModal = ref(false)
const previewAsset = ref<Asset | null>(null)
const sortBy = ref<'name' | 'date' | 'size' | 'type'>('date')
const sortOrder = ref<'asc' | 'desc'>('desc')
const showFilters = ref(false)
const selectedTags = ref<string[]>([])
const isOptimizing = ref(false)
const optimizationProgress = ref(0)
const isPreviewFullscreen = ref(false)

const filteredAssets = computed(() => {
  const list = props.filterType === 'all' ? [...assets.value] : getAssetsByType(props.filterType)
  const term = props.searchQuery.trim().toLowerCase()
  const searched = term
    ? list.filter(asset => getAssetDisplayName(asset).toLowerCase().includes(term))
    : list
  const tagged = selectedTags.value.length > 0
    ? searched.filter(asset => {
      const metadata = parseAssetMetadata(asset)
      const assetTags = metadata.tags || []
      return selectedTags.value.some(tag => assetTags.includes(tag))
    })
    : searched
  const direction = sortOrder.value === 'asc' ? 1 : -1
  return [...tagged].sort((a, b) => compareAssets(a, b) * direction)
})

const hasSelectedAssets = computed(() => selectedAssets.value.length > 0)

/** Sort comparator for the page-owned `sortBy` / `sortOrder` state. */
function compareAssets(a: Asset, b: Asset): number {
  switch (sortBy.value) {
    case 'name':
      return getAssetDisplayName(a).localeCompare(getAssetDisplayName(b))
    case 'size':
      return a.size - b.size
    case 'type':
      return a.mimeType.localeCompare(b.mimeType)
    default:
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  }
}

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

const handlePreview = (asset: Asset) => {
  previewAsset.value = asset
  showPreviewModal.value = true
  emit('preview', asset)
}

/** Index of the open asset inside the currently visible list (carousel source). */
const previewIndex = computed(() => {
  if (!previewAsset.value) return -1
  return filteredAssets.value.findIndex(asset => asset.id === previewAsset.value?.id)
})

const hasPreviewNavigation = computed(() => filteredAssets.value.length > 1)

/** Carousel view: one large asset at a time, driven by the filtered list. */
const carouselIndex = ref(0)
const carouselAsset = computed(() => filteredAssets.value[carouselIndex.value] ?? filteredAssets.value[0] ?? null)

watch(filteredAssets, (list) => {
  if (carouselIndex.value >= list.length) carouselIndex.value = 0
})

function selectCarousel(index: number) {
  carouselIndex.value = index
}

function stepCarousel(direction: 1 | -1) {
  const total = filteredAssets.value.length
  if (total === 0) return
  carouselIndex.value = (carouselIndex.value + direction + total) % total
}

function handleCarouselPrev() {
  stepCarousel(-1)
}

function handleCarouselNext() {
  stepCarousel(1)
}

function stepPreview(direction: 1 | -1) {
  const list = filteredAssets.value
  if (list.length === 0) return
  const current = previewIndex.value
  const next = current < 0 ? 0 : (current + direction + list.length) % list.length
  previewAsset.value = list[next] ?? null
}

function handlePreviewPrev() {
  stepPreview(-1)
}

function handlePreviewNext() {
  stepPreview(1)
}

function handlePreviewKeydown(event: KeyboardEvent) {
  if (!showPreviewModal.value) {
    if (props.viewMode === 'carousel' && filteredAssets.value.length > 1) {
      if (event.key === 'ArrowLeft') handleCarouselPrev()
      if (event.key === 'ArrowRight') handleCarouselNext()
    }
    return
  }
  if (event.key === 'ArrowLeft') handlePreviewPrev()
  if (event.key === 'ArrowRight') handlePreviewNext()
}

onMounted(() => window.addEventListener('keydown', handlePreviewKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handlePreviewKeydown))

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

const toggleFullscreen = () => {
  isPreviewFullscreen.value = !isPreviewFullscreen.value
}

const handleDeleteSelected = () => {
  assetsToDelete.value = [...selectedAssets.value]
  showDeleteDialog.value = true
}

const closeDeleteDialog = () => {
  showDeleteDialog.value = false
  assetsToDelete.value = []
}

const confirmDelete = async () => {
  const assetIds = assetsToDelete.value.map(asset => asset.id)
  closeDeleteDialog()
  await deleteAssets(assetIds)
}

const loadMore = () => {
  if (isLoading.value || isLoadingMore.value) return
  if (pagination.value.page < pagination.value.totalPages && props.businessId) {
    loadMoreAssets(props.businessId)
  }
}

// Infinite scroll: auto-load the next page when the sentinel enters the viewport
const sentinelRef = ref<HTMLElement | null>(null)
let sentinelObserver: IntersectionObserver | null = null

watch(sentinelRef, (element) => {
  sentinelObserver?.disconnect()
  sentinelObserver = null
  if (element && typeof IntersectionObserver !== 'undefined') {
    sentinelObserver = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        loadMore()
      }
    }, { rootMargin: '300px 0px' })
    sentinelObserver.observe(element)
  }
})

onBeforeUnmount(() => {
  sentinelObserver?.disconnect()
  sentinelObserver = null
})

const toggleTag = (tag: string) => {
  const index = selectedTags.value.indexOf(tag)
  if (index === -1) {
    selectedTags.value.push(tag)
  } else {
    selectedTags.value.splice(index, 1)
  }
}

// One watcher over business AND folder scope: the composable holds the scope so
// infinite scroll pages the same bucket the first page came from.
watch(
  () => [props.businessId, props.folderScope] as const,
  ([businessId, scope]) => {
    if (!businessId) return
    setFolderScope(scope)
    fetchAssets(businessId, { filters: { folderScope: scope } })
  },
  { immediate: true },
)

const retryFetch = () => {
  fetchAssets(props.businessId || '0', { filters: { folderScope: props.folderScope } })
}

const moveTargetToken = ref(UNFILED_TOKEN)

const moveTargets = computed(() => [
  { value: UNFILED_TOKEN, label: t('unfiled'), icon: 'i-lucide-inbox' },
  ...props.folders.map(folder => ({
    value: folder.id,
    label: `${folder.name} (${folder.assetCount})`,
    icon: 'i-lucide-folder',
  })),
])

const handleMoveSelected = () => {
  emit('move-selected', moveTargetToken.value === UNFILED_TOKEN ? null : moveTargetToken.value)
}

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

const handleDeleteAsset = (asset: Asset) => {
  assetsToDelete.value = [asset]
  showDeleteDialog.value = true
}
</script>

<template>
  <div class="w-full">
    <div class="bg-card rounded-xl p-4">
      <div class="flex flex-wrap items-center gap-3">
        <UButton variant="outline" size="sm" @click="selectAllAssets">
          {{ t('toolbar.select_all') }}
        </UButton>
        <UButton variant="outline" size="sm" :disabled="!hasSelectedAssets" @click="deselectAllAssets">
          {{ t('toolbar.deselect_all') }}
        </UButton>
        <span class="text-sm text-muted-foreground">
          {{ t('toolbar.selected_count', { count: selectedAssets.length }) }}
        </span>
        <UButton v-if="hasSelectedAssets" variant="solid" color="error" size="sm"
          :aria-label="t('toolbar.delete_selected')" :disabled="isDeletingAssets" @click="handleDeleteSelected">
          <Icon name="lucide:trash-2" class="w-4 h-4" />
        </UButton>
        <div v-if="hasSelectedAssets" class="flex items-center gap-2" v-motion-slide-bottom :duration="250">
          <USelect v-model="moveTargetToken" :items="moveTargets" class="w-[180px]" size="sm"
            :aria-label="t('folders')" />
          <UButton size="sm" variant="outline" @click="handleMoveSelected">
            <Icon name="lucide:folder-input" class="w-4 h-4" />
            {{ t('move_selected') }}
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
      <UButton @click="retryFetch" v-if="props.businessId">
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

    <div v-if="viewMode === 'masonry'" class="columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4">
      <div v-for="asset in filteredAssets" :key="asset.id"
        class="group relative mb-3 break-inside-avoid cursor-pointer overflow-hidden rounded-xl bg-elevated"
        :class="{ 'ring-2 ring-primary': props.selectable && isAssetSelected(asset) }" @click="handleAssetClick(asset)">
        <video v-if="getAssetType(asset.mimeType) === 'video'" :src="asset.url" class="h-auto w-full object-cover" muted
          playsinline preload="metadata" />
        <img v-else-if="getAssetType(asset.mimeType) === 'image'" :src="getAssetPreviewUrl(asset)"
          :alt="getAssetDisplayName(asset)"
          class="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy" />
        <div v-else class="flex aspect-4/3 items-center justify-center p-6">
          <div class="text-center">
            <Icon name="lucide:file" class="mx-auto mb-2 size-8 text-muted" />
            <p class="line-clamp-2 text-xs font-medium text-muted">{{ getAssetDisplayName(asset) }}</p>
          </div>
        </div>

        <span v-if="getAssetType(asset.mimeType) === 'video'"
          class="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span class="flex size-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
            <Icon name="lucide:play" class="size-4 translate-x-px text-white" />
          </span>
        </span>

        <div v-if="props.selectable"
          class="absolute left-2 top-2 z-10 size-5 rounded-full border-2 transition-all duration-200"
          :class="isAssetSelected(asset) ? 'border-primary bg-primary' : 'border-white/80 bg-black/30'">
          <Icon v-if="isAssetSelected(asset)" name="lucide:check" class="text-white" size="12" />
        </div>

        <div
          class="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/65 via-black/5 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <div class="pointer-events-auto flex items-end justify-between gap-2 p-2">
            <p class="min-w-0 truncate text-xs font-medium text-white">{{ getAssetDisplayName(asset) }}</p>
            <div class="flex shrink-0 items-center gap-1">
              <UButton size="xs" variant="solid" color="neutral" icon="lucide:eye" :aria-label="t('buttons.preview')"
                @click.stop="handlePreview(asset)" />
              <UButton size="xs" variant="solid" color="neutral" icon="lucide:download"
                :aria-label="t('buttons.download')" @click.stop="handleOpenInNewTab(asset)" />
              <UButton v-if="getAssetType(asset.mimeType) === 'image'" size="xs" variant="solid" color="neutral"
                icon="lucide:edit" :aria-label="t('buttons.edit')" @click.stop="handleOpedEditModal(asset)" />
              <UButton size="xs" variant="solid" color="error" icon="lucide:trash-2" :aria-label="t('buttons.delete')"
                :disabled="isDeletingAssets" @click.stop="handleDeleteAsset(asset)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="viewMode === 'grid'" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <div v-for="(asset, index) in filteredAssets" :key="asset.id" class="group cursor-pointer"
        @click="handleAssetClick(asset)">
        <div class="bg-card  rounded-xl overflow-hidden transition-shadow hover:shadow-md"
          :class="{ 'ring-2 ring-primary': props.selectable && isAssetSelected(asset) }">
          <div class="aspect-square bg-muted relative overflow-hidden">
            <div class="relative w-full h-full">
              <video v-if="getAssetType(asset.mimeType) === 'video'" :src="asset.url" :alt="getAssetDisplayName(asset)"
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

    <div v-else-if="viewMode === 'list'" class="space-y-2">
      <div v-for="asset in filteredAssets" :key="asset.id"
        class="flex items-center gap-4 p-3  rounded-lg hover:bg-accent cursor-pointer"
        :class="{ 'bg-primary/5 border-primary': props.selectable && isAssetSelected(asset) }"
        @click="handleAssetClick(asset)">
        <UCheckbox v-if="props.selectable" :checked="isAssetSelected(asset)" @click.stop="handleAssetClick(asset)" />

        <div class="w-12 h-12 bg-muted rounded flex items-center justify-center shrink-0 overflow-hidden">
          <div class="relative w-full h-full">
            <video v-if="getAssetType(asset.mimeType) === 'video'" :src="asset.url" :alt="getAssetDisplayName(asset)"
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

    <div v-else class="space-y-3">
      <div class="relative overflow-hidden rounded-2xl border border-default bg-elevated/30">
        <div class="flex min-h-[360px] items-center justify-center p-3 sm:p-6">
          <video v-if="carouselAsset && getAssetType(carouselAsset.mimeType) === 'video'" :src="carouselAsset.url"
            controls class="max-h-[68vh] w-full rounded-xl bg-black"></video>
          <img v-else-if="carouselAsset" :src="getAssetPreviewUrl(carouselAsset)"
            :alt="getAssetDisplayName(carouselAsset)"
            class="max-h-[68vh] w-auto max-w-full cursor-zoom-in rounded-xl object-contain"
            @click="handlePreview(carouselAsset)" />
          <div v-else class="py-16 text-center">
            <Icon name="lucide:image-off" class="mx-auto size-12 text-muted" />
            <p class="mt-3 text-sm text-muted">{{ t('states.no_assets_title') }}</p>
          </div>
        </div>

        <div v-if="props.selectable && carouselAsset" class="absolute left-3 top-3">
          <UButton size="sm" :variant="isAssetSelected(carouselAsset) ? 'solid' : 'soft'"
            :color="isAssetSelected(carouselAsset) ? 'primary' : 'neutral'" icon="lucide:check"
            :label="isAssetSelected(carouselAsset) ? t('buttons.selected') : t('buttons.select')"
            @click="() => toggleAssetSelection(carouselAsset!)" />
        </div>

        <template v-if="filteredAssets.length > 1">
          <UButton class="absolute left-2 top-1/2 -translate-y-1/2 rounded-full shadow-lg sm:left-4" size="lg"
            variant="solid" color="neutral" icon="i-lucide-chevron-left" :aria-label="t('buttons.previous')"
            @click="handleCarouselPrev" />
          <UButton class="absolute right-2 top-1/2 -translate-y-1/2 rounded-full shadow-lg sm:right-4" size="lg"
            variant="solid" color="neutral" icon="i-lucide-chevron-right" :aria-label="t('buttons.next')"
            @click="handleCarouselNext" />
        </template>

        <div v-if="carouselAsset"
          class="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-3">
          <div class="min-w-0 text-white">
            <p class="truncate text-sm font-medium">{{ getAssetDisplayName(carouselAsset) }}</p>
            <p class="text-xs text-white/70">
              {{ formatFileSize(carouselAsset.size) }} · {{ getAssetType(carouselAsset.mimeType) }}
            </p>
          </div>
          <div class="pointer-events-auto flex items-center gap-1">
            <UBadge variant="solid" color="neutral" size="sm" class="tabular-nums">
              {{ carouselIndex + 1 }} / {{ filteredAssets.length }}
            </UBadge>
            <UButton size="xs" variant="solid" color="neutral" icon="lucide:eye" :aria-label="t('buttons.preview')"
              @click="() => handlePreview(carouselAsset!)" />
            <UButton size="xs" variant="solid" color="neutral" icon="lucide:download"
              :aria-label="t('buttons.download')" @click="() => handleOpenInNewTab(carouselAsset!)" />
            <UButton v-if="getAssetType(carouselAsset.mimeType) === 'image'" size="xs" variant="solid" color="neutral"
              icon="lucide:edit" :aria-label="t('buttons.edit')" @click="() => handleOpedEditModal(carouselAsset!)" />
            <UButton size="xs" variant="solid" color="error" icon="lucide:trash-2" :aria-label="t('buttons.delete')"
              :disabled="isDeletingAssets" @click="() => handleDeleteAsset(carouselAsset!)" />
          </div>
        </div>
      </div>

      <div v-if="filteredAssets.length > 1" class="flex gap-2 overflow-x-auto pb-1">
        <button v-for="(asset, index) in filteredAssets" :key="asset.id" type="button"
          class="relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-opacity"
          :class="index === carouselIndex ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'"
          @click="() => selectCarousel(index)">
          <img v-if="getAssetType(asset.mimeType) === 'image'" :src="getAssetPreviewUrl(asset)"
            :alt="getAssetDisplayName(asset)" class="size-full object-cover" loading="lazy" />
          <span v-else class="flex size-full items-center justify-center bg-elevated">
            <Icon :name="getAssetType(asset.mimeType) === 'video' ? 'lucide:video' : 'lucide:file'"
              class="size-5 text-muted" />
          </span>
        </button>
      </div>
    </div>

    <div v-if="pagination.page < pagination.totalPages" ref="sentinelRef"
      class="flex items-center justify-center gap-2 py-6">
      <Icon v-if="isLoadingMore" name="lucide:loader-2" class="w-5 h-5 animate-spin text-muted-foreground" />
      <span v-else class="text-sm text-muted-foreground">{{ t('buttons.load_more') }}</span>
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
            <UButton variant="outline" size="sm" :disabled="!previewAsset"
              @click="previewAsset && handleOpenInNewTab(previewAsset)">
              <Icon name="lucide:download" class="w-4 h-4" />
              {{ t('buttons.download') }}
            </UButton>
            <UButton variant="outline" size="sm"
              :disabled="!previewAsset || getAssetType(previewAsset.mimeType) !== 'image'"
              @click="handleOpedEditModal(previewAsset!)">
              <Icon name="lucide:edit" class="w-4 h-4" />
              {{ t('buttons.edit') }}
            </UButton>
            <UButton variant="ghost" size="sm" @click="toggleFullscreen">
              <Icon name="lucide:fullscreen" class="w-4 h-4" />
            </UButton>
          </div>
        </div>
      </template>

      <template #body>
        <div class="relative flex min-h-[45vh] flex-1 items-center justify-center p-2 sm:p-4">
          <img v-if="previewAsset && getAssetType(previewAsset.mimeType) === 'image'"
            :src="getAssetPreviewUrl(previewAsset)" :alt="getAssetDisplayName(previewAsset)"
            class="max-h-[78vh] max-w-full rounded-lg object-contain" />
          <div v-else-if="previewAsset && getAssetType(previewAsset.mimeType) === 'video'" class="w-full max-w-4xl">
            <video :src="previewAsset.url" controls class="max-h-[78vh] w-full rounded-lg bg-black"></video>
          </div>
          <div v-else-if="previewAsset" class="flex size-64 items-center justify-center rounded-lg bg-elevated">
            <div class="text-center">
              <Icon name="lucide:file" class="mx-auto mb-4 size-16 text-muted" />
              <p class="text-muted">{{ getAssetDisplayName(previewAsset) }}</p>
            </div>
          </div>

          <template v-if="hasPreviewNavigation">
            <UButton class="absolute left-1 top-1/2 -translate-y-1/2 rounded-full shadow-lg sm:left-3" size="lg"
              variant="solid" color="neutral" icon="i-lucide-chevron-left" :aria-label="t('preview_modal.previous')"
              @click="handlePreviewPrev" />
            <UButton class="absolute right-1 top-1/2 -translate-y-1/2 rounded-full shadow-lg sm:right-3" size="lg"
              variant="solid" color="neutral" icon="i-lucide-chevron-right" :aria-label="t('preview_modal.next')"
              @click="handlePreviewNext" />
            <UBadge class="absolute bottom-3 left-1/2 -translate-x-1/2 tabular-nums" variant="solid" color="neutral"
              size="sm">
              {{ previewIndex + 1 }} / {{ filteredAssets.length }}
            </UBadge>
          </template>
        </div>

        <div v-if="previewAsset" class="px-6 py-4 space-y-3 ">
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
