<i18n src="#site/app/pages/tools/image-editor/ImageEditor.json"></i18n>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { FabricImage, Gradient, Rect } from 'fabric'
import { useFabricJs } from '../../../composables/tools/image-editor/useFabricJs'

/**
 * Background tab — Polotno-style: quick colors, Unsplash background photos for
 * the Background/Design/Patterns/Wallpaper/Gradients tags, and gradient presets.
 * Backgrounds are stored as a real page layer (`__background`) so they export,
 * batch-render and survive reloads.
 */

interface BackgroundPhoto {
  id: string
  url: string
  preview: string
  alt: string
  color: string
  photographer: string
  photographerUrl: string
  sourceUrl: string
}

const { t } = useI18n()
const { editor } = useFabricJs()

const categories = computed(() => [
  { id: 'background', query: 'color background', label: t('studio.background.cat.background') },
  { id: 'design', query: 'design background', label: t('studio.background.cat.design') },
  { id: 'patterns', query: 'pattern background', label: t('studio.background.cat.patterns') },
  { id: 'wallpaper', query: 'wallpaper', label: t('studio.background.cat.wallpaper') },
  { id: 'gradients', query: 'gradient background', label: t('studio.background.cat.gradients') },
])

const COLORS = [
  '#0f172a', '#334155', '#64748b', '#e2e8f0', '#ffffff',
  '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#111827',
]

const GRADIENTS: Array<{ colors: [string, string]; angle: number }> = [
  { colors: ['#f97316', '#facc15'], angle: 135 },
  { colors: ['#3b82f6', '#8b5cf6'], angle: 135 },
  { colors: ['#0ea5e9', '#22d3ee'], angle: 180 },
  { colors: ['#ec4899', '#f43f5e'], angle: 135 },
]

const category = ref('background')
const query = ref('')
const photos = ref<BackgroundPhoto[]>([])
const loading = ref(false)
const applying = ref<string | null>(null)

const UTM = 'utm_source=magicsync&utm_medium=referral'

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

function frameSize(): { width: number; height: number } {
  const objects = editor.value?.fabricCanvas?.getObjects() ?? []
  const frame = objects.find(object => (object as { id?: string }).id === 'workspace')
  return {
    width: Math.round(frame?.width ?? 1080),
    height: Math.round(frame?.height ?? 1080),
  }
}

/** Remove the previous background layer and hide template full-frame fills. */
function resetBackgroundLayers(): void {
  const canvas = editor.value?.fabricCanvas
  if (!canvas) return
  for (const object of canvas.getObjects()) {
    if ((object as { id?: string }).id === '__background') canvas.remove(object)
  }
  const frame = frameSize()
  for (const object of canvas.getObjects()) {
    const record = object as unknown as { id?: string; type?: string; width?: number; height?: number; visible?: boolean }
    if (record.id === 'workspace' || record.id === '__background') continue
    if (record.type === 'rect' && (record.width ?? 0) >= frame.width * 0.95 && (record.height ?? 0) >= frame.height * 0.95) {
      // Mark it so the layer list can keep it out of the way; clearing the
      // background restores it instead of leaving an invisible ghost row.
      record.id = '__template-fill'
      record.visible = false
    }
  }
}

function placeBackground(object: Rect | FabricImage): void {
  const canvas = editor.value?.fabricCanvas
  if (!canvas) return
  canvas.add(object)
  canvas.sendObjectToBack(object)
  const workspace = canvas.getObjects().find(entry => (entry as { id?: string }).id === 'workspace')
  if (workspace) canvas.sendObjectToBack(workspace)
  // No bringObjectForward here: after sending the workspace back the background
  // is already directly above it. Moving it forward pushed it above the first
  // content layer, hiding that layer under the photo.
  canvas.requestRenderAll()
}

function afterApply(label: string): void {
  applying.value = null
  useToast().add({ title: t('studio.background.applied'), description: label, color: 'success', icon: 'i-lucide-image' })
}

function applyColor(color: string): void {
  const { width, height } = frameSize()
  resetBackgroundLayers()
  const rect = new Rect({ width, height, fill: color, left: 0, top: 0, originX: 'left', originY: 'top', selectable: false, evented: false })
  ;(rect as unknown as Record<string, unknown>).id = '__background'
  placeBackground(rect)
  afterApply(color)
}

function applyGradient(colors: [string, string], angle: number): void {
  const { width, height } = frameSize()
  resetBackgroundLayers()
  const radians = (angle * Math.PI) / 180
  const dx = Math.cos(radians) / 2
  const dy = Math.sin(radians) / 2
  const gradient = new Gradient({
    type: 'linear',
    gradientUnits: 'percentage',
    coords: { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy },
    colorStops: [{ offset: 0, color: colors[0] }, { offset: 1, color: colors[1] }],
  })
  const rect = new Rect({ width, height, fill: gradient, left: 0, top: 0, originX: 'left', originY: 'top', selectable: false, evented: false })
  ;(rect as unknown as Record<string, unknown>).id = '__background'
  placeBackground(rect)
  afterApply(t('studio.background.gradient'))
}

