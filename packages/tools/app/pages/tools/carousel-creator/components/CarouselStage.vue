<script lang="ts" setup>
import { useCarouselDeck } from '../composables/useCarouselDeck'

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
const fileInput = ref<HTMLInputElement | null>(null)

const { currentSlide, updateSlideData, setBgImage, updateBgTransform, resetBgTransform, setGalleryImage } = useCarouselDeck()

let observer: ResizeObserver | null = null

function computeScale(): void {
  if (!wrap.value) return
  scale.value = Math.min(wrap.value.clientWidth / stageWidth.value, 1)
}

onMounted(() => {
  observer = new ResizeObserver(computeScale)
  if (wrap.value) observer.observe(wrap.value)
  computeScale()
})

watch([stageWidth, stageHeight], () => nextTick(computeScale))

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

// ── Text editing ──
const showTextEditor = ref(false)
const editingField = ref<string | null>(null)
const textEditValue = ref('')
const editingItemsValue = ref('')

const editableFields = computed(() => {
  const d = currentSlide.value.data
  const t = currentSlide.value.templateKey
  const fields: Array<{ key: string, label: string, value: string, placeholder: string }> = []
  if (['title-kicker', 'tips-list', 'full-photo', 'feature-highlight', 'number-hero', 'image-focus', 'split-band'].includes(t) || d.kicker !== undefined) {
    fields.push({ key: 'kicker', label: 'Kicker', value: d.kicker ?? '', placeholder: 'Kicker' })
  }
  fields.push({ key: 'headline', label: 'Headline', value: d.headline, placeholder: 'Headline' })
  if (['title-kicker', 'qa', 'cta', 'stat-highlight', 'photo-left', 'full-photo', 'number-hero', 'image-focus', 'split-band', 'feature-highlight'].includes(t) || d.body !== undefined) {
    fields.push({ key: 'body', label: 'Body', value: d.body ?? '', placeholder: 'Body text' })
  }
  if (['tips-list', 'steps', 'checklist', 'comparison', 'stat-cards', 'feature-highlight', 'timeline', 'number-hero'].includes(t) || (d.items && d.items.length)) {
    fields.push({ key: 'items', label: 'Items (one per line)', value: (d.items ?? []).join('\n'), placeholder: 'One per line' })
  }
  if (t === 'quote' || t === 'testimonial' || d.quote !== undefined) {
    fields.push({ key: 'quote', label: 'Quote', value: d.quote ?? '', placeholder: 'Quote' })
    fields.push({ key: 'author', label: 'Author', value: d.author ?? '', placeholder: 'Author' })
  }
  if (t === 'stat-highlight' || d.stat !== undefined) {
    fields.push({ key: 'stat', label: 'Big number', value: d.stat ?? '', placeholder: '87%' })
    fields.push({ key: 'statLabel', label: 'Stat label', value: d.statLabel ?? '', placeholder: 'Stat label' })
  }
  if (t === 'cta' || d.cta !== undefined) {
    fields.push({ key: 'cta', label: 'Button text', value: d.cta ?? '', placeholder: 'CTA' })
  }
  return fields
})

function openTextEditor(preferKey?: string): void {
  if (!props.editable) return
  // Prefer the clicked field if valid, else headline
  const keys = editableFields.value.map(f => f.key)
  const target = preferKey && keys.includes(preferKey) ? preferKey : (keys.includes('headline') ? 'headline' : keys[0] ?? 'headline')
  editingField.value = target
  const field = editableFields.value.find(f => f.key === target)
  textEditValue.value = field?.value ?? ''
  if (target === 'items') editingItemsValue.value = field?.value ?? ''
  showTextEditor.value = true
}

