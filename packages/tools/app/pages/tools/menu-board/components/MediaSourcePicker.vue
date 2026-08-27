<i18n src="../index.json"></i18n>
<script setup lang="ts">
const { t } = useI18n()
/**
 *
 * MediaSourcePicker — image source selector for menu board layers.
 * Tabs: your assets, Pexels search (logged in), or a direct URL.
 *
 */
interface AssetItem {
  id: string
  url: string
  originalName?: string
  mimeType?: string
}

interface PexelsPhoto {
  id: number
  src: { large: string, medium: string }
  alt: string
}

const model = defineModel<string>({ default: '' })

const source = ref<'assets' | 'pexels' | 'url'>('url')

const assets = ref<AssetItem[]>([])
const assetsLoading = ref(false)
const assetsLoaded = ref(false)

const pexelsQuery = ref('')
const pexelsPhotos = ref<PexelsPhoto[]>([])
const pexelsLoading = ref(false)
const pexelsSearched = ref(false)

const { loggedIn, fetchSession } = UseUser()

async function loadAssets(): Promise<void> {
  if (!loggedIn.value) await fetchSession()
  if (!loggedIn.value) return
  assetsLoading.value = true
  try {
    const res = await $fetch<{ success: boolean, data: AssetItem[] }>('/api/v1/assets', {
      query: { own: 'true', limit: 60 },
    })
    assets.value = (res.data ?? []).filter(a => (a.mimeType ?? 'image').startsWith('image/'))
    assetsLoaded.value = true
  } catch {
    assets.value = []
  } finally {
    assetsLoading.value = false
  }
}

async function searchPexels(): Promise<void> {
  if (!pexelsQuery.value.trim()) return
  pexelsLoading.value = true
  try {
    const res = await $fetch<{ photos: PexelsPhoto[] }>('/api/v1/assets/pexel', {
      query: { query: pexelsQuery.value.trim(), per_page: 15 },
    })
    pexelsPhotos.value = res.photos ?? []
    pexelsSearched.value = true
  } catch {
    useToast().add({ title: t('pexels_failed'), color: 'error', icon: 'i-lucide-camera-off' })
  } finally {
    pexelsLoading.value = false
  }
}

watch(source, (tab) => {
  if (tab === 'assets' && !assetsLoaded.value) void loadAssets()
})
</script>

<template>
  <div class="space-y-2" data-testid="media-source-picker">
    <div v-if="model" class="relative rounded-lg overflow-hidden ring-1 ring-border">
      <img :src="model" alt="Selected image" class="w-full h-24 object-cover">
      <UButton icon="i-lucide-x" size="xs" color="error" variant="solid"
        class="absolute top-1 right-1" aria-label="Remove image"
        @click="() => { model = '' }" />
    </div>

    <UTabs
      v-model="source" color="neutral" size="sm" :items="[
        { label: t('choose_assets'), value: 'assets', icon: 'i-lucide-folder-open' },
        { label: t('pexels'), value: 'pexels', icon: 'i-lucide-camera' },
        { label: t('url'), value: 'url', icon: 'i-lucide-link' },
      ]" />

    <!-- Assets -->
    <template v-if="source === 'assets'">
      <div v-if="!loggedIn" class="rounded-lg border border-dashed border-accented p-3 text-center text-xs text-muted">
        {{ t('login_assets') }}
      </div>
      <template v-else>
        <div v-if="assetsLoading" class="text-xs text-muted py-3 text-center">{{ t('loading_assets') }}</div>
        <div v-else-if="assets.length === 0" class="text-xs text-muted py-3 text-center">
          {{ t('no_images_found') }}
        </div>
        <div v-else class="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
          <button v-for="asset in assets" :key="asset.id" type="button"
            class="rounded-md overflow-hidden ring-1 ring-border hover:ring-primary transition-shadow cursor-pointer"
            @click="() => { model = asset.url }">
            <img :src="asset.url" :alt="asset.originalName ?? 'Asset'" class="w-full h-20 object-cover" loading="lazy">
          </button>
        </div>
      </template>
    </template>

    <!-- Pexels -->
    <template v-else-if="source === 'pexels'">
      <div v-if="!loggedIn" class="rounded-lg border border-dashed border-accented p-3 text-center text-xs text-muted">
        {{ t('login_pexels') }}
      </div>
      <template v-else>
        <div class="flex gap-2">
          <UInput v-model="pexelsQuery" :placeholder="t('search_photos')" size="sm" class="flex-1"
            data-testid="pexels-search-input" @keydown.enter="searchPexels" />
          <UButton icon="i-lucide-search" size="sm" :loading="pexelsLoading" data-testid="pexels-search-button"
            @click="searchPexels" />
        </div>
        <div v-if="pexelsPhotos.length" class="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
          <button v-for="photo in pexelsPhotos" :key="photo.id" type="button"
            class="rounded-md overflow-hidden ring-1 ring-border hover:ring-primary transition-shadow cursor-pointer"
            @click="() => { model = photo.src.large }">
            <img :src="photo.src.medium" :alt="photo.alt" class="w-full h-20 object-cover" loading="lazy">
          </button>
        </div>
        <p v-else-if="pexelsSearched" class="text-xs text-muted text-center py-3">{{ t('no_results') }}</p>
        <p v-else class="text-xs text-muted text-center py-3">{{ t('pexels_search_hint') }}</p>
      </template>
    </template>

    <!-- URL -->
    <template v-else>
      <UInput :model-value="model.startsWith('blob:') ? '' : model" placeholder="https://placehold.co/600x400?text=My+Image"
        size="sm" class="w-full" data-testid="image-url-input"
        @update:model-value="(v: string) => { model = v }" />
    </template>
  </div>
</template>