async function applyImage(photo: BackgroundPhoto): Promise<void> {
  const canvas = editor.value?.fabricCanvas
  if (!canvas) return
  applying.value = photo.id
  try {
    const image = await FabricImage.fromURL(photo.url, { crossOrigin: 'anonymous' })
    const { width, height } = frameSize()
    const scale = Math.max(width / (image.width ?? 1), height / (image.height ?? 1))
    image.set({
      left: Math.round((width - (image.width ?? 0) * scale) / 2),
      top: Math.round((height - (image.height ?? 0) * scale) / 2),
      originX: 'left',
      originY: 'top',
      scaleX: scale,
      scaleY: scale,
      selectable: false,
      evented: false,
    })
    ;(image as unknown as Record<string, unknown>).id = '__background'
    ;(image as unknown as Record<string, unknown>).name = 'Background'
    resetBackgroundLayers()
    canvas.add(image)
    canvas.sendObjectToBack(image)
    const workspace = canvas.getObjects().find(entry => (entry as { id?: string }).id === 'workspace')
    if (workspace) canvas.sendObjectToBack(workspace)
    canvas.requestRenderAll()
    afterApply(photo.photographer ? `${photo.photographer} · Unsplash` : t('studio.background.photo'))
  } catch {
    applying.value = null
    useToast().add({ title: t('studio.background.failed'), color: 'error', icon: 'i-lucide-x-circle' })
  }
}

function clearBackground(): void {
  const canvas = editor.value?.fabricCanvas
  if (!canvas) return
  resetBackgroundLayers()
  for (const object of canvas.getObjects()) {
    if ((object as { id?: string }).id === '__template-fill') {
      ;(object as unknown as { visible: boolean }).visible = true
    }
  }
  canvas.requestRenderAll()
  useToast().add({ title: t('studio.background.cleared'), color: 'neutral', icon: 'i-lucide-eraser' })
}

function activeCategoryQuery(): string {
  return query.value.trim() || categories.value.find(entry => entry.id === category.value)?.query || 'color background'
}

async function search(): Promise<void> {
  loading.value = true
  try {
    const params = new URLSearchParams({ query: activeCategoryQuery(), per_page: '20' })
    const response = await $fetch<{ photos?: BackgroundPhoto[] }>(`/api/v1/image-editor/backgrounds?${params}`)
    photos.value = response?.photos ?? []
  } catch {
    photos.value = []
    useToast().add({ title: t('studio.background.failed'), color: 'error', icon: 'i-lucide-cloud-off' })
  }
  loading.value = false
}

function pickCategory(id: string): void {
  category.value = id
  query.value = ''
  void search()
}

onMounted(() => { void search() })
</script>

<template>
  <div class="space-y-4">
    <section class="space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="text-[11px] font-semibold uppercase tracking-wider text-dimmed">{{ t('studio.background.colors') }}</h3>
        <UButton size="xs" variant="ghost" color="neutral" icon="lucide:eraser" :aria-label="t('studio.background.clear')" @click="clearBackground" />
      </div>
      <div class="grid grid-cols-7 gap-1.5">
        <button
          v-for="color in COLORS" :key="color"
          type="button"
          class="aspect-square rounded-md border border-default transition-transform hover:scale-105"
          :style="{ backgroundColor: color }"
          :aria-label="color"
          @click="applyColor(color)" />
      </div>
      <div class="grid grid-cols-4 gap-1.5">
        <button
          v-for="(preset, index) in GRADIENTS" :key="index"
          type="button"
          class="aspect-square rounded-md border border-default transition-transform hover:scale-105"
          :style="{ backgroundImage: `linear-gradient(${preset.angle}deg, ${preset.colors[0]}, ${preset.colors[1]})` }"
          :aria-label="t('studio.background.gradient')"
          @click="applyGradient(preset.colors, preset.angle)" />
      </div>
    </section>

    <section class="space-y-2">
      <div class="flex gap-1.5 flex-wrap">
        <UButton
          v-for="entry in categories" :key="entry.id" size="xs"
          :variant="category === entry.id ? 'soft' : 'ghost'"
          :color="category === entry.id ? 'primary' : 'neutral'"
          @click="pickCategory(entry.id)">
          {{ entry.label }}
        </UButton>
      </div>

      <div class="flex gap-2">
        <UInput v-model="query" size="xs" :placeholder="t('studio.background.searchPlaceholder')" class="flex-1" @keydown.enter="search" />
        <UButton size="xs" variant="soft" icon="lucide:search" :loading="loading" @click="search">
          {{ t('common.search') }}
        </UButton>
      </div>

      <div v-if="loading" class="flex items-center gap-2 py-3 text-xs text-muted">
        <Icon name="svg-spinners:270-ring-with-bg" class="size-4" />
        {{ t('studio.background.loading') }}
      </div>

      <div v-else class="grid grid-cols-2 gap-2">
        <div v-for="photo in photos" :key="photo.id" class="space-y-1">
          <button
            type="button"
            class="relative block w-full overflow-hidden rounded-lg border border-default hover:border-primary transition-colors"
            :style="{ backgroundColor: photo.color }"
            :aria-label="t('studio.background.setBackground')"
            @click="applyImage(photo)">
            <img :src="photo.preview" :alt="photo.alt" class="aspect-square w-full object-cover" loading="lazy">
            <span
              v-if="applying === photo.id"
              class="absolute inset-0 flex items-center justify-center bg-black/40">
              <Icon name="svg-spinners:270-ring-with-bg" class="size-5 text-white" />
            </span>
          </button>
          <div v-if="photo.photographer" class="text-[9px] leading-tight text-muted truncate">
            {{ t('studio.stock.photoBy') }}
            <a :href="withUtm(photo.photographerUrl)" target="_blank" rel="noopener noreferrer" class="underline decoration-dotted hover:text-highlighted">{{ photo.photographer }}</a>
            {{ t('studio.stock.on') }}
            <a :href="withUtm('https://unsplash.com/')" target="_blank" rel="noopener noreferrer" class="underline decoration-dotted hover:text-highlighted">Unsplash</a>
          </div>
        </div>
      </div>

      <div v-if="!loading && photos.length === 0" class="py-6 text-center text-xs text-muted">
        {{ t('studio.background.empty') }}
      </div>
    </section>
  </div>
</template>
