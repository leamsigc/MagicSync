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
import CarouselControlBar from './components/CarouselControlBar.vue'
import CarouselPlatformPreview from './components/CarouselPlatformPreview.vue'
import CarouselStripPreview from './components/CarouselStripPreview.vue'
import CarouselSlidesRail from './components/CarouselSlidesRail.vue'
import { useCarouselDeck, fxStyle } from './composables/useCarouselDeck'
import type { FetchErrorShape } from './composables/useCarouselDeck'

const { t } = useI18n()
const toast = useToast()
const { loggedIn, fetchSession } = UseUser()

const {
  slides,
  currentIndex,
  currentHtml,
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

const fonts = ref<string[]>(['Arial', 'Georgia', 'Courier New', 'Verdana'])
const mode = ref<'deck' | 'ai'>('deck')
const guides = ref(false)
const previewPlatform = ref<'editor' | 'instagram' | 'linkedin' | 'strip'>('editor')
const stageFx = computed(() => fxStyle(fx.value))

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
  const shape = error as FetchErrorShape
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
</script>

<template>
  <div class="min-h-screen bg-linear-to-br from-neutral-900 via-neutral-800 to-neutral-900">
    <BaseHeader />
    <div class="container mx-auto px-4 pt-6 pb-12">
      <div class="mb-4">
        <h1 class="text-2xl font-bold text-white">{{ t('studioTitle') }}</h1>
        <p class="text-sm text-neutral-400">{{ t('description') }}</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div class="min-w-0 space-y-4">
          <template v-if="mode === 'deck'">
            <CarouselStripPreview v-if="previewPlatform === 'strip'" />
            <CarouselPlatformPreview
              v-else-if="previewPlatform !== 'editor'"
              :html="currentHtml()"
              :width="frame.w"
              :height="frame.h"
              :fx-style="stageFx"
              :platform="previewPlatform"
              :current-index="currentIndex"
              :total="slides.length"
              :handle="handle"
            />
            <CarouselStage
              v-else
              :html="currentHtml()"
              :width="frame.w"
              :height="frame.h"
              :guides="guides"
              :fx-style="stageFx"
            />
          </template>
          <CarouselAiPanel v-else @generated="() => mode = 'deck'" />

          <div
            v-if="mode === 'deck'"
            class="flex flex-col items-center gap-3"
          >
            <div class="flex items-center justify-center gap-4">
              <UButton
                data-testid="btn-prev-slide"
                variant="outline"
                color="neutral"
                size="sm"
                icon="i-lucide-chevron-left"
                :disabled="currentIndex === 0"
                :aria-label="t('slide.prev')"
                @click="prevSlide"
              />
              <span class="font-mono text-sm text-neutral-300" data-testid="slide-counter">
                {{ currentIndex + 1 }}/{{ slides.length }}
              </span>
              <UButton
                data-testid="btn-next-slide"
                variant="outline"
                color="neutral"
                size="sm"
                icon="i-lucide-chevron-right"
                :disabled="currentIndex === slides.length - 1"
                :aria-label="t('slide.next')"
                @click="nextSlide"
              />
            </div>

            <div class="flex items-center gap-1 p-1 rounded-full bg-neutral-800 border border-neutral-700/60" data-testid="preview-switcher" role="group" :aria-label="t('preview.label')">
              <UButton
                size="xs"
                :variant="previewPlatform === 'editor' ? 'solid' : 'ghost'"
                :color="previewPlatform === 'editor' ? 'primary' : 'neutral'"
                icon="i-lucide-pencil"
                :label="t('preview.editor')"
                data-testid="preview-editor"
                :aria-pressed="previewPlatform === 'editor'"
                @click="() => previewPlatform = 'editor'"
              />
              <UButton
                size="xs"
                :variant="previewPlatform === 'strip' ? 'solid' : 'ghost'"
                :color="previewPlatform === 'strip' ? 'primary' : 'neutral'"
                icon="i-lucide-gallery-horizontal"
                :label="t('preview.strip')"
                data-testid="preview-strip"
                :aria-pressed="previewPlatform === 'strip'"
                @click="() => previewPlatform = 'strip'"
              />
              <UButton
                size="xs"
                :variant="previewPlatform === 'instagram' ? 'solid' : 'ghost'"
                :color="previewPlatform === 'instagram' ? 'primary' : 'neutral'"
                icon="i-lucide-instagram"
                :label="t('preview.instagram')"
                data-testid="preview-instagram"
                :aria-pressed="previewPlatform === 'instagram'"
                @click="() => previewPlatform = 'instagram'"
              />
              <UButton
                size="xs"
                :variant="previewPlatform === 'linkedin' ? 'solid' : 'ghost'"
                :color="previewPlatform === 'linkedin' ? 'primary' : 'neutral'"
                icon="i-lucide-linkedin"
                :label="t('preview.linkedin')"
                data-testid="preview-linkedin"
                :aria-pressed="previewPlatform === 'linkedin'"
                @click="() => previewPlatform = 'linkedin'"
              />
            </div>
            <p v-if="previewPlatform !== 'editor'" class="text-[11px] text-neutral-500">
              {{ previewPlatform === 'instagram' ? t('preview.igHint') : previewPlatform === 'linkedin' ? t('preview.liHint') : t('preview.stripHint') }}
            </p>
          </div>

          <div class="sticky bottom-4 z-30 flex justify-center">
            <CarouselControlBar
              v-model:mode="mode"
              v-model:guides="guides"
              :exporting="exporting"
              :export-progress="exportProgress"
              @download="handleDownloadCurrent"
              @download-all="handleDownloadAll"
              @save-all="handleSaveAll"
              @use-in-post="handleUseInPost"
            />
          </div>
        </div>

        <aside class="w-full rounded-2xl border border-neutral-700/60 bg-neutral-900/70 backdrop-blur-md p-4 space-y-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <CarouselDeckTemplatesPanel />
          <USeparator />
          <CarouselSlidesRail />
          <USeparator />
          <CarouselDeckPanel />
          <USeparator />
          <CarouselStylePanel :fonts="fonts" />
          <USeparator />
          <CarouselMediaPanel />
          <USeparator />
          <CarouselExportPanel />
        </aside>
      </div>
    </div>

    <!-- Hidden full-size export stage -->
    <div
      id="carousel-export-stage"
      :style="{ position: 'fixed', left: '-99999px', top: '0', width: `${frame.w}px`, height: `${frame.h}px`, pointerEvents: 'none' }"
      aria-hidden="true"
    >
      <div
        id="carousel-export-canvas"
        :style="{ position: 'absolute', inset: '0', '--slide-fx': stageFx }"
        v-html="mode === 'deck' ? currentHtml() : ''"
      />
    </div>
  </div>
</template>

<style scoped>
#carousel-export-stage :deep(img) {
  max-width: none;
}
</style>
