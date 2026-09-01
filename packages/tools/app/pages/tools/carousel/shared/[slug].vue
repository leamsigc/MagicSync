<script lang="ts" setup>
import { renderSlideHtml, type SlideData, type SlidePalette } from '../../carousel-creator/templates'
import { patternStyle } from '../../carousel-creator/patterns'
import { renderSlideLayers } from '../../carousel-creator/layers/render'
import type { SlideLayer } from '../../carousel-creator/layers/types'

interface SharedSlide {
  id: string
  templateKey: string
  data: SlideData
  pattern: string
  patternColor: string
  patternOpacity: number
  bgImage: { url: string; dim: number; shadow: { x: number; y: number; blur: number; opacity: number }; transform?: { x: number; y: number; scale: number } } | null
  customHtml: string
  layers?: SlideLayer[]
}

interface SharedPalette {
  bg: string
  text: string
  accent: string
  font?: string
}

interface SharedCarousel {
  name: string
  slides: SharedSlide[]
  palette: SharedPalette
  pattern?: string
  handle?: string
}

const route = useRoute()
const slug = route.params.slug as string

const carousel = ref<SharedCarousel | null>(null)
const error = ref<string | null>(null)
const isLoading = ref(true)
const THUMB_W = 260
const SCALE = THUMB_W / 1080
const THUMB_H = Math.round(THUMB_W * 1350 / 1080)

onMounted(async () => {
  try {
    carousel.value = await $fetch<SharedCarousel>(`/api/v1/carousel/public/${slug}`)
  } catch (e: unknown) {
    error.value = extractError(e)
  } finally {
    isLoading.value = false
  }
})

useHead({
  title: carousel.value?.name ?? 'Shared Carousel',
})

function extractError(e: unknown): string {
  const err = e as { data?: { statusMessage?: string } }
  return err?.data?.statusMessage ?? 'Carousel not found'
}

function buildPalette(carousel: SharedCarousel): SlidePalette {
  return {
    bg: carousel.palette.bg,
    text: carousel.palette.text,
    accent: carousel.palette.accent,
    patternColor: carousel.palette.text,
    font: carousel.palette.font,
  }
}

function buildPatternHtml(pattern: string, color: string, opacity: number): string {
  const styles = patternStyle(pattern, color, opacity)
  const css = Object.entries(styles)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`)
    .join(';')
  return `<div style="position:absolute;inset:0;${css}"></div>`
}

function slideHtml(slide: SharedSlide, index: number): string {
  if (!carousel.value) return ''
  if (slide.layers?.length) {
    return renderSlideLayers(slide.layers, { w: 1080, h: 1350 }, {
      bg: carousel.value.palette.bg,
      text: carousel.value.palette.text,
      accent: carousel.value.palette.accent,
      font: carousel.value.palette.font,
    }, { index, total: carousel.value.slides.length, handle: carousel.value.handle })
  }
  const palette = buildPalette(carousel.value)
  const patternKey = slide.pattern ?? carousel.value.pattern ?? 'dots'
  const patternHtml = buildPatternHtml(patternKey, palette.patternColor, slide.patternOpacity ?? 0.08)
  return renderSlideHtml(
    slide.templateKey,
    slide.data,
    palette,
    index,
    carousel.value.slides.length,
    patternHtml,
    slide.bgImage ?? undefined,
    undefined,
    carousel.value.handle,
  )
}
</script>

<template>
  <ClientOnly>
    <div class="min-h-screen" :style="{ backgroundColor: carousel?.palette?.bg ?? '#0f172a' }">
      <div v-if="error" class="flex items-center justify-center min-h-screen">
        <div class="text-center">
          <h1 class="text-2xl font-bold text-white mb-2">Carousel not found</h1>
          <p class="text-neutral-400">{{ error }}</p>
        </div>
      </div>

      <div v-else-if="carousel" class="px-4 py-8">
        <h1 class="text-xl font-bold text-center mb-6" :style="{ color: carousel.palette.text }">
          {{ carousel.name }}
        </h1>

        <div class="overflow-x-auto pb-4">
          <div class="flex gap-4 justify-start min-w-max px-4">
            <div
              v-for="(slide, index) in carousel.slides"
              :key="index"
              class="relative shrink-0 overflow-hidden rounded-xl shadow-lg border border-white/10"
              :style="{ width: `${THUMB_W}px`, height: `${THUMB_H}px` }"
            >
              <div
                class="absolute top-0 left-0 origin-top-left"
                :style="{
                  width: '1080px',
                  height: '1350px',
                  transform: `scale(${SCALE})`,
                  transformOrigin: 'top left',
                }"
                v-html="slideHtml(slide, index)"
              />
              <span class="absolute top-2 left-2 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-black/70 text-white border border-white/10 pointer-events-none z-10">
                {{ String(index + 1).padStart(2, '0') }}
              </span>
            </div>
          </div>
        </div>

        <p v-if="carousel.handle" class="text-center text-sm mt-6" :style="{ color: carousel.palette.text + '80' }">
          @{{ carousel.handle }}
        </p>
      </div>

      <div v-else-if="isLoading" class="flex items-center justify-center min-h-screen">
        <div class="text-neutral-400">Loading...</div>
      </div>
    </div>

    <template #fallback>
      <div class="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div class="text-neutral-400">Loading carousel...</div>
      </div>
    </template>
  </ClientOnly>
</template>
