<script lang="ts" setup>
import { useCarouselDeck } from '../composables/useCarouselDeck'
import { findSlideTemplate } from '../slideTemplates'
import type { SlideLayer, TextLayer, HtmlLayer } from '../layers/types'

const props = defineProps<{
  html: string
  width?: number
  height?: number
  guides?: boolean
  fxStyle?: string
  editable?: boolean
}>()

const stageWidth = computed(() => props.width ?? 1080)
const stageHeight = computed(() => props.height ?? 1350)
const ratio = computed(() => stageWidth.value / stageHeight.value)

const wrap = ref<HTMLElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const scale = ref(0)

const {
  currentSlide,
  selectedLayer,
  selectedLayerId,
  selectLayer,
  updateLayer,
  updateLayerTransform,
  removeLayer,
} = useCarouselDeck()

let observer: ResizeObserver | null = null

function computeScale(): void {
  if (!wrap.value) return
  scale.value = Math.min(wrap.value.clientWidth / stageWidth.value, 1)
}

onMounted(() => {
  observer = new ResizeObserver(computeScale)
  if (wrap.value) observer.observe(wrap.value)
  computeScale()
  measureLayerHeights()
})

watch([stageWidth, stageHeight], () => nextTick(computeScale))

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  window.removeEventListener('keydown', onKeydown)
})

// ── Selection ─────────────────────────────────────────────────────────────

const measuredHeights = ref<Record<string, number>>({})

function measureLayerHeights(): void {
  if (!import.meta.client) return
  const el = document.getElementById('carousel-stage')
  if (!el) return
  const next: Record<string, number> = {}
  for (const node of el.querySelectorAll('[data-layer-id]')) {
    const id = node.getAttribute('data-layer-id')
    if (id) next[id] = node.clientHeight
  }
  measuredHeights.value = next
}

watch(() => props.html, () => nextTick(measureLayerHeights))
watch(() => selectedLayerId.value, () => nextTick(measureLayerHeights))

/** Screen-space selection chrome (unscaled so handles/labels stay legible). */
const selectionScreen = computed(() => {
  const layer = selectedLayer.value
  if (!layer) return null
  const s = scale.value
  const h = layer.transform.h ?? measuredHeights.value[layer.id] ?? 0
  return {
    layer,
    style: {
      left: `${layer.transform.x * s}px`,
      top: `${layer.transform.y * s}px`,
      width: `${layer.transform.w * s}px`,
      height: `${h * s}px`,
      transform: layer.transform.rotate ? `rotate(${layer.transform.rotate}deg)` : undefined,
    },
  }
})

function findLayerId(target: EventTarget | null): string | null {
  const el = target as HTMLElement | null
  const hit = el?.closest?.('[data-layer-id]') as HTMLElement | null
  return hit?.getAttribute('data-layer-id') ?? null
}

// ── Editor modal ──────────────────────────────────────────────────────────

type EditorMode = 'text' | 'bindings' | 'html'
const showEditor = ref(false)
const editorMode = ref<EditorMode>('text')
const editingLayerId = ref<string | null>(null)
const editorTitle = ref('Edit layer')

const textEditValue = ref('')
const htmlEditValue = ref('')
const bindingsFields = ref<Array<{ key: string, label: string, value: string, textarea: boolean }>>([])

const BINDING_META: Record<string, { label: string, textarea: boolean }> = {
  kicker: { label: 'Kicker', textarea: false },
  headline: { label: 'Headline', textarea: false },
  body: { label: 'Body', textarea: true },
  quote: { label: 'Quote', textarea: true },
  author: { label: 'Author', textarea: false },
  stat: { label: 'Big number', textarea: false },
  statLabel: { label: 'Stat label', textarea: false },
  cta: { label: 'Button text', textarea: false },
  items: { label: 'Items (one per line)', textarea: true },
  images: { label: 'Image URLs (one per line)', textarea: true },
}

function openEditor(layer: SlideLayer): void {
  if (!props.editable) return
  editingLayerId.value = layer.id
  if (layer.type === 'text') {
    editorMode.value = 'text'
    editorTitle.value = 'Edit text'
    textEditValue.value = (layer as TextLayer).content
    showEditor.value = true
  } else if (layer.type === 'html') {
    const html = layer as HtmlLayer
    if (html.bindings?.templateKey) {
      editorMode.value = 'bindings'
      editorTitle.value = 'Edit content'
      const template = findSlideTemplate(html.bindings.templateKey)
      const keys = template?.kind === 'html' ? template.bindings : []
      const data = html.bindings.data as Record<string, unknown>
      bindingsFields.value = keys.map((key) => {
        const raw = data[key]
        const value = Array.isArray(raw) ? (raw as string[]).join('\n') : typeof raw === 'string' ? raw : ''
        return { key, label: BINDING_META[key]?.label ?? key, value, textarea: BINDING_META[key]?.textarea ?? false }
      })
    } else {
      editorMode.value = 'html'
      editorTitle.value = 'Edit HTML'
      htmlEditValue.value = html.html ?? ''
    }
    showEditor.value = true
  }
}

