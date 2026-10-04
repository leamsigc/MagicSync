<i18n src="#site/app/pages/tools/carousel-creator/carousel-creator.json"></i18n>
<script lang="ts" setup>
import { useCarouselDeck } from '#layers/BaseUI/app/utils/composables/useCarouselDeck'
import type { SlideLayer } from '#layers/BaseUI/app/utils/layers/types'

const {
  selectedLayerId,
  selectLayer,
  addLayer,
  removeLayer,
  duplicateLayer,
  moveLayer,
  reorderLayer,
  updateLayer,
  currentLayers,
} = useCarouselDeck()

const { t } = useI18n()

const TYPE_ICONS: Record<SlideLayer['type'], string> = {
  background: 'i-lucide-wallpaper',
  text: 'i-lucide-type',
  image: 'i-lucide-image',
  shape: 'i-lucide-square',
  html: 'i-lucide-code-2',
  pattern: 'i-lucide-grid-3x3',
  overlay: 'i-lucide-layers',
  frame: 'i-lucide-frame',
  effect: 'i-lucide-wand-2',
}

const TYPE_LABELS: Record<SlideLayer['type'], string> = {
  background: 'Background',
  text: 'Text',
  image: 'Image',
  shape: 'Shape',
  html: 'HTML',
  pattern: 'Pattern',
  overlay: 'Overlay',
  frame: 'Frame',
  effect: 'Effect',
}

const visibleLayers = computed(() => [...currentLayers()].reverse())

// ── Drag reorder ──────────────────────────────────────────────────────────

const dragLayerId = ref<string | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart(e: DragEvent, layer: SlideLayer): void {
  dragLayerId.value = layer.id
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e: DragEvent, index: number): void {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverIndex.value = index
}

function onDrop(e: DragEvent, index: number): void {
  e.preventDefault()
  const id = dragLayerId.value
  dragLayerId.value = null
  dragOverIndex.value = null
  if (!id) return
  // index is in the reversed (top-first) list → map back to array order
  const arrayIndex = visibleLayers.value.length - 1 - index
  reorderLayer(id, arrayIndex)
}

function onDragEnd(): void {
  dragLayerId.value = null
  dragOverIndex.value = null
}

function handleAddText(): void {
  addLayer()
}

function selectFromPanel(layer: SlideLayer): void {
  selectLayer(layer.id)
}
</script>

<template>
  <section class="space-y-3" data-testid="layers-panel" :aria-label="'Layers'">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('layers.title') }}</p>
      <UButton size="xs" color="primary" variant="soft" icon="i-lucide-plus" :label="t('layers.addText')"
        data-testid="btn-add-layer" @click="handleAddText" />
    </div>
    <p class="text-[11px] text-muted leading-relaxed">{{ t('layers.hint') }}</p>

    <ol class="space-y-1" data-testid="layer-list">
      <li v-for="(layer, index) in visibleLayers" :key="layer.id" :data-layer-row="layer.id"
        :data-active="selectedLayerId === layer.id" draggable="true"
        class="group flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors cursor-pointer"
        :class="selectedLayerId === layer.id ? 'border-primary bg-primary/10' : 'border-default bg-muted hover:border-primary/40'"
        @dragstart="(e: DragEvent) => onDragStart(e, layer)" @dragover="(e: DragEvent) => onDragOver(e, index)"
        @drop="(e: DragEvent) => onDrop(e, index)" @dragend="onDragEnd" @click="() => selectFromPanel(layer)">
        <UIcon name="i-lucide-grip-vertical" class="size-3.5 shrink-0 text-muted opacity-60" />
        <UIcon :name="TYPE_ICONS[layer.type]" class="size-4 shrink-0 text-muted" />
        <span class="min-w-0 flex-1 truncate text-xs font-medium text-highlighted">
          {{ layer.name || TYPE_LABELS[layer.type] }}
        </span>
        <button type="button" class="shrink-0 rounded p-0.5 text-muted hover:text-highlighted"
          :aria-label="layer.visible ? 'Hide layer' : 'Show layer'" :data-testid="`btn-layer-vis-${layer.id}`"
          @click.stop="() => updateLayer(layer.id, { visible: !layer.visible })">
          <UIcon :name="layer.visible ? 'i-lucide-eye' : 'i-lucide-eye-off'" class="size-3.5" />
        </button>
        <button type="button" class="shrink-0 rounded p-0.5 text-muted hover:text-highlighted"
          :aria-label="layer.locked ? 'Unlock layer' : 'Lock layer'" :data-testid="`btn-layer-lock-${layer.id}`"
          @click.stop="() => updateLayer(layer.id, { locked: !layer.locked })">
          <UIcon :name="layer.locked ? 'i-lucide-lock' : 'i-lucide-unlock'" class="size-3.5" />
        </button>
        <div class="hidden group-hover:flex items-center gap-0.5">
          <UButton size="2xs" variant="ghost" color="neutral" icon="i-lucide-copy" :aria-label="t('slide.duplicate')"
            :data-testid="`btn-layer-dup-${layer.id}`" @click.stop="() => duplicateLayer(layer.id)" />
          <UButton size="2xs" variant="ghost" color="neutral" icon="i-lucide-trash-2"
            :aria-label="t('slide.delete')" :data-testid="`btn-layer-del-${layer.id}`"
            @click.stop="() => removeLayer(layer.id)" />
        </div>
      </li>
      <li v-if="dragOverIndex !== null && dragOverIndex === visibleLayers.length - 1"
        class="h-1.5 rounded bg-primary/50" />
    </ol>

    <div class="flex items-center gap-1">
      <UButton v-if="selectedLayerId" size="xs" variant="ghost" color="neutral" icon="i-lucide-arrow-up"
        :label="t('layers.bringForward')" data-testid="btn-layer-forward"
        @click="() => { const l = currentLayers().find(x => x.id === selectedLayerId); if (l) moveLayer(l.id, 1) }" />
      <UButton v-if="selectedLayerId" size="xs" variant="ghost" color="neutral" icon="i-lucide-arrow-down"
        :label="t('layers.sendBack')" data-testid="btn-layer-back"
        @click="() => { const l = currentLayers().find(x => x.id === selectedLayerId); if (l) moveLayer(l.id, -1) }" />
      <span v-if="selectedLayerId" class="ml-auto text-[10px] text-muted">{{ t('layers.zHint') }}</span>
    </div>
  </section>
</template>