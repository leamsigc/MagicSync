<!-- eslint-disable vue/multi-word-component-names -->
<i18n src="./carousel-creator.json"></i18n>
<script lang="ts" setup>
import CarouselStage from './components/CarouselStage.vue'
import CarouselAiPanel from './components/CarouselAiPanel.vue'
import CarouselMediaPanel from './components/CarouselMediaPanel.vue'
import CarouselExportPanel from './components/CarouselExportPanel.vue'
import CarouselDeckPanel from './components/CarouselDeckPanel.vue'
import CollapsibleSection from './components/CollapsibleSection.vue'
import CarouselControlBar from './components/CarouselControlBar.vue'
import CarouselPlatformPreview from './components/CarouselPlatformPreview.vue'
import CarouselStripPreview from './components/CarouselStripPreview.vue'
import CarouselSlidesRail from './components/CarouselSlidesRail.vue'
import CarouselDeckShowcase from './components/CarouselDeckShowcase.vue'
import CarouselLayersPanel from './components/CarouselLayersPanel.vue'
import CarouselDesignTabs from './components/CarouselDesignTabs.vue'
import LayerStylePanel from './components/LayerStylePanel.vue'
import { useCarouselDeck, fxStyle } from './composables/useCarouselDeck'
import { useCarouselVideoExport } from './composables/useCarouselVideoExport'
import { useCarouselSaveShare } from '../../../composables/useCarouselSaveShare'
import { getAllLocalCarousels } from '../../../utils/carousel-db'
import type { SlideData, SlidePalette } from './templates'

const { t } = useI18n()
const toast = useToast()
const { loggedIn, fetchSession } = UseUser()

interface SavedCarousel {
  id: string
  name: string
  slides: Array<{ templateKey: string; data: SlideData; pattern: string; patternColor: string; patternOpacity: number; bgImage: unknown; customHtml: string; layers?: unknown[] }>
  palette: SlidePalette
  pattern?: string
  handle?: string
  isPublic?: boolean
  shareSlug?: string
  updatedAt?: string
}

const {
  slides,
  currentIndex,
  currentHtml,
  palette,
  exporting,
  exportProgress,
  frame,
  fx,
  handle,
  nextSlide,
  prevSlide,
  downloadSlide,
  downloadAllSlides,
  saveAllSlides,
  renderSlideToPng,
  migrateAllSlides,
  showFromImageModal,
  showFromHtmlModal,
  slicedImageGroup,
  updateSlicedImageCount,
  addSlide: addBlankSlide,
  duplicateSlide: duplicateCurrentSlide,
} = useCarouselDeck()

const { exportCarouselVideo, exporting: videoExporting } = useCarouselVideoExport()

const sliceCountProxy = computed({
  get: () => slicedImageGroup.value?.count ?? 3,
  set: (v: number) => {
    if (slicedImageGroup.value) updateSlicedImageCount(v)
  },
})

const currentCarousel = computed(() => {
  if (slides.value.length === 0) return null
  return {
    id: `carousel-${Date.now()}`,
    name: 'My Carousel',
    slides: slides.value.map((s, i) => ({
      id: `slide-${i}`,
      templateKey: s.templateKey,
      data: s.data,
      pattern: s.pattern,
      patternColor: s.patternColor,
      patternOpacity: s.patternOpacity,
      bgImage: s.bgImage,
      customHtml: s.customHtml,
      layers: s.layers,
    })),
    palette: palette.value,
    handle: handle.value,
  }
})

const {
  isSaving,
  isPublic,
  shareUrl,
  saveCarousel: saveToCloud,
  publishCarousel,
  unpublishCarousel,
  copyShareLink,
} = useCarouselSaveShare(currentCarousel)

const currentHtmlStr = computed(() => {
  void palette.value
  return currentHtml()
})

const fonts = ref<string[]>([
  'Arial',
  'Arial Black',
  'Impact',
  'Georgia',
  'Courier New',
  'Verdana',
  'Trebuchet MS',
  'Comic Sans MS',
  'Palatino',
  'Century Gothic',
])
const mode = ref<'deck' | 'ai'>('deck')
const guides = ref(false)
const previewPlatform = ref<'editor' | 'instagram' | 'linkedin' | 'strip'>('editor')
const stageFx = computed(() => fxStyle(fx.value))

