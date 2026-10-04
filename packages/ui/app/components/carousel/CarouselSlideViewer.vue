<script setup lang="ts">
import { renderSlideHtml, toSlideData, type SlidePalette } from '../../utils/carouselTemplates'
import { buildPatternHtml } from '../../utils/carouselPatternHtml'
import CarouselSlideStrip from './CarouselSlideStrip.vue'

/**
 * One carousel slide, large, in a modal — the "look at it properly" view.
 *
 * The strip is for choosing a slide; this is for reading one. It keeps the whole
 * deck reachable with the arrow keys so a reviewer can walk every page without
 * closing anything.
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
  labels: {
    prev: string
    next: string
    goTo: string
    close: string
    of: string
    allPages: string
    single: string
    edit: string
    editHint: string
    editSave: string
    editSaving: string
  }
  frameW?: number
  frameH?: number
  /** Which slide to show when the modal opens. */
  initialIndex?: number
  /**
   * The real carousel editor, embedded.
   *
   * The editor's panels (layers, layer style, design, quick actions, slides,
   * media, export) all act on the carousel tool's module-level deck, so
   * rebuilding them here would mean a second editor that drifts from the first.
   * Embedding the tool itself is the only way to actually reuse those options.
   */
  editorUrl?: string
  /** True while the parent persists the chat carousel so the editor can load it. */
  editorBusy?: boolean
}>(), {
  frameW: 1080,
  frameH: 1350,
  initialIndex: 0,
  editorUrl: '',
  editorBusy: false,
})

const emit = defineEmits<{ edit: [] }>()

const open = defineModel<boolean>('open', { default: false })

/** `pages` is the horizontal all-pages track; `single` is one slide at a time. */
type ViewMode = 'pages' | 'single' | 'edit'
const mode = ref<ViewMode>('pages')

const index = ref(0)

/** The Edit tab is always visible so the full editor stays discoverable. Without a saved carousel it shows the save gate instead of the iframe. */
const modeItems = computed(() => [
  { value: 'pages', label: props.labels.allPages },
  { value: 'single', label: props.labels.single },
  { value: 'edit', label: props.labels.edit },
])
const stageRef = ref<HTMLElement | null>(null)
const scale = ref(1)

const current = computed(() => props.slides[index.value] ?? props.slides[0])

/** The pattern the preview draws and the save path persists. */
const PATTERN = { key: 'dots', color: '#f97316', opacity: 0.08 }

function templateForSlide(slide: CarouselSlideInput): string {
  if (slide.template) return slide.template
  if (slide.cta) return 'cta'
  if (slide.quote) return 'quote'
  if (slide.items?.length) return 'tips-list'
  return 'big-statement'
}

function paletteFor(position: number): SlidePalette {
  return {
    bg: position % 2 === 0 ? '#0f0e0d' : '#171717',
    text: '#fafaf9',
    accent: position % 3 === 1 ? '#38bdf8' : '#f97316',
    patternColor: '#f97316',
  }
}

function slideHtml(): string {
  const slide = current.value
  if (!slide) return ''
  return renderSlideHtml(
    templateForSlide(slide),
    toSlideData(slide),
    paletteFor(index.value),
    index.value,
    props.slides.length,
    buildPatternHtml(PATTERN.key, PATTERN.color, PATTERN.opacity),
  )
}

/** Fit the real frame inside whatever space the modal has left. */
function updateScale(): void {
  const el = stageRef.value
  if (!el) return
  const padding = 32
  const byWidth = (el.clientWidth - padding) / props.frameW
  const byHeight = (el.clientHeight - padding) / props.frameH
  scale.value = Math.max(0.1, Math.min(byWidth, byHeight, 1))
}

function go(delta: number): void {
  const next = index.value + delta
  if (next < 0 || next >= props.slides.length) return
  index.value = next
  nextTick(updateScale)
}

function goTo(position: number): void {
  if (position < 0 || position >= props.slides.length) return
  index.value = position
  nextTick(updateScale)
}

function handleClose(): void {
  open.value = false
}

/** The strip owns scrolling; the viewer follows it so the dots stay honest. */
function handleStripIndex(next: number): void {
  index.value = next
}

function handleModeChange(next: string | number): void {
  mode.value = next as ViewMode
  // Editing needs the carousel persisted before the tool can load it.
  if (mode.value === 'edit') emit('edit')
  nextTick(observeStage)
}

