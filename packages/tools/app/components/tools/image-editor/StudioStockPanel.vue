<i18n src="#site/app/pages/tools/image-editor/ImageEditor.json"></i18n>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import type { FabricImage } from 'fabric'
import { useFabricJs } from '../../../composables/tools/image-editor/useFabricJs'
import { replaceImageSource } from '../../../../shared/image-editor/studio-canvas'

/**
 * Stock panel — Pexels photos & videos plus Unsplash photos, served through
 * the existing /api/v1/assets proxies. Insert as a layer, set as canvas
 * background, or replace the selected image layer. Video rows copy the
 * mp4 URL for use as a {field:image_url} value.
 */

interface StockPhoto {
  id: string
  url: string
  preview: string
  alt: string
  photographer: string
  photographerUrl?: string
  sourceUrl?: string
  provider: 'pexels' | 'unsplash'
  kind: 'photo' | 'video'
}

interface PexelsPhotoRow {
  id?: number | string
  src?: Record<string, string>
  image?: string
  alt?: string
  photographer?: string
  photographer_url?: string
  url?: string
  links?: { html?: string; download?: string }
  video_files?: Array<Record<string, string>>
  user?: { name?: string; url?: string }
}

const { t } = useI18n()
const { editor } = useFabricJs()

const provider = ref<'pexels' | 'unsplash' | 'pexels-video'>('pexels')
const query = ref('')
const photos = ref<StockPhoto[]>([])
const loading = ref(false)
const page = ref(1)

const isVideo = computed(() => provider.value === 'pexels-video')

const PROVIDER_ENDPOINTS: Record<string, string> = {
  pexels: 'pexel',
  unsplash: 'unsplash',
  'pexels-video': 'pexel/videos',
}

function normalizePhotos(raw: { photos?: PexelsPhotoRow[] }, provider: 'pexels' | 'unsplash'): StockPhoto[] {
  return (raw.photos ?? []).map(entry => ({
    id: String(entry.id ?? ''),
    url: String(entry.src?.large ?? ''),
    preview: String(entry.src?.medium ?? ''),
    alt: entry.alt ?? '',
    photographer: entry.photographer ?? '',
    photographerUrl: entry.photographer_url ?? '',
    sourceUrl: entry.links?.html ?? entry.url ?? '',
    provider,
    kind: 'photo',
  }))
}

function normalizeVideos(raw: { videos?: PexelsPhotoRow[] }): StockPhoto[] {
  return (raw.videos ?? []).map(entry => {
    const files = entry.video_files ?? []
    const mp4 = files.find(file => file.quality === 'sd') ?? files[0]
    return {
      id: String(entry.id ?? ''),
      url: String(mp4?.link ?? ''),
      preview: String(entry.image ?? ''),
      alt: entry.user?.name ?? '',
      photographer: entry.user?.name ?? '',
      photographerUrl: entry.user?.url ?? '',
      sourceUrl: entry.url ?? '',
      provider: 'pexels' as const,
      kind: 'video' as const,
    }
  })
}

async function search(nextPage = 1): Promise<void> {
  const term = query.value.trim()
  if (!term) return
  loading.value = true
  page.value = nextPage
  try {
    const params = new URLSearchParams({ query: term, page: String(nextPage), per_page: '18' })
    const endpoint = PROVIDER_ENDPOINTS[provider.value] ?? 'pexel'
    const response = await $fetch<{ photos?: PexelsPhotoRow[]; videos?: PexelsPhotoRow[] }>(`/api/v1/assets/${endpoint}?${params}`)
    photos.value = isVideo.value
      ? normalizeVideos(response)
      : normalizePhotos(response, provider.value === 'unsplash' ? 'unsplash' : 'pexels')
  } catch {
    photos.value = []
    useToast().add({ title: t('studio.stock.failed'), color: 'error', icon: 'i-lucide-cloud-off' })
  }
  loading.value = false
}

const UTM = 'utm_source=magicsync&utm_medium=referral'

/** Unsplash/Pexels guidelines require attribution links with UTM parameters. */
function withUtm(url?: string): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    parsed.searchParams.set('utm_source', 'magicsync')
    parsed.searchParams.set('utm_medium', 'referral')
    return parsed.toString()
  } catch {
    return url
  }
}

function providerHome(photo: StockPhoto): string {
  return photo.provider === 'unsplash' ? `https://unsplash.com/?${UTM}` : `https://www.pexels.com/?${UTM}`
}

