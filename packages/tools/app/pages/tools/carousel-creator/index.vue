<!-- eslint-disable vue/multi-word-component-names -->
<i18n src="./carousel-creator.json"></i18n>
<script lang="ts" setup>
import CarouselStage from './components/CarouselStage.vue'
import CarouselAiPanel from './components/CarouselAiPanel.vue'
import CarouselMediaPanel from './components/CarouselMediaPanel.vue'
import CarouselStylePanel from './components/CarouselStylePanel.vue'
import CarouselExportPanel from './components/CarouselExportPanel.vue'
import CarouselDeckPanel from './components/CarouselDeckPanel.vue'
import CarouselDeckTemplatesPanel from './components/CarouselDeckTemplatesPanel.vue'
import CollapsibleSection from './components/CollapsibleSection.vue'
import CarouselControlBar from './components/CarouselControlBar.vue'
import CarouselPlatformPreview from './components/CarouselPlatformPreview.vue'
import CarouselStripPreview from './components/CarouselStripPreview.vue'
import CarouselSlidesRail from './components/CarouselSlidesRail.vue'
import CarouselDeckShowcase from './components/CarouselDeckShowcase.vue'
import { useCarouselDeck, fxStyle } from './composables/useCarouselDeck'
import { useCarouselSaveShare } from '../../../composables/useCarouselSaveShare'
import { getAllLocalCarousels } from '../../../utils/carousel-db'
import type { SlideData, SlidePalette } from './templates'

const { t } = useI18n()
const toast = useToast()
const { loggedIn, fetchSession } = UseUser()

interface SavedCarousel {
  id: string
  name: string
  slides: Array<{ templateKey: string; data: SlideData; pattern: string; patternColor: string; patternOpacity: number; bgImage: unknown; customHtml: string }>
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
} = useCarouselDeck()

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
    // Directly apply slides and palette to the deck
    slides.value = carousel.slides.map(s => ({
      id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      templateKey: s.templateKey,
      data: { ...s.data },
      pattern: s.pattern ?? 'dots',
      patternColor: s.patternColor ?? carousel.palette.text,
      patternOpacity: s.patternOpacity ?? 0.08,
      bgImage: s.bgImage ?? null,
      customHtml: s.customHtml ?? '',
    }))
    palette.value = { ...carousel.palette }
    handle.value = carousel.handle ?? ''
    currentIndex.value = 0
    currentCarouselName.value = carousel.name
    toast.add({ title: 'Carousel loaded', description: `"${carousel.name}" loaded into editor.`, color: 'success', icon: 'i-lucide-check-circle' })
  } catch {
    toast.add({ title: 'Load failed', description: 'Could not load carousel.', color: 'error', icon: 'i-lucide-alert-circle' })
  }
}

onMounted(async () => {
  await loadSavedCarousels()
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
  const shape = error as any
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

      <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
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
            <CarouselControlBar v-model:mode="mode" v-model:guides="guides" :exporting="exporting"
              :export-progress="exportProgress" :is-saving="isSaving" :is-public="isPublic" :share-url="shareUrl"
              @download="handleDownloadCurrent" @download-all="handleDownloadAll"
              @save-all="handleSaveAll" @use-in-post="handleUseInPost"
              @save="handleSaveToCloud" @share="handleShare" @unshare="handleUnshare" @copy-link="handleCopyLink" />
          </div>
        </div>

        <aside
          class="w-full rounded-2xl border border-default bg-elevated/70 backdrop-blur-md p-4 space-y-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <CollapsibleSection :title="t('templates.deckTitle')" :default-open="true" testid="section-templates">
            <CarouselDeckTemplatesPanel />
          </CollapsibleSection>
          <CollapsibleSection :title="t('slide.label')" :default-open="true" testid="section-slides">
            <CarouselSlidesRail />
          </CollapsibleSection>
          <CollapsibleSection :title="`${t('deck.brand')} & ${t('flow.label')}`" :default-open="true"
            testid="section-brand">
            <CarouselDeckPanel />
          </CollapsibleSection>
          <CollapsibleSection :title="t('style.label')" :default-open="true" testid="section-style">
            <CarouselStylePanel :fonts="fonts" />
          </CollapsibleSection>
          <CollapsibleSection :title="t('media.label')" :default-open="true" testid="section-media">
            <CarouselMediaPanel />
          </CollapsibleSection>
          <CollapsibleSection :title="t('export.label')" :default-open="true" testid="section-export">
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