function handleSaveGateClick(): void {
  emit('edit')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowRight') go(1)
  if (event.key === 'ArrowLeft') go(-1)
}

let observer: ResizeObserver | null = null

/**
 * The stage lives inside the modal, so it does not exist when this component
 * mounts — the observer used to be attached then, never was, and the slide kept
 * a scale measured against a smaller box and overflowed the fullscreen frame.
 */
function observeStage(): void {
  const el = stageRef.value
  if (!el) return
  observer?.disconnect()
  observer = new ResizeObserver(updateScale)
  observer.observe(el)
  updateScale()
}

watch(open, (isOpen) => {
  if (isOpen) {
    index.value = Math.min(props.slides.length - 1, Math.max(0, props.initialIndex))
    // Twice: once for the DOM, once more for the modal's own layout pass.
    nextTick(() => { observeStage(); requestAnimationFrame(observeStage) })
    window.addEventListener('keydown', onKeydown)
  }
  else {
    window.removeEventListener('keydown', onKeydown)
  }
})

onMounted(() => {
  window.addEventListener('resize', updateScale)
  observeStage()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', updateScale)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <UModal
    v-model:open="open"
    fullscreen
    :ui="{ content: 'sm:max-w-none' }"
    :title="`${labels.goTo} ${index + 1} ${labels.of} ${slides.length}`"
  >
    <template #body>
      <div class="mb-3 flex items-center justify-center">
        <UTabs
          :model-value="mode"
          :items="modeItems"
          size="sm"
          data-testid="carousel-viewer-modes"
          @update:model-value="handleModeChange"
        />
      </div>

      <CarouselSlideStrip
        v-if="mode === 'pages'"
        :slides="slides"
        :labels="labels"
        fit-height
        @update:active="handleStripIndex"
      />

      <div v-else-if="mode !== 'edit'" class="flex items-center gap-3">
        <UButton
          icon="i-lucide-chevron-left"
          variant="ghost"
          color="neutral"
          size="lg"
          :disabled="index === 0"
          :aria-label="labels.prev"
          data-testid="carousel-viewer-prev"
          @click="go(-1)"
        />
        <div
          ref="stageRef"
          class="flex min-h-[60vh] flex-1 items-center justify-center overflow-hidden"
          data-testid="carousel-viewer-stage"
        >
          <div class="relative shrink-0" :style="{ aspectRatio: `${frameW} / ${frameH}`, width: `${frameW * scale}px` }">
            <div
              class="absolute left-0 top-0 origin-top-left"
              :style="{ width: `${frameW}px`, height: `${frameH}px`, transform: `scale(${scale})` }"
              v-html="slideHtml()"
            />
          </div>
        </div>
        <UButton
          icon="i-lucide-chevron-right"
          variant="ghost"
          color="neutral"
          size="lg"
          :disabled="index >= slides.length - 1"
          :aria-label="labels.next"
          data-testid="carousel-viewer-next"
          @click="go(1)"
        />
      </div>

      <iframe
        v-else-if="mode === 'edit' && editorUrl"
        :src="editorUrl"
        class="h-[78vh] w-full rounded-lg border border-default"
        :title="labels.edit"
        data-testid="carousel-editor-frame"
      />

      <div
        v-else-if="mode === 'edit'"
        v-motion-fade
        :duration="200"
        class="flex h-[78vh] w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-default bg-elevated/50 p-6 text-center"
        data-testid="carousel-editor-gate"
      >
        <p class="max-w-md text-sm text-muted">{{ labels.editHint }}</p>
        <UButton
          color="primary"
          variant="solid"
          icon="i-heroicons-bookmark"
          :loading="editorBusy"
          data-testid="carousel-editor-save"
          @click="handleSaveGateClick"
        >
          {{ editorBusy ? labels.editSaving : labels.editSave }}
        </UButton>
      </div>

      <div v-if="mode === 'single'" class="mt-3 flex items-center justify-center gap-1.5" data-testid="carousel-viewer-dots">
        <button
          v-for="(slide, position) in slides"
          :key="slide.id ?? position"
          type="button"
          class="h-1.5 rounded-full transition-all"
          :class="position === index ? 'w-6 bg-primary' : 'w-1.5 bg-muted hover:bg-neutral-500'"
          :aria-label="`${labels.goTo} ${position + 1}`"
          @click="goTo(position)"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end">
        <UButton variant="ghost" color="neutral" :label="labels.close" @click="handleClose" />
      </div>
    </template>
  </UModal>
</template>