function saveEditor(): void {
  const id = editingLayerId.value
  const layer = currentSlide.value.layers?.find(l => l.id === id)
  if (id && layer) {
    applyEditorMode(layer)
  }
  showEditor.value = false
  nextTick(measureLayerHeights)
}

function applyEditorMode(layer: SlideLayer): void {
  if (editorMode.value === 'text' && layer.type === 'text') {
    updateLayer(layer.id, { content: textEditValue.value })
    return
  }
  if (editorMode.value === 'html' && layer.type === 'html') {
    updateLayer(layer.id, { html: htmlEditValue.value })
    return
  }
  if (editorMode.value === 'bindings' && layer.type === 'html' && layer.bindings) {
    saveBindings(layer)
  }
}

function saveBindings(layer: HtmlLayer): void {
  if (!layer.bindings) return
  const data = { ...layer.bindings.data }
  for (const field of bindingsFields.value) {
    if (field.key === 'items' || field.key === 'images') {
      setListField(data, field.key, field.value)
    } else {
      data[field.key] = field.value
    }
  }
  updateLayer(layer.id, { bindings: { templateKey: layer.bindings.templateKey, data } })
}

function setListField(data: Record<string, unknown>, key: string, value: string): void {
  const list = value.split('\n').map(s => s.trim()).filter(Boolean)
  data[key] = list.length ? list : undefined
}

// ── Pointer interactions ──────────────────────────────────────────────────

type DragMode = 'move' | 'resize-nw' | 'resize-ne' | 'resize-se' | 'resize-sw' | 'rotate' | null
let dragMode: DragMode = null
let dragStartX = 0
let dragStartY = 0
let didDrag = false
let startTransform: SlideLayer['transform'] | null = null

function onStagePointerDown(e: PointerEvent): void {
  if (!props.editable) return
  const id = findLayerId(e.target)
  if (id) {
    selectLayer(id)
    startMove(e)
    return
  }
  selectLayer(null)
}

function startMove(e: PointerEvent): void {
  const layer = selectedLayer.value
  if (!layer || layer.locked) return
  dragMode = 'move'
  didDrag = false
  dragStartX = e.clientX
  dragStartY = e.clientY
  startTransform = { ...layer.transform }
  ; (e.target as HTMLElement).setPointerCapture(e.pointerId)
  e.preventDefault()
}

function startHandle(e: PointerEvent, mode: Exclude<DragMode, 'move' | null>): void {
  const layer = selectedLayer.value
  if (!layer || layer.locked) return
  e.stopPropagation()
  dragMode = mode
  didDrag = false
  dragStartX = e.clientX
  dragStartY = e.clientY
  startTransform = { ...layer.transform }
  ; (e.target as HTMLElement).setPointerCapture(e.pointerId)
  e.preventDefault()
}

function rotateVector(dx: number, dy: number, deg: number): { x: number, y: number } {
  const rad = deg * Math.PI / 180
  return { x: dx * Math.cos(rad) - dy * Math.sin(rad), y: dx * Math.sin(rad) + dy * Math.cos(rad) }
}

function onPointerMove(e: PointerEvent): void {
  if (!dragMode || !startTransform) return
  const dx = (e.clientX - dragStartX) / scale.value
  const dy = (e.clientY - dragStartY) / scale.value
  if (Math.abs(e.clientX - dragStartX) > 3 || Math.abs(e.clientY - dragStartY) > 3) didDrag = true
  const id = selectedLayerId.value
  if (!id) return

  if (dragMode === 'move') {
    updateLayerTransform(id, { x: Math.round(startTransform.x + dx), y: Math.round(startTransform.y + dy) })
    return
  }

  if (dragMode === 'rotate') {
    updateRotate(id, e)
    return
  }

  resizeLayer(id, dx, dy)
}

function updateRotate(id: string, e: PointerEvent): void {
  const t = startTransform!
  const centerX = t.x + t.w / 2
  const centerY = t.y + (t.h ?? t.w) / 2
  const px = e.clientX / scale.value
  const py = e.clientY / scale.value
  const angle = Math.atan2(py - centerY, px - centerX) * 180 / Math.PI
  updateLayerTransform(id, { rotate: Math.round(angle + 90) })
}