function inferFieldFromTarget(target: HTMLElement): string | undefined {
  // Check data-field attribute first
  const withField = target.closest('[data-field]') as HTMLElement | null
  if (withField) return withField.getAttribute('data-field') ?? undefined
  // Fallback: check text content vs slide data
  const txt = target.textContent?.trim() ?? ''
  const d = currentSlide.value.data
  if (txt && d.headline && txt.includes(d.headline.slice(0, Math.min(12, d.headline.length)))) return 'headline'
  if (txt && d.body && txt.includes(d.body.slice(0, Math.min(12, d.body.length)))) return 'body'
  if (txt && d.kicker && txt.includes(d.kicker.slice(0, 8))) return 'kicker'
  if (txt && d.quote && txt.includes(d.quote.slice(0, 12))) return 'quote'
  if (txt && d.cta && txt.includes(d.cta.slice(0, 6))) return 'cta'
  return undefined
}

function saveTextEdit(): void {
  const key = editingField.value
  if (!key) { showTextEditor.value = false; return }
  if (key === 'items') {
    const items = textEditValue.value.split('\n').map(s => s.trim()).filter(Boolean)
    updateSlideData({ items })
  } else {
    updateSlideData({ [key]: textEditValue.value } as any)
  }
  showTextEditor.value = false
}

// ── Image handling ──
let pendingImageSlot: string | null = null
const showImageControls = ref(false)

const hasBgImage = computed(() => !!currentSlide.value.bgImage?.url)
const bgTransform = computed(() => currentSlide.value.bgImage?.transform ?? { x: 0, y: 0, scale: 1 })

function handleStageClick(e: MouseEvent): void {
  if (!props.editable) return
  if (didDrag) {
    didDrag = false
    return
  }
  const target = e.target as HTMLElement
  // Image slot detection
  const slotEl = target.closest('[data-image-slot]') as HTMLElement | null
  if (slotEl) {
    const slot = slotEl.getAttribute('data-image-slot')!
    handleImageSlotClick(slot)
    e.stopPropagation()
    return
  }
  const imgEl = target.closest('[data-image]') as HTMLElement | null
  if (imgEl) {
    const slot = imgEl.getAttribute('data-image')!
    handleImageSlotClick(slot)
    e.stopPropagation()
    return
  }
  const emptyEl = target.closest('[data-image-empty]') as HTMLElement | null
  if (emptyEl) {
    const slot = emptyEl.getAttribute('data-image-empty')!
    handleImageSlotClick(slot)
    e.stopPropagation()
    return
  }
  // Text editing
  const field = inferFieldFromTarget(target)
  // If click was on guide or outside, still open generic editor
  openTextEditor(field)
}

function handleImageSlotClick(slot: string): void {
  pendingImageSlot = slot
  if (slot === 'bg') {
    if (!hasBgImage.value) {
      fileInput.value?.click()
    } else {
      showImageControls.value = true
    }
  } else if (slot.startsWith('grid-')) {
    const idx = parseInt(slot.split('-')[1] ?? '0', 10)
    const url = currentSlide.value.data.images?.[idx]
    if (!url) {
      fileInput.value?.click()
    } else {
      // For now, also allow re-upload
      fileInput.value?.click()
    }
  } else if (['polaroid', 'focus', 'testimonial'].includes(slot)) {
    const hasImg = !!currentSlide.value.data.images?.[0]
    if (!hasImg && slot !== 'bg') {
      fileInput.value?.click()
    } else if (hasBgImage.value && slot === 'polaroid') {
      // polaroid uses first gallery image, allow replace
      fileInput.value?.click()
    } else {
      fileInput.value?.click()
    }
  } else {
    fileInput.value?.click()
  }
}

function onFileChange(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  const slot = pendingImageSlot ?? 'bg'
  if (slot === 'bg') {
    setBgImage(url)
    showImageControls.value = true
  } else if (slot.startsWith('grid-')) {
    const idx = parseInt(slot.split('-')[1] ?? '0', 10)
    setGalleryImage(idx, url)
  } else if (slot === 'polaroid' || slot === 'focus' || slot === 'testimonial') {
    setGalleryImage(0, url)
    // also set bg for templates that use bgImage fallback (polaroid uses bg.url as fallback)
    if (!hasBgImage.value) setBgImage(url)
  } else {
    // fallback to bg
    setBgImage(url)
  }
  // reset input
  input.value = ''
  pendingImageSlot = null
}

