<i18n src="../carousel-creator.json"></i18n>
<script lang="ts" setup>
import { CAROUSEL_DECK_TEMPLATES, type DeckTemplate } from '../deckTemplates'
import { renderSlideHtml, type SlidePalette } from '../templates'
import { patternStyle } from '../patterns'
import { useCarouselDeck } from '../composables/useCarouselDeck'

const { applyDeckTemplate, slides } = useCarouselDeck()
const { t } = useI18n()
const toast = useToast()

const THUMB_W = 200
const SCALE = THUMB_W / 1080

const pendingDeck = ref<{ key: string, title: string } | null>(null)
const isConfirmOpen = computed({
  get: () => !!pendingDeck.value,
  set: (value: boolean) => { if (!value) pendingDeck.value = null },
})

function previewHtml(deck: DeckTemplate, slideIdx: number): string {
  const spec = deck.slides[slideIdx]
  if (!spec) return ''
  const palette: SlidePalette = {
    bg: deck.palette.bg,
    text: deck.palette.text,
    accent: deck.palette.accent,
    patternColor: deck.palette.text,
    font: deck.palette.font,
  }
  const patternKey = deck.pattern ?? 'dots'
  const patternHtml = `<div style="position:absolute;inset:0;${Object.entries(patternStyle(patternKey, palette.patternColor, 0.08)).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`).join(';')}"></div>`
  return renderSlideHtml(spec.templateKey, spec.data, palette, slideIdx, deck.slides.length, patternHtml)
}

function handleApply(key: string, title: string): void {
  if (slides.value.length > 1) {
    pendingDeck.value = { key, title }
    return
  }
  applyNow(key, title)
}

function confirmApply(): void {
  if (!pendingDeck.value) return
  const { key, title } = pendingDeck.value
  pendingDeck.value = null
  applyNow(key, title)
}

function applyNow(key: string, title: string): void {
  applyDeckTemplate(key)
  toast.add({ title: t('templates.applied'), description: t('templates.appliedDesc', { title }), color: 'success' })
}
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-6" data-testid="deck-showcase">
    <div class="flex flex-col gap-1">
      <h2 class="text-lg font-bold text-highlighted">{{ t('showcase.title') }}</h2>
      <p class="text-sm text-muted">{{ t('showcase.hint') }}</p>
    </div>

    <article
      v-for="(deck, deckIdx) in CAROUSEL_DECK_TEMPLATES"
      :key="deck.key"
      :data-testid="`showcase-deck-${deck.key}`"
      class="overflow-hidden rounded-2xl border border-default bg-elevated/60"
    >
      <div class="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-3">
        <div class="min-w-0 space-y-0.5">
          <h3 class="text-sm font-semibold text-highlighted">{{ deck.title }}</h3>
          <p class="text-[11px] text-muted line-clamp-1">{{ deck.description }}</p>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1">
            <span class="h-3 w-3 rounded-full border border-white/20" :style="{ background: deck.palette.bg }" />
            <span class="h-3 w-3 rounded-full border border-white/20" :style="{ background: deck.palette.accent }" />
            <span class="h-3 w-3 rounded-full border border-white/20" :style="{ background: deck.palette.text }" />
          </div>
          <UBadge variant="outline" color="neutral" size="xs">{{ deck.slides.length }} {{ t('showcase.pages') }}</UBadge>
          <UButton
            size="xs"
            color="primary"
            variant="soft"
            icon="i-lucide-sparkles"
            :label="t('templates.useDeck')"
            :data-testid="`btn-showcase-use-${deck.key}`"
            @click="() => handleApply(deck.key, deck.title)"
          />
        </div>
      </div>

      <div class="border-t border-default bg-muted/60 p-3">
        <div
          :id="`showcase-strip-${deckIdx}`"
          class="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]"
          data-testid="showcase-strip"
        >
          <div
            v-for="(spec, idx) in deck.slides"
            :key="`${deck.key}-${idx}`"
            class="group relative shrink-0 overflow-hidden rounded-lg border border-default shadow-md transition-transform hover:-translate-y-1 hover:border-primary/50"
            :style="{ width: `${THUMB_W}px`, height: `${Math.round(THUMB_W * 1350 / 1080)}px` }"
            :title="spec.templateKey"
          >
            <div
              class="pointer-events-none absolute top-0 left-0 origin-top-left"
              :style="{ width: '1080px', height: '1350px', transform: `scale(${SCALE})`, transformOrigin: 'top left' }"
              v-html="previewHtml(deck, idx)"
            />
            <span class="absolute top-1 left-1 text-[9px] font-mono px-1 py-0.5 rounded-full bg-black/70 text-highlighted border border-white/10 pointer-events-none">
              {{ String(idx + 1).padStart(2, '0') }}
            </span>
            <span class="absolute bottom-1 right-1 text-[8px] font-mono px-1 rounded bg-black/70 text-toned opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
              {{ spec.templateKey }}
            </span>
          </div>
        </div>
      </div>
    </article>
    </section>

    <UModal v-model:open="isConfirmOpen" :title="t('templates.confirmTitle')" :description="pendingDeck ? t('templates.confirmReplace', { title: pendingDeck.title }) : undefined">
      <template #body>
        <div class="space-y-3">
          <UAlert color="warning" variant="subtle" icon="i-lucide-triangle-alert" :title="t('templates.confirmHint')" />
          <p class="text-sm text-muted">{{ t('templates.confirmBody') }}</p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" :label="t('templates.cancel')" data-testid="btn-showcase-cancel-deck" @click="() => pendingDeck = null" />
          <UButton color="primary" :label="t('templates.confirm')" data-testid="btn-showcase-confirm-deck" @click="confirmApply" />
        </div>
      </template>
    </UModal>
  </div>
</template>