function resizeLayer(id: string, dx: number, dy: number): void {
  // deltas in the layer's local (unrotated) frame
  const layer = currentSlide.value.layers?.find(l => l.id === id)
  if (!layer) return
  const local = rotateVector(dx, dy, -(layer.transform.rotate ?? 0))
  const t = { ...startTransform! }
  const min = 20
  if (dragMode === 'resize-nw') resizeNW(t, local, min)
  else if (dragMode === 'resize-ne') resizeNE(t, local, min)
  else if (dragMode === 'resize-se') resizeSE(t, local, min)
  else if (dragMode === 'resize-sw') resizeSW(t, local, min)
  updateLayerTransform(id, t)
}

function resizeNW(t: SlideLayer['transform'], local: { x: number, y: number }, min: number): void {
  t.x = Math.round(t.x + local.x)
  t.y = Math.round(t.y + local.y)
  t.w = Math.max(min, Math.round(t.w - local.x))
  if (t.h !== undefined) t.h = Math.max(min, Math.round(t.h - local.y))
}

function resizeNE(t: SlideLayer['transform'], local: { x: number, y: number }, min: number): void {
  t.w = Math.max(min, Math.round(t.w + local.x))
  t.y = Math.round(t.y + local.y)
  if (t.h !== undefined) t.h = Math.max(min, Math.round(t.h - local.y))
}

function resizeSE(t: SlideLayer['transform'], local: { x: number, y: number }, min: number): void {
  t.w = Math.max(min, Math.round(t.w + local.x))
  if (t.h !== undefined) t.h = Math.max(min, Math.round(t.h + local.y))
}

function resizeSW(t: SlideLayer['transform'], local: { x: number, y: number }, min: number): void {
  t.x = Math.round(t.x + local.x)
  t.w = Math.max(min, Math.round(t.w - local.x))
  if (t.h !== undefined) t.h = Math.max(min, Math.round(t.h + local.y))
}

function onPointerUp(e: PointerEvent): void {
  if (!dragMode) return
  dragMode = null
  startTransform = null
  try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch {
    // pointer capture may already be released
  }
  nextTick(measureLayerHeights)
}

function onStageClick(e: MouseEvent): void {
  if (!props.editable) return
  if (didDrag) { didDrag = false; return }
  const id = findLayerId(e.target)
  if (!id) return
  selectLayer(id)
}