// ── Image pan / zoom ──
let isDragging = false
let didDrag = false
let dragStartX = 0
let dragStartY = 0
let startTx = 0
let startTy = 0

function onPointerDown(e: PointerEvent): void {
  if (!props.editable || !hasBgImage.value) return
  const target = e.target as HTMLElement
  // Only drag when clicking image slot area
  const slotEl = target.closest('[data-image-slot="bg"]') ?? target.closest('[data-image="bg"]')
  if (!slotEl) return
  isDragging = true
  didDrag = false
  dragStartX = e.clientX
  dragStartY = e.clientY
  startTx = bgTransform.value.x
  startTy = bgTransform.value.y
    ; (e.target as HTMLElement).setPointerCapture(e.pointerId)
  e.preventDefault()
}

function onPointerMove(e: PointerEvent): void {
  if (!isDragging || !hasBgImage.value) return
  const dx = (e.clientX - dragStartX) / scale.value
  const dy = (e.clientY - dragStartY) / scale.value
  if (Math.abs(e.clientX - dragStartX) > 3 || Math.abs(e.clientY - dragStartY) > 3) {
    didDrag = true
  }
  updateBgTransform({ x: startTx + dx, y: startTy + dy })
}

function onPointerUp(e: PointerEvent): void {
  if (!isDragging) return
  isDragging = false
  try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch { }
}

function onWheel(e: WheelEvent): void {
  if (!props.editable || !hasBgImage.value) return
  const target = e.target as HTMLElement
  const slotEl = target.closest('[data-image-slot="bg"]') ?? target.closest('[data-image="bg"]')
  if (!slotEl) return
  e.preventDefault()
  const cur = bgTransform.value.scale
  const delta = e.deltaY < 0 ? 0.08 : -0.08
  const next = Math.min(3, Math.max(0.5, +(cur + delta).toFixed(2)))
  updateBgTransform({ scale: next })
}

const zoomPercent = computed({
  get: () => Math.round(bgTransform.value.scale * 100),
  set: (v: number) => updateBgTransform({ scale: Math.min(3, Math.max(0.5, v / 100)) }),
})

function handleZoomSlider(val: number | undefined): void {
  if (val === undefined) return
  updateBgTransform({ scale: Math.min(3, Math.max(0.5, val / 100)) })
}

function replaceBgImage(): void {
  pendingImageSlot = 'bg'
  fileInput.value?.click()
}
</script>

