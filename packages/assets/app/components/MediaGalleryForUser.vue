<i18n src="./MediaGalleryForUser.json"></i18n>
<script lang="ts" setup>
import type { Asset } from '#layers/BaseDB/db/schema'
import type { FolderScope } from '#layers/BaseShared/shared/utils/asset-folders'
import { ALL_SCOPE_TOKEN, parseFolderScope } from '#layers/BaseShared/shared/utils/asset-folders'

/**
 * Asset picker used across the app (post editor, bulk scheduler, tools).
 *
 * Lists either the active business's library — with the same folder scopes as
 * `/app/media` — or every asset the user owns. Images/videos are lazy: opening
 * the picker must not download an entire media library.
 */
const props = defineProps<{
  /** Defaults to the app-wide active business. */
  businessId?: string
}>()

const { t } = useI18n({ useScope: 'local' })
const activeBusinessId = useState<string | undefined>('business:id')
const businessId = computed(() => props.businessId || activeBusinessId.value || '')
const hasBusiness = computed(() => Boolean(businessId.value))

const $emit = defineEmits({
  select: (asset: Asset[]) => true,
  deselect: (asset: Asset[]) => true,
})

const selected = defineModel<Asset[]>('selected', {
  type: Array,
  default: () => [],
})

const selectedTab = ref('local')
const showUploader = ref(false)
const mode = ref<'business' | 'all'>(hasBusiness.value ? 'business' : 'all')
const search = ref('')
const toast = useToast()

const {
  assets,
  assetFolders,
  folderScope,
  isLoading,
  fetchAssets,
  fetchFolders,
  fetUserAssets,
  setFolderScope,
} = useAssetManagement()

function getAssetType(mimeType: string): 'image' | 'video' | 'pdf' | 'audio' | 'other' {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'other'
}

function getAssetIcon(type: ReturnType<typeof getAssetType>): string {
  switch (type) {
    case 'video': return 'lucide:film'
    case 'pdf': return 'lucide:file-text'
    case 'audio': return 'lucide:music'
    case 'other': return 'lucide:file'
    default: return 'lucide:image'
  }
}

const scopeToken = computed(() => {
  if (folderScope.value.kind === 'folder') return folderScope.value.id
  return folderScope.value.kind === 'unfiled' ? 'unfiled' : ALL_SCOPE_TOKEN
})

const folderItems = computed(() => [
  { label: t('allAssets'), value: ALL_SCOPE_TOKEN },
  { label: t('unfiled'), value: 'unfiled' },
  ...assetFolders.value.map(folder => ({
    label: `${folder.name} (${folder.assetCount})`,
    value: folder.id,
  })),
])

const visibleAssets = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return assets.value
  return assets.value.filter(asset =>
    (asset.originalName || asset.filename || '').toLowerCase().includes(query),
  )
})

const isSelected = (asset: Asset) => selected.value.some(item => item.id === asset.id)

function HandleSelect(asset: Asset) {
  if (isSelected(asset)) {
    selected.value = selected.value.filter(item => item.id !== asset.id)
    $emit('deselect', selected.value)
    return
  }
  selected.value = [...selected.value, asset]
  $emit('select', selected.value)
}

function HandleExternalSelect(assetsToAdd: Asset[]) {
  const newAssets = assetsToAdd.filter(
    newAsset => !selected.value.some(existingAsset => existingAsset.id === newAsset.id),
  )
  selected.value = [...selected.value, ...newAssets]
  $emit('select', selected.value)
  toast.add({
    title: t('assetsAdded'),
    description: t('assetsAddedDescription', { count: newAssets.length }),
    icon: 'i-heroicons-check-circle',
    color: 'success',
  })
}

async function loadLibrary() {
  if (mode.value === 'business' && businessId.value) {
    await fetchFolders(businessId.value)
    await fetchAssets(businessId.value, { filters: { folderScope: folderScope.value } })
    return
  }
  await fetUserAssets()
}

async function handleScopeChange(value: string | number) {
  const scope: FolderScope = parseFolderScope(String(value))
  setFolderScope(scope)
  if (!businessId.value) return
  await fetchAssets(businessId.value, { filters: { folderScope: scope } })
}

function handleModeChange(value: 'business' | 'all') {
  if (value === 'all') setFolderScope({ kind: 'all' })
  mode.value = value
}

watch([businessId, mode], () => {
  void loadLibrary()
}, { immediate: true })

// The active business resolves from the app-wide state and can arrive after
// mount; switch the default view to its folders once it does.
watch(hasBusiness, (value) => {
  if (value && mode.value === 'all') mode.value = 'business'
})

const items = computed(() => [{
  label: t('local'),
  icon: 'lucide:folder',
  value: 'local',
  slot: 'local' as const,
}, {
  label: t('pexels'),
  icon: 'lucide:image',
  value: 'pexels',
  slot: 'pexels' as const,
}, {
  label: t('canvas'),
  icon: 'lucide:brush',
  value: 'canvas',
  slot: 'canvas' as const,
}, {
  label: t('googleDrive'),
  icon: 'lucide:folder-open',
  value: 'google-drive',
  slot: 'google-drive' as const,
}])
</script>

