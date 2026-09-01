<i18n src="../carousel-creator.json"></i18n>
<script lang="ts" setup>
import type { DeckTemplate } from '../deckTemplates'
import { renderSlideHtml, type SlidePalette } from '../templates'
import { patternStyle } from '../patterns'
import { renderSlideLayers } from '../layers/render'
import { instantiateLayers } from '../layers/types'
import { useCarouselDeck } from '../composables/useCarouselDeck'

const { applyDeckTemplate, slides, allDeckTemplates, customDecks, removeCustomDeck, frame } = useCarouselDeck()
const { t } = useI18n()
const toast = useToast()

const pendingDeck = ref<{ key: string, title: string } | null>(null)
const isConfirmOpen = computed({
  get: () => !!pendingDeck.value,
  set: (value: boolean) => { if (!value) pendingDeck.value = null },
})

function handleRemoveAi(key: string): void {
  removeCustomDeck(key)
  toast.add({ title: 'Template removed', color: 'neutral' })
}

function previewHtml(deck: DeckTemplate, slideIdx: number): string {
  const spec = deck.slides[slideIdx]
  if (!spec) return ''
  if (spec.layers) {
    return renderSlideLayers(instantiateLayers(JSON.parse(JSON.stringify(spec.layers))), frame.value, deck.palette, { index: slideIdx, total: deck.slides.length })
  }
  if (spec.html) {
    return `<div style="position:relative;width:1080px;height:1350px;overflow:hidden;background:${deck.palette.bg}">${spec.html}</div>`
  }
  const palette: SlidePalette = { bg: deck.palette.bg, text: deck.palette.text, accent: deck.palette.accent, patternColor: deck.palette.text, font: deck.palette.font }
  const patternKey = deck.pattern ?? 'dots'
  const patternHtml = `<div style="position:absolute;inset:0;${Object.entries(patternStyle(patternKey, palette.patternColor, 0.08)).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`).join(';')}"></div>`
  return renderSlideHtml(spec.templateKey, spec.data, palette, slideIdx, deck.slides.length, patternHtml)
}

function isAiDeck(key: string): boolean {
  return customDecks.value.some(d => d.key === key)
}

function applyDeck(key: string, title: string): void {
  applyDeckTemplate(key)
  toast.add({ title: t('templates.applied'), description: t('templates.appliedDesc', { title }), color: 'success' })
}

function handleApply(key: string, title: string): void {
  if (slides.value.length > 1) {
    pendingDeck.value = { key, title }
    return
  }
  applyDeck(key, title)
}

function confirmApply(): void {
  if (!pendingDeck.value) return
  const { key, title } = pendingDeck.value
  pendingDeck.value = null
  applyDeck(key, title)
}
</script>

<template>
  <section class="space-y-3" data-testid="deck-templates-panel">
    <div class="flex items-center justify-between">
      <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('templates.deckTitle') }}</p>
      <UBadge variant="outline" color="neutral" size="xs">{{ allDeckTemplates.length }}</UBadge>
    </div>
    <p class="text-[11px] text-muted leading-relaxed">{{ t('templates.deckHint') }}</p>

    <div class="grid grid-cols-1 gap-3">
      <article
        v-for="deck in allDeckTemplates"
        :key="deck.key"
        :data-testid="`deck-template-${deck.key}`"
        class="group relative overflow-hidden rounded-xl border border-default bg-muted hover:border-primary/50 hover:bg-muted transition-colors"
        :class="isAiDeck(deck.key) ? 'ring-1 ring-primary/30' : ''"
      >
        <div class="flex gap-2 p-3">
          <!-- Stacked mini previews of first 3 pages -->
          <div class="relative flex shrink-0" style="width:92px;height:84px">
            <div
              v-for="i in Math.min(3, deck.slides.length)"
              :key="i"
              class="absolute rounded-md overflow-hidden border border-default bg-elevated shadow-md"
              :style="{ width: '56px', height: '70px', left: `${(i - 1) * 14}px`, top: `${(i - 1) * 4}px`, zIndex: 4 - i }"
            >
              <div class="origin-top-left pointer-events-none" :style="{ width: '1080px', height: '1350px', transform: 'scale(0.052)' }" v-html="previewHtml(deck, i - 1)" />
            </div>
            <span class="absolute -bottom-1 -right-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/70 text-white border border-white/10">{{ deck.slides.length }} pages</span>
          </div>

          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-1.5">
              <h4 class="text-sm font-semibold text-highlighted truncate">{{ deck.title }}</h4>
              <UBadge v-if="isAiDeck(deck.key)" color="primary" variant="solid" size="xs" class="shrink-0">AI</UBadge>
            </div>
            <p class="text-[11px] leading-relaxed text-muted line-clamp-2">{{ deck.description }}</p>
            <div class="flex flex-wrap gap-1 pt-1">
              <span v-for="s in deck.slides.slice(0, 4)" :key="s.templateKey" class="text-[9px] px-1 py-0.5 rounded bg-accented text-toned">{{ s.templateKey }}</span>
              <span v-if="deck.slides.length > 4" class="text-[9px] px-1 text-muted">+{{ deck.slides.length - 4 }}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 px-3 pb-3">
          <div class="flex items-center gap-1">
            <span class="h-3 w-3 rounded-full border border-white/20" :style="{ background: deck.palette.bg }" />
            <span class="h-3 w-3 rounded-full border border-white/20" :style="{ background: deck.palette.accent }" />
            <span class="h-3 w-3 rounded-full border border-white/20" :style="{ background: deck.palette.text }" />
          </div>
          <div class="flex items-center gap-1">
            <UButton
              v-if="isAiDeck(deck.key)"
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-trash-2"
              :aria-label="`Delete ${deck.title}`"
              :data-testid="`btn-delete-deck-${deck.key}`"
              @click="() => handleRemoveAi(deck.key)"
            />
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="i-lucide-sparkles"
              :label="t('templates.useDeck')"
              :data-testid="`btn-use-deck-${deck.key}`"
              @click="() => handleApply(deck.key, deck.title)"
            />
          </div>
        </div>
      </article>
    </div>

    <UModal v-model:open="isConfirmOpen" :title="t('templates.confirmTitle')" :description="pendingDeck ? t('templates.confirmReplace', { title: pendingDeck.title }) : undefined">
      <template #body>
        <div class="space-y-3">
          <UAlert color="warning" variant="subtle" icon="i-lucide-triangle-alert" :title="t('templates.confirmHint')" />
          <p class="text-sm text-muted">{{ t('templates.confirmBody') }}</p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" :label="t('templates.cancel')" data-testid="btn-cancel-deck" @click="() => pendingDeck = null" />
          <UButton color="primary" :label="t('templates.confirm')" data-testid="btn-confirm-deck" @click="confirmApply" />
        </div>
      </template>
    </UModal>
  </section>
</template>
