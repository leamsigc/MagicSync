<i18n src="#site/app/pages/tools/carousel-creator/carousel-creator.json"></i18n>
<script lang="ts" setup>
import { useCarouselDeck } from '#layers/BaseUI/app/utils/composables/useCarouselDeck'

const { slides, currentIndex, slideHtml, frame, switchTo } = useCarouselDeck()
const { t } = useI18n()

const stripRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const didDrag = ref(false)
const stripScale = ref(0.32)
let startX = 0
let startScroll = 0
let resizeObserver: ResizeObserver | null = null

function updateScale(): void {
  if (!stripRef.value) return
  // card is 50% of strip width
  const cardWidth = stripRef.value.clientWidth / 2
  // clamp to avoid tiny or huge values during SSR/hydration
  const next = Math.min(0.6, Math.max(0.12, cardWidth / 1080))
  stripScale.value = next
}

onMounted(() => {
  updateScale()
  if (stripRef.value) {
    resizeObserver = new ResizeObserver(updateScale)
    resizeObserver.observe(stripRef.value)
  }
  window.addEventListener('resize', updateScale)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', updateScale)
})

watch(() => frame.value.w, updateScale)

function scrollToIndex(index: number): void {
  if (didDrag.value) return
  switchTo(index)
  nextTick(() => {
    const el = stripRef.value?.querySelector<HTMLElement>(`[data-strip-index="${index}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  })
}

watch(currentIndex, index => {
  const el = stripRef.value?.querySelector<HTMLElement>(`[data-strip-index="${index}"]`)
  el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
})

function onPointerDown(event: PointerEvent): void {
  isDragging.value = true
  didDrag.value = false
  startX = event.clientX
  startScroll = stripRef.value?.scrollLeft ?? 0
    ; (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  if (stripRef.value) stripRef.value.style.scrollSnapType = 'none'
  if (stripRef.value) stripRef.value.style.scrollBehavior = 'auto'
}

function onPointerMove(event: PointerEvent): void {
  if (!isDragging.value || !stripRef.value) return
  const dx = event.clientX - startX
  if (Math.abs(dx) > 4) didDrag.value = true
  stripRef.value.scrollLeft = startScroll - dx
}

function onPointerUp(event: PointerEvent): void {
  if (!stripRef.value) return
  isDragging.value = false
  stripRef.value.style.scrollSnapType = ''
  stripRef.value.style.scrollBehavior = ''
  try { (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId) } catch { /* ignore release */ }
  if (didDrag.value) setTimeout(() => { didDrag.value = false }, 120)
}

function onPointerLeave(): void {
  if (!isDragging.value) return
  isDragging.value = false
  if (stripRef.value) {
    stripRef.value.style.scrollSnapType = ''
    stripRef.value.style.scrollBehavior = ''
  }
}
</script>

<template>
  <div class="w-full space-y-3" data-testid="preview-strip">
    <!-- header hint like Instagram/LinkedIn strip -->
    <div class="flex items-center justify-between px-1">
      <p class="text-xs font-medium text-muted">
        {{ t('preview.stripTitle', 'All pages — scroll to preview') }}
        <span class="font-mono text-muted">{{ slides.length }} pages</span>
      </p>
      <div class="hidden sm:flex items-center gap-1.5">
        <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-chevron-left" :disabled="currentIndex === 0"
          :aria-label="t('slide.prev')" data-testid="strip-prev"
          @click="() => scrollToIndex(Math.max(0, currentIndex - 1))" />
        <span class="text-xs font-mono text-muted">{{ currentIndex + 1 }} / {{ slides.length }}</span>
        <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-chevron-right"
          :disabled="currentIndex === slides.length - 1" :aria-label="t('slide.next')" data-testid="strip-next"
          @click="() => scrollToIndex(Math.min(slides.length - 1, currentIndex + 1))" />
      </div>
    </div>

    <div class="relative overflow-hidden ">
      <div ref="stripRef"
        class="flex overflow-x-auto snap-x snap-mandatory select-none scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] touch-pan-y gap-px bg-transparent"
        :class="isDragging ? 'cursor-grabbing' : 'cursor-grab'" data-testid="strip-scroll" role="region"
        :aria-label="t('preview.stripTitle')" tabindex="0" @pointerdown="onPointerDown" @pointermove="onPointerMove"
        @pointerup="onPointerUp" @pointercancel="onPointerUp" @pointerleave="onPointerLeave">
        <button v-for="(slide, index) in slides" :key="slide.id" type="button" :data-strip-index="index"
          :data-testid="`strip-thumb-${index}`" :data-active="index === currentIndex"
          class="group relative shrink-0 snap-start overflow-hidden bg-inverted text-left last:border-r-0 select-none"
          :class="index === currentIndex ? 'ring-2 ring-inset ring-white/25 z-1' : 'hover:brightness-110'"
          :style="{ width: '50%', minWidth: '50%', maxWidth: '50%', aspectRatio: `${frame.w} / ${frame.h}` }"
          :aria-label="`${t('slide.goTo')} ${index + 1}`" @click="() => scrollToIndex(index)">
          <div class="absolute inset-0 overflow-hidden">
            <div class="origin-top-left pointer-events-none"
              :style="{ width: `${frame.w}px`, height: `${frame.h}px`, transform: `scale(${stripScale})`, transformOrigin: 'top left' }"
              v-html="slideHtml(slide, index, slides.length)" />
          </div>

          <span
            class="absolute top-1.5 left-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-black/70 text-highlighted border border-white/10 backdrop-blur select-none pointer-events-none">
            {{ String(index + 1).padStart(2, '0') }}
          </span>
          <span v-if="index === currentIndex"
            class="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-white shadow pointer-events-none" />
        </button>
      </div>
    </div>

    <!-- dot pagination mirrors instagram/linkedin -->
    <div class="flex items-center justify-center gap-1.5" data-testid="strip-dots">
      <button v-for="(_, i) in slides" :key="i" type="button" class="h-1.5 rounded-full transition-all"
        :class="i === currentIndex ? 'w-6 bg-white' : 'w-1.5 bg-neutral-600 hover:bg-neutral-500'"
        :aria-label="`${t('slide.goTo')} ${i + 1}`" @click="() => scrollToIndex(i)" />
    </div>
  </div>
</template>
