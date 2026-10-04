<script setup lang="ts">
import { renderSlideHtml, toSlideData, type SlidePalette } from '../../utils/carouselTemplates'
import { buildPatternHtml } from '../../utils/carouselPatternHtml'

/**
 * A carousel rendered the way the carousel tool renders it.
 *
 * The chat used to draw its own thumbnails: it guessed a palette per slide and
 * called a template's `render` directly, so the chat and the tool produced
 * visibly different slides for the same payload. This goes through the same
 * `renderSlideHtml` the tool's stage uses, so one payload always looks the same
 * wherever it is shown.
 *
 * The deck in the tool lives in a module-level singleton, so this takes the
 * slides as a prop instead of reading that state — two carousels on one page
 * cannot fight over it.
 */

interface CarouselSlideInput {
  id?: string
  headline?: string
  body?: string
  kicker?: string
  items?: string[]
  stat?: string
  statLabel?: string
  quote?: string
  author?: string
  cta?: string
  template?: string
}

const props = withDefaults(defineProps<{
  slides: CarouselSlideInput[]
  /** Every string the owner reads, supplied by the caller's own i18n. */
  labels: {
    prev: string
    next: string
    goTo: string
    pages: string
    expand: string
  }
  frameW?: number
  frameH?: number
  /**
   * Card width as a share of the track. The chat preview wants a peek of the
   * next slide (50); the fullscreen viewer wants one slide nearly filling the
   * screen so reading it does not need a second window.
   */
  cardWidthPercent?: number
  /**
   * Size cards to the track's available height instead of a share of its
   * width. Without it a wide card is also a very tall one — at 62% of a
   * 1640px track a 4:5 slide is 1190px tall, so the modal grew a vertical
   * scrollbar to show a preview that is meant to be looked at, not scrolled.
   */
  fitHeight?: boolean
}>(), {
  frameW: 1080,
  frameH: 1350,
  cardWidthPercent: 50,
  fitHeight: false,
})

const emit = defineEmits<{
  expand: [index: number]
  /** The slide currently centred, so a parent can mirror it. */
  'update:active': [index: number]
}>()

/** A definite track height is what `fitHeight` measures against. */
const TRACK_HEIGHT = { height: '68vh' }

const stripRef = ref<HTMLElement | null>(null)
const activeIndex = ref(0)
const stripScale = ref(0.3)

/** The template the tool would pick for this slide's shape. */
/** The pattern the preview draws and the save path persists. */
const PATTERN = { key: 'dots', color: '#f97316', opacity: 0.08 }

function templateForSlide(slide: CarouselSlideInput): string {
  if (slide.template) return slide.template
  if (slide.cta) return 'cta'
  if (slide.quote) return 'quote'
  if (slide.items?.length) return 'tips-list'
  return 'big-statement'
}

function paletteFor(index: number): SlidePalette {
  return {
    bg: index % 2 === 0 ? '#0f0e0d' : '#171717',
    text: '#fafaf9',
    accent: index % 3 === 1 ? '#38bdf8' : '#f97316',
    patternColor: '#f97316',
  }
}

function slideHtml(slide: CarouselSlideInput, index: number): string {
  return renderSlideHtml(
    templateForSlide(slide),
    toSlideData(slide),
    paletteFor(index),
    index,
    props.slides.length,
    buildPatternHtml(PATTERN.key, PATTERN.color, PATTERN.opacity),
  )
}

/** Pixels one card should occupy, honouring the fit-height mode. */
function cardWidth(): number {
  const el = stripRef.value
  if (!el) return 0
  if (!props.fitHeight) return el.clientWidth * (props.cardWidthPercent / 100)
  const available = el.clientHeight
  if (available <= 0) return el.clientWidth * (props.cardWidthPercent / 100)
  return available * (props.frameW / props.frameH)
}

function cardPercent(): number {
  const el = stripRef.value
  if (!el || el.clientWidth <= 0) return props.cardWidthPercent
  return Math.min(100, (cardWidth() / el.clientWidth) * 100)
}

/** Scaled down from the real frame so nothing overflows its card. */
function updateScale(): void {
  const width = cardWidth()
  if (width <= 0) return
  stripScale.value = Math.min(1, Math.max(0.12, width / props.frameW))
}

function scrollToIndex(index: number): void {
  if (index < 0 || index >= props.slides.length) return
  activeIndex.value = index
  emit('update:active', index)
  nextTick(() => {
    stripRef.value?.querySelector<HTMLElement>(`[data-strip-index="${index}"]`)
      ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  })
}