<template>
  <section class="mt-5">
    <UTabs v-model="selectedTab" :items="items" class="w-full">
      <template #default="{ item }">
        <div class="flex items-center gap-2 relative">
          <span class="truncate">{{ item.label }}</span>
        </div>
      </template>

      <template #local>
        <div class="mt-5 space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <UButton size="sm" class="glass-button hover-scale-105 shrink-0" @click="showUploader = !showUploader">
              {{ showUploader ? '' : t('upload') }}
              <Icon :name="showUploader ? 'lucide:x' : 'lucide:upload'" class="w-4 h-4" />
            </UButton>

            <UButtonGroup v-if="hasBusiness" size="sm">
              <UButton
                :color="mode === 'business' ? 'primary' : 'neutral'"
                :variant="mode === 'business' ? 'solid' : 'outline'"
                icon="lucide:folder"
                @click="handleModeChange('business')"
              >
                {{ t('businessLibrary') }}
              </UButton>
              <UButton
                :color="mode === 'all' ? 'primary' : 'neutral'"
                :variant="mode === 'all' ? 'solid' : 'outline'"
                icon="lucide:library"
                @click="handleModeChange('all')"
              >
                {{ t('allMyMedia') }}
              </UButton>
            </UButtonGroup>

            <div class="ms-auto flex items-center gap-2">
              <USelect
                v-if="mode === 'business' && hasBusiness"
                :model-value="scopeToken"
                :items="folderItems"
                value-key="value"
                size="sm"
                class="w-52"
                :aria-label="t('folders')"
                @update:model-value="handleScopeChange"
              />
              <UInput
                v-model="search"
                size="sm"
                icon="lucide:search"
                :placeholder="t('search')"
                class="w-44"
              />
            </div>
          </div>

          <section v-if="showUploader" class="mt-2">
            <MediaUploader :business-id="businessId" :with-padding="false" />
          </section>

          <div v-if="isLoading && visibleAssets.length === 0" class="flex justify-center py-10">
            <UIcon name="lucide:loader-circle" class="size-6 animate-spin text-muted" />
          </div>

          <div v-else-if="visibleAssets.length === 0" class="rounded-lg border border-dashed border-default py-10 text-center">
            <Icon name="lucide:image-off" class="mx-auto size-8 text-muted" />
            <p class="mt-2 text-sm text-muted">{{ t('emptyLibrary') }}</p>
          </div>

          <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <BaseShinyCard v-for="asset in visibleAssets" :key="asset.id" :show-bg="false" @click="HandleSelect(asset)">
              <UCard :ui="{ header: 'p-0 sm:p-2', footer: 'p-0 sm:p-2', body: 'p-0 sm:p-0 h-full', root: 'p-1' }"
                class="bg-muted/50 dark:bg-card hover:bg-background dark:hover:bg-background transition-all delay-75 group/number h-full relative">
                <section class="text-muted-foreground">
                  <div
                    class="absolute inset-0 bg-primary-950/95 rounded-lg transition-opacity duration-500 z-50 grid place-content-center font-black"
                    v-if="isSelected(asset)">
                    {{ t('selected') }}
                  </div>
                  <div class="relative w-full h-full">
                    <video v-if="getAssetType(asset.mimeType) === 'video'" :src="asset.url" :aria-label="asset.originalName"
                      preload="none" playsinline
                      class="w-full h-full object-cover rounded-lg shadow-md aspect-square" />
                    <img v-else-if="getAssetType(asset.mimeType) === 'image'" :src="asset.url" :alt="asset.originalName"
                      loading="lazy" decoding="async" width="320" height="320"
                      class="w-full h-full object-cover rounded-lg shadow-md aspect-square" />
                    <div v-else
                      class="w-full h-full flex items-center justify-center bg-muted rounded-lg shadow-md aspect-square">
                      <Icon :name="getAssetIcon(getAssetType(asset.mimeType))"
                        class="w-12 h-12 text-muted-foreground" />
                    </div>
                    <div
                      class="absolute top-1 start-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-background/80 backdrop-blur-sm text-foreground ">
                      {{ t(getAssetType(asset.mimeType)) }}
                    </div>
                  </div>
                </section>
              </UCard>
            </BaseShinyCard>
          </div>
        </div>
      </template>

      <template #pexels>
        <ImageGalleryFromPexel @select-images="HandleExternalSelect" />
      </template>

      <template #canvas>
        <CanvaGallery @select-images="HandleExternalSelect" />
      </template>

      <template #google-drive>
        <GoogleDriveGallery @select-images="HandleExternalSelect" />
      </template>
    </UTabs>
  </section>
</template>
<style scoped></style>