// Carousel selector state
const savedCarousels = ref<SavedCarousel[]>([])
const isLoadingCarousels = ref(false)
const currentCarouselName = ref('My Carousel')

async function loadSavedCarousels(): Promise<void> {
  isLoadingCarousels.value = true
  try {
    await fetchSession()
    if (loggedIn.value) {
      const res = await $fetch<SavedCarousel[]>('/api/v1/carousel')
      savedCarousels.value = res ?? []
    } else {
      const local = await getAllLocalCarousels()
      savedCarousels.value = local.map(c => ({
        id: c.id,
        name: c.name,
        slides: c.slides,
        palette: c.palette,
        pattern: c.pattern,
        handle: c.handle,
        isPublic: false,
        updatedAt: new Date(c.lastModified).toISOString(),
      }))
    }
  } catch {
    savedCarousels.value = []
  } finally {
    isLoadingCarousels.value = false
  }
}

async function loadCarouselIntoEditor(carousel: SavedCarousel): Promise<void> {
  if (!carousel.slides?.length) {
    toast.add({ title: 'Empty carousel', description: 'This carousel has no slides.', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }

  try {
    slides.value = carousel.slides.map(s => ({
      id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      templateKey: s.templateKey,
      data: { ...s.data },
      pattern: s.pattern ?? 'dots',
      patternColor: s.patternColor ?? carousel.palette.text,
      patternOpacity: s.patternOpacity ?? 0.08,
      bgImage: s.bgImage ?? null,
      customHtml: s.customHtml ?? '',
      layers: s.layers ? JSON.parse(JSON.stringify(s.layers)) : undefined,
    }))
    palette.value = { ...carousel.palette }
    handle.value = carousel.handle ?? ''
    migrateAllSlides()
    currentIndex.value = 0
    currentCarouselName.value = carousel.name
    toast.add({ title: 'Carousel loaded', description: `"${carousel.name}" loaded into editor.`, color: 'success', icon: 'i-lucide-check-circle' })
  } catch {
    toast.add({ title: 'Load failed', description: 'Could not load carousel.', color: 'error', icon: 'i-lucide-alert-circle' })
  }
}

onMounted(async () => {
  await loadSavedCarousels()
  migrateAllSlides()
})

useHead({
  title: t('title'),
  meta: [
    { name: 'description', content: t('description') },
    { name: 'keywords', content: 'instagram carousel creator, carousel maker, instagram post designer, ai carousel generator' },
  ],
})

function getExportStage(): HTMLElement | null {
  return document.getElementById('carousel-export-stage')
}

function handleSaveError(error: unknown): void {
  const shape = error as { status?: number; statusCode?: number }
  const status = shape?.status ?? shape?.statusCode
  if (status === 401 || status === 403) {
    toast.add({
      title: t('toasts.loginRequired'),
      color: 'warning',
      actions: [{ label: t('login'), to: '/login', color: 'primary' }],
    })
  } else {
    toast.add({
      title: t('toasts.failedTitle'),
      description: t('toasts.failedDescription'),
      color: 'error',
    })
  }
}

async function uploadDataUrl(dataUrl: string, filename: string): Promise<string> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  const form = new FormData()
  form.append('files', new File([blob], filename, { type: 'image/png' }))
  const result = await $fetch<{ success: boolean, data: Array<{ id: string }> }>('/api/v1/assets', {
    method: 'POST',
    body: form,
  })
  return result.data[0]!.id
}

async function ensureAuth(): Promise<boolean> {
  if (!loggedIn.value) await fetchSession()
  if (!loggedIn.value) {
    toast.add({
      title: t('toasts.loginRequired'),
      color: 'warning',
      actions: [{ label: t('login'), to: '/login', color: 'primary' }],
    })
    return false
  }
  return true
}

async function handleSaveAll(): Promise<void> {
  const stage = getExportStage()
  if (!stage) return
  if (!await ensureAuth()) return
  try {
    const ids = await saveAllSlides(stage, uploadDataUrl)
    if (ids.length) {
      toast.add({
        title: t('toasts.savedTitle'),
        description: t('toasts.savedDescription', { count: ids.length }),
        color: 'success',
      })
    }
  } catch (error) {
    handleSaveError(error)
  }
}

async function handleUseInPost(): Promise<void> {
  const stage = getExportStage()
  if (!stage) return
  if (!await ensureAuth()) return
  try {
    const ids = await saveAllSlides(stage, uploadDataUrl)
    if (!ids.length) return
    sessionStorage.setItem(
      'repurposed-content',
      JSON.stringify({
        content: '',
        fullContent: '',
        platform: 'instagram',
        isThread: false,
        comments: [],
        mediaAssets: ids,
      }),
    )
    await navigateTo('/app/posts/new')
  } catch (error) {
    handleSaveError(error)
  }
}

async function handleUseInPostVideo(): Promise<void> {
  const stage = getExportStage()
  if (!stage) return
  if (!await ensureAuth()) return
  try {
    toast.add({ title: t('actions.renderingVideo'), description: t('actions.renderingVideoDesc'), color: 'neutral' })
    const blob = await exportCarouselVideo(
      (idx: number) => renderSlideToPng(stage, idx),
      slides.value.length,
      {
        fps: 30,
        secondsPerSlide: 3,
        crossfade: false,
        crossfadeSeconds: 0.5,
        motions: slides.value.map(() => 'none' as const),
        music: null,
        width: frame.value.w,
        height: frame.value.h,
      },
    )
    if (!blob) {
      toast.add({ title: t('toasts.failedTitle'), description: 'Video export failed', color: 'error' })
      return
    }
    const form = new FormData()
    form.append('files', new File([blob], `carousel_${Date.now()}.mp4`, { type: 'video/mp4' }))
    const result = await $fetch<{ success: boolean, data: Array<{ id: string }> }>('/api/v1/assets', { method: 'POST', body: form })
    const id = result.data[0]!.id
    sessionStorage.setItem(
      'repurposed-content',
      JSON.stringify({
        content: '',
        fullContent: '',
        platform: 'instagram',
        isThread: false,
        comments: [],
        mediaAssets: [id],
      }),
    )
    toast.add({ title: t('actions.videoReady'), description: t('actions.videoReadyDesc'), color: 'success' })
    await navigateTo('/app/posts/new')
  } catch (error) {
    handleSaveError(error)
  }
}

async function handleDownloadCurrent(): Promise<void> {
  const stage = getExportStage()
  if (!stage) return
  try {
    await downloadSlide(stage, currentIndex.value)
  } catch (error) {
    handleSaveError(error)
  }
}

async function handleDownloadAll(): Promise<void> {
  const stage = getExportStage()
  if (!stage) return
  try {
    await downloadAllSlides(stage)
  } catch (error) {
    handleSaveError(error)
  }
}

async function handleSaveToCloud(): Promise<void> {
  if (!await ensureAuth()) return
  await saveToCloud()
}

async function handleShare(): Promise<void> {
  if (!await ensureAuth()) return
  await publishCarousel()
}

async function handleUnshare(): Promise<void> {
  if (!await ensureAuth()) return
  await unpublishCarousel()
}

async function handleCopyLink(): Promise<void> {
  await copyShareLink()
}
</script>

<template>
  <div class="min-h-screen bg-linear-to-br from-default via-muted to-default">
    <BaseHeader />
    <div class="container mx-auto px-4 pt-6 pb-12">
      <div class="mb-4 flex items-center gap-4">
        <h1 class="text-2xl font-bold text-highlighted">{{ t('studioTitle') }}</h1>
        <UPopover v-if="loggedIn || savedCarousels.length > 0">
          <UButton variant="outline" color="neutral" icon="i-lucide-layout-grid" :loading="isLoadingCarousels">
            {{ currentCarouselName }}
            <UIcon name="i-lucide-chevron-down" class="ml-1 size-4" />
          </UButton>
          <template #content>
            <div class="p-2 w-72 max-h-96 overflow-y-auto">
              <div v-if="savedCarousels.length === 0" class="px-3 py-2 text-sm text-muted">
                No saved carousels
              </div>
              <button
                v-for="carousel in savedCarousels"
                :key="carousel.id"
                class="w-full text-left px-3 py-2 rounded-lg hover:bg-accent flex items-center gap-2"
                :class="{ 'bg-accent': carousel.name === currentCarouselName }"
                @click="() => loadCarouselIntoEditor(carousel)"
              >
                <UIcon name="i-lucide-gallery-horizontal-end" class="size-4 shrink-0" />
                <span class="truncate">{{ carousel.name }}</span>
                <UBadge v-if="carousel.isPublic" color="info" variant="subtle" size="sm" class="ml-auto">
                  Public
                </UBadge>
              </button>
              <USeparator class="my-2" />
              <UButton variant="ghost" block icon="i-lucide-plus" to="/app/templates">
                Manage all templates
              </UButton>
            </div>
          </template>
        </UPopover>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div class="min-w-0 space-y-4">
          <template v-if="mode === 'deck'">
            <CarouselStripPreview v-if="previewPlatform === 'strip'" />
            <CarouselPlatformPreview v-else-if="previewPlatform !== 'editor'" :html="currentHtml()" :width="frame.w"
              :height="frame.h" :fx-style="stageFx" :platform="previewPlatform" :current-index="currentIndex"
              :total="slides.length" :handle="handle" />
            <CarouselStage v-else :html="currentHtmlStr" :width="frame.w" :height="frame.h" :guides="guides"
              :fx-style="stageFx" :editable="true" />
          </template>
          <CarouselAiPanel v-else @generated="() => mode = 'deck'" />

          <!-- Sliced image group controls (add/trim pages of the slice run) -->
          <div v-if="mode === 'deck' && slicedImageGroup" class="mx-auto max-w-md w-full rounded-xl border border-default bg-elevated/80 backdrop-blur p-3 space-y-2"
            data-testid="sliced-group-controls">
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs font-semibold text-muted flex items-center gap-1.5">
                <UIcon name="i-lucide-scissors" class="size-3.5" />
                {{ t('quickActions.sliceImage') }}
              </p>
              <span class="text-[10px] font-mono text-muted">{{ slicedImageGroup.count }} · {{ slicedImageGroup.direction }}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-[10px] uppercase tracking-wide text-muted shrink-0">{{ t('fromImage.slices') }}</span>
              <USlider v-model="sliceCountProxy" :min="1" :max="9" :step="1" class="flex-1" data-testid="sliced-count-slider" />
            </div>
            <p class="text-[10px] text-muted">{{ t('quickActions.sliceImageDesc') }}</p>
          </div>

          <div v-if="mode === 'deck'" class="flex flex-col items-center gap-3">
            <div class="flex items-center justify-center gap-4">
              <UButton data-testid="btn-prev-slide" variant="outline" color="neutral" size="sm"
                icon="i-lucide-chevron-left" :disabled="currentIndex === 0" :aria-label="t('slide.prev')"
                @click="prevSlide" />
              <span class="font-mono text-sm text-muted" data-testid="slide-counter">
                {{ currentIndex + 1 }}/{{ slides.length }}
              </span>
              <UButton data-testid="btn-next-slide" variant="outline" color="neutral" size="sm"
                icon="i-lucide-chevron-right" :disabled="currentIndex === slides.length - 1"
                :aria-label="t('slide.next')" @click="nextSlide" />
            </div>

            <div class="flex items-center gap-1 p-1 rounded-full bg-elevated border border-default"
              data-testid="preview-switcher" role="group" :aria-label="t('preview.label')">
              <UButton size="xs" :variant="previewPlatform === 'editor' ? 'solid' : 'ghost'"
                :color="previewPlatform === 'editor' ? 'primary' : 'neutral'" icon="i-lucide-pencil"
                :label="t('preview.editor')" data-testid="preview-editor" :aria-pressed="previewPlatform === 'editor'"
                @click="() => previewPlatform = 'editor'" />
              <UButton size="xs" :variant="previewPlatform === 'strip' ? 'solid' : 'ghost'"
                :color="previewPlatform === 'strip' ? 'primary' : 'neutral'" icon="i-lucide-gallery-horizontal"
                :label="t('preview.strip')" data-testid="preview-strip" :aria-pressed="previewPlatform === 'strip'"
                @click="() => previewPlatform = 'strip'" />
              <UButton size="xs" :variant="previewPlatform === 'instagram' ? 'solid' : 'ghost'"
                :color="previewPlatform === 'instagram' ? 'primary' : 'neutral'" icon="i-lucide-instagram"
                :label="t('preview.instagram')" data-testid="preview-instagram"
                :aria-pressed="previewPlatform === 'instagram'" @click="() => previewPlatform = 'instagram'" />
              <UButton size="xs" :variant="previewPlatform === 'linkedin' ? 'solid' : 'ghost'"
                :color="previewPlatform === 'linkedin' ? 'primary' : 'neutral'" icon="i-lucide-linkedin"
                :label="t('preview.linkedin')" data-testid="preview-linkedin"
                :aria-pressed="previewPlatform === 'linkedin'" @click="() => previewPlatform = 'linkedin'" />
            </div>
            <p v-if="previewPlatform !== 'editor'" class="text-[11px] text-muted">
              {{ previewPlatform === 'instagram' ? t('preview.igHint') : previewPlatform === 'linkedin' ?
                t('preview.liHint') :
                t('preview.stripHint') }}
            </p>
          </div>

          <div class="sticky bottom-4 z-30 flex justify-center">
            <CarouselControlBar v-model:mode="mode" v-model:guides="guides" :exporting="exporting || videoExporting"
              :export-progress="exportProgress" :is-saving="isSaving" :is-public="isPublic" :share-url="shareUrl"
              @download="handleDownloadCurrent" @download-all="handleDownloadAll"
              @save-all="handleSaveAll" @use-in-post="handleUseInPost" @use-in-post-video="handleUseInPostVideo"
              @save="handleSaveToCloud" @share="handleShare" @unshare="handleUnshare" @copy-link="handleCopyLink" />
          </div>
        </div>

        <aside
          class="w-full rounded-2xl border border-default bg-elevated/70 backdrop-blur-md p-4 space-y-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <CollapsibleSection :title="t('layers.title')" :default-open="true" testid="section-layers">
            <CarouselLayersPanel />
          </CollapsibleSection>
          <CollapsibleSection :title="t('style.label')" :default-open="true" testid="section-style">
            <LayerStylePanel />
          </CollapsibleSection>
          <CollapsibleSection :title="t('design.label')" :default-open="true" testid="section-design">
            <CarouselDesignTabs />
          </CollapsibleSection>
          <CollapsibleSection :title="t('quickActions.label')" :default-open="true" testid="section-quick-actions">
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-2">
                <UButton size="xs" color="primary" variant="soft" icon="i-lucide-scissors" :label="t('quickActions.sliceImage')" data-testid="btn-quick-slice-image" @click="() => showFromImageModal = true" />
                <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-file-plus" :label="t('quickActions.addBlank')" data-testid="btn-quick-add-blank" @click="() => addBlankSlide()" />
                <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-code-2" :label="t('quickActions.addHtml')" data-testid="btn-quick-add-html" @click="() => showFromHtmlModal = true" />
                <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-copy" :label="t('quickActions.duplicate')" :disabled="slides.length >= 10" data-testid="btn-quick-duplicate" @click="() => duplicateCurrentSlide(currentIndex)" />
              </div>
              <p class="text-[10px] text-muted">{{ t('quickActions.sliceImageDesc') }}</p>
            </div>
          </CollapsibleSection>
          <CollapsibleSection :title="`${t('deck.brand')} & ${t('flow.label')}`" :default-open="false"
            testid="section-brand">
            <CarouselDeckPanel :fonts="fonts" />
          </CollapsibleSection>
          <CollapsibleSection :title="t('slide.label')" :default-open="false" testid="section-slides">
            <CarouselSlidesRail />
          </CollapsibleSection>
          <CollapsibleSection :title="t('media.label')" :default-open="false" testid="section-media">
            <CarouselMediaPanel />
          </CollapsibleSection>
          <CollapsibleSection :title="t('export.label')" :default-open="false" testid="section-export">
            <CarouselExportPanel />
          </CollapsibleSection>
        </aside>
      </div>

      <div class="mt-12 pt-8 border-t border-default">
        <CarouselDeckShowcase />
      </div>
    </div>

    <!-- Hidden full-size export stage -->
    <div id="carousel-export-stage"
      :style="{ position: 'fixed', left: '-99999px', top: '0', width: `${frame.w}px`, height: `${frame.h}px`, pointerEvents: 'none' }"
      aria-hidden="true">
      <div id="carousel-export-canvas" :style="{ position: 'absolute', inset: '0', '--slide-fx': stageFx }"
        v-html="mode === 'deck' ? currentHtmlStr : ''" />
    </div>
  </div>
</template>

<style scoped>
#carousel-export-stage :deep(img) {
  max-width: none;
}
</style>

<style>
#carousel-export-stage [data-empty-label] {
  display: none !important;
}
</style>