function onStageDblClick(e: MouseEvent): void {
  if (!props.editable) return
  if (didDrag) return
  const id = findLayerId(e.target)
  if (!id) return
  const layer = currentSlide.value.layers?.find(l => l.id === id)
  if (!layer) return
  selectLayer(id)
  if (layer.type === 'text' || layer.type === 'html') {
    openEditor(layer)
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (!props.editable || !selectedLayerId.value) return
  if (isTypingTarget(e.target)) return
  if (e.key === 'Escape') {
    selectLayer(null)
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelectedLayer(e)
  } else if (e.key.startsWith('Arrow')) {
    handleArrowKey(e)
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

function deleteSelectedLayer(e: KeyboardEvent): void {
  e.preventDefault()
  const layer = selectedLayer.value
  if (layer && !layer.locked) removeLayer(layer.id)
}

function handleArrowKey(e: KeyboardEvent): void {
  e.preventDefault()
  const layer = selectedLayer.value
  if (!layer || layer.locked) return
  const step = e.shiftKey ? 10 : 1
  const patch: Partial<SlideLayer['transform']> = {}
  if (e.key === 'ArrowLeft') patch.x = layer.transform.x - step
  if (e.key === 'ArrowRight') patch.x = layer.transform.x + step
  if (e.key === 'ArrowUp') patch.y = layer.transform.y - step
  if (e.key === 'ArrowDown') patch.y = layer.transform.y + step
  updateLayerTransform(layer.id, patch)
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

// ── Layer name for the hint chip ──────────────────────────────────────────

const selectedName = computed(() => selectedLayer.value?.name ?? '')

const layerTypeIcon: Record<string, string> = {
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
</script>

<template>
  <div class="w-full flex justify-center">
    <div ref="wrap" class="relative"
      :style="{ width: `min(100%, calc((100vh - 280px) * ${ratio}))`, aspectRatio: `${stageWidth} / ${stageHeight}` }"
      @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp">
      <div class="absolute top-0 left-0 origin-top-left"
        :style="{ transform: `scale(${scale})`, width: `${stageWidth}px`, height: `${stageHeight}px`, '--slide-fx': props.fxStyle || 'none' }">
        <div ref="stageEl" id="carousel-stage" class="relative w-full h-full overflow-hidden shadow-2xl select-none"
          :class="editable ? 'cursor-default' : ''" v-html="html" @pointerdown="onStagePointerDown"
          @click="onStageClick" @dblclick="onStageDblClick" />
        <div v-if="props.guides" data-testid="stage-guides" class="absolute inset-0 pointer-events-none">
          <div class="absolute inset-0 grid grid-cols-3 grid-rows-3">
            <span v-for="i in 9" :key="i" class="border border-primary-400/30" />
          </div>
          <div class="absolute border-2 border-dashed border-primary-400/50"
            style="left:80px;right:80px;top:96px;bottom:140px" />
          <div class="absolute left-1/2 top-0 bottom-0 w-px bg-primary-400/40" />
          <div class="absolute top-1/2 left-0 right-0 h-px bg-primary-400/40" />
        </div>
      </div>

      <!-- Screen-space selection chrome (clipped to the slide bounds) -->
      <div class="absolute inset-0 pointer-events-none overflow-hidden" :style="{ borderRadius: '4px' }">
        <div v-if="selectionScreen && editable && !showEditor" :style="selectionScreen.style"
          class="absolute pointer-events-none" data-testid="layer-selection">
          <div class="absolute inset-0 ring-2 ring-primary/80" />
          <span v-if="selectedName"
            class="absolute -top-6 left-0 flex items-center gap-1 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground whitespace-nowrap">
            <UIcon :name="layerTypeIcon[selectionScreen.layer.type] ?? 'i-lucide-box'" class="size-3" />
            {{ selectedName }}
          </span>
          <!-- Resize handles -->
          <button v-for="h in ['nw', 'ne', 'se', 'sw']" :key="h"
            class="absolute size-2.5 rounded-sm bg-primary border border-white pointer-events-auto cursor-nwse-resize"
            :class="{
              'top-0 left-0 -translate-x-1/2 -translate-y-1/2': h === 'nw',
              'top-0 right-0 translate-x-1/2 -translate-y-1/2': h === 'ne',
              'bottom-0 right-0 translate-x-1/2 translate-y-1/2': h === 'se',
              'bottom-0 left-0 -translate-x-1/2 translate-y-1/2': h === 'sw',
            }"
            :data-testid="`handle-${h}`" :aria-label="`Resize ${h}`"
            @pointerdown.stop="(e: PointerEvent) => startHandle(e, `resize-${h}` as any)" />
          <!-- Rotate handle -->
          <button
            class="absolute -top-8 left-1/2 -translate-x-1/2 flex size-6 items-center justify-center rounded-full bg-primary border border-white pointer-events-auto"
            data-testid="handle-rotate" :aria-label="'Rotate'"
            @pointerdown.stop="(e: PointerEvent) => startHandle(e, 'rotate')">
            <UIcon name="i-lucide-rotate-cw" class="size-3 text-primary-foreground" />
          </button>
          <div class="absolute -top-6 left-1/2 h-6 w-px bg-primary" />
        </div>
      </div>

      <!-- Screen-space helper pill -->
      <div v-if="editable"
        class="absolute top-2 left-2 z-10 pointer-events-none flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full bg-black/70 text-white backdrop-blur border border-white/10">
        <UIcon name="i-lucide-mouse-pointer-2" class="w-3 h-3" />
        Click a layer to select · Drag to move · Handles to resize · Double-click text to edit
      </div>
    </div>

    <!-- Layer editor modal -->
    <UModal v-model:open="showEditor" :title="editorTitle" :ui="{ overlay: 'bg-black/60' }">
      <template #body>
        <div class="space-y-3">
          <template v-if="editorMode === 'text'">
            <UFormField label="Text" size="xs">
              <UTextarea :model-value="textEditValue" :rows="5" class="w-full" data-testid="layer-text-editor"
                @update:model-value="(v: string) => textEditValue = v" />
            </UFormField>
          </template>

          <template v-else-if="editorMode === 'bindings'">
            <template v-for="field in bindingsFields" :key="field.key">
              <UFormField :label="field.label" size="xs">
                <UTextarea v-if="field.textarea" :model-value="field.value" :rows="field.key === 'items' ? 4 : 3"
                  class="w-full" :data-testid="`bindings-${field.key}`" @update:model-value="(v: string) => field.value = v" />
                <UInput v-else :model-value="field.value" class="w-full" :data-testid="`bindings-${field.key}`"
                  @update:model-value="(v: string) => field.value = v" />
              </UFormField>
            </template>
          </template>

          <template v-else-if="editorMode === 'html'">
            <UFormField label="HTML" size="xs">
              <UTextarea :model-value="htmlEditValue" :rows="10" class="w-full font-mono text-xs"
                data-testid="layer-html-editor" @update:model-value="(v: string) => htmlEditValue = v" />
            </UFormField>
          </template>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" label="Cancel" @click="showEditor = false" />
          <UButton color="primary" label="Save" data-testid="btn-save-layer-edit" @click="saveEditor" />
        </div>
      </template>
    </UModal>
  </div>
</template>