function handlePrev(): void {
  scrollToIndex(activeIndex.value - 1)
}

function handleNext(): void {
  scrollToIndex(activeIndex.value + 1)
}

function handleExpand(index: number): void {
  emit('expand', index)
}

/** Scrolling by hand or by swipe keeps the counter and the dots in step. */
function onStripScroll(): void {
  const el = stripRef.value
  if (!el) return
  const width = cardWidth()
  if (width <= 0) return
  activeIndex.value = Math.min(
    props.slides.length - 1,
    Math.max(0, Math.round(el.scrollLeft / width)),
  )
  emit('update:active', activeIndex.value)
}

let observer: ResizeObserver | null = null

onMounted(() => {
  updateScale()
  if (stripRef.value) {
    observer = new ResizeObserver(updateScale)
    observer.observe(stripRef.value)
  }
  window.addEventListener('resize', updateScale)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', updateScale)
})

watch(() => [props.frameW, props.cardWidthPercent, props.fitHeight], updateScale)
watch(() => props.slides.length, updateScale)
</script>

<template>
  <div class="w-full space-y-3" data-testid="carousel-strip">
    <div class="flex items-center justify-between gap-2 px-1">
      <p class="text-xs text-muted">
        {{ labels.pages }}
        <span class="font-mono">{{ slides.length }}</span>
      </p>
      <div class="flex items-center gap-1.5">
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-chevron-left"
          :disabled="activeIndex === 0"
          :aria-label="labels.prev"
          data-testid="carousel-strip-prev"
          @click="handlePrev"
        />
        <span class="text-xs font-mono text-muted">{{ activeIndex + 1 }} / {{ slides.length }}</span>
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-chevron-right"
          :disabled="activeIndex >= slides.length - 1"
          :aria-label="labels.next"
          data-testid="carousel-strip-next"
          @click="handleNext"
        />
      </div>
    </div>

    <div class="relative overflow-hidden">
      <div
        ref="stripRef"
        class="flex snap-x snap-mandatory gap-px overflow-x-auto overflow-y-hidden scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]"
        data-testid="carousel-strip-scroll"
        role="region"
        tabindex="0"
        :style="fitHeight ? TRACK_HEIGHT : undefined"
        :aria-label="labels.pages"
        @scroll.passive="onStripScroll"
      >
        <button
          v-for="(slide, index) in slides"
          :key="slide.id ?? index"
          type="button"
          :data-strip-index="index"
          :data-active="index === activeIndex"
          class="group relative shrink-0 snap-start overflow-hidden bg-inverted text-left"
          :class="index === activeIndex ? 'ring-2 ring-inset ring-primary z-1' : 'hover:brightness-110'"
          :style="{ width: `${cardPercent()}%`, minWidth: `${cardPercent()}%`, maxWidth: `${cardPercent()}%`, aspectRatio: `${frameW} / ${frameH}` }"
          :aria-label="`${labels.goTo} ${index + 1}`"
          :data-testid="`carousel-strip-thumb-${index}`"
          @click="handleExpand(index)"
        >
          <div class="absolute inset-0 overflow-hidden">
            <div
              class="pointer-events-none origin-top-left"
              :style="{ width: `${frameW * stripScale}px`, height: `${frameH * stripScale}px` }"
            >
              <div
                class="origin-top-left"
                :style="{ width: `${frameW}px`, height: `${frameH}px`, transform: `scale(${stripScale})`, transformOrigin: 'top left' }"
                v-html="slideHtml(slide, index)"
              />
            </div>
          </div>
          <span class="absolute left-1.5 top-1.5 select-none rounded-full border border-white/10 bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-highlighted backdrop-blur">
            {{ String(index + 1).padStart(2, '0') }}
          </span>
          <span class="absolute bottom-1.5 right-1.5 select-none rounded-full bg-black/70 p-1 opacity-0 transition-opacity group-hover:opacity-100" :aria-label="labels.expand">
            <UIcon name="i-lucide-maximize-2" class="size-3 text-white" />
          </span>
        </button>
      </div>
    </div>

    <div class="flex items-center justify-center gap-1.5" data-testid="carousel-strip-dots">
      <button
        v-for="(slide, index) in slides"
        :key="slide.id ?? index"
        type="button"
        class="h-1.5 rounded-full transition-all"
        :class="index === activeIndex ? 'w-6 bg-primary' : 'w-1.5 bg-muted hover:bg-neutral-500'"
        :aria-label="`${labels.goTo} ${index + 1}`"
        @click="scrollToIndex(index)"
      />
    </div>
  </div>
</template>