<template>
  <div class="w-full flex justify-center">
    <div ref="wrap" class="relative"
      :style="{ width: `min(100%, calc((100vh - 280px) * ${ratio}))`, aspectRatio: `${stageWidth} / ${stageHeight}` }">
      <div class="absolute top-0 left-0 origin-top-left"
        :style="{ transform: `scale(${scale})`, width: `${stageWidth}px`, height: `${stageHeight}px`, '--slide-fx': props.fxStyle || 'none' }">
        <div ref="stageEl" id="carousel-stage" class="relative w-full h-full overflow-hidden shadow-2xl  select-none "
          :class="editable ? 'cursor-pointer hover:ring-primary/50' : ''" v-html="html" @click="handleStageClick"
          @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp"
          @pointercancel="onPointerUp" @wheel="onWheel" />

        <div v-if="props.guides" data-testid="stage-guides" class="absolute inset-0 pointer-events-none">
          <div class="absolute inset-0 grid grid-cols-3 grid-rows-3">
            <span v-for="i in 9" :key="i" class="border border-primary-400/30" />
          </div>
          <div class="absolute border-2 border-dashed border-primary-400/50"
            style="left:80px;right:80px;top:96px;bottom:140px" />
          <div class="absolute left-1/2 top-0 bottom-0 w-px bg-primary-400/40" />
          <div class="absolute top-1/2 left-0 right-0 h-px bg-primary-400/40" />
        </div>

        <!-- Editable hint overlay -->
        <div v-if="editable"
          class="absolute top-2 left-2 pointer-events-none flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full bg-black/70 text-white backdrop-blur border border-white/10">
          <UIcon name="i-lucide-pencil" class="w-3 h-3" />
          Click text to edit · Click image to upload / drag to move · Scroll to zoom
        </div>

        <!-- Image controls when bg image exists -->
        <div v-if="editable && hasBgImage && showImageControls"
          class="absolute bottom-2 left-2 right-2 flex items-center gap-2 p-2 rounded-xl bg-black/75 backdrop-blur border border-white/10"
          data-testid="image-controls">
          <UIcon name="i-lucide-move" class="w-4 h-4 text-white/80 shrink-0" />
          <span class="text-[11px] text-white/80 shrink-0">Move & Zoom</span>
          <USlider :model-value="zoomPercent" :min="50" :max="300" :step="5" class="flex-1"
            @update:model-value="(v) => handleZoomSlider(v as number)" />
          <span class="text-[11px] font-mono text-white w-10 text-right">{{ zoomPercent }}%</span>
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-rotate-ccw" class="text-white"
            :aria-label="'Reset image position'" @click="resetBgTransform" />
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-image-plus" :aria-label="'Replace image'"
            @click="replaceBgImage" />
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" class="text-white"
            @click="showImageControls = false" />
        </div>
      </div>
    </div>

    <!-- Hidden file input -->
    <input ref="fileInput" type="file" accept="image/*" class="hidden" data-testid="stage-file-input"
      @change="onFileChange" />

    <!-- Text editor modal -->
    <UModal v-model:open="showTextEditor" :title="`Edit ${editingField ?? 'slide'}`"
      :description="'Update the content for this slide'">
      <template #body>
        <div class="space-y-3">
          <template v-for="field in editableFields" :key="field.key">
            <UFormField v-if="editingField === field.key || editableFields.length <= 4" :label="field.label" size="xs">
              <UTextarea v-if="field.key === 'body' || field.key === 'quote' || field.key === 'items'"
                :model-value="field.key === editingField ? textEditValue : field.value"
                :rows="field.key === 'items' ? 4 : 3" :placeholder="field.placeholder" class="w-full"
                :data-testid="`field-edit-${field.key}`" @update:model-value="(v: string) => {
                  if (field.key === editingField) textEditValue = v
                  else updateSlideData({ [field.key]: v } as any)
                }" />
              <UInput v-else :model-value="field.key === editingField ? textEditValue : field.value"
                :placeholder="field.placeholder" class="w-full" :data-testid="`field-edit-${field.key}`"
                @update:model-value="(v: string) => {
                  if (field.key === editingField) textEditValue = v
                  else updateSlideData({ [field.key]: v } as any)
                }" />
            </UFormField>
          </template>
          <!-- Quick switcher when many fields -->
          <div v-if="editableFields.length > 4" class="flex flex-wrap gap-1 pt-1">
            <UButton v-for="f in editableFields" :key="f.key" :variant="editingField === f.key ? 'solid' : 'soft'"
              :color="editingField === f.key ? 'primary' : 'neutral'" size="xs"
              @click="() => { editingField = f.key; const found = editableFields.find(x => x.key === f.key); textEditValue = found?.value ?? '' }">
              {{ f.label }}
            </UButton>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" label="Cancel" @click="showTextEditor = false" />
          <UButton color="primary" label="Save" data-testid="btn-save-text-edit" @click="saveTextEdit" />
        </div>
      </template>
    </UModal>
  </div>
</template>