function isFabricImage(): FabricImage | null {
  const selection = editor.value?.fabricCanvas?.getActiveObject()
  return selection && (selection as FabricImage).type === 'image' ? selection as FabricImage : null
}

async function insert(photo: StockPhoto): Promise<void> {
  if (photo.kind === 'video') {
    await editor.value?.addVideoLayer?.(photo.url, photo.preview)
    useToast().add({ title: t('studio.stock.videoAdded'), color: 'success', icon: 'i-lucide-film' })
    return
  }
  await editor.value?.addImageLayerFromUrl?.(photo.url)
}

async function setAsBackground(photo: StockPhoto): Promise<void> {
  const canvas = editor.value?.fabricCanvas
  if (!canvas || photo.kind === 'video') {
    if (canvas && photo.kind === 'video') useToast().add({ title: t('studio.stock.videoBgUnsupported'), color: 'warning', icon: 'i-lucide-film' })
    return
  }
  const { FabricImage } = await import('fabric')
  const image = await FabricImage.fromURL(photo.url, { crossOrigin: 'anonymous' })
  const frameWidth = (canvas.getObjects().find(obj => obj.id === 'workspace')?.width ?? canvas.width) as number
  const frameHeight = (canvas.getObjects().find(obj => obj.id === 'workspace')?.height ?? canvas.height) as number
  const scale = Math.max((frameWidth ?? 1242) / (image.width ?? 1), (frameHeight ?? 1660) / (image.height ?? 1))
  image.scale(scale)
  canvas.backgroundImage = image
  canvas.requestRenderAll()
}

async function replaceSelection(photo: StockPhoto): Promise<void> {
  const target = isFabricImage()
  if (!target) {
    useToast().add({ title: t('studio.stock.replaceMissing'), color: 'warning', icon: 'i-lucide-image-off' })
    return
  }
  await replaceImageSource(target, photo.url, true)
  editor.value?.fabricCanvas?.requestRenderAll()
}
</script>

<template>
  <div class="space-y-3">
    <USelect
      v-model="provider"
      size="xs"
      :items="[
        { label: t('studio.stock.pexels'), value: 'pexels' },
        { label: t('studio.stock.unsplash'), value: 'unsplash' },
        { label: t('studio.stock.videos'), value: 'pexels-video' },
      ]" />

    <div class="flex gap-2">
      <UInput v-model="query" size="xs" :placeholder="t('studio.stock.placeholder')" class="flex-1" @keydown.enter="search(1)" />
      <UButton size="xs" variant="soft" icon="lucide:search" :loading="loading" @click="search(1)">
        {{ t('common.search') }}
      </UButton>
    </div>

    <UAlert v-if="photos.length === 0 && !loading" color="neutral" variant="soft" icon="i-lucide-image" :title="t('studio.stock.empty')" />

    <div class="grid grid-cols-2 gap-2">
      <div v-for="photo in photos" :key="`${photo.kind}-${photo.id}`" class="space-y-1">
        <img :src="photo.preview" :alt="photo.alt" class="w-full aspect-square object-cover rounded-lg border border-default" loading="lazy">
        <div class="flex gap-1">
          <UButton size="xs" variant="ghost" icon="lucide:plus-square" :aria-label="t('studio.stock.insert')" @click="insert(photo)" />
          <UButton size="xs" variant="ghost" icon="lucide:paintbrush" :aria-label="t('studio.stock.background')" @click="setAsBackground(photo)" />
          <UButton size="xs" variant="ghost" icon="lucide:replace" :aria-label="t('studio.stock.replace')" @click="replaceSelection(photo)" />
        </div>
        <div v-if="photo.photographer" class="text-[9px] leading-tight text-muted">
          {{ t('studio.stock.photoBy') }}
          <a
            v-if="photo.photographerUrl"
            :href="withUtm(photo.photographerUrl)"
            target="_blank" rel="noopener noreferrer"
            class="underline decoration-dotted hover:text-highlighted">{{ photo.photographer }}</a>
          <span v-else>{{ photo.photographer }}</span>
          {{ t('studio.stock.on') }}
          <a
            :href="providerHome(photo)"
            target="_blank" rel="noopener noreferrer"
            class="underline decoration-dotted hover:text-highlighted">{{ photo.provider === 'unsplash' ? 'Unsplash' : 'Pexels' }}</a>
        </div>
      </div>
    </div>

    <UButton
      v-if="photos.length > 0 && !isVideo"
      block size="xs" variant="outline"
      :loading="loading" @click="search(page + 1)">
      {{ t('studio.stock.more') }}
    </UButton>
  </div>
</template>
